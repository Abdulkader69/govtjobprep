#!/usr/bin/env node
/**
 * Structural checks on the authored content. Run in CI and before every commit:
 * a malformed question is invisible in the UI until a candidate hits it.
 *
 * This reads `content/` through the compiler rather than the generated bank, so
 * it fails on bad source even when nobody has run `npm run bank` yet.
 */
import { buildBank } from "./build-bank.mjs";
import { supply, DIFFICULTIES } from "../src/lib/paper.js";

const bank = buildBank();

const errors = [];
const warnings = [];
const seenIds = new Set();
const seenStems = new Map();
const bands = new Set(bank.exam_profiles.map((p) => p.grade_band));
const STATUSES = new Set(["draft", "reviewed", "retired"]);
const answerIndex = [0, 0, 0, 0];

for (const q of bank.questions) {
  const at = `${q.id ?? "(no id)"} [${q.shard}]`;

  if (!q.id) errors.push(`${at}: no id`);
  else if (seenIds.has(q.id)) errors.push(`${at}: duplicate id`);
  else seenIds.add(q.id);

  if (!Array.isArray(q.options) || q.options.length !== 4)
    errors.push(`${at}: expected 4 options, got ${q.options?.length}`);
  else if (new Set(q.options.map((o) => String(o).trim())).size !== 4)
    errors.push(`${at}: duplicate option text`);

  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3)
    errors.push(`${at}: answer index out of range`);
  else answerIndex[q.answer]++;

  if (!q.explanation?.trim()) errors.push(`${at}: missing explanation`);
  if (!q.topic?.trim()) errors.push(`${at}: missing topic`);
  if (!q.subject?.trim()) errors.push(`${at}: missing subject`);

  if (!DIFFICULTIES.includes(q.difficulty))
    errors.push(`${at}: difficulty must be one of ${DIFFICULTIES.join(", ")}`);

  if (!STATUSES.has(q.status))
    errors.push(`${at}: status must be one of ${[...STATUSES].join(", ")}`);

  if (q.expires_at !== null && Number.isNaN(Date.parse(q.expires_at)))
    errors.push(`${at}: expires_at is not a date`);

  // `exam` is optional — a question written in past-paper style has no real
  // exam to name, and inventing one would be a false record. But when it is
  // present it must be usable, because it is shown to candidates.
  if (q.exam !== undefined && q.exam !== null) {
    if (typeof q.exam !== "object" || Array.isArray(q.exam))
      errors.push(`${at}: exam must be an object`);
    else {
      if (!q.exam.name?.trim()) errors.push(`${at}: exam.name is required`);
      if (q.exam.year !== undefined && !Number.isInteger(q.exam.year))
        errors.push(`${at}: exam.year must be a whole number`);
      if (Number.isInteger(q.exam.year) && (q.exam.year < 1970 || q.exam.year > 2100))
        errors.push(`${at}: exam.year ${q.exam.year} is out of range`);
    }
  }

  if (!Array.isArray(q.grade_bands) || q.grade_bands.length === 0)
    errors.push(`${at}: no grade_bands`);
  else
    for (const b of q.grade_bands)
      if (!bands.has(b)) errors.push(`${at}: unknown grade band "${b}"`);

  // Two questions are the same question when they ask the same thing AND
  // expect the same answer. Matching on the stem alone cries wolf on shared
  // boilerplate — "Which sentence is correct?" heads a whole family of
  // unrelated grammar items.
  const stem = q.stem?.trim();
  const key = stem && q.options?.[q.answer] ? `${stem}\u0000${q.options[q.answer]}` : null;
  if (key) {
    if (seenStems.has(key)) errors.push(`${at}: duplicate of ${seenStems.get(key)}`);
    else seenStems.set(key, q.id);
  }
}

