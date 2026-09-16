import { bn } from "@/lib/bn.js";

export default function QuestionGrid({ questions, answers, index, perPage = 1, onJump, onClose, onSubmit }) {
  return (
    <div className="sheet" onClick={onClose}>
      <div className="sheet-in" role="dialog" aria-label="প্রশ্নপত্র" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-top">
          <h3>প্রশ্নপত্র</h3>
          <button type="button" className="ghost" onClick={onClose}>বন্ধ করুন</button>
        </div>
        <div className="grid">
          {questions.map((q, i) => (
            <button
              key={q.id}
              type="button"
              className={`cell${answers[q.id] !== undefined ? " done" : ""}${i >= index && i < index + perPage ? " here" : ""}`}
              onClick={() => onJump(i)}
            >
              {bn(i + 1)}
            </button>
          ))}
        </div>
        <div className="legend">
          <span><i className="dot" style={{ background: "var(--ink)" }} />উত্তর দেওয়া</span>
          <span><i className="dot" style={{ background: "#fff" }} />বাকি আছে</span>
        </div>
        <button type="button" className="go" onClick={onSubmit}>জমা দিন</button>
      </div>
    </div>
  );
}
