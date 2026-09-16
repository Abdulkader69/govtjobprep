import { useCallback, useEffect, useState } from "react";
import { isAllowedPhone, normalizePhone } from "./access.js";

const KEY = "bdje.user";

/**
 * Placeholder sign-in by phone number.
 *
 * An allowed number unlocks the whole bank; everyone else sees the guest
 * subset. This is navigation and convenience, NOT security: in `local` mode the
 * whole bank and this allowlist both ship to the browser. The server owns the
 * real boundary — see docs/api-contract.md.
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setUser(JSON.parse(raw));
    } catch {
      // Private mode, or storage disabled. Treat as signed out.
    }
    setReady(true);
  }, []);

  /**
   * @returns {{ok: true, user: object} | {ok: false, reason: string}}
   */
  const signIn = useCallback((phoneInput) => {
    const phone = normalizePhone(phoneInput);
    if (phone.length !== 11) {
      return { ok: false, reason: "১১ সংখ্যার মোবাইল নম্বর দিন (যেমন ০১৭xxxxxxxx)।" };
    }
    if (!isAllowedPhone(phone)) {
      return { ok: false, reason: "এই নম্বরটি অনুমোদিত নয়।" };
    }
    const next = { phone, since: Date.now() };
    setUser(next);
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // Not fatal — the session just will not survive a reload.
    }
    return { ok: true, user: next };
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* nothing to do */
    }
  }, []);

  // A stored session is re-checked against the allowlist on load, so removing a
  // number from it takes effect without the user having to sign out.
  const unlocked = Boolean(user?.phone && isAllowedPhone(user.phone));

  return { user, unlocked, ready, signIn, signOut };
}
