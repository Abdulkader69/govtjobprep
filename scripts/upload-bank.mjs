/**
 * Push the full question bank to Firestore, where only `plan: "full"`
 * accounts and admins can read it (see firestore.rules).
 *
 *   npm run bank:upload
 *
 * Signs in with a super-admin account using the ordinary web SDK — no service
 * account, no firebase-admin. Reads VITE_FIREBASE_* from .env; the admin
 * email and password come from FIREBASE_ADMIN_EMAIL / FIREBASE_ADMIN_PASSWORD
 * (environment or .env — .env is git-ignored) or are asked for interactively.
 *
 * Layout in Firestore:
 *   bank/meta      { version, chunks, total_questions, generated_at, exam_profiles, topic_blueprint }
 *   bank/chunk-N   { index: N, questions: [...] }     ~250 questions each, well under the 1 MiB limit
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { loadEnv } from "vite";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, doc, getDocs, writeBatch } from "firebase/firestore";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CHUNK = 250;

// Empty prefix: load every variable in .env, not only VITE_*, so the admin
// credentials can live there too. Nothing without VITE_ ever reaches the bundle.
const env = { ...loadEnv("production", root, ""), ...process.env };
for (const k of ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_AUTH_DOMAIN", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"]) {
  if (!env[k]) {
    console.error(`${k} is not set in .env`);
    process.exit(1);
  }
}

const bank = JSON.parse(readFileSync(join(root, "src/data/question-bank.json"), "utf8"));
const version =
  bank.meta.version ?? createHash("sha256").update(JSON.stringify(bank.questions)).digest("hex").slice(0, 12);

const rl = createInterface({ input: stdin, output: stdout });
const email = env.FIREBASE_ADMIN_EMAIL || (await rl.question("Admin email: "));
const password = env.FIREBASE_ADMIN_PASSWORD || (await rl.question("Password: "));
rl.close();

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const auth = getAuth(app);
const db = getFirestore(app);

try {
  await signInWithEmailAndPassword(auth, email, password);
} catch (err) {
  console.error(`sign-in failed: ${err.code ?? err.message}`);
  process.exit(1);
}

const chunks = [];
for (let i = 0; i < bank.questions.length; i += CHUNK) chunks.push(bank.questions.slice(i, i + CHUNK));

// Firestore batches take 500 writes; ours is a handful, so one batch does.
const batch = writeBatch(db);
chunks.forEach((questions, index) => batch.set(doc(db, "bank", `chunk-${index}`), { index, questions }));
batch.set(doc(db, "bank", "meta"), {
  version,
  chunks: chunks.length,
  total_questions: bank.questions.length,
  generated_at: bank.meta.generated_at,
  exam_profiles: bank.exam_profiles,
  topic_blueprint: bank.topic_blueprint,
});

// Remove chunks left over from a larger previous upload.
const existing = await getDocs(collection(db, "bank"));
for (const d of existing.docs) {
  const m = /^chunk-(\d+)$/.exec(d.id);
  if (m && Number(m[1]) >= chunks.length) batch.delete(d.ref);
}

try {
  await batch.commit();
} catch (err) {
  console.error(
    err.code === "permission-denied"
      ? `permission denied — is ${email} in the admins collection, and are firestore.rules published?`
      : `upload failed: ${err.code ?? err.message}`
  );
  process.exit(1);
}

console.log(`uploaded ${bank.questions.length} questions in ${chunks.length} chunks · version ${version}`);
process.exit(0);
