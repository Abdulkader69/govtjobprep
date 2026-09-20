/**
 * Pure calculations behind the admin page. Nothing here touches Firebase;
 * the page feeds in what it fetched and renders what comes out, which is
 * what makes these testable.
 */

/** Firestore's Spark (free) plan, and one hard limit that is not a quota. */
export const FIRESTORE_FREE = {
  storageBytes: 1024 ** 3, // 1 GiB
  readsPerDay: 50_000,
  writesPerDay: 20_000,
  deletesPerDay: 20_000,
  docMaxBytes: 1024 ** 2, // 1 MiB per document — a hard limit, not a quota
};

/** Must match CHUNK in scripts/upload-bank.mjs. */
export const BANK_CHUNK = 250;

const WARN_AT = 0.8;
const KEY_SEP = "::";

const byteLength = (value) => new TextEncoder().encode(JSON.stringify(value)).length;

/**
 * Where the questions are: subject, topic, difficulty, guest vs private,
 * and how big each Firestore chunk is.
 */
export function bankBreakdown(full, guest) {
  const guestIds = new Set(guest?.questions?.map((q) => q.id) ?? []);
  const questions = full?.questions ?? [];

  const tally = (key) => {
    const m = new Map();
    for (const q of questions) {
      const k = key(q);
      const row = m.get(k) ?? { key: k, total: 0, guest: 0 };
      row.total += 1;
      if (guestIds.has(q.id)) row.guest += 1;
      m.set(k, row);
    }
    return [...m.values()];
  };

  const topics = {};
  for (const row of tally((q) => `${q.subject}${KEY_SEP}${q.topic}`)) {
    const [subject, topic] = row.key.split(KEY_SEP);
    (topics[subject] ??= []).push({ topic, total: row.total, guest: row.guest });
  }
  for (const list of Object.values(topics)) list.sort((a, b) => b.total - a.total);

  const chunks = [];
  for (let i = 0; i < questions.length; i += BANK_CHUNK) {
    const slice = questions.slice(i, i + BANK_CHUNK);
    chunks.push({
      index: chunks.length,
      count: slice.length,
      bytes: byteLength({ index: chunks.length, questions: slice }),
    });
  }

  return {
    total: questions.length,
    guest: guestIds.size,
    private: questions.length - guestIds.size,
    bySubject: tally((q) => q.subject).map(({ key, ...r }) => ({ subject: key, ...r })),
    byDifficulty: tally((q) => q.difficulty).map(({ key, ...r }) => ({ difficulty: key, ...r })),
    byStatus: tally((q) => q.status ?? "reviewed").map(({ key, ...r }) => ({ status: key, ...r })),
    expiring: questions.filter((q) => q.expires_at).length,
    topics,
    chunks,
    bytes: chunks.reduce((n, c) => n + c.bytes, 0),
  };
}

/**
 * A rough picture of what the project is using, from what the client can see.
 * Firestore does not expose its counters to the web SDK, so reads and writes
 * are projected from today's logins; storage is summed from document sizes.
 * The console has the real numbers — the page says so and links to it.
 */
export function usageEstimate({ users = [], orphanSessions = 0, bankBytes = 0, now = Date.now() } = {}) {
  const dayStart = new Date(now).setHours(0, 0, 0, 0);
  const loginsToday = users.filter((u) => u.session?.since && u.session.since >= dayStart).length;
  const sessions = users.filter((u) => u.session).length + orphanSessions;

  const docs = users.length + sessions + Math.ceil(bankBytes / (BANK_CHUNK * 450)) + 1;
  const storage = bankBytes + users.length * 260 + sessions * 320;

  // Per login: profile check + 3 listeners; an unlocked account adds a bank
  // fetch (meta + chunks) only when the version changed. Admin page loads
  // read every user and session. Deliberately generous.
  const reads = loginsToday * 12 + users.length + sessions;
  const writes = loginsToday * 2;

  const meter = (used, limit) => ({
    used,
    limit,
    ratio: limit ? used / limit : 0,
    warn: limit ? used / limit >= WARN_AT : false,
  });
  return {
    loginsToday,
    sessions,
    docs,
    storage: meter(storage, FIRESTORE_FREE.storageBytes),
    reads: meter(reads, FIRESTORE_FREE.readsPerDay),
    writes: meter(writes, FIRESTORE_FREE.writesPerDay),
  };
}

