import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthApi, authMode, AUTH_MESSAGES } from "@/api/auth.js";

/**
 * Sign-in state for the whole app, one account per device at a time.
 *
 * The adapter (`src/api/auth.js`) owns the mechanics — Firebase Auth for
 * identity, a Firestore `sessions/{uid}` document watched in real time for
 * the device rule. This hook just mirrors its state into React and exposes
 * the actions the pages need. `kicked` is set when another device took the
 * account; the login page shows it.
 *
 * `user` shape: `{ uid, phone, phoneVerified, email, name, plan, unlocked, isAdmin }`.
 */
export function useAuth() {
  const [state, setState] = useState({ user: null, ready: false, kicked: null });
  const [phoneLogin, setPhoneLogin] = useState(false);
  const apiRef = useRef(null);

  useEffect(() => {
    let stop = null;
    let cancelled = false;
    getAuthApi().then((api) => {
      if (cancelled) return;
      apiRef.current = api;
      setPhoneLogin(Boolean(api.phoneLogin));
      stop = api.subscribe((next) => setState(next));
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const api = useCallback(async () => apiRef.current ?? (apiRef.current = await getAuthApi()), []);

  const call = useCallback(
    async (fn) => {
      try {
        const result = await fn(await api());
        return result.ok ? result : { ...result, reason: result.message ?? AUTH_MESSAGES[result.code] };
      } catch {
        return { ok: false, code: "OFFLINE", reason: AUTH_MESSAGES.OFFLINE };
      }
    },
    [api]
  );

  return {
    user: state.user,
    unlocked: Boolean(state.user?.unlocked),
    ready: state.ready,
    kicked: state.kicked,
    mode: authMode,
    phoneLogin,

    /** Phone OTP, step 1. Returns `{ ok, confirm(code) }`; `confirm` completes sign-in. */
    sendCode: (phone) =>
      call(async (a) => {
        const r = await a.sendCode(phone);
        if (!r.ok) return r;
        return { ...r, confirm: (code) => call(() => r.confirm(code)) };
      }),
    /** `{ name, via: "email" | "phone", email?, phone?, password }` — `via` names the identity field. */
    register: (fields) => call((a) => a.register(fields)),
    /** `identifier` is a phone number (or an email, for accounts that have one). */
    login: (identifier, password) => call((a) => a.login(identifier, password)),
    /** Google popup; registers on first use. */
    loginWithGoogle: () => call((a) => a.loginWithGoogle()),
    resetPassword: (identifier) => call((a) => a.resetPassword(identifier)),
    updateName: (name) => call((a) => a.updateName(name)),
    signOut: () => call((a) => a.logout()),
    dismissKicked: () => apiRef.current?.dismissKicked(),

    /** Super-admin operations; firestore.rules refuses them for anyone else. */
    admin: {
      snapshot: async () => (await api()).admin.snapshot(),
      listUsers: async () => (await api()).admin.listUsers(),
      setName: async (uid, name) => (await api()).admin.setName(uid, name),
      deleteProfile: async (uid) => (await api()).admin.deleteProfile(uid),
      setPlan: async (uid, plan) => (await api()).admin.setPlan(uid, plan),
      setDisabled: async (uid, disabled) => (await api()).admin.setDisabled(uid, disabled),
      signOutDevice: async (uid) => (await api()).admin.signOutDevice(uid),
    },
  };
}
