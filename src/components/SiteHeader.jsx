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
              <button type="button" className="ghost" onClick={() => navigate("/profile")}>
                প্রোফাইল
              </button>
              <span className="who-name">{user.phone ?? "লগইন করা"}</span>
              <button type="button" className="linky" onClick={signOut}>
                সাইন আউট
              </button>
            </span>
          ) : (
            <>
              <button type="button" className="ghost" onClick={() => navigate("/profile")}>
                প্রোফাইল
              </button>
              <button type="button" className="solid" onClick={() => navigate("/login")}>
                লগইন
              </button>
            </>
          )}
        </nav>
        )}
      </div>
    </header>
  );
}
