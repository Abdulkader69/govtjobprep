import { describe, it, expect } from "vitest";
import { grade, bySubject, weakTopics } from "../scoring.js";

const profile = { negative_mark: 0.25, pass_percent: 50 };

const paper = [
  { id: "q1", subject: "bangla", topic: "সন্ধি", answer: 0 },
  { id: "q2", subject: "bangla", topic: "সন্ধি", answer: 1 },
  { id: "q3", subject: "math", topic: "শতকরা", answer: 2 },
  { id: "q4", subject: "math", topic: "শতকরা", answer: 3 },
];

describe("grade", () => {
  it("applies the negative mark only to wrong answers", () => {
    const r = grade(paper, { q1: 0, q2: 0, q3: 2 }, profile);
    expect(r.correct).toBe(2);
    expect(r.wrong).toBe(1);
    expect(r.blank).toBe(1);
    expect(r.penalty).toBe(0.25);
    expect(r.score).toBe(1.75);
  });

  it("never penalises a blank", () => {
    const r = grade(paper, {}, profile);
    expect(r.penalty).toBe(0);
    expect(r.score).toBe(0);
    expect(r.blank).toBe(4);
  });

  it("honours a profile with no negative marking", () => {
    const r = grade(paper, { q1: 1, q2: 0 }, { negative_mark: 0, pass_percent: 40 });
    expect(r.wrong).toBe(2);
    expect(r.score).toBe(0);
  });

  it("floors the score at zero instead of going negative", () => {
    const r = grade(paper, { q1: 1, q2: 0, q3: 0, q4: 0 }, profile);
    expect(r.score).toBe(0);
  });

  it("treats option index 0 as a real answer, not as missing", () => {
    const r = grade(paper, { q1: 0 }, profile);
    expect(r.correct).toBe(1);
    expect(r.blank).toBe(3);
  });

  it("passes only at or above the pass mark", () => {
    expect(grade(paper, { q1: 0, q2: 1 }, profile).passed).toBe(true);
    expect(grade(paper, { q1: 0 }, profile).passed).toBe(false);
  });
});

describe("bySubject", () => {
  it("reports per subject and drops subjects absent from the paper", () => {
    const rows = bySubject(paper, { q1: 0, q3: 2, q4: 0 });
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.key === "bangla")).toMatchObject({ correct: 1, total: 2 });
    expect(rows.find((r) => r.key === "english")).toBeUndefined();
  });
});

describe("weakTopics", () => {
  it("flags a topic the candidate mostly got wrong", () => {
    const weak = weakTopics(paper, { q1: 1, q2: 0, q3: 2, q4: 3 });
    expect(weak.map((w) => w.topic)).toEqual(["সন্ধি"]);
  });

  it("ignores topics with too few questions to judge", () => {
    const thin = [{ id: "x", subject: "gk", topic: "সংবিধান", answer: 0 }];
    expect(weakTopics(thin, { x: 1 })).toEqual([]);
  });
});
