/**
 * Break an explanation into display lines.
 *
 * Authors write explanations as ordinary prose — "a² + b² = (a + b)² − 2ab =
 * ৪৯ − ২০ = ২৯।" — which reads badly as one long line on a phone. For maths
 * we show one sentence per line and, when a sentence is a single chain of
 * equalities, one step per line with the "=" leading each step:
 *
 *   a² + b²
 *   = (a + b)² − 2ab
 *   = ৪৯ − ২০
 *   = ২৯।
 *
 * A sentence that also contains a comma, "এবং", "বা" or "অর্থাৎ" is more than
 * one statement ("১২ = ২²×৩, ১৮ = ২×৩²…"), so it is left whole. An explicit
 * newline in the content always wins, for any subject.
 */

const STEP_BLOCKERS = /[,;]|এবং|\sবা\s|অর্থাৎ/;

/** @returns {string[]} */
export function explanationLines(text, subject) {
  const paragraphs = String(text ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  if (subject !== "math") return paragraphs;
  return paragraphs.flatMap((p) => sentences(p).flatMap(steps));
}

/** Split on the Bangla full stop, keeping it attached to its sentence. */
function sentences(paragraph) {
  return paragraph.split(/(?<=।)\s+/).map((s) => s.trim()).filter(Boolean);
}

function steps(sentence) {
  const parts = sentence.split(" = ");
  if (parts.length < 3 || STEP_BLOCKERS.test(sentence)) return [sentence];
  return [parts[0], ...parts.slice(1).map((p) => `= ${p}`)];
}
