import { useState } from "react";

/**
 * Notice strip above the header for signed-in accounts that do not have full
 * access yet, linking to the admin's Messenger thread. Not shown for premium
 * accounts, during an exam (minimal header), or after the user closes it for
 * the session.
 *
 * The link comes from VITE_ADMIN_MESSENGER (e.g. https://m.me/yourname);
 * without it the strip is not rendered at all.
 */
const LINK = import.meta.env?.VITE_ADMIN_MESSENGER ?? "";
const HIDE_KEY = "bdje.askAdmin.hidden";

export default function AskAdmin({ auth }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return sessionStorage.getItem(HIDE_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (!LINK || hidden || !auth.user || auth.unlocked) return null;

  function dismiss() {
    setHidden(true);
    try {
      sessionStorage.setItem(HIDE_KEY, "1");
    } catch {
      /* fine */
    }
  }

  return (
    <div className="notice-bar" role="status">
      <div className="notice-bar-in">
        <span>
          আপনার অ্যাকাউন্টে এখন ফ্রি অ্যাক্সেস আছে। পুরো প্রশ্নব্যাংক ও উত্তর-ব্যাখ্যার জন্য{" "}
          <a href={LINK} target="_blank" rel="noreferrer">
            <MessengerIcon /> অ্যাডমিনকে মেসেজ করুন
          </a>
          {auth.user.phone || auth.user.email ? (
            <small> — মেসেজে আপনার {auth.user.phone ? "মোবাইল নম্বর" : "ইমেইল"} ({auth.user.phone ?? auth.user.email}) লিখে দিন।</small>
          ) : null}
        </span>
        <button type="button" className="notice-bar-x" onClick={dismiss} aria-label="বন্ধ করুন">
          ×
        </button>
      </div>
    </div>
  );
}

function MessengerIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="currentColor" style={{ verticalAlign: "-2px" }}>
      <path d="M12 2C6.5 2 2 6.1 2 11.3c0 2.9 1.4 5.5 3.7 7.2V22l3.4-1.9c.9.3 1.9.4 2.9.4 5.5 0 10-4.1 10-9.3S17.5 2 12 2zm1 12.5l-2.6-2.7-5 2.7 5.5-5.8 2.6 2.7 5-2.7-5.5 5.8z" />
    </svg>
  );
}
