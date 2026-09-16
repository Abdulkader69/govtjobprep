import { SUBJECTS } from "./constants.js";

export const DIFFICULTIES = ["easy", "medium", "hard"];

/** Where to look when a difficulty bucket cannot fill its quota. */
const NEIGHBOURS = {
  easy: ["medium", "hard"],
  medium: ["easy", "hard"],
  hard: ["medium", "easy"],
};

/**
 * Is this question fit to put in front of a candidate right now?
 *
 * `status` gates review: a freshly imported question is `draft` until someone
 * has checked it, so a bulk import cannot leak an unverified answer into a
 * live paper. `expires_at` handles facts with a shelf life — office holders,
 * budget figures, "current" anything — which are wrong later rather than
 * wrong now, and so never get caught by review.
 */
export function isServable(q, now = Date.now()) {
  if ((q.status ?? "reviewed") !== "reviewed") return false;
  if (q.expires_at && Date.parse(q.expires_at) <= now) return false;
  return true;
}

/**
 * Assemble a paper for one grade band.
 *
 * The bank is tagged per question with the bands it is valid for, so a single
 * bank serves every band. Questions are drawn per subject up to that band's
 * weight, and within a subject the band's `difficulty_mix` decides how many
 * easy, medium and hard questions to take. If the bank is short, the paper is
 * short: callers must surface that rather than pretend the target was met.
 */
export function buildPaper(
  bank,
  band,
  {
    shuffle = false,
    rng = Math.random,
    permuteOptions = true,
    now = Date.now(),
    count = null,
    subjects = null,
    topics = null,
  } = {}
) {
  const base = bank.exam_profiles.find((p) => p.grade_band === band);
  if (!base) throw new Error(`No exam profile for band "${band}"`);

  const profile = resizeProfile(base, count);

  let pool = bank.questions.filter(
    (q) => q.grade_bands.includes(band) && isServable(q, now)
  );
  if (subjects?.length) pool = pool.filter((q) => subjects.includes(q.subject));
  if (topics?.length) pool = pool.filter((q) => topics.includes(q.topic));

  // A topic-restricted paper has no subject shape to honour — the candidate
  // chose the shape. Draw the whole paper from the filtered pool instead.
  const restricted = Boolean(subjects?.length || topics?.length);
  let paper;

  if (restricted) {
    let items = shuffle ? shuffleWith(pool, rng) : pool;
    paper = drawByDifficulty(items, profile.questions, profile.difficulty_mix);
  } else {
    paper = [];
    for (const { key } of SUBJECTS) {
      const want = profile.subject_weights[key] || 0;
      if (!want) continue;
      let items = pool.filter((q) => q.subject === key);
      if (shuffle) items = shuffleWith(items, rng);
      paper.push(...drawSubject(items, want, profile.difficulty_mix, bank.topic_blueprint?.[key]));
    }
  }

  return {
    profile,
    paper: permuteOptions ? paper.map((q) => withPermutedOptions(q, rng)) : paper,
  };
}

/**
 * Rescale a band's profile to a different question count.
 *
 * Time scales with it, because a 20-question paper on a 60-minute clock is not
 * a shorter exam, it is a different one. Subject weights are reallocated with
 * largest-remainder so they still sum to the new total, and the topic blueprint
 * needs no adjustment at all — its weights are relative.
 */
export function resizeProfile(profile, count) {
  if (!count || count === profile.questions) return profile;

  const subject_weights =
    allocate(count, Object.entries(profile.subject_weights)) ?? profile.subject_weights;

  return {
    ...profile,
    questions: count,
    minutes: Math.max(1, Math.round((profile.minutes * count) / profile.questions)),
    subject_weights,
  };
}

/**
 * Draw one subject's share of the paper.
 *
 * A topic blueprint, when the subject has one, is the stronger constraint: it
 * is the published shape of the real exam, so a paper that ignores it is not a
 * model test. Difficulty is applied *within* each topic, where it degrades
 * gracefully — a topic owed two questions cannot express a 40/45/15 mix, and
 * should not pretend to.
 *
 * Whatever the blueprint cannot fill is backfilled from the rest of the
 * subject, including topics the blueprint never mentions, so no question is
 * stranded and no paper comes up short on a technicality.
 */
export function drawSubject(items, want, mix, topicWeights) {
  if (!topicWeights) return drawByDifficulty(items, want, mix);

  const quota = allocate(want, Object.entries(topicWeights));
  if (!quota) return drawByDifficulty(items, want, mix);

  const taken = [];
  const used = new Set();
  for (const [topic, n] of Object.entries(quota)) {
    const inTopic = items.filter((q) => q.topic === topic && !used.has(q.id));
    for (const q of drawByDifficulty(inTopic, n, mix)) {
      used.add(q.id);
      taken.push(q);
    }
  }

  if (taken.length < want) {
    const rest = items.filter((q) => !used.has(q.id));
    for (const q of drawByDifficulty(rest, want - taken.length, mix)) taken.push(q);
  }

  return taken;
}

/**
 * Take `want` questions honouring the difficulty mix, backfilling from the
 * nearest difficulty when a bucket runs dry.
 *
 * Backfilling rather than returning short is deliberate: a candidate is better
 * served by a full paper of slightly the wrong shape than by a 45-question
 * paper where 70 was promised. `supply()` reports the distortion separately.
 */
