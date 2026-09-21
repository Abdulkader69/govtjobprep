import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import GoogleButton, { OrDivider } from "@/components/GoogleButton.jsx";
import { usePageMeta } from "@/lib/usePageMeta.js";

/**
 * Registration with either a mobile number or an email as the identity —
 * the thing the person will log in with. Many candidates have no email;
 * those who do get password-reset links. The other field is optional.
 * Neither is verified: there is no SMS on the free plan.
 */
export default function Register({ auth }) {
  const navigate = useNavigate();
  usePageMeta("রেজিস্টার", "বিনামূল্যে অ্যাকাউন্ট খুলুন — মোবাইল নম্বর, ইমেইল বা Google দিয়ে।");
  const location = useLocation();
  const next = new URLSearchParams(location.search).get("next") || "/start";
  const [via, setVia] = useState("phone");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "" });
  const [error, setError] = useState(null);
  const [oauthError, setOauthError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (auth.ready && auth.user) navigate(next, { replace: true });
  }, [auth.ready, auth.user, navigate, next]);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setError(null);
  };

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (form.password !== form.confirm) return setError("দুটি পাসওয়ার্ড মিলছে না।");
    setBusy(true);
    const r = await auth.register({ name: form.name, via, email: form.email, phone: form.phone, password: form.password });
    setBusy(false);
    if (!r.ok) return setError(r.reason);
    navigate(next, { replace: true });
  }

  const phoneField = (required) => (
    <label className="field" key="phone">
      <span>মোবাইল নম্বর{!required && <small> (ঐচ্ছিক)</small>}</span>
      <input
        type="tel"
        value={form.phone}
        onChange={set("phone")}
        autoComplete="tel"
        inputMode="numeric"
        placeholder="০১৭xxxxxxxx"
        disabled={busy}
        required={required}
      />
    </label>
  );

  const emailField = (required) => (
    <label className="field" key="email">
      <span>ইমেইল{!required && <small> (ঐচ্ছিক)</small>}</span>
      <input
        type="email"
        value={form.email}
        onChange={set("email")}
        autoComplete="email"
        inputMode="email"
        disabled={busy}
        required={required}
      />
    </label>
  );

  return (
    <>
      <SiteHeader auth={auth} />
      <div className="wrap narrow">
        <div className="hero" style={{ paddingBottom: 8 }}>
          <h1 style={{ fontSize: 24 }}>রেজিস্টার</h1>
          <p>একবার অ্যাকাউন্ট খুললে আপনার পরীক্ষার ফলাফল ও অগ্রগতি এক জায়গায় থাকবে।</p>
        </div>

        <div className="card form" style={{ marginBottom: 14 }}>
          <GoogleButton auth={auth} onDone={() => navigate(next, { replace: true })} onError={setOauthError} label="Google দিয়ে রেজিস্টার করুন" />
          {oauthError && <span className="field-error">{oauthError}</span>}
        </div>
        <OrDivider />

        <div className="tabs" role="tablist" aria-label="কী দিয়ে রেজিস্টার করবেন">
          {[
            ["phone", "মোবাইল নম্বর দিয়ে"],
            ["email", "ইমেইল দিয়ে"],
          ].map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={via === k}
              className="tab"
              onClick={() => {
                setVia(k);
                setError(null);
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <form className="card form" onSubmit={submit}>
          <label className="field">
            <span>নাম</span>
            <input type="text" value={form.name} onChange={set("name")} autoComplete="name" disabled={busy} required />
          </label>

          {via === "phone" ? [phoneField(true), emailField(false)] : [emailField(true), phoneField(false)]}

          <label className="field">
            <span>পাসওয়ার্ড <small>(অন্তত ৬ অক্ষর)</small></span>
            <input type="password" value={form.password} onChange={set("password")} autoComplete="new-password" minLength={6} disabled={busy} required />
          </label>
          <label className="field">
            <span>পাসওয়ার্ড আবার লিখুন</span>
            <input type="password" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" minLength={6} disabled={busy} required />
            {error && <span className="field-error">{error}</span>}
          </label>
          <button type="submit" className="cta" style={{ width: "100%" }} disabled={busy}>
            {busy ? "অ্যাকাউন্ট খোলা হচ্ছে…" : "অ্যাকাউন্ট খুলুন"}
          </button>
          <p className="fineprint">
            {via === "phone"
              ? "এই মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করবেন। পাসওয়ার্ড ভুলে গেলে অ্যাডমিনের সাহায্য লাগবে।"
              : "এই ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করবেন। পাসওয়ার্ড ভুলে গেলে এই ইমেইলে রিসেট লিংক যাবে।"}{" "}
            একটি অ্যাকাউন্ট একসাথে একটি ডিভাইসেই লগইন থাকে।
          </p>
        </form>

        <p className="fineprint" style={{ textAlign: "center", marginTop: 18 }}>
          আগেই অ্যাকাউন্ট আছে? <Link to={`/login?next=${encodeURIComponent(next)}`}>লগইন করুন</Link>
        </p>
      </div>
      <SiteFooter auth={auth} />
    </>
  );
}