// Position bias. The assembler permutes options per attempt, so a skewed bank
// is not a fairness bug at runtime — but it is a sign the content was written
// answer-first, and it does leak if a paper is ever exported to print.
const answered = answerIndex.reduce((a, b) => a + b, 0);
if (answered) {
  const worst = Math.max(...answerIndex);
  if (worst / answered > 0.4)
    warnings.push(
      `answer position is skewed: ${answerIndex.join("/")} across indices 0-3 ` +
        `(${Math.round((worst / answered) * 100)}% in one slot). ` +
        `Runtime permutation covers this, but vary it when authoring.`
    );
}

// The checks that matter as the bank grows: can each band fill its paper, and
// can it fill the paper with the right *shape*?
for (const p of bank.exam_profiles) {
  const s = supply(bank, p.grade_band);

  for (const [subject, { have, want }] of Object.entries(s.perSubject))
    if (have < want)
      warnings.push(`band ${p.grade_band} / ${subject}: ${have} of ${want} available`);

  for (const d of DIFFICULTIES) {
    const row = s.perDifficulty[d];
    if (!row) continue;
    // Backfill hides a thin bucket behind a full paper, so compare the mix the
    // profile asked for against what the assembler could actually find.
    if (row.have < row.want)
      warnings.push(
        `band ${p.grade_band} / ${d}: ${row.have} of ${row.want} wanted ` +
          `(backfilled from another difficulty)`
      );
  }
}

// Topic depth. A topic with only as many questions as a paper needs produces
// the same questions every time, which is the difference between a model test
// and a practice tool. Reported as a table because it is a work queue.
const blueprint = bank.topic_blueprint ?? {};
const depthTarget = blueprint._target_per_topic ?? 0;
for (const [subject, weights] of Object.entries(blueprint)) {
  if (subject.startsWith("_")) continue;
  const counts = {};
  for (const q of bank.questions)
    if (q.subject === subject) counts[q.topic] = (counts[q.topic] ?? 0) + 1;

  const rows = Object.keys(weights).map((topic) => {
    const have = counts[topic] ?? 0;
    // Distinct papers before a question must repeat, at the busiest band.
    const perPaper = Math.max(
      ...bank.exam_profiles.map((p) => {
        const want = p.subject_weights[subject] || 0;
        const total = Object.values(weights).reduce((a, b) => a + b, 0);
        return want ? Math.round((want * weights[topic]) / total) : 0;
      })
    );
    return { topic, have, perPaper, short: depthTarget ? Math.max(0, depthTarget - have) : 0 };
  });

  const missing = rows.reduce((sum, r) => sum + r.short, 0);
  console.log(`\ntopic depth — ${subject} (target ${depthTarget} each)\n`);
  console.log("  have  need   papers  topic");
  for (const r of rows.sort((a, b) => a.have - b.have)) {
    const papers = r.perPaper ? Math.floor(r.have / r.perPaper) : "—";
    const flag = r.have < r.perPaper ? "  ← cannot fill a paper" : "";
    console.log(
      `  ${String(r.have).padStart(4)}  ${String(r.short).padStart(4)}   ${String(papers).padStart(6)}  ${r.topic}${flag}`
    );
  }
  console.log(`\n  ${missing} more needed to reach ${depthTarget} per topic`);
}

for (const w of warnings) console.warn(`warn  ${w}`);
for (const e of errors) console.error(`error ${e}`);

const withExam = bank.questions.filter((q) => q.exam?.name).length;
console.log(
  `\nexam provenance: ${withExam} of ${bank.questions.length} questions name a real exam` +
    (withExam === bank.questions.length ? "" : " (the rest are original, past-paper pattern)")
);

const drafts = bank.questions.filter((q) => q.status === "draft").length;
console.log(
  `\n${bank.questions.length} questions` +
    (drafts ? ` (${drafts} draft, not served)` : "") +
    ` · ${errors.length} errors · ${warnings.length} warnings`
);
process.exit(errors.length ? 1 : 0);
