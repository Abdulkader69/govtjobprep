import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: {
    // Only the exam API (VITE_API_MODE=http) goes through here, to a local
    // Laravel. Sign-in talks to Firebase directly.
    proxy: {
      "/api": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
  test: {
    environment: "node",
    // Tests never touch Firebase, whatever .env says: local sign-in, and the
    // full bank imported from disk rather than fetched from Firestore.
    env: { VITE_AUTH_MODE: "local", VITE_BANK_SOURCE: "bundle" },
  },
});
