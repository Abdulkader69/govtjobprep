import { buildPaper, supply, isServable } from "@/lib/paper.js";
import { GUEST_QUESTION_LIMIT } from "@/lib/access.js";
import { loadBank } from "@/lib/bank.js";
import { grade } from "@/lib/scoring.js";

/**
 * In-browser implementation. Development and demo only.
 *
 * It ships the full bank, answers included, so anyone can read the key from
 * devtools. Never run a real exam on this adapter. It exists so the app runs
 * with no backend and so the scoring logic is exercised in tests.
 */
const attempts = new Map();
let seq = 0;

/**
 * The one in-progress attempt, mirrored to storage.
 *
 * Without this a refresh mid-exam loses the paper. Restoring only the UI would
 * not be enough: grading happens against the `attempts` map, so a reload would
 * leave a visible exam that cannot be submitted.
 *
 * The stored record contains the answer key, because grading needs it. In
 * `local` mode that key is already in the JS bundle, so this exposes nothing
 * new — but it is one more reason `local` is for practice only.
 */
const LIVE_KEY = "bdje.live";

function persistLive(attempt) {
  try {
    if (!attempt || attempt.submittedAt) localStorage.removeItem(LIVE_KEY);
    else localStorage.setItem(LIVE_KEY, JSON.stringify(attempt));
  } catch {
    // Storage unavailable. The exam still works; it just will not survive a reload.
  }
}

function readLive() {
  try {
    const raw = localStorage.getItem(LIVE_KEY);
    if (!raw) return null;
    const a = JSON.parse(raw);
    if (!a?.id || !Array.isArray(a.paper)) return null;
    return a;
  } catch {
    return null;
  }
}

/**
 * The bank as this visitor may see it: the bundled guest subset, or the full
 * bank from Firestore for an unlocked account. See src/lib/bank.js.
 */
const bankFor = (unlocked) => loadBank(Boolean(unlocked));

export const localApi = {
  async profiles({ unlocked = false } = {}) {
    const bank = await bankFor(unlocked);
    return bank.exam_profiles.map((p) => ({
      ...p,
      supply: supply(bank, p.grade_band),
    }));
  },

  /**
   * Headline numbers for the landing page. Read from the live bank so the
   * page can never advertise a question count the app cannot actually serve.
   */
  async stats({ unlocked = false } = {}) {
    const bank = await bankFor(unlocked);
    const servable = bank.questions.filter((q) => isServable(q));
    const topics = new Set(servable.map((q) => q.topic));
    return {
      questions: servable.length,
      topics: topics.size,
      subjects: new Set(servable.map((q) => q.subject)).size,
      bands: bank.exam_profiles.length,
      locked: !unlocked,
      guestLimit: GUEST_QUESTION_LIMIT,
    };
  },

  /**
   * The taxonomy the setup and revision dropdowns are built from.
   *
   * Topics come from the blueprint so the order is the published exam order,
   * not whatever the bank happens to hold. Subtopics are read from the
   * questions themselves, since only some subjects use them.
   */
  async topics({ unlocked = false } = {}) {
    const bank = await bankFor(unlocked);
    const out = {};
    for (const [subject, weights] of Object.entries(bank.topic_blueprint ?? {})) {
      if (subject.startsWith("_")) continue;
      out[subject] = Object.keys(weights).map((topic) => {
        const subs = new Set(
          bank.questions
            .filter((q) => q.subject === subject && q.topic === topic && q.subtopic)
            .map((q) => q.subtopic)
        );
        return { topic, subtopics: [...subs].sort() };
      });
    }
    return out;
  },

  /**
   * Questions for revision — answers and explanations included.
   *
   * This is deliberately the opposite of `startAttempt`, which strips them.
   * Reading before an exam is the whole point of the preparation room, so the
   * key is not a secret here. A server implementing this must still keep it on
   * a separate endpoint from the attempt flow, so an exam can never be graded
   * against a payload the candidate could have read.
   */
  async studyQuestions({
    subject, topic = null, subtopic = null, band = null, unlocked = false,
  } = {}) {
    const bank = await bankFor(unlocked);
    let items = bank.questions.filter((q) => isServable(q));
    if (subject) items = items.filter((q) => q.subject === subject);
    if (topic) items = items.filter((q) => q.topic === topic);
    if (subtopic) items = items.filter((q) => q.subtopic === subtopic);
    if (band) items = items.filter((q) => q.grade_bands.includes(band));
    // Stable order so a candidate can come back to where they left off.
    return items.map(({ shard, ...q }) => q);
  },

  /**
   * `shuffle` defaults to true: a candidate coming back should meet a different
   * paper, not the same one in the same order.
   */
  async startAttempt({
    band, shuffle = true, count = null, subjects = null, topics = null, unlocked = false,
  }) {
    const bank = await bankFor(unlocked);
    const { profile, paper } = buildPaper(bank, band, { shuffle, count, subjects, topics });
    const id = `local-${++seq}`;
    const startedAt = Date.now();
    const expiresAt = startedAt + profile.minutes * 60 * 1000;

    const record = { id, band, profile, paper, answers: {}, expiresAt, submittedAt: null, startedAt };
    attempts.set(id, record);
    persistLive(record);

    return {
      attemptId: id,
      band,
      startedAt,
      profile,
      expiresAt,
      // Mirrors the production payload: no `answer`, no `explanation`.
      questions: paper.map(stripAnswer),
    };
  },

  async saveAnswer({ attemptId, questionId, option }) {
    const a = must(attemptId);
    if (a.submittedAt || Date.now() > a.expiresAt) {
      return { accepted: false, reason: "expired" };
    }
    if (option === null) delete a.answers[questionId];
    else a.answers[questionId] = option;
    persistLive(a);
    return { accepted: true };
  },

  async submitAttempt({ attemptId, auto = false }) {
    const a = must(attemptId);
    a.submittedAt ??= Date.now();
    persistLive(a);
    return {
      auto,
      result: grade(a.paper, a.answers, a.profile),
      answers: a.answers,
      // Correct answers and explanations are released only now.
      questions: a.paper,
    };
  },

  /**
   * The attempt still in progress, if any.
   *
   * Mirrors what a server would answer for `GET /attempts/current`. An expired
   * attempt is still returned — the caller submits it rather than discarding
   * it, so time that ran out while the tab was closed is graded honestly
   * instead of silently vanishing.
   */
  async resumeAttempt() {
    const live = readLive();
    if (!live || live.submittedAt) return null;

    // Put it back where grading expects to find it.
    attempts.set(live.id, live);

    return {
      attempt: {
        attemptId: live.id,
        band: live.band,
        startedAt: live.startedAt ?? null,
        profile: live.profile,
        expiresAt: live.expiresAt,
        questions: live.paper.map(stripAnswer),
      },
      answers: { ...live.answers },
      expired: Date.now() > live.expiresAt,
    };
  },

  /** Abandon the in-progress attempt without grading it. */
  async discardAttempt() {
    const live = readLive();
    if (live) attempts.delete(live.id);
    persistLive(null);
  },
};

function must(id) {
  const a = attempts.get(id);
  if (!a) throw new Error(`Unknown attempt ${id}`);
  return a;
}

/**
 * The shape the browser is allowed to see before submission.
 *
 * `option_order` matters as much as `answer` here: the bank writes the correct
 * option first, so leaking the permutation leaks the key. `shard` is a build
 * detail with no business reaching a candidate.
 */
function stripAnswer(q) {
  const { answer, explanation, option_order, shard, ...safe } = q;
  return safe;
}
