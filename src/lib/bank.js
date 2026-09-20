/**
 * Where the questions come from.
 *
 * Guests get `question-bank.guest.json`, a 500-question subset compiled at
 * build time. It is the only bank in the production bundle, so the private
 * questions are never downloadable by someone who is not entitled to them.
 *
 * Unlocked accounts fetch the full bank from Firestore (`bank/meta` plus
 * `bank/chunk-N`), where firestore.rules refuses anyone whose profile is not
 * `plan: "full"` (or an admin). It is cached in localStorage keyed by the
 * bank version, and the cache is wiped on sign-out.
 *
 * `VITE_BANK_SOURCE=bundle` (development, `local` auth) imports the full JSON
 * instead. Vite inlines that env value at build time, so with the default
 * `firestore` the `import()` below is dead code and the full bank is not
 * emitted at all — check `dist/assets` if you doubt it.
 */

const SOURCE = import.meta.env?.VITE_BANK_SOURCE === "bundle" ? "bundle" : "firestore";
const CACHE_KEY = "bdje.bank.full";

let guestPromise = null;
let fullPromise = null;

export const bankSource = SOURCE;

export function loadBank(unlocked) {
  return unlocked ? loadFull() : loadGuest();
}

function loadGuest() {
  return (guestPromise ??= import("@/data/question-bank.guest.json").then((m) => m.default));
}

function loadFull() {
  if (fullPromise) return fullPromise;
  fullPromise = (SOURCE === "bundle" ? loadBundled() : loadFromFirestore()).catch((err) => {
    fullPromise = null; // let the next call retry
    throw err;
  });
  return fullPromise;
}

async function loadBundled() {
  // Never reached in a `firestore` build; see the header comment.
  if (import.meta.env?.VITE_BANK_SOURCE !== "bundle") throw new Error("bundle bank unavailable");
  const m = await import("@/data/question-bank.json");
  return m.default;
}

async function loadFromFirestore() {
  const { collection, doc, getDoc, getDocs } = await import("firebase/firestore");
  const { firebase } = await import("@/api/firebase.js");
  const { db } = firebase();

  const metaSnap = await getDoc(doc(db, "bank", "meta"));
  if (!metaSnap.exists()) throw new Error("bank/meta missing — run `npm run bank:upload`");
  const meta = metaSnap.data();

  const cached = readCache();
  if (cached?.meta?.version === meta.version) return cached;

  const chunks = await getDocs(collection(db, "bank"));
  const parts = chunks.docs
    .filter((d) => d.id.startsWith("chunk-"))
    .map((d) => d.data())
    .sort((x, y) => x.index - y.index);
  if (parts.length !== meta.chunks) throw new Error(`bank: expected ${meta.chunks} chunks, got ${parts.length}`);

  const bank = {
    meta: { ...meta, tier: "full" },
    exam_profiles: meta.exam_profiles,
    topic_blueprint: meta.topic_blueprint,
    questions: parts.flatMap((p) => p.questions),
  };
  writeCache(bank);
  return bank;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(bank) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(bank));
  } catch {
    // Quota or private mode: fine, we just refetch next time.
  }
}

/** Forget the full bank. Called on sign-out so the next visitor cannot read it. */
export function clearFullBank() {
  fullPromise = null;
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* nothing to do */
  }
}
