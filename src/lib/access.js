import { allocate } from "./paper.js";

/**
 * Who sees what.
 *
 * A signed-out visitor gets the stable guest subset below, which is the only
 * bank the production bundle contains. An account whose Firestore profile has
 * `plan: "full"` (set by a super admin) fetches the whole bank from
 * Firestore, where rules refuse everyone else — see src/lib/bank.js.
 */

/** Questions a signed-out visitor may reach. */
export const GUEST_QUESTION_LIMIT = 500;

/** Separator for the subject+topic grouping key. */
const KEY_SEP = "::";

/**
 * Reduce a typed number to bare digits so the same phone entered as
 * "+880 1748-114144", "8801748114144" or "01748114144" all match. Used for
 * the optional phone on a profile and for phone-OTP sign-in.
 */
export function normalizePhone(input) {
  const digits = String(input ?? "").replace(/\D/g, "");
  if (digits.startsWith("880")) return "0" + digits.slice(3);
  if (digits.length === 10 && digits.startsWith("1")) return "0" + digits;
  return digits;
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
