#!/usr/bin/env node
/**
 * Split a scanned question paper into one image per page, ready for
 * transcription.
 *
 * Usage: node scripts/pdf-to-pages.mjs <paper.pdf> [outDir] [dpi]
 *
 * 300 dpi is the default because it is the lowest resolution at which Bengali
 * matras (ু vs ূ) and the ই/ঈ pair stay separable. Going below it does not save
 * enough to be worth the transcription errors; going much above it mostly
 * costs upload size.
 *
 * Requires poppler:  brew install poppler
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, existsSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";

const [, , pdf, outDir, dpi = "300"] = process.argv;

if (!pdf) {
  console.error("usage: node scripts/pdf-to-pages.mjs <paper.pdf> [outDir] [dpi]");
  process.exit(1);
}
if (!existsSync(pdf)) {
  console.error(`no such file: ${pdf}`);
  process.exit(1);
}

try {
  execFileSync("pdftoppm", ["-v"], { stdio: "ignore" });
} catch {
  console.error("pdftoppm not found. Install poppler:  brew install poppler");
  process.exit(1);
}

const name = basename(pdf, extname(pdf));
const dir = outDir ?? join("scans", name);
mkdirSync(dir, { recursive: true });

execFileSync("pdftoppm", ["-r", dpi, "-png", pdf, join(dir, "page")], {
  stdio: "inherit",
});

const pages = readdirSync(dir).filter((f) => f.endsWith(".png")).sort();
console.log(`\n${pages.length} page image${pages.length === 1 ? "" : "s"} at ${dpi} dpi → ${dir}/`);
console.log("Next: transcribe each page into draft questions — see docs/content-authoring.md");
