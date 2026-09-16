#!/usr/bin/env node
/**
 * Turn transcribed questions into a draft shard.
 *
 * Usage: node scripts/import-draft.mjs <transcribed.json> <subject> <slug> [--source "BPSC 2023"]
 *
 * Input is a JSON array of `{ topic, difficulty, grade_bands, stem, options,
 * answer, explanation }`. Everything lands as `status: "draft"`, which keeps it
 * out of every paper until a person has checked it — see `isServable` in
 * src/lib/paper.js. Flipping a batch to `reviewed` is the review step, and it
 * is deliberately a separate, manual act.
 *
 * This script refuses obviously broken input rather than writing a shard that
 * `npm run validate` will reject later.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : args[i + 1];
};
const source = flag("--source");
const examName = flag("--exam");
const examYear = flag("--year");
const FLAGS = ["--source", "--exam", "--year"];
const skip = new Set();
args.forEach((a, i) => {
  if (FLAGS.includes(a)) { skip.add(i); skip.add(i + 1); }
});
const [input, subject, slug] = args.filter((_, i) => !skip.has(i));

const SUBJECTS = ["bangla", "english", "math", "gk"];
const DIFFICULTIES = ["easy", "medium", "hard"];

if (!input || !subject || !slug) {
  console.error(
    'usage: node scripts/import-draft.mjs <transcribed.json> <subject> <slug>\n' +
      '       [--source "..."] [--exam "৪৪তম বিসিএস প্রিলিমিনারি"] [--year 2023]\n' +
      `       subject: ${SUBJECTS.join(" | ")}`
  );
  process.exit(1);
}
if (!SUBJECTS.includes(subject)) {
  console.error(`subject must be one of: ${SUBJECTS.join(", ")}`);
  process.exit(1);
}

const incoming = JSON.parse(readFileSync(input, "utf8"));
if (!Array.isArray(incoming)) {
  console.error("expected a JSON array of questions");
  process.exit(1);
}

const problems = [];
const questions = incoming.map((q, i) => {
  const at = q.id ?? `#${i + 1}`;
  if (!q.stem?.trim()) problems.push(`${at}: missing stem`);
  if (!Array.isArray(q.options) || q.options.length !== 4)
    problems.push(`${at}: expected 4 options, got ${q.options?.length}`);
  else if (new Set(q.options.map((o) => String(o).trim())).size !== 4)
    // Two identical options almost always means the transcription flattened a
    // distinction the question was testing — ু vs ূ, ই vs ঈ.
    problems.push(`${at}: two options are identical — check the original scan`);
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3)
    problems.push(`${at}: answer must be an index 0-3`);
  if (!q.explanation?.trim()) problems.push(`${at}: missing explanation`);
  if (!q.topic?.trim()) problems.push(`${at}: missing topic`);
  if (!DIFFICULTIES.includes(q.difficulty))
    problems.push(`${at}: difficulty must be ${DIFFICULTIES.join("/")}`);
  if (!Array.isArray(q.grade_bands) || !q.grade_bands.length)
    problems.push(`${at}: no grade_bands`);

  const exam =
    q.exam ??
    (examName ? { name: examName, ...(examYear ? { year: Number(examYear) } : {}) } : null);

  return {
    ...(exam ? { exam } : {}),
    id: q.id ?? `${subject.slice(0, 2)}-${slug}-${String(i + 1).padStart(3, "0")}`,
    topic: q.topic,
    difficulty: q.difficulty,
    grade_bands: q.grade_bands,
    stem: q.stem,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
  };
});

if (problems.length) {
  console.error(`refusing to import — ${problems.length} problem(s):\n`);
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}

const dir = join("content", "questions", subject);
const out = join(dir, `${slug}.json`);
if (existsSync(out)) {
  console.error(`${out} already exists — pick a different slug or merge by hand`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

writeFileSync(
  out,
  JSON.stringify(
    {
      source: source ?? slug,
      // draft: invisible to candidates until a person flips it to "reviewed".
      defaults: { subject, status: "draft", expires_at: null },
      questions,
    },
    null,
    2
  ) + "\n"
);

console.log(`wrote ${out} — ${questions.length} questions, all status: draft`);
console.log(`\nThey are NOT served yet. After checking each answer against the`);
console.log(`original paper, flip "status" to "reviewed" in the defaults block.`);
console.log(`Then: npm run bank && npm run validate`);
