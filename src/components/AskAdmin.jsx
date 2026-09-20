import { useState } from "react";
import { useLocation } from "react-router-dom";

/**
 * Floating "message the admin" button for signed-in accounts that do not
 * have full access yet. Opens the admin's Messenger thread. Hidden during an
 * exam, for premium accounts, and after the user closes it (for the session).
 *
 * The link comes from VITE_ADMIN_MESSENGER (e.g. https://m.me/yourname);
 * without it the button is not rendered at all.
 */
const LINK = import.meta.env?.VITE_ADMIN_MESSENGER ?? "";
const HIDE_KEY = "bdje.askAdmin.hidden";

export default function AskAdmin({ auth }) {
  const { pathname } = useLocation();
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!LINK || hidden || !auth.user || auth.unlocked || pathname === "/exam") return null;

  const who = [auth.user.name, auth.user.phone, auth.user.email].filter(Boolean).join(" · ");
  // Messenger prefills nothing for personal profiles, so the user copies the
  // details from the tooltip if they need them.
  const title = `অ্যাডমিনকে জানান: "${who} — পুরো প্রশ্নব্যাংকের অ্যাক্সেস চাই"`;

  function dismiss() {
    setHidden(true);
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* fine */
    }
  }

  return (
    <div className="ask-admin">
      <a className="ask-admin-btn" href={LINK} target="_blank" rel="noreferrer" title={title}>
        <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor">
          <path d="M12 2C6.5 2 2 6.1 2 11.3c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.3S17.5 2 12 2zm1 12.5l-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 5-2.7-5.5 5.8z" />
        </svg>
        <span>পুরো অ্যাক্সেসের জন্য অ্যাডমিনকে মেসেজ করুন</span>
      </a>
      <button type="button" className="ask-admin-x" onClick={dismiss} aria-label="বন্ধ করুন">
        ×
      </button>
    </div>
  );
}
