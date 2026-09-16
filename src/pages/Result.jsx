import { useEffect, useRef } from "react";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import { Link, Navigate } from "react-router-dom";
import { bySubject, weakTopics } from "@/lib/scoring.js";
import { saveAttempt } from "@/lib/history.js";
import { bn, mark } from "@/lib/bn.js";

export default function Result({ attempt, auth }) {
  const { result, attempt: data } = attempt;
  // Ref, not state: Result re-renders on navigation back from Review, and a
  // second write would duplicate the attempt in history.
  const recorded = useRef(null);

  useEffect(() => {
    if (!result || !data) return;
    const key = data.attemptId;
    if (recorded.current === key) return;
    recorded.current = key;
    saveAttempt({
      id: String(key),
      band: data.band ?? data.profile?.grade_band ?? null,
      mode: data.mode ?? "full",
      auto: result.auto,
      profile: data.profile,
      questions: result.questions,
      answers: result.answers,
      result: result.result,
      startedAt: data.startedAt ?? null,
    });
  }, [result, data]);

  if (!result) return <Navigate to="/" replace />;

  const { auto, result: score, answers, questions } = result;
  const subjects = bySubject(questions, answers);
  const weak = weakTopics(questions, answers);

  return (
    <>
      <SiteHeader auth={auth} />
      <div className="wrap">
      {auto && (
        <div className="banner">
          সময় শেষ হয়ে যাওয়ায় খাতা স্বয়ংক্রিয়ভাবে জমা হয়েছে। যেসব প্রশ্নের উত্তর
          দেওয়া হয়নি সেগুলো শূন্য ধরা হয়েছে।
        </div>
      )}

      <div className="score">
        <div className="big">{mark(score.score)}</div>
        <div className="of">
          {bn(score.total)} নম্বরের মধ্যে · পাস নম্বর {mark(score.passMark)}
        </div>
        <div className="verdict" style={{ color: score.passed ? "var(--ok)" : "var(--seal)" }}>
          {score.passed ? "উত্তীর্ণ" : "অকৃতকার্য"}
        </div>
      </div>

      <div className="tally">
        <div><b style={{ color: "var(--ok)" }}>{bn(score.correct)}</b><span>সঠিক</span></div>
        <div><b style={{ color: "var(--seal)" }}>{bn(score.wrong)}</b><span>ভুল</span></div>
        <div><b>{bn(score.blank)}</b><span>উত্তর দেননি</span></div>
      </div>

      {score.penalty > 0 && (
        <p className="fineprint">
          ভুল উত্তরের জন্য {mark(score.penalty)} নম্বর কাটা হয়েছে।
        </p>
      )}

      <div className="brk">
        <h3>বিষয়ভিত্তিক ফল</h3>
        {subjects.map((s) => (
          <div className="row" key={s.key}>
            <span className="nm">{s.label}</span>
            <span className="meter"><i style={{ width: `${(s.correct / s.total) * 100}%` }} /></span>
            <span className="val">{bn(s.correct)}/{bn(s.total)}</span>
          </div>
        ))}
      </div>

      {weak.length > 0 && (
        <div className="weak">
          <b>যেসব টপিকে বেশি ভুল হয়েছে:</b> {weak.map((w) => w.topic).join(", ")}।
          এই টপিকগুলো আলাদা করে অনুশীলন করলে পরের টেস্টে নম্বর বাড়বে।
        </div>
      )}

      <div className="nav">
        <Link to="/" className="nav-link" style={{ flex: 1 }}>
          <button type="button" style={{ width: "100%" }}>নতুন পরীক্ষা</button>
        </Link>
        <Link to="/review" style={{ flex: 1 }}>
          <button type="button" className="primary" style={{ width: "100%" }}>
            উত্তর ও ব্যাখ্যা
          </button>
        </Link>
      </div>

      <p className="fineprint" style={{ textAlign: "center" }}>
        এই ফলাফল আপনার <Link to="/profile">প্রোফাইলে</Link> সংরক্ষিত হয়েছে।
      </p>
      </div>
      <SiteFooter />
    </>
  );
}
