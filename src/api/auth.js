import { isFirebaseConfigured } from "./firebase.config.js";
import { createLocalAuth } from "./auth.local.js";

export { AUTH_MESSAGES } from "./auth.messages.js";

/**
 * Sign-in transport, separate from the exam API so grading can stay in the
 * browser (`VITE_API_MODE=local`) while accounts live in Firebase.
 *
 *   firebase — Firebase Auth (email/password, phone OTP) + Firestore for the
 *              one-device-per-account rule. Default whenever VITE_FIREBASE_*
 *              is set.
 *   local    — the browser trusts itself. No server, no OTP, no device limit.
 *
 * Every method resolves to `{ ok: true, ... }` or `{ ok: false, code, message }`;
 * nothing here throws on a refusal. The Firebase SDK is loaded lazily so the
 * bundle for `local` mode never includes it.
 */
const requested = import.meta.env?.VITE_AUTH_MODE ?? "firebase";
export const authMode = requested === "local" || !isFirebaseConfigured ? "local" : "firebase";

let instance = null;

export async function getAuthApi() {
  if (instance) return instance;
  if (authMode === "firebase") {
    const { createFirebaseAuth } = await import("./auth.firebase.js");
    instance = createFirebaseAuth();
  } else {
    instance = createLocalAuth();
  }
  return instance;
}