export function drawByDifficulty(items, want, mix) {
  const quota = difficultyQuota(want, mix);
  if (!quota) return items.slice(0, want);

  const buckets = Object.fromEntries(
    DIFFICULTIES.map((d) => [d, items.filter((q) => q.difficulty === d)])
  );
  // Anything tagged with an unknown difficulty still belongs in the paper.
  const untagged = items.filter((q) => !DIFFICULTIES.includes(q.difficulty));
  const taken = [];
  const used = new Set();

  const take = (list, n) => {
    for (const q of list) {
      if (taken.length >= want || n <= 0) break;
      if (used.has(q.id)) continue;
      used.add(q.id);
      taken.push(q);
      n--;
    }
    return n; // still owed
  };

  const owed = {};
  for (const d of DIFFICULTIES) owed[d] = take(buckets[d], quota[d]);
  for (const d of DIFFICULTIES) {
    for (const alt of NEIGHBOURS[d]) {
      if (owed[d] <= 0) break;
      owed[d] = take(buckets[alt], owed[d]);
    }
    if (owed[d] > 0) owed[d] = take(untagged, owed[d]);
  }

  return taken;
}

/**
 * Split `want` across the difficulties by percentage, using largest-remainder
 * so the parts always sum back to `want` instead of drifting by a question or
 * two after rounding.
 */
export function difficultyQuota(want, mix) {
  return mix ? allocate(want, DIFFICULTIES.map((d) => [d, mix[d] || 0])) : null;
}

/**
 * Split `want` across weighted buckets using largest-remainder, so the parts
 * always sum back to `want` instead of drifting by one or two after rounding.
 *
 * Weights are relative. A topic blueprint written for a 25-question Bangla
 * section therefore scales unchanged to a band that allocates 20.
 *
 * @param {Array<[string, number]>} weights
 * @returns {Record<string, number>|null} null when nothing is weighted
 */
export function allocate(want, weights) {
  const total = weights.reduce((sum, [, w]) => sum + w, 0);
  if (!total) return null;

  const exact = weights.map(([, w]) => (want * w) / total);
  const counts = exact.map(Math.floor);
  let left = want - counts.reduce((a, b) => a + b, 0);

  const byRemainder = exact
    .map((v, i) => ({ rem: v - Math.floor(v), i }))
    .sort((a, b) => b.rem - a.rem);
  for (let k = 0; left > 0 && counts.length; k++, left--) counts[byRemainder[k % counts.length].i]++;

  return Object.fromEntries(weights.map(([key], i) => [key, counts[i]]));
}

/**
 * Reorder one question's options and move the answer index with them.
 *
 * Hand-authored banks put the correct option first far more often than chance
 * — this one did it in all 100 questions — and a candidate who spots that
 * scores full marks without reading a single stem. Permuting per attempt makes
 * the position of the key meaningless no matter how the bank is written, so
 * this is a property of the assembler, not a rule authors have to remember.
 */
export function withPermutedOptions(q, rng = Math.random) {
  if (!Array.isArray(q.options) || !Number.isInteger(q.answer)) return q;
  const order = shuffleWith(
    q.options.map((_, i) => i),
    rng
  );
  return {
    ...q,
    options: order.map((i) => q.options[i]),
    answer: order.indexOf(q.answer),
    // Kept so a stored attempt can be replayed exactly; stripped before the
    // paper is sent to the browser.
    option_order: order,
  };
}

/** What a band can actually serve right now, versus what its profile targets. */
export function supply(bank, band, { now = Date.now() } = {}) {
  const { profile, paper } = buildPaper(bank, band, { permuteOptions: false, now });
  const pool = bank.questions.filter(
    (q) => q.grade_bands.includes(band) && isServable(q, now)
  );

  const perSubject = {};
  for (const { key } of SUBJECTS) {
    const want = profile.subject_weights[key] || 0;
    if (!want) continue;
    perSubject[key] = { have: paper.filter((q) => q.subject === key).length, want };
  }

  // Difficulty is reported against the whole paper: the mix is a property of
  // the exam, not of any one subject.
  const quota = difficultyQuota(profile.questions, profile.difficulty_mix);
  const perDifficulty = {};
  if (quota) {
    for (const d of DIFFICULTIES) {
      perDifficulty[d] = {
        have: paper.filter((q) => q.difficulty === d).length,
        want: quota[d],
      };
    }
  }

  // Per topic, for subjects with a blueprint. `have` counts what the bank could
  // supply for that topic, not what landed in this paper, so the number is a
  // shopping list rather than a symptom of backfill.
  const perTopic = {};
  for (const [subject, weights] of Object.entries(bank.topic_blueprint ?? {})) {
    const subjectWant = profile.subject_weights[subject] || 0;
    if (!subjectWant) continue;
    const quota = allocate(subjectWant, Object.entries(weights));
    if (!quota) continue;
    perTopic[subject] = {};
    for (const [topic, want] of Object.entries(quota)) {
      perTopic[subject][topic] = {
        want,
        have: pool.filter((q) => q.subject === subject && q.topic === topic).length,
      };
    }
  }

  return {
    target: profile.questions,
    actual: paper.length,
    short: paper.length < profile.questions,
    perSubject,
    perDifficulty,
    perTopic,
  };
}

function shuffleWith(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
