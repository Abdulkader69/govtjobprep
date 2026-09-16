import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import { GUEST_QUESTION_LIMIT } from "@/lib/access.js";
import { bn } from "@/lib/bn.js";

export default function Login({ auth }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState(null);
  const next = new URLSearchParams(location.search).get("next") || "/start";

  function submit(e) {
    e.preventDefault();
    const result = auth.signIn(phone);
    if (!result.ok) {
      setError(result.reason);
      return;
    }
    navigate(next, { replace: true });
  }

  return (
    <>
      <SiteHeader auth={auth} />
      <div className="wrap narrow">
        <div className="hero" style={{ paddingBottom: 8 }}>
          <h1 style={{ fontSize: 24 }}>লগইন</h1>
          <p>
            অনুমোদিত মোবাইল নম্বর দিয়ে লগইন করলে পুরো প্রশ্নব্যাংক খুলে যাবে।
            লগইন ছাড়াও {bn(GUEST_QUESTION_LIMIT)}টি প্রশ্ন ব্যবহার করা যায়।
          </p>
        </div>

        <form className="card form" onSubmit={submit}>
          <label className="field">
            <span>মোবাইল নম্বর</span>
            <input
              type="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                setError(null);
              }}
              placeholder="০১৭xxxxxxxx"
              autoComplete="tel"
              aria-invalid={error ? "true" : undefined}
            />
            {error && <span className="field-error">{error}</span>}
          </label>
          <button type="submit" className="cta" style={{ width: "100%" }}>
            শুরু করুন
          </button>
          <p className="fineprint">
            এখনো কোনো অ্যাকাউন্ট সিস্টেম নেই — নম্বরটি শুধু এই ব্রাউজারে রাখা হয়,
            কোথাও পাঠানো হয় না। এটি নিরাপত্তা ব্যবস্থা নয়, কেবল সুবিধার জন্য।
          </p>
        </form>
      </div>
      <SiteFooter />
    </>
  );
}
