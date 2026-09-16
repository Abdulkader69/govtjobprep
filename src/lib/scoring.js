import { SUBJECTS } from "./constants.js";

/**
 * Grade an attempt.
 *
 * `answers` maps a question id to the chosen option index. Unanswered questions
 * are neither right nor wrong and never attract the negative mark, which is how
 * every Bangladeshi recruitment paper treats a blank.
 */
export function grade(paper, answers, profile) {
  let correct = 0;
  let wrong = 0;

  for (const q of paper) {
    const picked = answers[q.id];
    if (picked === undefined || picked === null) continue;
    if (picked === q.answer) correct++;
    else wrong++;
  }

  const blank = paper.length - correct - wrong;
  const penalty = wrong * (profile.negative_mark ?? 0);
  const score = Math.max(0, correct - penalty);
  const passMark = (paper.length * profile.pass_percent) / 100;

  return {
    total: paper.length,
    correct,
    wrong,
    blank,
    penalty: round2(penalty),
    score: round2(score),
    passMark: round2(passMark),
    passed: score >= passMark,
  };
}

export function bySubject(paper, answers) {
  return SUBJECTS.map(({ key, label }) => {
    const items = paper.filter((q) => q.subject === key);
    return {
      key,
      label,
      correct: items.filter((q) => answers[q.id] === q.answer).length,
      total: items.length,
    };
  }).filter((s) => s.total > 0);
}

/**
 * Topics the candidate is weakest in. Requires at least `minSeen` questions in
 * a topic, otherwise one unlucky answer would read as a diagnosis.
 */
export function weakTopics(paper, answers, { minSeen = 2, threshold = 0.5, limit = 4 } = {}) {
  const byTopic = new Map();
  for (const q of paper) {
    const row = byTopic.get(q.topic) || { topic: q.topic, correct: 0, total: 0 };
    row.total++;
    if (answers[q.id] === q.answer) row.correct++;
    byTopic.set(q.topic, row);
  }
  return [...byTopic.values()]
    .filter((r) => r.total >= minSeen && r.correct / r.total < threshold)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)
    .slice(0, limit);
}

const round2 = (n) => Math.round(n * 100) / 100;
