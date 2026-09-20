import { describe, it, expect } from "vitest";
import {
  normalizePhone,
  guestQuestionIds,
  visibleQuestions,
  GUEST_QUESTION_LIMIT,
} from "../access.js";
import { buildPaper } from "../paper.js";
import bank from "../../data/question-bank.json";

describe("normalizePhone", () => {
  it("accepts the same number in the forms people actually type", () => {
    for (const form of [
      "01748114144",
      "01748-114144",
      "  01748 114144 ",
      "+8801748114144",
      "8801748114144",
      "1748114144",
    ]) {
      expect(normalizePhone(form)).toBe("01748114144");
    }
  });

  it("returns an empty string for junk rather than throwing", () => {
    expect(normalizePhone(null)).toBe("");
    expect(normalizePhone("abc")).toBe("");
  });
});

describe("guestQuestionIds", () => {
  it("caps the guest pool at the limit", () => {
    expect(guestQuestionIds(bank.questions).size).toBe(GUEST_QUESTION_LIMIT);
  });

  it("is stable across calls, so a guest cannot accumulate the whole bank", () => {
    const a = [...guestQuestionIds(bank.questions)].sort();
    const b = [...guestQuestionIds(bank.questions)].sort();
    expect(a).toEqual(b);
  });

  it("spreads across every subject rather than taking one flat slice", () => {
    const ids = guestQuestionIds(bank.questions);
    const subjects = new Set(
      bank.questions.filter((q) => ids.has(q.id)).map((q) => q.subject)
    );
    expect([...subjects].sort()).toEqual(["bangla", "english", "gk", "math"]);
  });

  it("includes every topic, so no topic disappears for guests", () => {
    const ids = guestQuestionIds(bank.questions);
    const guestTopics = new Set(
      bank.questions.filter((q) => ids.has(q.id)).map((q) => `${q.subject}/${q.topic}`)
    );
    const allTopics = new Set(bank.questions.map((q) => `${q.subject}/${q.topic}`));
    expect(guestTopics.size).toBe(allTopics.size);
  });

  it("never returns more than the bank holds", () => {
    const tiny = bank.questions.slice(0, 20);
    expect(guestQuestionIds(tiny, 500).size).toBeLessThanOrEqual(20);
  });
});

describe("visibleQuestions", () => {
  it("returns everything when unlocked", () => {
    expect(visibleQuestions(bank.questions, true)).toHaveLength(bank.questions.length);
  });

  it("returns only the capped pool when locked", () => {
    expect(visibleQuestions(bank.questions, false)).toHaveLength(GUEST_QUESTION_LIMIT);
  });
});

describe("a guest can still sit a full exam", () => {
  const guestBank = { ...bank, questions: visibleQuestions(bank.questions, false) };

  it("fills every band's paper from the reduced pool", () => {
    for (const band of ["11-12", "13-16", "17-20"]) {
      const { profile, paper } = buildPaper(guestBank, band, { shuffle: true });
      expect(paper).toHaveLength(profile.questions);
      expect(new Set(paper.map((q) => q.id)).size).toBe(paper.length);
    }
  });

  it("still honours the topic blueprint", () => {
    const { paper } = buildPaper(guestBank, "11-12", { shuffle: true });
    const counts = {};
    for (const q of paper) if (q.subject === "bangla") counts[q.topic] = (counts[q.topic] ?? 0) + 1;
    for (const [topic, want] of Object.entries(bank.topic_blueprint.bangla)) {
      expect(counts[topic] ?? 0).toBe(want);
    }
  });

  it("fills the 40-question demo", () => {
    const { paper } = buildPaper(guestBank, "13-16", { count: 40, shuffle: true });
    expect(paper).toHaveLength(40);
  });
});
