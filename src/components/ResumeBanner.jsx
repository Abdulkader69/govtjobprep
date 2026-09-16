import { useNavigate } from "react-router-dom";
import { bn, clock } from "@/lib/bn.js";

/**
 * Offered whenever an exam is still open.
 *
 * Starting a new paper replaces the live one, so a candidate who reloaded mid
 * exam needs to be told it is still there before they click anything else.
 */
export default function ResumeBanner({ attempt }) {
  const navigate = useNavigate();
  const data = attempt.attempt;
  if (attempt.restoring || !data || attempt.status === "done") return null;

  const left = Math.max(0, Math.round((data.expiresAt - Date.now()) / 1000));
  const answered = Object.keys(attempt.answers ?? {}).length;

  return (
    <div className="resume">
      <div className="resume-text">
        <b>একটি পরীক্ষা এখনো চলছে</b>
        <span>
          {bn(answered)}/{bn(data.questions.length)} উত্তর দেওয়া হয়েছে ·{" "}
          {left > 0 ? `${clock(left)} বাকি` : "সময় শেষ"}
        </span>
      </div>
      <div className="resume-actions">
        <button type="button" className="cta" onClick={() => navigate("/exam")}>
          ফিরে যান
        </button>
        <button type="button" className="cta ghost" onClick={() => attempt.discard()}>
          বাতিল করুন
        </button>
      </div>
    </div>
  );
}
