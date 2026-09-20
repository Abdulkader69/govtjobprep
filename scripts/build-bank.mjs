#!/usr/bin/env node
/**
 * Compile the authored content in `content/` into two files:
 *
 *   src/data/question-bank.json        everything — validation, tests, and
 *                                      `npm run bank:upload` (to Firestore)
 *   src/data/question-bank.guest.json  the stable guest subset — the only
 *                                      bank the production bundle contains
 *
 * Questions are authored in shards — one file per subject and source — because
 * a single bank file stops being reviewable and starts generating merge
 * conflicts somewhere around a few hundred questions. The app still loads one
 * compiled file at runtime, so nothing downstream has to know about shards.
 *
 * Run `npm run bank` after editing anything under `content/`.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { guestQuestionIds, GUEST_QUESTION_LIMIT } from "../src/lib/access.js";
import { fileURLToPath, URL } from "node:url";
import { join, relative } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const contentDir = join(root, "content");
const outFile = join(root, "src/data/question-bank.json");
const guestFile = join(root, "src/data/question-bank.guest.json");

export function loadShards(dir = join(contentDir, "questions")) {
  const questions = [];
  for (const file of walk(dir)) {
    const where = relative(root, file);
    let shard;
    try {
      shard = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      throw new Error(`${where}: not valid JSON — ${e.message}`);
    }
    if (!Array.isArray(shard.questions)) {
      throw new Error(`${where}: expected a "questions" array`);
    }
    // `defaults` keeps the per-question payload small. A shard is usually one
    // subject from one source, so subject/grade_bands/source repeat otherwise.
    const defaults = shard.defaults ?? {};
    for (const q of shard.questions) {
      questions.push({
        status: "reviewed",
        expires_at: null,
        ...defaults,
        ...q,
        source: q.source ?? shard.source ?? defaults.source ?? null,
        shard: where,
      });
    }
  }
  return questions;
}

function* walk(dir) {
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walk(full);
    else if (entry.endsWith(".json")) yield full;
  }
}

export function buildBank() {
  const profiles = JSON.parse(readFileSync(join(contentDir, "exam-profiles.json"), "utf8"));
  const blueprint = JSON.parse(readFileSync(join(contentDir, "topic-blueprint.json"), "utf8"));
  delete blueprint._comment;
  const questions = loadShards();
  return {
    meta: {
      generated_at: new Date().toISOString(),
      // Content hash: the same questions give the same version, whatever the
      // build time. The admin page compares this with what is in Firestore.
      version: createHash("sha256").update(JSON.stringify(questions)).digest("hex").slice(0, 12),
      generator: "scripts/build-bank.mjs",
      total_questions: questions.length,
      language: "bn/en",
    },
    exam_profiles: profiles,
    topic_blueprint: blueprint,
    questions,
  };
}

/** The same bank narrowed to what a signed-out visitor may see. */
export function guestBank(bank, limit = GUEST_QUESTION_LIMIT) {
  const ids = guestQuestionIds(bank.questions, limit);
  const questions = bank.questions.filter((q) => ids.has(q.id));
  return {
    ...bank,
    meta: { ...bank.meta, tier: "guest", total_questions: questions.length, full_total: bank.questions.length },
    questions,
  };
}

// Only write the file when run directly, so the validator can import and
// compile the content without touching the working tree.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const bank = buildBank();
  writeFileSync(outFile, JSON.stringify(bank, null, 2) + "\n");
  const guest = guestBank(bank);
  writeFileSync(guestFile, JSON.stringify(guest) + "\n");
  console.log(`wrote ${relative(root, guestFile)} — ${guest.questions.length} guest questions`);
  const bySubject = {};
  for (const q of bank.questions) bySubject[q.subject] = (bySubject[q.subject] ?? 0) + 1;
  console.log(`wrote ${relative(root, outFile)} — ${bank.questions.length} questions`);
  console.log(
    Object.entries(bySubject).map(([s, n]) => `  ${s}: ${n}`).join("\n")
  );
}
