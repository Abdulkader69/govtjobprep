import { describe, it, expect } from "vitest";
import { bankBreakdown, usageEstimate, adminWarnings, FIRESTORE_FREE, BANK_CHUNK } from "../adminStats.js";

const q = (id, subject, topic, difficulty = "medium", extra = {}) => ({
  id, subject, topic, difficulty, status: "reviewed", stem: "s", options: ["a", "b"], answer: 0, explanation: "e", ...extra,
});
const full = {
  questions: [
    q("1", "math", "গড়"),
    q("2", "math", "গড়", "hard"),
    q("3", "bangla", "সন্ধি"),
    q("4", "gk", "সংবিধান", "easy", { expires_at: "2027-01-01" }),
  ],
};
const guest = { questions: [q("1", "math", "গড়"), q("3", "bangla", "সন্ধি")] };

describe("bankBreakdown", () => {
  it("counts totals, guest share, and groups", () => {
    const b = bankBreakdown(full, guest);
    expect(b).toMatchObject({ total: 4, guest: 2, private: 2, expiring: 1 });
    expect(b.bySubject.find((s) => s.subject === "math")).toEqual({ subject: "math", total: 2, guest: 1 });
    expect(b.topics.math).toEqual([{ topic: "গড়", total: 2, guest: 1 }]);
    expect(b.byDifficulty.map((d) => d.difficulty).sort()).toEqual(["easy", "hard", "medium"]);
  });

  it("chunks the way the upload script does and measures each chunk", () => {
    const many = { questions: Array.from({ length: BANK_CHUNK + 1 }, (_, i) => q(String(i), "math", "t")) };
    const b = bankBreakdown(many, { questions: [] });
    expect(b.chunks.map((c) => c.count)).toEqual([BANK_CHUNK, 1]);
    expect(b.chunks[0].bytes).toBeGreaterThan(b.chunks[1].bytes);
    expect(b.bytes).toBe(b.chunks[0].bytes + b.chunks[1].bytes);
  });
});

describe("usageEstimate", () => {
  const now = new Date("2026-09-20T15:00:00").getTime();
  const users = [
    { uid: "a", session: { since: new Date("2026-09-20T09:00:00").getTime() } },
    { uid: "b", session: { since: new Date("2026-09-19T09:00:00").getTime() } },
    { uid: "c", session: null },
  ];

  it("counts today's logins and live sessions", () => {
    const u = usageEstimate({ users, orphanSessions: 1, bankBytes: 700_000, now });
    expect(u.loginsToday).toBe(1);
    expect(u.sessions).toBe(3);
    expect(u.storage.limit).toBe(FIRESTORE_FREE.storageBytes);
    expect(u.storage.warn).toBe(false);
    expect(u.reads.used).toBeGreaterThan(0);
  });

  it("flags a meter at 80% of the free tier", () => {
    const u = usageEstimate({ users: [], bankBytes: FIRESTORE_FREE.storageBytes * 0.85, now });
    expect(u.storage.warn).toBe(true);
  });
});

describe("adminWarnings", () => {
  it("is empty when everything is fine", () => {
    expect(
      adminWarnings({
        bank: { chunks: [{ index: 0, bytes: 100 }] },
        usage: usageEstimate(),
        deployedVersion: "abc",
        uploadedVersion: "abc",
        deployedAt: "2026-09-21T10:00:00Z", // rebuilt later, same content: not a warning
        uploadedAt: "2026-09-20T10:00:30Z",
      })
    ).toEqual([]);
  });

  it("orders danger before warning before info", () => {
    const w = adminWarnings({
      bankMissing: true,
      bank: { chunks: [{ index: 2, bytes: FIRESTORE_FREE.docMaxBytes * 0.9 }] },
      deployedVersion: "new",
      uploadedVersion: "old",
      deployedAt: "2026-09-21T00:00:00Z",
      uploadedAt: "2026-09-20T00:00:00Z",
      orphanSessions: 2,
    });
    expect(w.map((x) => x.level)).toEqual(["danger", "warning", "warning", "info"]);
    expect(w[1].text).toContain("chunk-2");
    expect(w[2].action).toContain("bank:upload");
  });

  it("tells the admin to redeploy when Firestore is newer than the app", () => {
    const w = adminWarnings({ deployedVersion: "old", uploadedVersion: "new", deployedAt: "2026-09-19T00:00:00Z", uploadedAt: "2026-09-20T00:00:00Z" });
    expect(w[0].action).toContain("ডিপ্লয়");
  });
});
