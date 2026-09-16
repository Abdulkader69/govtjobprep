import { allocate } from "./paper.js";

/**
 * Phone numbers that unlock the whole bank.
 *
 * This is a convenience gate, not a security boundary. In `local` mode the
 * entire bank — answers included — is shipped to the browser, and this list is
 * in the same bundle. Anyone who opens devtools sees both. Moving the limit
 * server-side is the only way to make it mean anything; see docs/api-contract.md.
 */
export const ALLOWED_PHONES = ["01748114144", "01733634538"];

/** Questions a signed-out visitor may reach. */
export const GUEST_QUESTION_LIMIT = 500;

/** Separator for the subject+topic grouping key. */
const KEY_SEP = "::";

/**
 * Reduce a typed number to bare digits so the same phone entered as
 * "+880 1748-114144", "8801748114144" or "01748114144" all match.
 */
export function normalizePhone(input) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.startsWith("880")) return "0" + digits.slice(3);
  if (digits.length === 10 && digits.startsWith("1")) return "0" + digits;
  return digits;
}

export function isAllowedPhone(input) {
  const phone = normalizePhone(input);
  if (!phone) return false;
  return ALLOWED_PHONES.some((allowed) => normalizePhone(allowed) === phone);
}

/**
 * The stable subset a signed-out visitor sees.
 *
 * Two properties matter. It must be **proportional per topic** — a flat slice
 * of the first 500 would be entirely Bangla and no band could fill a paper.
 * And it must be **stable**: if the subset shifted between visits, a guest
 * would gradually see the whole bank and the limit would mean nothing. Sorting
 * by id and taking a fixed head gives both.
 */
export function guestQuestionIds(questions, limit = GUEST_QUESTION_LIMIT) {
  const byTopic = new Map();
  for (const q of questions) {
    const key = `${q.subject}${KEY_SEP}${q.topic}`;
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key).push(q);
  }

  const weights = [...byTopic.entries()].map(([key, list]) => [key, list.length]);
  const quota = allocate(Math.min(limit, questions.length), weights) ?? {};

  const ids = new Set();
  for (const [key, list] of byTopic) {
    const take = quota[key] ?? 0;
    if (!take) continue;
    [...list]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .slice(0, take)
      .forEach((q) => ids.add(q.id));
  }
  return ids;
}

/** Narrow a question list to what this visitor may see. */
export function visibleQuestions(questions, unlocked, limit = GUEST_QUESTION_LIMIT) {
  if (unlocked) return questions;
  const allowed = guestQuestionIds(questions, limit);
  return questions.filter((q) => allowed.has(q.id));
}
