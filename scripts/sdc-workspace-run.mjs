/**
 * Run sdc-workspace: find CSV in input/, export top N .sdc.json to output/.
 * Refreshes TS eval daemon, runs import-rules preflight, matches app time budget.
 *
 * Usage: node scripts/sdc-workspace-run.mjs [workspaceDir] [--deep]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultWorkspace = join(ROOT, "sdc-workspace");
const pythonCmd = process.platform === "win32" ? "python" : "python3";

/** Same formula as importTimeBudgetMs in src/features/layoutSearch/importSearchConfig.ts */
function importTimeBudgetMs(strandCount) {
  return Math.min(300_000, 90_000 + strandCount * 2_500);
}

function normalizeDir(arg) {
  if (!arg) return defaultWorkspace;
  const cleaned = arg.replace(/^["']+|["']+$/g, "").replace(/\\+$/, "");
  return resolve(cleaned || defaultWorkspace);
}

function findCsv(workspaceDir) {
  const inputDir = join(workspaceDir, "input");
  const candidates = [];

  const inputCsv = join(workspaceDir, "input.csv");
  if (existsSync(inputCsv)) candidates.push(inputCsv);

  if (existsSync(inputDir)) {
    for (const name of readdirSync(inputDir)) {
      if (name.toLowerCase().endsWith(".csv")) {
        candidates.push(join(inputDir, name));
      }
    }
  }

  if (existsSync(workspaceDir)) {
    for (const name of readdirSync(workspaceDir)) {
      if (!name.toLowerCase().endsWith(".csv")) continue;
      candidates.push(join(workspaceDir, name));
    }
  }

  if (candidates.length === 0) {
    console.error(
      "No CSV found. Place a Bentley CSV at:\n" +
        `  ${join(workspaceDir, "input.csv")}\n` +
        `  or ${join(inputDir, "your-file.csv")}`,
    );
    process.exit(1);
  }

  if (candidates.length > 1) {
    console.error(
      "Multiple CSV files found — keep only one:\n" +
        candidates.map((p) => `  ${p}`).join("\n"),
    );
    process.exit(1);
  }

  return candidates[0];
}

function runPython(args, label, { allowFailure = false } = {}) {
  const result = spawnSync(pythonCmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SDC_REPO_ROOT: ROOT },
    shell: false,
  });
  if (result.status !== 0 && !allowFailure) {
    console.error(`\n[FAIL] ${label}`);
    console.error(result.stderr || result.stdout || "unknown error");
    process.exit(result.status ?? 1);
  }
  return result.stdout ?? "";
}

function parseJson(text, label) {
  try {
    return JSON.parse(text.trim());
  } catch {
    console.error(`[FAIL] ${label} — invalid JSON`);
    process.exit(1);
  }
}

function strandCountFromParseSummary(summary) {
  if (!summary) return 0;
  if (typeof summary.fiberConnections === "number") return summary.fiberConnections;
  if (typeof summary.connectionCount === "number") return summary.connectionCount;
  return (summary.fiberConnections ?? 0) + (summary.tubeConnections ?? 0);
}

function warnImportRules(importRules) {
  if (importRules?.feasible !== false) {
    console.log("Import rules: OK");
    return;
  }
  console.warn("\n[WARN] Import validation failed (continuing — same as PWA banner):");
  for (const v of importRules.violations ?? []) {
    if (!v.ok) {
      console.warn(`  ${v.id}: ${v.detail}`);
    }
  }
  console.warn("");
}

function mergeSearchSummary(outDir, patch) {
  const summaryPath = join(outDir, "search-summary.json");
  let base = {};
  if (existsSync(summaryPath)) {
    try {
      base = JSON.parse(readFileSync(summaryPath, "utf8"));
    } catch {
      base = {};
    }
  }
  writeFileSync(summaryPath, `${JSON.stringify({ ...base, ...patch }, null, 2)}\n`, "utf8");
}

