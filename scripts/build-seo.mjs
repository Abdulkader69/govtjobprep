/**
 * Write public/robots.txt and public/sitemap.xml from VITE_SITE_URL, so the
 * absolute URLs in them match the deployed origin. Runs as part of prebuild.
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { siteUrl } from "./site-url.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = siteUrl();

if (!site) {
  console.warn("build-seo: no VITE_SITE_URL and not on Vercel — sitemap will have relative URLs and og:image will not resolve.");
}

// Only pages with content worth indexing. Exam/result/admin are per-user.
const pages = [
  ["/", "1.0", "weekly"],
  ["/prepare", "0.9", "weekly"],
  ["/start", "0.8", "monthly"],
  ["/start?mode=topic", "0.7", "monthly"],
  ["/demo", "0.6", "monthly"],
  ["/register", "0.4", "yearly"],
  ["/login", "0.3", "yearly"],
];
const today = new Date().toISOString().slice(0, 10);
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages
  .map(
    ([p, pri, freq]) => `  <url>
    <loc>${site}${p.replace(/&/g, "&amp;")}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>
  </url>`
  )
  .join("\n")}
</urlset>
`;
writeFileSync(join(root, "public/sitemap.xml"), xml);
writeFileSync(
  join(root, "public/robots.txt"),
  `User-agent: *
Allow: /
Disallow: /admin
Disallow: /exam
Disallow: /result
Disallow: /review
Disallow: /profile

Sitemap: ${site}/sitemap.xml
`
);
console.log(`wrote public/sitemap.xml and public/robots.txt for ${site || "(no VITE_SITE_URL)"}`);
