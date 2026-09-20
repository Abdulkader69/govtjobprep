import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  onAuthStateChanged,
  RecaptchaVerifier,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { firebase } from "./firebase.js";
import { fail, fromFirebaseError } from "./auth.messages.js";
import { normalizePhone } from "@/lib/access.js";
import { classify, loginEmailFor, phoneFromEmail, realEmail } from "@/lib/identity.js";
import { clearFullBank } from "@/lib/bank.js";

/**
 * Firebase Auth for identity, Firestore for "which device is signed in".
 *
 * Firebase happily keeps one account signed in on any number of devices. The
 * one-device rule is ours: `sessions/{uid}` holds a single `deviceId`. A login
 * writes this device's id there; every signed-in tab watches the document in
 * real time, and the moment the id is not its own it signs itself out. Under
 * the `block` policy a login checks the document first and refuses if another
 * device holds it.
 *
 * `users/{uid}` is the profile — name, phone, email, and two admin-only
 * fields (see firestore.rules): `plan` (`"full"` unlocks the whole bank)
 * and `disabled`.
 *
 * Super admins are the documents in `admins/{uid}`, created from the Firebase
 * console. The admin page uses `admin.*` below; the rules are what actually
 * stop a non-admin calling the same functions.
 */

const DEVICE_KEY = "bdje.device";
const POLICY = import.meta.env?.VITE_SESSION_POLICY === "block" ? "block" : "replace";
const SESSION_TTL_MS = (Number(import.meta.env?.VITE_SESSION_TTL_DAYS) || 30) * 24 * 60 * 60 * 1000;
const RECAPTCHA_ID = "recaptcha-anchor";
// Phone OTP needs the Blaze plan on Firebase. Off until someone turns it on.
const PHONE_LOGIN = import.meta.env?.VITE_PHONE_LOGIN === "true";

/** A random id this browser keeps for good; it is what "this device" means. */
function deviceId() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    // No storage: this tab is a device of its own, until it closes.
    return (deviceId.volatile ??= crypto.randomUUID());
  }
}

function e164(phoneInput) {
  const phone = normalizePhone(phoneInput);
  if (phone.length !== 11) return null;
  return `+88${phone}`;
}

function shape(fbUser, profile, isAdmin) {
  const phone = fbUser.phoneNumber
    ? normalizePhone(fbUser.phoneNumber)
    : profile?.phone ?? phoneFromEmail(fbUser.email);
  return {
    uid: fbUser.uid,
    phone,
    phoneVerified: Boolean(fbUser.phoneNumber),
    email: realEmail(fbUser.email) ?? profile?.email ?? null,
    name: fbUser.displayName ?? profile?.name ?? null,
    plan: profile?.plan ?? "guest",
    isAdmin: Boolean(isAdmin),
    // Only an admin-granted plan (or being an admin) opens the full bank.
    unlocked: profile?.plan === "full" || Boolean(isAdmin),
  };
}

