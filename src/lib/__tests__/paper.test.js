import { describe, it, expect } from "vitest";
import {
  buildPaper,
  supply,
  isServable,
  difficultyQuota,
  drawByDifficulty,
  withPermutedOptions,
  allocate,
  drawSubject,
  resizeProfile,
} from "../paper.js";
import bank from "../../data/question-bank.json";

/** A question bank small enough to reason about exactly. */
const fake = (over = {}) => ({
  id: Math.random().toString(36).slice(2),
  subject: "bangla",
  topic: "t",
  difficulty: "easy",
  grade_bands: ["13-16"],
  stem: "s",
  options: ["a", "b", "c", "d"],
  answer: 0,
  explanation: "e",
  status: "reviewed",
  expires_at: null,
  ...over,
});

describe("buildPaper", () => {
  it("only draws questions tagged for the requested band", () => {
    for (const band of ["11-12", "13-16", "17-20"]) {
      const { paper } = buildPaper(bank, band);
      expect(paper.every((q) => q.grade_bands.includes(band))).toBe(true);
    }
  });

  it("never exceeds a subject weight", () => {
    const { profile, paper } = buildPaper(bank, "13-16");
    for (const [subject, want] of Object.entries(profile.subject_weights)) {
      expect(paper.filter((q) => q.subject === subject).length).toBeLessThanOrEqual(want);
    }
  });

  it("never repeats a question within one paper", () => {
    const { paper } = buildPaper(bank, "11-12");
    expect(new Set(paper.map((q) => q.id)).size).toBe(paper.length);
  });

  it("throws on an unknown band rather than returning an empty paper", () => {
    expect(() => buildPaper(bank, "99-99")).toThrow();
  });

  it("honours the difficulty mix when the bank can supply it", () => {
    const questions = [
      ...Array.from({ length: 50 }, () => fake({ difficulty: "easy" })),
      ...Array.from({ length: 50 }, () => fake({ difficulty: "medium" })),
      ...Array.from({ length: 50 }, () => fake({ difficulty: "hard" })),
    ];
    const testBank = {
      exam_profiles: [
        {
          grade_band: "13-16",
          questions: 20,
          minutes: 60,
          negative_mark: 0,
          pass_percent: 50,
          difficulty_mix: { easy: 50, medium: 25, hard: 25 },
          subject_weights: { bangla: 20 },
        },
      ],
      questions,
    };
    const { paper } = buildPaper(testBank, "13-16");
    const count = (d) => paper.filter((q) => q.difficulty === d).length;
    expect(paper).toHaveLength(20);
    expect(count("easy")).toBe(10);
    expect(count("medium")).toBe(5);
    expect(count("hard")).toBe(5);
  });

  it("backfills a full paper when a difficulty bucket is thin", () => {
    const questions = [
      ...Array.from({ length: 20 }, () => fake({ difficulty: "easy" })),
      fake({ difficulty: "hard" }),
    ];
    const testBank = {
      exam_profiles: [
        {
          grade_band: "13-16",
          questions: 10,
          minutes: 60,
          negative_mark: 0,
          pass_percent: 50,
          difficulty_mix: { easy: 20, medium: 30, hard: 50 },
          subject_weights: { bangla: 10 },
        },
      ],
      questions,
    };
    const { paper } = buildPaper(testBank, "13-16");
    // A short paper would be worse than a paper of slightly the wrong shape.
    expect(paper).toHaveLength(10);
  });
});

describe("isServable", () => {
  const now = Date.parse("2026-01-01T00:00:00Z");

  it("serves a reviewed question with no expiry", () => {
    expect(isServable(fake(), now)).toBe(true);
  });

  it("withholds a draft so an unchecked import cannot reach a candidate", () => {
    expect(isServable(fake({ status: "draft" }), now)).toBe(false);
  });

  it("withholds a retired question", () => {
    expect(isServable(fake({ status: "retired" }), now)).toBe(false);
  });

  it("withholds a question whose facts have expired", () => {
    expect(isServable(fake({ expires_at: "2025-06-30T00:00:00Z" }), now)).toBe(false);
    expect(isServable(fake({ expires_at: "2027-06-30T00:00:00Z" }), now)).toBe(true);
  });

  it("keeps serving a question with no status, so old content stays valid", () => {
    const { status, ...noStatus } = fake();
    expect(isServable(noStatus, now)).toBe(true);
  });
});

describe("buildPaper lifecycle filtering", () => {
  it("leaves drafts and expired questions out of the paper", () => {
    const testBank = {
      exam_profiles: [
        {
          grade_band: "13-16",
          questions: 5,
          minutes: 60,
          negative_mark: 0,
          pass_percent: 50,
          difficulty_mix: { easy: 100, medium: 0, hard: 0 },
          subject_weights: { bangla: 5 },
        },
      ],
      questions: [
        fake({ id: "ok-1" }),
        fake({ id: "ok-2" }),
        fake({ id: "draft-1", status: "draft" }),
        fake({ id: "gone-1", expires_at: "2020-01-01T00:00:00Z" }),
      ],
    };
    const { paper } = buildPaper(testBank, "13-16", { now: Date.parse("2026-01-01") });
    expect(paper.map((q) => q.id).sort()).toEqual(["ok-1", "ok-2"]);
  });
});

