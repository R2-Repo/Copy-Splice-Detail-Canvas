/**
 * Headless import QA with optimizer diagnostics (dev only).
 *
 * Prerequisites:
 *   - `npm run dev` on http://127.0.0.1:5173
 *   - `.env.local` with `VITE_DEBUG_IMPORT_OPTIMIZER=1` (see .env.example)
 *   - Playwright: `npm install --prefix /tmp/sdc-playwright playwright` (one-time)
 *
 * Usage:
 *   node scripts/import-diagnostics-qa.mjs <csv-path> [screenshot-path]
 *
 * Example:
 *   node scripts/import-diagnostics-qa.mjs docs/reference/examples/Left-STATE_OFFICE.csv
 */
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.SDC_DEV_URL ?? "http://127.0.0.1:5173/";

const csvArg = process.argv[2];
if (!csvArg) {
  console.error(
    "Usage: node scripts/import-diagnostics-qa.mjs <csv-path> [screenshot-path]",
  );
  process.exit(1);
}

const csvPath = resolve(ROOT, csvArg);
readFileSync(csvPath, "utf8");

const screenshotPath = process.argv[3]
  ? resolve(process.argv[3])
  : join(ROOT, "import-qa-screenshot.png");

let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error(
    "Playwright not found. Install once:\n  npm install --prefix /tmp/sdc-playwright playwright",
  );
  process.exit(1);
}

function formatMs(ms) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m}m ${(s % 60).toFixed(1)}s`;
}

async function waitForImportComplete(page, startMs) {
  const overlay = page.locator(".layout-search-overlay");
  await page.waitForFunction(
    () => document.querySelectorAll(".react-flow__node").length > 0,
    { timeout: 360_000 },
  );
  const heuristicMs = performance.now() - startMs;
  if (await overlay.isVisible().catch(() => false)) {
    await overlay.waitFor({ state: "hidden", timeout: 360_000 });
  }
  await page.waitForTimeout(2500);
  return { heuristicMs, totalMs: performance.now() - startMs };
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(360_000);
page.setDefaultNavigationTimeout(120_000);

const start = performance.now();
await page.goto(BASE_URL, { waitUntil: "networkidle" });
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.getByRole("button", { name: "Import file" }).click(),
]);
await chooser.setFiles(csvPath);
const timing = await waitForImportComplete(page, start);
await page.screenshot({ path: screenshotPath, fullPage: false });

const diagnostics = await page.evaluate(() => {
  const w = window;
  if (typeof w.__SDC_PRINT_LAST_IMPORT_DIAGNOSTICS__ === "function") {
    w.__SDC_PRINT_LAST_IMPORT_DIAGNOSTICS__();
  }
  return w.__SDC_LAST_IMPORT_DIAGNOSTICS__ ?? null;
});

const banner = await page
  .locator(".config-error-banner")
  .innerText()
  .catch(() => "");

console.log(
  JSON.stringify(
    {
      csv: csvPath,
      heuristic: formatMs(timing.heuristicMs),
      total: formatMs(timing.totalMs),
      diagnosticsTotalMs: diagnostics?.totalMs,
      searchStats: diagnostics?.searchStats,
      fallback: diagnostics?.fallback,
      ruleRejectCounts: diagnostics?.ruleRejectCounts,
      banner: banner || null,
      screenshot: screenshotPath,
    },
    null,
    2,
  ),
);

await browser.close();