export function createFirebaseAuth() {
  const { auth, db } = firebase();
  const me = deviceId();
  const sessionRef = (uid) => doc(db, "sessions", uid);
  const userRef = (uid) => doc(db, "users", uid);
  const adminRef = (uid) => doc(db, "admins", uid);

  let listeners = new Set();
  let state = { user: null, ready: false, kicked: null };
  let stopSession = null;
  let stopProfile = null;
  let stopAdmin = null;
  let profile = null;
  let isAdmin = false;
  let fbUser = null;
  // Set by the login flows so the auth-state handler claims the device before
  // it starts watching the session doc — otherwise the old device's id would
  // arrive first and this tab would kick itself.
  let pendingClaim = false;
  // Resolves the in-flight login once the claim has settled (see awaitClaim).
  let loginOutcome = null;

  function emit(patch) {
    state = { ...state, ...patch };
    for (const cb of listeners) cb(state);
  }

  function publishUser() {
    emit({ user: fbUser ? shape(fbUser, profile, isAdmin) : null });
  }

  function stopWatching() {
    stopSession?.();
    stopProfile?.();
    stopAdmin?.();
    stopSession = stopProfile = stopAdmin = null;
    profile = null;
    isAdmin = false;
  }

  /** Make sure users/{uid} exists, so the admin page lists phone-OTP sign-ups too. */
  async function ensureProfile(user) {
    const snap = await getDoc(userRef(user.uid));
    if (snap.exists()) return;
    await setDoc(userRef(user.uid), {
      name: user.displayName ?? null,
      email: realEmail(user.email),
      phone: user.phoneNumber ? normalizePhone(user.phoneNumber) : phoneFromEmail(user.email),
      createdAt: serverTimestamp(),
    });
  }

  function leave(code) {
    stopWatching();
    clearFullBank();
    signOut(auth).finally(() => emit({ kicked: fail(code) }));
  }

  async function claim(uid) {
    const ref = sessionRef(uid);
    if (POLICY === "block") {
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : null;
      const since = data?.since?.toMillis?.() ?? 0;
      const fresh = Date.now() - since < SESSION_TTL_MS;
      if (data && data.deviceId !== me && fresh) {
        return fail("DEVICE_BUSY", { device: data.device, since });
      }
    }
    await setDoc(ref, {
      deviceId: me,
      device: String(navigator.userAgent).slice(0, 200),
      since: serverTimestamp(),
    });
    return { ok: true };
  }

  /**
   * Start the three listeners. Resolves once the admin check has answered,
   * so nobody sees `isAdmin: false` for an admin during the first paint —
   * the admin page would bounce them home.
   */
  function watch(uid) {
    stopWatching();
    let settle;
    const adminKnown = new Promise((r) => (settle = r));
    stopSession = onSnapshot(
      sessionRef(uid),
      (snap) => {
        // A cached snapshot says what this device last saw, not what is
        // true now. Never sign out on it — an offline reload would look like
        // a missing session.
        if (snap.metadata.fromCache) return;
        const holder = snap.exists() ? snap.data().deviceId : null;
        if (holder === me) return;
        // Someone else holds this account (or nobody does — an admin may
        // have forced us out). Leave quietly; the auth-state handler clears `user`.
        leave(holder ? "SESSION_REPLACED" : "NO_SESSION");
      },
      () => {
        // Permission or network trouble. Do nothing: being unable to ask is
        // not the same as being told no.
      }
    );
    stopProfile = onSnapshot(
      userRef(uid),
      (snap) => {
        profile = snap.exists() ? snap.data() : null;
        if (profile?.disabled === true && !snap.metadata.fromCache) return leave("USER_DISABLED");
        publishUser();
      },
      () => {
        profile = null;
        publishUser();
      }
    );
    stopAdmin = onSnapshot(
      adminRef(uid),
      (snap) => {
        isAdmin = snap.exists();
        publishUser();
        settle();
      },
      () => {
        isAdmin = false;
        publishUser();
        settle();
      }
    );
    // Offline, the listener may never answer; don't hold the login hostage.
    return Promise.race([adminKnown, new Promise((r) => setTimeout(r, 4000))]);
  }

  onAuthStateChanged(auth, async (next) => {
    fbUser = next;
    if (!next) {
      stopWatching();
      publishUser();
      emit({ ready: true });
      return;
    }
    if (pendingClaim) {
      pendingClaim = false;
      let result;
      try {
        result = await claim(next.uid);
      } catch (err) {
        // Usually firestore.rules not published yet. Say so rather than hang.
        result = fromFirebaseError(err);
      }
      if (!result.ok) {
        // `block` refused us. Undo the Firebase sign-in so the tab is clean.
        await signOut(auth);
        emit({ kicked: null, ready: true });
        loginOutcome?.(result);
        return;
      }
    }
    try {
      await ensureProfile(next);
    } catch {
      // Rules not published, or offline. The profile listener copes either way.
    }
    await watch(next.uid);
    publishUser();
    emit({ ready: true, kicked: null });
    loginOutcome?.({ ok: true });
  });

  // The login flows resolve only after the device is claimed, so a caller
  // that navigates on success never races the session watcher.
  function awaitClaim() {
    return new Promise((resolve) => {
      loginOutcome = (r) => {
        loginOutcome = null;
        resolve(r);
      };
    });
  }

  async function finishLogin(run) {
    pendingClaim = true;
    const settled = awaitClaim();
    try {
      await run();
    } catch (err) {
      pendingClaim = false;
      loginOutcome = null;
      return fromFirebaseError(err);
    }
    return settled;
  }

  let verifier = null;
  function recaptcha() {
    if (!verifier) {
      let anchor = document.getElementById(RECAPTCHA_ID);
      if (!anchor) {
        anchor = document.createElement("div");
        anchor.id = RECAPTCHA_ID;
        document.body.appendChild(anchor);
      }
      verifier = new RecaptchaVerifier(auth, anchor, { size: "invisible" });
    }
    return verifier;
  }

  return {
    mode: "firebase",
    policy: POLICY,
    phoneLogin: PHONE_LOGIN,

    subscribe(cb) {
      listeners.add(cb);
      cb(state);
      return () => listeners.delete(cb);
    },

    /** Step 1 of phone login: send the code. Resolves to `{ ok, confirm(code) }`. */
    async sendCode(phoneInput) {
      if (!PHONE_LOGIN) return fail("PHONE_UNAVAILABLE");
      const phone = e164(phoneInput);
      if (!phone) return fail("INVALID_PHONE");
      try {
        const confirmation = await signInWithPhoneNumber(auth, phone, recaptcha());
        return {
          ok: true,
          phone: normalizePhone(phone),
          confirm: (code) =>
            finishLogin(() => confirmation.confirm(String(code ?? "").replace(/\D/g, ""))),
        };
      } catch (err) {
        verifier?.clear?.();
        verifier = null;
        return fromFirebaseError(err);
      }
    },

    /**
     * `via` says which field is the identity — the one the person will log
     * in with. "email" gets password-reset links; "phone" is created under a
     * synthetic address (see lib/identity.js) and cannot. The other field is
     * optional profile info.
     */
    async register({ name, via, email = "", phone = "", password }) {
      const trimmed = String(name ?? "").trim();
      if (!trimmed) return fail("UNKNOWN", { message: "আপনার নাম লিখুন।" });
      const e = classify(email);
      const p = classify(phone);
      if (via === "email" ? e.kind !== "email" : e.kind === "invalid") return fail("INVALID_EMAIL");
      if (via === "phone" ? p.kind !== "phone" : p.kind === "invalid") return fail("INVALID_PHONE");
      if (via !== "email" && via !== "phone") return fail("INVALID_IDENTIFIER");
      const identity = via === "email" ? e.email : loginEmailFor(p.phone);
      const result = await finishLogin(async () => {
        const cred = await createUserWithEmailAndPassword(auth, identity, password);
        await updateProfile(cred.user, { displayName: trimmed });
        await setDoc(userRef(cred.user.uid), {
          name: trimmed,
          email: e.kind === "email" ? e.email : null,
          phone: p.kind === "phone" ? p.phone : null,
          createdAt: serverTimestamp(),
        });
      });
      return result.code === "EMAIL_IN_USE" && via === "phone" ? fail("PHONE_IN_USE") : result;
    },

    /**
     * Google. One button does both registration and login: the first sign-in
     * creates the account, ensureProfile() fills the profile from the Google
     * name and email. A popup, not a redirect — the redirect flow breaks on
     * browsers that partition third-party storage (Safari, and Chrome soon).
     */
    async loginWithGoogle() {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const result = await finishLogin(() => signInWithPopup(auth, provider));
      if (!result.ok && result.detail === "auth/operation-not-allowed") return fail("GOOGLE_UNAVAILABLE");
      return result;
    },

    /** `identifier` is a phone number, or an email for accounts that have one. */
    login(identifier, password) {
      const email = loginEmailFor(identifier);
      if (!email) return Promise.resolve(fail("INVALID_IDENTIFIER"));
      return finishLogin(() => signInWithEmailAndPassword(auth, email, password));
    },

    /** Only possible for accounts whose Firebase identity is a real address. */
    async resetPassword(identifier) {
      const id = classify(identifier);
      if (id.kind === "phone") return fail("NO_RESET_FOR_PHONE");
      if (id.kind !== "email") return fail("INVALID_IDENTIFIER");
      try {
        await sendPasswordResetEmail(auth, id.email);
        return { ok: true };
      } catch (err) {
        return fromFirebaseError(err);
      }
    },

    async updateName(name) {
      if (!fbUser) return fail("NO_SESSION");
      const trimmed = String(name ?? "").trim();
      try {
        await updateProfile(fbUser, { displayName: trimmed });
        await setDoc(userRef(fbUser.uid), { name: trimmed }, { merge: true });
        publishUser();
        return { ok: true };
      } catch (err) {
        return fromFirebaseError(err);
      }
    },

    async logout() {
      const uid = fbUser?.uid;
      stopWatching();
      clearFullBank();
      try {
        if (uid) {
          // Release the number only if we are the device that holds it.
          const snap = await getDoc(sessionRef(uid));
          if (snap.exists() && snap.data().deviceId === me) await deleteDoc(sessionRef(uid));
        }
      } catch {
        // Offline: the session expires on its own, or the next login replaces it.
      }
      await signOut(auth);
      emit({ kicked: null });
      return { ok: true };
    },

    dismissKicked() {
      emit({ kicked: null });
    },

    /**
     * Super-admin operations. Every one of these is refused by firestore.rules
     * unless admins/{uid} exists for the caller, so the UI guard is cosmetic.
     */
    admin: {
      /**
       * Everything the admin page shows, in one round of reads: every
       * account with its live session attached, who the admins are, sessions
       * whose account no longer has a profile, and the bank's metadata.
       */
      async snapshot() {
        const [users, sessions, admins, bankMeta] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "sessions")),
          getDocs(collection(db, "admins")),
          getDoc(doc(db, "bank", "meta")),
        ]);
        const adminIds = new Set(admins.docs.map((d) => d.id));
        const session = (d) => ({ device: d.device ?? "", since: d.since?.toMillis?.() ?? null });
        const byUid = new Map(sessions.docs.map((d) => [d.id, session(d.data())]));
        const list = users.docs
          .map((d) => {
            const u = d.data();
            return {
              uid: d.id,
              name: u.name ?? null,
              email: u.email ?? null,
              phone: u.phone ?? null,
              plan: u.plan ?? "guest",
              disabled: u.disabled === true,
              isAdmin: adminIds.has(d.id),
              createdAt: u.createdAt?.toMillis?.() ?? null,
              session: byUid.get(d.id) ?? null,
            };
          })
          .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
        const known = new Set(users.docs.map((d) => d.id));
        const orphanSessions = sessions.docs.filter((d) => !known.has(d.id)).map((d) => ({ uid: d.id, ...session(d.data()) }));
        const meta = bankMeta.exists() ? bankMeta.data() : null;
        return {
          users: list,
          admins: [...adminIds],
          orphanSessions,
          bank: meta
            ? { version: meta.version, chunks: meta.chunks, total: meta.total_questions, generatedAt: meta.generated_at ?? null }
            : null,
        };
      },
      /** Kept for callers that only need the list. */
      async listUsers() {
        return (await this.snapshot()).users;
      },
      setName(uid, name) {
        return updateDoc(userRef(uid), { name: String(name ?? "").trim() || null });
      },
      /** Remove a profile whose Auth account was deleted in the console. */
      deleteProfile(uid) {
        return deleteDoc(userRef(uid));
      },
      setPlan(uid, plan) {
        return updateDoc(userRef(uid), { plan: plan === "full" ? "full" : "guest" });
      },
      setDisabled(uid, disabled) {
        return updateDoc(userRef(uid), { disabled: Boolean(disabled) });
      },
      /** Delete the session doc; that device's watcher signs it out within seconds. */
      signOutDevice(uid) {
        return deleteDoc(sessionRef(uid));
      },
    },
  };
}