describe("difficultyQuota", () => {
  it("splits by percentage", () => {
    expect(difficultyQuota(100, { easy: 25, medium: 50, hard: 25 })).toEqual({
      easy: 25,
      medium: 50,
      hard: 25,
    });
  });

  it("always sums back to the requested total despite rounding", () => {
    for (const want of [7, 13, 33, 70, 80, 99]) {
      const q = difficultyQuota(want, { easy: 60, medium: 35, hard: 5 });
      expect(q.easy + q.medium + q.hard).toBe(want);
    }
  });

  it("returns null when a profile declares no mix, so callers fall back", () => {
    expect(difficultyQuota(10, undefined)).toBeNull();
    expect(difficultyQuota(10, { easy: 0, medium: 0, hard: 0 })).toBeNull();
  });
});

describe("drawByDifficulty", () => {
  it("falls back to plain slicing with no mix", () => {
    const items = Array.from({ length: 5 }, () => fake());
    expect(drawByDifficulty(items, 3, null)).toHaveLength(3);
  });

  it("keeps questions with an unrecognised difficulty usable as backfill", () => {
    const items = [fake({ difficulty: "unknown", id: "u1" }), fake({ difficulty: "unknown", id: "u2" })];
    const out = drawByDifficulty(items, 2, { easy: 100, medium: 0, hard: 0 });
    expect(out).toHaveLength(2);
  });
});

describe("withPermutedOptions", () => {
  it("keeps the answer pointing at the same option text", () => {
    const q = fake({ options: ["ক", "খ", "গ", "ঘ"], answer: 0 });
    for (let i = 0; i < 200; i++) {
      const p = withPermutedOptions(q);
      expect(p.options[p.answer]).toBe("ক");
      expect([...p.options].sort()).toEqual([...q.options].sort());
    }
  });

  it("spreads the key across all four positions", () => {
    // The whole point: the bank writes the correct option first every time.
    const seen = new Set();
    for (let i = 0; i < 500; i++) seen.add(withPermutedOptions(fake()).answer);
    expect([...seen].sort()).toEqual([0, 1, 2, 3]);
  });

  it("records the permutation so an attempt can be replayed", () => {
    const q = fake();
    const p = withPermutedOptions(q);
    expect(p.option_order.map((i) => q.options[i])).toEqual(p.options);
  });

  it("leaves a malformed question alone rather than corrupting it", () => {
    const broken = { ...fake(), answer: null };
    expect(withPermutedOptions(broken)).toBe(broken);
  });
});

describe("the assembled paper", () => {
  it("does not leave every key in the first slot", () => {
    const { paper } = buildPaper(bank, "13-16");
    const first = paper.filter((q) => q.answer === 0).length;
    // Binomial over ~80 questions at p=0.25; 60% would be a broken permutation.
    expect(first / paper.length).toBeLessThan(0.6);
  });
});

describe("supply", () => {
  it("reports a shortfall instead of silently serving a short paper", () => {
    const s = supply(bank, "17-20");
    expect(s.actual).toBeLessThanOrEqual(s.target);
    expect(s.short).toBe(s.actual < s.target);
  });

  it("reports the difficulty shortfall that a backfilled paper hides", () => {
    const s = supply(bank, "13-16");
    expect(s.perDifficulty.hard).toBeDefined();
    expect(s.perDifficulty.hard.want).toBeGreaterThan(0);
  });
});

describe("allocate", () => {
  it("scales relative weights to any total", () => {
    const blueprint = { a: 2, b: 2, c: 1 };
    expect(allocate(25, Object.entries(blueprint))).toEqual({ a: 10, b: 10, c: 5 });
    expect(allocate(20, Object.entries(blueprint))).toEqual({ a: 8, b: 8, c: 4 });
  });

  it("always sums back to the requested total", () => {
    const w = Object.entries({ p: 2, q: 2, r: 2, s: 1, t: 3, u: 2, v: 3, x: 3, y: 2, z: 5 });
    for (const want of [7, 13, 20, 25, 33, 70]) {
      const got = allocate(want, w);
      expect(Object.values(got).reduce((a, b) => a + b, 0)).toBe(want);
    }
  });

  it("returns null when nothing is weighted", () => {
    expect(allocate(10, [])).toBeNull();
    expect(allocate(10, [["a", 0]])).toBeNull();
  });
});