const argv = process.argv.slice(2);
const deep = argv.includes("--deep");
const workspaceArg = argv.find((a) => !a.startsWith("--"));
const workspaceDir = normalizeDir(workspaceArg);
const csvPath = findCsv(workspaceDir);
const outDir = join(workspaceDir, "output");
const relCsv = csvPath.startsWith(ROOT)
  ? csvPath.slice(ROOT.length + 1).replace(/\\/g, "/")
  : csvPath.replace(/\\/g, "/");

console.log("SDC workspace run");
console.log(`  CSV:    ${csvPath}`);
console.log(`  Output: ${outDir}`);
console.log(`  Mode:   ${deep ? "deep-search + export-top" : "export-top"}`);
console.log("  Rules:  src/features/rules (TS — fresh process each export-top)");
console.log("");

mkdirSync(outDir, { recursive: true });

if (!existsSync(join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"))) {
  console.error("tsx missing — run.bat should have run npm install first.");
  process.exit(1);
}

console.log("Refreshing TS eval daemon (latest rule code)...");
runPython(["-m", "sdc", "daemon", "stop"], "daemon stop", { allowFailure: true });
runPython(["-m", "sdc", "daemon", "start", "--workers", "1"], "daemon start");

console.log("Parsing CSV...");
const parseOut = runPython(["-m", "sdc", "parse", csvPath], "parse");
const parsed = parseJson(parseOut, "parse");
const strandCount = strandCountFromParseSummary(parsed.summary);
const timeBudgetMs = importTimeBudgetMs(strandCount);
console.log(`  Strands: ${strandCount}  Time budget: ${timeBudgetMs}ms`);

console.log("Running import-rules preflight...");
const importRulesOut = runPython(["-m", "sdc", "import-rules", csvPath], "import-rules");
const importRulesResult = parseJson(importRulesOut, "import-rules");
const importRules = {
  feasible: importRulesResult.feasible,
  violations: importRulesResult.violations ?? [],
  ruleRejectCounts: importRulesResult.ruleRejectCounts ?? {},
  importRuleIds: importRulesResult.importRuleIds ?? [],
};
warnImportRules(importRules);

if (deep) {
  console.log("Running deep-search (may take several minutes)...");
  const deepOut = runPython(
    [
      "-m",
      "sdc",
      "deep-search",
      csvPath,
      "--strategy",
      "evolutionary",
      "--time-budget-ms",
      "120000",
      "--population-size",
      "96",
      "--max-generations",
      "15",
      "--out",
      join(outDir, "deep-search-result.json"),
    ],
    "deep-search",
  );
  try {
    const deepParsed = JSON.parse(deepOut);
    mergeSearchSummary(outDir, {
      deepSearch: {
        mode: "deep-search",
        csvPath: relCsv,
        bestScore: deepParsed.bestScore,
        comparison: deepParsed.comparison,
        incumbent: deepParsed.incumbent,
        wallMs: deepParsed.wallMs,
      },
    });
  } catch {
    /* deep-search stdout may be large */
  }
}

console.log("Exporting top layout files...");
const exportOut = runPython(
  [
    "-m",
    "sdc",
    "export-top",
    csvPath,
    "--out-dir",
    outDir,
    "--top",
    "5",
    "--max-rounds",
    "2000",
    "--time-budget-ms",
    String(timeBudgetMs),
  ],
  "export-top",
);

const exportParsed = parseJson(exportOut, "export-top");

mergeSearchSummary(outDir, {
  mode: deep ? "deep-search + export-top" : "export-top",
  rulesEngine: "src/features/rules (TS)",
  csvPath: relCsv,
  strandCount,
  timeBudgetMs,
  maxRounds: 2000,
  importRulesPreflight: importRules,
});

console.log("");
console.log("Done. Import in the web app (Import file):");
for (const exp of exportParsed.exports ?? []) {
  console.log(`  ${exp.fileName}  score=${exp.score}  feasible=${exp.fasible}`);
}
console.log(`\nSummary: ${join(outDir, "search-summary.json")}`);
