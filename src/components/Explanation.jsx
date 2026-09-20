import { explanationLines } from "@/lib/explanation.js";

/** The "ব্যাখ্যা" box under a question: label on its own line, then the steps. */
export default function Explanation({ text, subject }) {
  const lines = explanationLines(text, subject);
  if (!lines.length) return null;
  return (
    <div className="expl">
      <b className="expl-label">ব্যাখ্যা:</b>
      {lines.map((line, i) => (
        <div className="expl-line" key={i}>{line}</div>
      ))}
    </div>
  );
}