describe("drawSubject with a topic blueprint", () => {
  const items = (topic, n, difficulty = "easy") =>
    Array.from({ length: n }, (_, i) => fake({ id: `${topic}-${i}`, topic, difficulty }));

  it("respects the blueprint's topic proportions", () => {
    const pool = [...items("a", 20), ...items("b", 20), ...items("c", 20)];
    const out = drawSubject(pool, 10, null, { a: 3, b: 1, c: 1 });
    const count = (t) => out.filter((q) => q.topic === t).length;
    expect(out).toHaveLength(10);
    expect(count("a")).toBe(6);
    expect(count("b")).toBe(2);
    expect(count("c")).toBe(2);
  });

  it("backfills from other topics rather than serving a short paper", () => {
    // Only one question exists for topic "b", which is owed five.
    const pool = [...items("a", 20), ...items("b", 1)];
    const out = drawSubject(pool, 10, null, { a: 1, b: 1 });
    expect(out).toHaveLength(10);
    expect(new Set(out.map((q) => q.id)).size).toBe(10);
  });

  it("still serves questions whose topic the blueprint never mentions", () => {
    const pool = [...items("a", 2), ...items("unlisted", 20)];
    const out = drawSubject(pool, 10, null, { a: 1 });
    expect(out).toHaveLength(10);
    expect(out.some((q) => q.topic === "unlisted")).toBe(true);
  });

  it("falls back to difficulty-only drawing with no blueprint", () => {
    const pool = items("a", 20);
    expect(drawSubject(pool, 5, null, undefined)).toHaveLength(5);
  });
});

describe("the blueprint against the real bank", () => {
  it("matches the published paper shape for the 11-12 band", () => {
    const { perTopic } = supply(bank, "11-12");
    // The blueprint this table encodes: 2/2/2/1/3/2/3/3/2/5 across 25 questions.
    const wants = Object.values(perTopic.bangla).map((t) => t.want);
    expect(wants.reduce((a, b) => a + b, 0)).toBe(25);
    expect(perTopic.bangla["সাহিত্য (লেখক, রচনা, যুগ)"].want).toBe(5);
    expect(perTopic.bangla["প্রকৃতি-প্রত্যয়"].want).toBe(1);
  });

  it("never repeats a question even with topic quotas in play", () => {
    for (const band of ["11-12", "13-16", "17-20"]) {
      const { paper } = buildPaper(bank, band);
      expect(new Set(paper.map((q) => q.id)).size).toBe(paper.length);
    }
  });
});

describe("resizeProfile", () => {
  const profile = {
    grade_band: "13-16", questions: 80, minutes: 60, negative_mark: 0.25, pass_percent: 50,
    difficulty_mix: { easy: 40, medium: 45, hard: 15 },
    subject_weights: { bangla: 20, english: 20, math: 20, gk: 20 },
  };

  it("scales time with length, so a short paper is not a generous one", () => {
    expect(resizeProfile(profile, 40).minutes).toBe(30);
    expect(resizeProfile(profile, 20).minutes).toBe(15);
    expect(resizeProfile(profile, 10).minutes).toBe(8);
  });

  it("reallocates subject weights to the new total", () => {
    const r = resizeProfile(profile, 30);
    expect(Object.values(r.subject_weights).reduce((a, b) => a + b, 0)).toBe(30);
  });

  it("never returns a zero-minute exam", () => {
    expect(resizeProfile(profile, 1).minutes).toBeGreaterThanOrEqual(1);
  });

  it("returns the profile untouched when the count matches or is absent", () => {
    expect(resizeProfile(profile, null)).toBe(profile);
    expect(resizeProfile(profile, 80)).toBe(profile);
  });
});

describe("buildPaper with a chosen length", () => {
  it("serves exactly the requested number of questions", () => {
    for (const count of [10, 20, 40, 60]) {
      const { paper, profile } = buildPaper(bank, "13-16", { count, shuffle: true });
      expect(paper).toHaveLength(count);
      expect(profile.questions).toBe(count);
    }
  });

  it("keeps the blueprint shape at a reduced length", () => {
    const { paper } = buildPaper(bank, "13-16", { count: 40, shuffle: true });
    // 40 of 80 halves every subject: 20 → 10.
    for (const subject of ["bangla", "english", "math", "gk"]) {
      expect(paper.filter((q) => q.subject === subject).length).toBe(10);
    }
  });
});

describe("buildPaper restricted to subjects or topics", () => {
  it("draws only from the chosen subject", () => {
    const { paper } = buildPaper(bank, "13-16", { count: 20, subjects: ["math"], shuffle: true });
    expect(paper.length).toBeGreaterThan(0);
    expect(paper.every((q) => q.subject === "math")).toBe(true);
  });

  it("draws only from the chosen topics", () => {
    const topics = ["সন্ধি", "সমাস"];
    const { paper } = buildPaper(bank, "13-16", { count: 15, topics, shuffle: true });
    expect(paper.length).toBeGreaterThan(0);
    expect(paper.every((q) => topics.includes(q.topic))).toBe(true);
  });

  it("returns a short paper rather than padding from elsewhere", () => {
    // Far more questions requested than this topic holds.
    const { paper } = buildPaper(bank, "13-16", {
      count: 100, topics: ["প্রকৃতি-প্রত্যয়"], shuffle: true,
    });
    expect(paper.length).toBeLessThan(100);
    expect(paper.every((q) => q.topic === "প্রকৃতি-প্রত্যয়")).toBe(true);
  });

  it("still permutes options in a restricted paper", () => {
    const { paper } = buildPaper(bank, "13-16", { count: 20, subjects: ["gk"], shuffle: true });
    expect(paper.filter((q) => q.answer === 0).length / paper.length).toBeLessThan(0.8);
  });
});
