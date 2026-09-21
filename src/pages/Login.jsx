import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import GoogleButton, { OrDivider } from "@/components/GoogleButton.jsx";
import { usePageMeta } from "@/lib/usePageMeta.js";
import { GUEST_QUESTION_LIMIT } from "@/lib/access.js";
import { bn } from "@/lib/bn.js";

/**
 * Login with whichever identity the account was registered under — mobile
 * number or email — plus password. Phone OTP appears only when the adapter
 * offers it (Firebase Blaze plan, VITE_PHONE_LOGIN=true).
 */
export default function Login({ auth }) {
  const navigate = useNavigate();
  usePageMeta("লগইন", undefined);
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next") || "/start";
  const [tab, setTab] = useState("email");
  const [oauthError, setOauthError] = useState(null);
  const phoneLogin = auth.phoneLogin;
  const done = () => navigate(next, { replace: true });

  // Already signed in (e.g. landed here from a stale link): carry on.
  useEffect(() => {
    if (auth.ready && auth.user) navigate(next, { replace: true });
  }, [auth.ready, auth.user, navigate, next]);

  return (
    <>
      <SiteHeader auth={auth} />
      <div className="wrap narrow">
        <div className="hero" style={{ paddingBottom: 8 }}>
          <h1 style={{ fontSize: 24 }}>লগইন</h1>
          <p>
            অ্যাকাউন্টে লগইন করলে আপনার ফলাফল ও অগ্রগতি জমা থাকবে। লগইন ছাড়াও{" "}
            {bn(GUEST_QUESTION_LIMIT)}টি প্রশ্ন ব্যবহার করা যায়।
          </p>
        </div>

        {auth.kicked && (
          <div className="banner" role="status" style={{ marginTop: 0, marginBottom: 18 }}>
            {auth.kicked.message}
          </div>
        )}

        <div className="card form" style={{ marginBottom: 14 }}>
          <GoogleButton auth={auth} onDone={done} onError={setOauthError} />
          {oauthError && <span className="field-error">{oauthError}</span>}
        </div>
        <OrDivider />

        {phoneLogin && (
          <div className="tabs" role="tablist">
            {[
              ["email", "পাসওয়ার্ড"],
              ["phone", "OTP"],
            ].map(([k, label]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className="tab" onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
          </div>
        )}

        {tab === "phone" && phoneLogin ? (
          <PhoneForm auth={auth} onDone={() => navigate(next, { replace: true })} />
        ) : (
          <PasswordForm auth={auth} onDone={() => navigate(next, { replace: true })} />
        )}

        <p className="fineprint" style={{ textAlign: "center", marginTop: 18 }}>
          অ্যাকাউন্ট নেই?{" "}
          <Link to={`/register?next=${encodeURIComponent(next)}`}>রেজিস্টার করুন</Link>
        </p>
      </div>
      <SiteFooter auth={auth} />
    </>
  );
}

function PasswordForm({ auth, onDone }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [note, setNote] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await auth.login(identifier, password);
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    onDone();
  }

  async function forgot() {
    if (!identifier) return setError("আগে মোবাইল নম্বর বা ইমেইলটি লিখুন।");
    setBusy(true);
    const r = await auth.resetPassword(identifier);
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    setNote("পাসওয়ার্ড বদলানোর লিংক ইমেইলে পাঠানো হয়েছে।");
  }

  return (
    <form className="card form" onSubmit={submit}>
      <label className="field">
        <span>মোবাইল নম্বর বা ইমেইল</span>
        <input
          type="text"
          value={identifier}
          onChange={(e) => { setIdentifier(e.target.value); setError(null); }}
          autoComplete="username"
          inputMode="email"
          placeholder="০১৭xxxxxxxx / name@example.com"
          disabled={busy}
          required
        />
      </label>
      <label className="field">
        <span>পাসওয়ার্ড</span>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(null); }}
          autoComplete="current-password"
          disabled={busy}
          required
        />
        {error && <span className="field-error">{error}</span>}
        {note && <span className="fineprint">{note}</span>}
      </label>
      <button type="submit" className="cta" style={{ width: "100%" }} disabled={busy}>
        {busy ? "একটু অপেক্ষা করুন…" : "লগইন"}
      </button>
      <button type="button" className="linky" onClick={forgot} disabled={busy}>
        পাসওয়ার্ড ভুলে গেছেন?
      </button>
      <p className="fineprint">
        একটি অ্যাকাউন্ট একসাথে একটি ডিভাইসেই লগইন থাকে। অন্য ডিভাইসে লগইন করলে
        এখানকার লগইন বন্ধ হয়ে যাবে।
      </p>
    </form>
  );
}

function PhoneForm({ auth, onDone }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(null); // { phone, confirm }
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function send(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const r = await auth.sendCode(phone);
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    setPending(r);
  }

  async function verify(e) {
    e.preventDefault();
    if (busy || !pending) return;
    setBusy(true);
    setError(null);
    const r = await pending.confirm(code);
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    onDone();
  }

  if (pending) {
    return (
      <form className="card form" onSubmit={verify}>
        <label className="field">
          <span>{pending.phone} নম্বরে পাঠানো ৬ সংখ্যার কোড</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => { setCode(e.target.value); setError(null); }}
            maxLength={6}
            disabled={busy}
            required
          />
          {error && <span className="field-error">{error}</span>}
        </label>
        <button type="submit" className="cta" style={{ width: "100%" }} disabled={busy}>
          {busy ? "যাচাই হচ্ছে…" : "যাচাই করুন"}
        </button>
        <button type="button" className="linky" onClick={() => { setPending(null); setCode(""); }} disabled={busy}>
          নম্বর বদলান
        </button>
      </form>
    );
  }

  return (
    <form className="card form" onSubmit={send}>
      <label className="field">
        <span>মোবাইল নম্বর</span>
        <input
          type="tel"
          inputMode="numeric"
          value={phone}
          onChange={(e) => { setPhone(e.target.value); setError(null); }}
          placeholder="০১৭xxxxxxxx"
          autoComplete="tel"
          disabled={busy}
          required
        />
        {error && <span className="field-error">{error}</span>}
      </label>
      <button type="submit" className="cta" style={{ width: "100%" }} disabled={busy}>
        {busy ? "কোড পাঠানো হচ্ছে…" : "কোড পাঠান"}
      </button>
      <p className="fineprint">প্রথমবার হলে এই নম্বরেই অ্যাকাউন্ট খুলে যাবে।</p>
    </form>
  );
}
