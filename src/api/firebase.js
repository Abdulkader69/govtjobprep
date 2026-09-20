import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { firebaseConfig, isFirebaseConfigured } from "./firebase.config.js";

let cached = null;

/** App, Auth and Firestore handles, initialised once. Only auth.firebase.js imports this. */
export function firebase() {
  if (cached) return cached;
  if (!isFirebaseConfigured) throw new Error("Firebase is not configured — set VITE_FIREBASE_* in .env");
  const app = getApps()[0] ?? initializeApp(firebaseConfig);
  cached = { app, auth: getAuth(app), db: getFirestore(app) };
  return cached;
}
