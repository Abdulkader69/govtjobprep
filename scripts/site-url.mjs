import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The origin the site is served from, without a trailing slash.
 *
 *   1. VITE_SITE_URL from .env or the environment (a custom domain, or local dev)
 *   2. Vercel's VERCEL_PROJECT_PRODUCTION_URL — the project's production
 *      domain, which Vercel sets on every build without any configuration
 *   3. "" — relative URLs; previews will not resolve, and build-seo warns
 */
export function siteUrl(env = { ...loadEnv(process.env.NODE_ENV || "production", root, ""), ...process.env }) {
  const explicit = (env.VITE_SITE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = (env.VERCEL_PROJECT_PRODUCTION_URL || "").trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "";
}
