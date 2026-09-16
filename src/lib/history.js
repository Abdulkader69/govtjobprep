const KEY = "bdje.history";

/**
 * How many attempts to keep. Old ones fall off the end rather than growing
 * until localStorage throws, which would silently stop recording new results.
 */
export const MAX_ATTEMPTS = 300;

/**
 * Attempt history, stored in this browser.
 *
 * Records are deliberately compact: question ids only, never stems or options.
 * The bank already holds those, and duplicating them would blow the storage
 * quota after a few dozen papers — at which point writes start failing and the
 * history quietly stops updating.
 *
 * There is no server, so this is per-browser and per-device. Clearing site data
 * clears it; `exportAll` exists so a run of study is not one cleared cache away
 * from being lost.
 */

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt or unavailable storage. An empty history is better than a crash
    // on the profile page.
    return [];
  }
}

function write(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_ATTEMPTS)));
    return true;
  } catch {
    return false;
  }
}

/** Newest first. */
export function listAttempts() {
  return read().sort((a, b) => b.finishedAt - a.finishedAt);
}

export function getAttempt(id) {
  return read().find((a) => a.id === id) ?? null;
}

/**
 * Record one finished attempt.
 *
 * `questions` is the submitted paper (answers included) and `answers` the map
 * of what was chosen, exactly as `submitAttempt` returns them.
 */
export function saveAttempt({
  id,
  band,
  mode = "full",
  auto = false,
  profile,
  questions,
  answers,
  result,
  startedAt = null,
}) {
  const perSubject = {};
  const perTopic = {};
  const wrong = [];

  for (const q of questions) {
    const picked = answers[q.id];
    const answered = picked !== undefined && picked !== null;
    const correct = answered && picked === q.answer;

    const subj = (perSubject[q.subject] ??= { correct: 0, total: 0 });
    subj.total++;
    if (correct) subj.correct++;

    const topicKey = `${q.subject}/${q.topic}`;
    const topic = (perTopic[topicKey] ??= { correct: 0, total: 0 });
    topic.total++;
    if (correct) topic.correct++;

    // Unanswered counts as not-yet-learned, so it belongs in the drill pool too.
    if (!correct) wrong.push(q.id);
  }

  const record = {
    id: id ?? `a-${Date.now()}`,
    finishedAt: Date.now(),
    startedAt,
    band,
    mode,
    auto,
    minutes: profile?.minutes ?? null,
    total: result.total,
    correct: result.correct,
    wrongCount: result.wrong,
    blank: result.blank,
    score: result.score,
    passMark: result.passMark,
    passed: result.passed,
    perSubject,
    perTopic,
    wrong,
  };

  const list = read().filter((a) => a.id !== record.id);
  list.unshift(record);
  const saved = write(list.sort((a, b) => b.finishedAt - a.finishedAt));
  return { saved, record };
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
    return true;
  } catch {
    return false;
  }
}

export function deleteAttempt(id) {
  return write(read().filter((a) => a.id !== id));
}

/** Everything, as a JSON string, for the download button. */
export function exportAll() {
  return JSON.stringify({ exportedAt: new Date().toISOString(), attempts: listAttempts() }, null, 2);
}

/**
 * Aggregate across every attempt.
 *
 * Accuracy is computed over questions actually seen, so a topic that appears in
 * one paper does not look identical to one drilled ten times — `seen` is
 * reported alongside so thin samples stay visible.
 */
export function summarise(attempts = listAttempts()) {
  if (!attempts.length) {
    return {
      attempts: 0, questionsSeen: 0, correct: 0, accuracy: 0,
      bestScore: null, lastScore: null, passed: 0,
      perSubject: {}, perTopic: {}, wrongIds: [],
    };
  }

  const perSubject = {};
  const perTopic = {};
  const wrongIds = new Set();
  let questionsSeen = 0;
  let correct = 0;
  let passed = 0;

  for (const a of attempts) {
    questionsSeen += a.total;
    correct += a.correct;
    if (a.passed) passed++;

    for (const [k, v] of Object.entries(a.perSubject ?? {})) {
      const row = (perSubject[k] ??= { correct: 0, total: 0 });
      row.correct += v.correct;
      row.total += v.total;
    }
    for (const [k, v] of Object.entries(a.perTopic ?? {})) {
      const row = (perTopic[k] ??= { correct: 0, total: 0 });
      row.correct += v.correct;
      row.total += v.total;
    }
    for (const id of a.wrong ?? []) wrongIds.add(id);
  }

  const scores = attempts.map((a) => (a.total ? (a.score / a.total) * 100 : 0));

  return {
    attempts: attempts.length,
    questionsSeen,
    correct,
    accuracy: questionsSeen ? (correct / questionsSeen) * 100 : 0,
    bestScore: Math.max(...scores),
    lastScore: scores[0],
    passed,
    perSubject,
    perTopic,
    wrongIds: [...wrongIds],
  };
}

/**
 * Topics to work on next, weakest first.
 *
 * `minSeen` guards against a topic looking catastrophic because one question
 * from it appeared once and was missed.
 */
export function weakestTopics(summary, { minSeen = 3, limit = 8 } = {}) {
  return Object.entries(summary.perTopic)
    .filter(([, v]) => v.total >= minSeen)
    .map(([key, v]) => ({
      key,
      subject: key.split("/")[0],
      topic: key.slice(key.indexOf("/") + 1),
      ...v,
      accuracy: (v.correct / v.total) * 100,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, limit);
}
