import { Link, useNavigate } from "react-router-dom";
import AskAdmin from "./AskAdmin.jsx";

/** Logo left; sign-in and the demo entry point right. */
export default function SiteHeader({ auth, minimal = false }) {
  const navigate = useNavigate();
  const { user, signOut } = auth;

  return (
    <header className="site-head">
      {!minimal && <AskAdmin auth={auth} />}
      <div className="site-head-in">
        <Link to="/" className="logo" aria-label="হোম">
          <span className="logo-mark" aria-hidden="true">প</span>
          <span className="logo-text">
            <b>প্রস্তুতি</b>
            <small>১১–২০ গ্রেড</small>
          </span>
        </Link>

        {minimal ? (
          <span className="exam-chip">পরীক্ষা চলছে</span>
        ) : (
        <nav className="site-nav">
          <button type="button" className="ghost" onClick={() => navigate("/prepare")}>
            প্রস্তুতি কক্ষ
          </button>
          {user ? (
            <span className="who">
              {user.isAdmin && (
                <button type="button" className="iconbtn" onClick={() => navigate("/admin")} aria-label="অ্যাডমিন" title="অ্যাডমিন">
                  {/* shield */}
                  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                className="iconbtn"
                onClick={() => navigate("/profile")}
                aria-label="প্রোফাইল"
                title={`প্রোফাইল (${user.name ?? user.email ?? user.phone ?? ""})`}
              >
                {/* person */}
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-6 8-6s8 2 8 6" />
                </svg>
              </button>
              <button
                type="button"
                className="iconbtn signout"
                onClick={signOut}
                aria-label="সাইন আউট"
                title={`সাইন আউট (${user.name ?? user.email ?? user.phone ?? ""})`}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4" />
                  <path d="M15 8l4 4-4 4" />
                  <path d="M19 12H9" />
                </svg>
              </button>
            </span>
          ) : (
            <button type="button" className="solid" onClick={() => navigate("/login")}>
              লগইন
            </button>
          )}
        </nav>
        )}
      </div>
    </header>
  );
}
