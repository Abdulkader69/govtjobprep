import { fail } from "./auth.messages.js";
import { classify } from "@/lib/identity.js";
import { clearFullBank } from "@/lib/bank.js";

const KEY = "bdje.user";

/**
 * No Firebase: the browser trusts itself. This is what `vite preview` and the
 * tests use, and the fallback when `VITE_FIREBASE_*` is unset. Same interface
 * as the Firebase adapter, minus anything that needs a server — no OTP, no
 * device limit (no device can see another), and every sign-in is treated as
 * a full-plan admin so the whole app can be exercised. Pair it with
 * `VITE_BANK_SOURCE=bundle`, or the full bank has nowhere to come from.
 */
export function createLocalAuth() {
  let listeners = new Set();
  let state = { user: null, ready: false, kicked: null };

  function emit(patch) {
    state = { ...state, ...patch };
    for (const cb of listeners) cb(state);
  }

  function persist(user) {
    try {
      if (user) localStorage.setItem(KEY, JSON.stringify(user));
      else localStorage.removeItem(KEY);
    } catch {
      /* private mode */
    }
    emit({ user, kicked: null });
  }

  function shape({ phone = null, email = null, name = null }) {
    return {
      uid: `local:${phone ?? email}`,
      phone,
      phoneVerified: false,
      email,
      name,
      plan: "full",
      isAdmin: true,
      unlocked: true,
    };
  }

  queueMicrotask(() => {
    let stored = null;
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) stored = JSON.parse(raw);
    } catch {
      /* signed out */
    }
    emit({ user: stored?.uid ? stored : null, ready: true });
  });

  return {
    mode: "local",
    policy: "none",
    phoneLogin: false,

    subscribe(cb) {
      listeners.add(cb);
      cb(state);
      return () => listeners.delete(cb);
    },

    async sendCode() {
      return fail("PHONE_UNAVAILABLE");
    },

    async register({ name, via, email = "", phone = "", password }) {
      if (!String(name ?? "").trim()) return fail("UNKNOWN", { message: "আপনার নাম লিখুন।" });
      const e = classify(email);
      const p = classify(phone);
      if (via === "email" ? e.kind !== "email" : e.kind === "invalid") return fail("INVALID_EMAIL");
      if (via === "phone" ? p.kind !== "phone" : p.kind === "invalid") return fail("INVALID_PHONE");
      if (via !== "email" && via !== "phone") return fail("INVALID_IDENTIFIER");
      if (String(password ?? "").length < 6) return fail("WEAK_PASSWORD");
      persist(shape({ name: name.trim(), phone: p.kind === "phone" ? p.phone : null, email: e.kind === "email" ? e.email : null }));
      return { ok: true };
    },

    async loginWithGoogle() {
      persist(shape({ name: "Google ব্যবহারকারী", email: "google@example.com" }));
      return { ok: true };
    },

    async login(identifier, password) {
      const id = classify(identifier);
      if (id.kind !== "phone" && id.kind !== "email") return fail("INVALID_IDENTIFIER");
      if (!password) return fail("WRONG_CREDENTIALS");
      persist(shape({ phone: id.phone ?? null, email: id.email ?? null, name: state.user?.name ?? null }));
      return { ok: true };
    },

    async resetPassword(identifier) {
      return classify(identifier).kind === "phone" ? fail("NO_RESET_FOR_PHONE") : { ok: true };
    },

    async updateName(name) {
      if (!state.user) return fail("NO_SESSION");
      persist({ ...state.user, name: String(name ?? "").trim() });
      return { ok: true };
    },

    async logout() {
      clearFullBank();
      persist(null);
      return { ok: true };
    },

    dismissKicked() {
      emit({ kicked: null });
    },

    admin: {
      async snapshot() {
        return { users: [], admins: [], orphanSessions: [], bank: null };
      },
      async listUsers() {
        return [];
      },
      async setPlan() {},
      async setDisabled() {},
      async signOutDevice() {},
      async setName() {},
      async deleteProfile() {},
    },
  };
}
