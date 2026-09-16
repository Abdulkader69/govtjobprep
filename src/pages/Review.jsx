import { Link, Navigate } from "react-router-dom";
import SiteHeader from "@/components/SiteHeader.jsx";
import SiteFooter from "@/components/SiteFooter.jsx";
import OptionList from "@/components/OptionList.jsx";
import ExamTag from "@/components/ExamTag.jsx";
import BookmarkButton from "@/components/BookmarkButton.jsx";
import { DIFFICULTY_LABEL } from "@/lib/constants.js";
import { bn } from "@/lib/bn.js";

export default function Review({ attempt, auth }) {
  const { result } = attempt;
  if (!result) return <Navigate to="/" replace />;

  const { answers, questions } = result;

  return (
    <>
      <SiteHeader auth={auth} />
      <div className="wrap">
      <div className="hero" style={{ padding: "30px 0 4px" }}>
        <h1 style={{ fontSize: "22px" }}>উত্তর ও ব্যাখ্যা</h1>
      </div>

      {questions.map((q, i) => (
        <div className="rev" key={q.id}>
          <div className="rev-tag rev-tag-row">
            <span>
              {q.topic} · {DIFFICULTY_LABEL[q.difficulty]}
              <ExamTag exam={q.exam} />
            </span>
            <BookmarkButton id={q.id} />
          </div>
          <h2 className="stem" style={{ fontSize: "16px", marginBottom: "12px" }}>
            {bn(i + 1)}. {q.stem}
          </h2>
          <OptionList question={q} picked={answers[q.id]} review />
          <div className="expl"><b>ব্যাখ্যা:</b> {q.explanation}</div>
        </div>
      ))}

      <div className="nav">
        <Link to="/" style={{ flex: 1 }}>
          <button type="button" className="primary" style={{ width: "100%" }}>নতুন পরীক্ষা</button>
        </Link>
      </div>
      </div>
      <SiteFooter />
    </>
  );
}
