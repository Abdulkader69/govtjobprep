import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  saveAttempt, listAttempts, summarise, weakestTopics,
  clearHistory, deleteAttempt, exportAll, MAX_ATTEMPTS,
} from "../history.js";

// vite.config sets environment: "node", so provide the storage the module needs.
beforeEach(() => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear(),
  };
});

const paper = [
  { id: "q1", subject: "bangla", topic: "সন্ধি", answer: 0 },
  { id: "q2", subject: "bangla", topic: "সন্ধি", answer: 1 },
  { id: "q3", subject: "math", topic: "জ্যামিতি", answer: 2 },
  { id: "q4", subject: "math", topic: "জ্যামিতি", answer: 3 },
];

const record = (over = {}) =>
  saveAttempt({
    id: over.id ?? "a1",
    band: "13-16",
    mode: "full",
    profile: { minutes: 60 },
    questions: paper,
    answers: over.answers ?? { q1: 0, q2: 0, q3: 2 },
    result: over.result ?? {
      total: 4, correct: 2, wrong: 1, blank: 1,
      score: 1.75, passMark: 2, passed: false,
    },
    ...over,
  });

describe("saveAttempt", () => {
  it("stores a retrievable record", () => {
    const { saved } = record();
    expect(saved).toBe(true);
    expect(listAttempts()).toHaveLength(1);
  });

  it("keeps question ids only, never stems or options", () => {
    record();
    const stored = JSON.parse(exportAll()).attempts[0];
    expect(stored.wrong.every((id) => typeof id === "string")).toBe(true);
    expect(JSON.stringify(stored)).not.toContain("subject");
  });

  it("counts a wrong answer and a blank alike as needing revision", () => {
    record();
    const [a] = listAttempts();
    // q2 answered wrongly, q4 left blank.
    expect(a.wrong.sort()).toEqual(["q2", "q4"]);
  });

  it("breaks the result down per subject and per topic", () => {
    record();
    const [a] = listAttempts();
    expect(a.perSubject.bangla).toEqual({ correct: 1, total: 2 });
    expect(a.perTopic["math/জ্যামিতি"]).toEqual({ correct: 1, total: 2 });
  });

  it("replaces rather than duplicates when the same attempt is saved twice", () => {
    record();
    record();
    expect(listAttempts()).toHaveLength(1);
  });

  it("drops the oldest once the cap is reached, so writes never start failing", () => {
    for (let i = 0; i < MAX_ATTEMPTS + 5; i++) record({ id: `a${i}` });
    expect(listAttempts().length).toBeLessThanOrEqual(MAX_ATTEMPTS);
  });
});

describe("summarise", () => {
  it("returns a usable empty shape before any attempt", () => {
    const s = summarise();
    expect(s.attempts).toBe(0);
    expect(s.accuracy).toBe(0);
    expect(s.wrongIds).toEqual([]);
  });

  it("aggregates across attempts", () => {
    record({ id: "a1" });
    record({ id: "a2", answers: { q1: 0, q2: 1, q3: 2, q4: 3 },
      result: { total: 4, correct: 4, wrong: 0, blank: 0, score: 4, passMark: 2, passed: true } });

    const s = summarise();
    expect(s.attempts).toBe(2);
    expect(s.questionsSeen).toBe(8);
    expect(s.correct).toBe(6);
    expect(s.passed).toBe(1);
    expect(s.perSubject.bangla).toEqual({ correct: 3, total: 4 });
  });

  it("collects wrong ids across attempts without duplicates", () => {
    record({ id: "a1" });
    record({ id: "a2" });
    expect(summarise().wrongIds.sort()).toEqual(["q2", "q4"]);
  });
});

describe("weakestTopics", () => {
  it("ignores topics with too few questions to judge", () => {
    record();
    // Each topic has only 2 questions in one attempt, below the default minSeen.
    expect(weakestTopics(summarise())).toEqual([]);
  });

  it("ranks weakest first once enough has been seen", () => {
    for (let i = 0; i < 3; i++) record({ id: `a${i}` });
    const weak = weakestTopics(summarise(), { minSeen: 3 });
    expect(weak.length).toBeGreaterThan(0);
    for (let i = 1; i < weak.length; i++) {
      expect(weak[i - 1].accuracy).toBeLessThanOrEqual(weak[i].accuracy);
    }
  });

  it("splits the stored key back into subject and topic", () => {
    for (let i = 0; i < 3; i++) record({ id: `a${i}` });
    const weak = weakestTopics(summarise(), { minSeen: 3 });
    expect(weak.every((t) => ["bangla", "math"].includes(t.subject))).toBe(true);
    expect(weak.some((t) => t.topic === "সন্ধি")).toBe(true);
  });
});

describe("management", () => {
  it("deletes one attempt and keeps the rest", () => {
    record({ id: "a1" });
    record({ id: "a2" });
    deleteAttempt("a1");
    expect(listAttempts().map((a) => a.id)).toEqual(["a2"]);
  });

  it("clears everything", () => {
    record();
    clearHistory();
    expect(listAttempts()).toEqual([]);
  });

  it("exports valid JSON", () => {
    record();
    const parsed = JSON.parse(exportAll());
    expect(parsed.attempts).toHaveLength(1);
    expect(parsed.exportedAt).toBeTruthy();
  });
});

describe("hostile storage", () => {
  it("treats corrupt data as an empty history instead of crashing", () => {
    localStorage.setItem("bdje.history", "{not json");
    expect(listAttempts()).toEqual([]);
    expect(summarise().attempts).toBe(0);
  });

  it("reports failure rather than throwing when storage refuses a write", () => {
    globalThis.localStorage.setItem = () => {
      throw new Error("QuotaExceededError");
    };
    expect(() => record()).not.toThrow();
    expect(record().saved).toBe(false);
  });
});
