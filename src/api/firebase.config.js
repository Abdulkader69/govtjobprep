/**
 * Firebase is configured entirely from `VITE_FIREBASE_*` env vars. These are
 * public identifiers by design — Firebase's security lives in Firestore rules
 * and Auth settings, not in hiding the config. See firestore.rules.
 *
 * Deliberately imports nothing from the SDK, so checking whether Firebase is
 * configured does not pull ~700 kB into the main bundle.
 */
const env = import.meta.env ?? {};

export const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);
