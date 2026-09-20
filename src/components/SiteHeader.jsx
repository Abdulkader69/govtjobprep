import { Link, useNavigate } from "react-router-dom";

/** Logo left; sign-in and the demo entry point right. */
export default function SiteHeader({ auth, minimal = false }) {
  const navigate = useNavigate();
  const { user, signOut } = auth;

  return (
    <header className="site-head">
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
          <button type="button" className="ghost" onClick={() => navigate("/demo")}>
            ডেমো পরীক্ষা
          </button>
          {user ? (
            <span className="who">
              {user.isAdmin && (
                <button type="button" className="ghost" onClick={() => navigate("/admin")}>
                  অ্যাডমিন
                </button>
              )}
              <button type="button" className="ghost" onClick={() => navigate("/profile")}>
                প্রোফাইল
              </button>
              <button
                type="button"
                className="signout"
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
