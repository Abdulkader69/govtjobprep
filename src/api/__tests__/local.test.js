import { describe, it, expect, beforeEach } from "vitest";
import { localApi } from "../local.js";

// The adapter mirrors the live attempt to storage; vitest runs in node.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
});

describe("localApi.startAttempt", () => {
  it("withholds everything that would reveal the key", async () => {
    const { questions } = await localApi.startAttempt({ band: "13-16" });
    expect(questions.length).toBeGreaterThan(0);
    for (const q of questions) {
      expect(q).not.toHaveProperty("answer");
      expect(q).not.toHaveProperty("explanation");
      // The bank is authored answer-first, so the permutation is the key.
      expect(q).not.toHaveProperty("option_order");
      expect(q).not.toHaveProperty("shard");
      expect(q.options).toHaveLength(4);
    }
  });

  it("gives the attempt a deadline in the future", async () => {
    const a = await localApi.startAttempt({ band: "13-16" });
    expect(a.expiresAt).toBeGreaterThan(Date.now());
    expect(a.expiresAt - Date.now()).toBeLessThanOrEqual(a.profile.minutes * 60 * 1000);
  });
});

describe("localApi grading round trip", () => {
  it("scores the answers the candidate actually gave", async () => {
    const started = await localApi.startAttempt({ band: "13-16" });
    // Answer the first three; the grader sees the real key, we do not.
    for (const q of started.questions.slice(0, 3)) {
      const r = await localApi.saveAnswer({
        attemptId: started.attemptId,
        questionId: q.id,
        option: 0,
      });
      expect(r.accepted).toBe(true);
    }

    const done = await localApi.submitAttempt({ attemptId: started.attemptId });
    expect(done.result.total).toBe(started.questions.length);
    expect(done.result.correct + done.result.wrong).toBe(3);
    expect(done.result.blank).toBe(started.questions.length - 3);

    // Only now are the key and the explanations released.
    for (const q of done.questions) {
      expect(q).toHaveProperty("answer");
      expect(q.explanation).toBeTruthy();
    }
  });

  it("clears an answer when null is sent, so a blank stays a blank", async () => {
    const started = await localApi.startAttempt({ band: "17-20" });
    const q = started.questions[0];
    await localApi.saveAnswer({ attemptId: started.attemptId, questionId: q.id, option: 2 });
    await localApi.saveAnswer({ attemptId: started.attemptId, questionId: q.id, option: null });

    const done = await localApi.submitAttempt({ attemptId: started.attemptId });
    expect(done.answers[q.id]).toBeUndefined();
    expect(done.result.blank).toBe(done.result.total);
  });

  it("is idempotent, so a retried submit cannot produce a second result", async () => {
    const started = await localApi.startAttempt({ band: "13-16" });
    const first = await localApi.submitAttempt({ attemptId: started.attemptId });
    const second = await localApi.submitAttempt({ attemptId: started.attemptId });
    expect(second.result).toEqual(first.result);
  });

  it("refuses an answer once the attempt is submitted", async () => {
    const started = await localApi.startAttempt({ band: "13-16" });
    await localApi.submitAttempt({ attemptId: started.attemptId });
    const late = await localApi.saveAnswer({
      attemptId: started.attemptId,
      questionId: started.questions[0].id,
      option: 1,
    });
    expect(late).toEqual({ accepted: false, reason: "expired" });
  });
});

describe("localApi.profiles", () => {
  it("reports what each band can really serve", async () => {
    const profiles = await localApi.profiles();
    expect(profiles).toHaveLength(3);
    for (const p of profiles) {
      expect(p.supply.actual).toBeGreaterThan(0);
      expect(p.supply.short).toBe(p.supply.actual < p.supply.target);
    }
  });
});

describe("localApi.topics", () => {
  it("lists topics in blueprint order with their subtopics", async () => {
    const t = await localApi.topics();
    expect(Object.keys(t).sort()).toEqual(["bangla", "english", "gk", "math"]);
    expect(t.bangla[0].topic).toBe("সন্ধি");
    // Only maths carries subtopics today.
    const geometry = t.math.find((r) => r.topic === "জ্যামিতি");
    expect(geometry.subtopics.length).toBeGreaterThan(0);
    expect(t.bangla.every((r) => r.subtopics.length === 0)).toBe(true);
  });
});

