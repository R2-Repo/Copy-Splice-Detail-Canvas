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
 *   node scripts/import-diagnostics-qa.mjs <csv-path> --out-dir <dir> [--basename <name>]
 *
 * Example:
 *   node scripts/import-diagnostics-qa.mjs docs/reference/examples/Left-STATE_OFFICE.csv \
 *     --out-dir docs/reference/import-diagnostics --basename Left-STATE_OFFICE
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BASE_URL = process.env.SDC_DEV_URL ?? "http://localhost:5173/";

function parseArgs(argv) {
  const csvArg = argv[2];
  if (!csvArg) {
    console.error(
      "Usage: node scripts/import-diagnostics-qa.mjs <csv-path> [screenshot-path]\n" +
        "       node scripts/import-diagnostics-qa.mjs <csv-path> --out-dir <dir> [--basename <name>]",
    );
    process.exit(1);
  }

  let screenshotPath;
  let outDir;
  let baseName;

  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--out-dir" && argv[i + 1]) {
      outDir = resolve(ROOT, argv[++i]);
      continue;
    }
    if (argv[i] === "--basename" && argv[i + 1]) {
      baseName = argv[++i];
      continue;
    }
    if (!screenshotPath && !argv[i].startsWith("--")) {
      screenshotPath = resolve(argv[i]);
    }
  }

  const csvPath = resolve(ROOT, csvArg);
  readFileSync(csvPath, "utf8");

  if (outDir) {
    mkdirSync(outDir, { recursive: true });
    const stem = baseName ?? basename(csvPath, ".csv");
    screenshotPath = join(outDir, `${stem}-screenshot.png`);
  } else {
    screenshotPath ??= join(ROOT, "import-qa-screenshot.png");
  }

  return { csvPath, screenshotPath, outDir, baseName: baseName ?? basename(csvPath, ".csv") };
}

const { csvPath, screenshotPath, outDir, baseName } = parseArgs(process.argv);

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

function formatConsoleLine(msg) {
  const type = msg.type();
  const text = msg.text();
  if (type === "startGroupCollapsed") return `[startGroupCollapsed] ${text}`;
  if (type === "endGroup") return `[endGroup]`;
  if (type === "table") return `[table] ${text}`;
  return `[${type}] ${text}`;
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

const consoleLines = [];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(360_000);
page.setDefaultNavigationTimeout(120_000);

page.on("console", (msg) => {
  consoleLines.push(formatConsoleLine(msg));
});

const start = performance.now();
await page.goto(BASE_URL, { waitUntil: "networkidle" });
const [chooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.getByRole("button", { name: "Import file" }).click(),
]);
await chooser.setFiles(csvPath);
const timing = await waitForImportComplete(page, start);

await page.screenshot({ path: screenshotPath, fullPage: false });

const nodeCount = await page.locator(".react-flow__node").count();
const edgeCount = await page.locator(".react-flow__edge").count();

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

const runSummary = {
  capturedAt: new Date().toISOString(),
  csv: basename(csvPath),
  csvPath,
  heuristic: formatMs(timing.heuristicMs),
  total: formatMs(timing.totalMs),
  nodes: nodeCount,
  edges: edgeCount,
  banner: banner || null,
  screenshot: screenshotPath,
  diagnosticsTotalMs: diagnostics?.totalMs,
  phaseTimings: diagnostics?.phaseTimings,
  searchStats: diagnostics?.searchStats,
  fallback: diagnostics?.fallback,
  recoverableSelection: diagnostics?.recoverableSelection,
  fastPath: diagnostics?.fastPath,
  performanceBudget: diagnostics?.performanceBudget,
  ruleRejectCounts: diagnostics?.ruleRejectCounts,
  topBottomSummary: diagnostics?.topBottomSummary,
  finalistSummaries: diagnostics?.finalistSummaries,
  winner: diagnostics?.winner,
};

const PERF_BUDGET_WARN_MS = 10_000;
const PERF_BUDGET_FAIL_MS = 15_000;
const enforceBudget = process.env.SDC_ENFORCE_PERF_BUDGET === "1";
const debugMode = diagnostics?.performanceBudget?.enabled === false;

if (diagnostics?.performanceBudget?.exceeded) {
  console.warn(
    `[import-qa] optimizer exceeded ${PERF_BUDGET_FAIL_MS}ms budget: ${diagnostics.performanceBudget.optimizerWallMs}ms`,
  );
}

if (
  enforceBudget &&
  !debugMode &&
  diagnostics?.performanceBudget?.exceeded
) {
  console.error(
    `[import-qa] FAIL: optimizer wall ${diagnostics.performanceBudget.optimizerWallMs}ms exceeds ${PERF_BUDGET_FAIL_MS}ms`,
  );
  process.exitCode = 1;
} else if (
  !debugMode &&
  timing.totalMs > PERF_BUDGET_FAIL_MS &&
  !diagnostics?.fastPath?.used
) {
  console.warn(
    `[import-qa] total import ${formatMs(timing.totalMs)} exceeds ${PERF_BUDGET_FAIL_MS}ms (no fast-path)`,
  );
}

if (outDir) {
  const consolePath = join(outDir, `${baseName}-console.log`);
  const diagnosticsPath = join(outDir, `${baseName}-diagnostics.json`);
  const summaryPath = join(outDir, `${baseName}-run-summary.json`);

  writeFileSync(consolePath, `${consoleLines.join("\n")}\n`, "utf8");
  writeFileSync(diagnosticsPath, `${JSON.stringify(diagnostics, null, 2)}\n`, "utf8");
  writeFileSync(summaryPath, `${JSON.stringify(runSummary, null, 2)}\n`, "utf8");

  runSummary.consoleLog = consolePath;
  runSummary.diagnosticsPath = diagnosticsPath;
  runSummary.summaryPath = summaryPath;
}

console.log(JSON.stringify(runSummary, null, 2));

await browser.close();