/**
 * Things an admin should act on, most serious first.
 * @returns {{ level: "danger" | "warning" | "info", text: string, action?: string }[]}
 */
export function adminWarnings({
  bank,
  usage,
  deployedVersion,
  uploadedVersion,
  deployedAt,
  uploadedAt,
  bankMissing = false,
  orphanSessions = 0,
  disabledCount = 0,
} = {}) {
  const out = [];

  if (bankMissing) {
    out.push({
      level: "danger",
      text: "প্রশ্নব্যাংক Firestore-এ নেই — পুরো ব্যাংক খোলা অ্যাকাউন্টগুলো কোনো প্রশ্ন পাবে না।",
      action: "npm run bank:upload চালান।",
    });
  }

  const bigChunk = bank?.chunks?.find((c) => c.bytes >= FIRESTORE_FREE.docMaxBytes * WARN_AT);
  if (bigChunk) {
    const over = bigChunk.bytes >= FIRESTORE_FREE.docMaxBytes;
    out.push({
      level: over ? "danger" : "warning",
      text: `ব্যাংকের chunk-${bigChunk.index} ${fmtBytes(bigChunk.bytes)} — Firestore-এর ১ MiB সীমার ${over ? "উপরে" : "কাছাকাছি"}।`,
      action: "scripts/upload-bank.mjs-এ CHUNK কমিয়ে (যেমন ১৫০) আবার আপলোড করুন।",
    });
  }

  // Same questions → same version, however many times the bank was rebuilt.
  if (deployedVersion && uploadedVersion && deployedVersion !== uploadedVersion) {
    const d = Date.parse(deployedAt ?? 0) || 0;
    const u = Date.parse(uploadedAt ?? 0) || 0;
    out.push(
        d > u
          ? {
              level: "warning",
              text: "অ্যাপে যে ব্যাংক আছে তা Firestore-এর চেয়ে নতুন — পুরো ব্যাংকে নতুন প্রশ্ন যায়নি।",
              action: "npm run bank:upload চালান।",
            }
          : {
              level: "warning",
              text: "Firestore-এর ব্যাংক অ্যাপের চেয়ে নতুন — গেস্টরা পুরনো প্রশ্ন দেখছেন।",
              action: "অ্যাপটি আবার ডিপ্লয় করুন।",
            }
    );
  }

  for (const [key, label] of [
    ["storage", "স্টোরেজ"],
    ["reads", "দৈনিক রিড"],
    ["writes", "দৈনিক রাইট"],
  ]) {
    const m = usage?.[key];
    if (m?.warn) {
      out.push({
        level: m.ratio >= 1 ? "danger" : "warning",
        text: `Firestore ${label} ফ্রি সীমার ${Math.round(m.ratio * 100)}% — ${m.ratio >= 1 ? "সীমা পেরিয়েছে" : "প্রায় পূর্ণ"}।`,
        action: "Firebase কনসোলের Usage পাতায় প্রকৃত সংখ্যা দেখুন।",
      });
    }
  }

  if (orphanSessions > 0) {
    out.push({
      level: "info",
      text: `${orphanSessions}টি সেশন এমন অ্যাকাউন্টের যার প্রোফাইল নেই (Authentication থেকে মুছে ফেলা)।`,
      action: "ব্যবহারকারী ট্যাব থেকে সেশনগুলো মুছে দিন।",
    });
  }
  if (disabledCount > 0) {
    out.push({ level: "info", text: `${disabledCount}টি অ্যাকাউন্ট বন্ধ করা আছে।` });
  }

  const rank = { danger: 0, warning: 1, info: 2 };
  return out.sort((a, b) => rank[a.level] - rank[b.level]);
}

export function fmtBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GiB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}