describe("localApi.studyQuestions", () => {
  it("includes the answer and explanation, unlike an attempt", async () => {
    const rows = await localApi.studyQuestions({ subject: "gk" });
    expect(rows.length).toBeGreaterThan(0);
    for (const q of rows) {
      expect(Number.isInteger(q.answer)).toBe(true);
      expect(q.explanation).toBeTruthy();
      expect(q).not.toHaveProperty("shard");
    }
  });

  it("filters by topic and then by subtopic", async () => {
    const byTopic = await localApi.studyQuestions({ subject: "math", topic: "জ্যামিতি" });
    expect(byTopic.every((q) => q.topic === "জ্যামিতি")).toBe(true);

    const bySub = await localApi.studyQuestions({
      subject: "math", topic: "জ্যামিতি", subtopic: "বৃত্ত",
    });
    expect(bySub.length).toBeGreaterThan(0);
    expect(bySub.length).toBeLessThan(byTopic.length);
    expect(bySub.every((q) => q.subtopic === "বৃত্ত")).toBe(true);
  });

  it("never serves a draft or expired question for revision either", async () => {
    const rows = await localApi.studyQuestions({});
    expect(rows.every((q) => q.status !== "draft")).toBe(true);
    const now = Date.now();
    expect(rows.every((q) => !q.expires_at || Date.parse(q.expires_at) > now)).toBe(true);
  });

  it("returns everything when no filter is given", async () => {
    const all = await localApi.studyQuestions({});
    const gk = await localApi.studyQuestions({ subject: "gk" });
    expect(all.length).toBeGreaterThan(gk.length);
  });
});

describe("the guest gate through the API", () => {
  it("serves the capped pool to a signed-out visitor", async () => {
    const guest = await localApi.studyQuestions({});
    const member = await localApi.studyQuestions({ unlocked: true });
    expect(guest.length).toBe(500);
    expect(member.length).toBeGreaterThan(guest.length);
  });

  it("reports the lock state in stats so the UI can explain it", async () => {
    const guest = await localApi.stats({});
    const member = await localApi.stats({ unlocked: true });
    expect(guest.locked).toBe(true);
    expect(guest.questions).toBe(500);
    expect(member.locked).toBe(false);
    expect(member.questions).toBeGreaterThan(500);
  });

  it("still starts a full attempt for a guest", async () => {
    const a = await localApi.startAttempt({ band: "13-16" });
    expect(a.questions).toHaveLength(a.profile.questions);
  });

  it("keeps the answer key out of a guest attempt too", async () => {
    const a = await localApi.startAttempt({ band: "13-16", count: 20 });
    for (const q of a.questions) {
      expect(q).not.toHaveProperty("answer");
      expect(q).not.toHaveProperty("option_order");
    }
  });

  it("gives a guest every topic in the taxonomy", async () => {
    const guest = await localApi.topics({});
    const member = await localApi.topics({ unlocked: true });
    for (const subject of Object.keys(member)) {
      expect(guest[subject].length).toBe(member[subject].length);
    }
  });
});

describe("resuming an attempt after a reload", () => {
  it("returns nothing when no exam is open", async () => {
    expect(await localApi.resumeAttempt()).toBeNull();
  });

  it("brings back the paper and the answers given so far", async () => {
    const started = await localApi.startAttempt({ band: "13-16", count: 10 });
    const first = started.questions[0].id;
    await localApi.saveAnswer({ attemptId: started.attemptId, questionId: first, option: 2 });

    const live = await localApi.resumeAttempt();
    expect(live.attempt.attemptId).toBe(started.attemptId);
    expect(live.attempt.questions).toHaveLength(10);
    expect(live.answers[first]).toBe(2);
    expect(live.expired).toBe(false);
  });

  it("still withholds the key from a restored paper", async () => {
    await localApi.startAttempt({ band: "13-16", count: 10 });
    const live = await localApi.resumeAttempt();
    for (const q of live.attempt.questions) {
      expect(q).not.toHaveProperty("answer");
      expect(q).not.toHaveProperty("option_order");
    }
  });

  it("can be submitted after the resume, which is the whole point", async () => {
    const started = await localApi.startAttempt({ band: "13-16", count: 10 });
    await localApi.saveAnswer({
      attemptId: started.attemptId, questionId: started.questions[0].id, option: 0,
    });

    // Simulate the reload: the in-memory map is gone, only storage remains.
    const live = await localApi.resumeAttempt();
    const done = await localApi.submitAttempt({ attemptId: live.attempt.attemptId });
    expect(done.result.total).toBe(10);
    expect(done.result.correct + done.result.wrong).toBe(1);
  });

  it("stops offering a resume once the attempt is submitted", async () => {
    const started = await localApi.startAttempt({ band: "13-16", count: 10 });
    await localApi.submitAttempt({ attemptId: started.attemptId });
    expect(await localApi.resumeAttempt()).toBeNull();
  });

  it("reports an attempt whose time ran out, rather than dropping it", async () => {
    const started = await localApi.startAttempt({ band: "13-16", count: 10 });
    const stored = JSON.parse(localStorage.getItem("bdje.live"));
    stored.expiresAt = Date.now() - 1000;
    localStorage.setItem("bdje.live", JSON.stringify(stored));

    const live = await localApi.resumeAttempt();
    expect(live).not.toBeNull();
    expect(live.expired).toBe(true);
    expect(live.attempt.attemptId).toBe(started.attemptId);
  });

  it("discards on request", async () => {
    await localApi.startAttempt({ band: "13-16", count: 10 });
    await localApi.discardAttempt();
    expect(await localApi.resumeAttempt()).toBeNull();
  });

  it("ignores corrupt stored state instead of breaking the app", async () => {
    localStorage.setItem("bdje.live", "{not json");
    expect(await localApi.resumeAttempt()).toBeNull();
  });
});
