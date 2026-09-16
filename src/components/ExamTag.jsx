import { bn } from "@/lib/bn.js";

/**
 * Which real exam a question came from.
 *
 * Renders nothing when the question has no `exam`, which is the honest state
 * for anything written in past-paper style rather than lifted from a paper.
 */
export default function ExamTag({ exam }) {
  if (!exam?.name) return null;
  return (
    <span className="exam-tag" title="যে পরীক্ষায় এসেছিল">
      {exam.name}
      {exam.year ? ` · ${bn(exam.year)}` : ""}
    </span>
  );
}
