/**
 * Run sdc-workspace: find CSV in input/, export top N .sdc.json to output/.
 * Uses Python sidecar (daemon-accelerated export-top).
 *
 * Usage: node scripts/sdc-workspace-run.mjs [workspaceDir] [--deep]
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const defaultWorkspace = join(ROOT, "sdc-workspace");
const pythonCmd = process.platform === "win32" ? "python" : "python3";

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

function runPython(args, label) {
  const result = spawnSync(pythonCmd, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, SDC_REPO_ROOT: ROOT },
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`\n[FAIL] ${label}`);
    console.error(result.stderr || result.stdout || "unknown error");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
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
console.log(`  Mode:   ${deep ? "deep-search (Python)" : "export-top"}`);
console.log("");

mkdirSync(outDir, { recursive: true });

if (!existsSync(join(ROOT, "node_modules", "tsx", "dist", "cli.mjs"))) {
  console.error("tsx missing — run.bat should have run npm install first.");
  process.exit(1);
}

const sidecarCheck = spawnSync(
  pythonCmd,
  ["-m", "sdc", "daemon", "status"],
  { cwd: ROOT, encoding: "utf8", env: { ...process.env, SDC_REPO_ROOT: ROOT } },
);
if (sidecarCheck.status !== 0) {
  console.log("Starting TS eval daemon pool...");
  runPython(["-m", "sdc", "daemon", "start", "--workers", "1"], "daemon start");
}

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
    const parsed = JSON.parse(deepOut);
    writeFileSync(
      join(outDir, "search-summary.json"),
      JSON.stringify(
        {
          mode: "deep-search",
          csvPath: relCsv,
          bestScore: parsed.bestScore,
          comparison: parsed.comparison,
          incumbent: parsed.incumbent,
          wallMs: parsed.wallMs,
        },
        null,
        2,
      ) + "\n",
      "utf8",
    );
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
  ],
  "export-top",
);

try {
  const parsed = JSON.parse(exportOut);
  console.log("");
  console.log("Done. Import in the web app (Import file):");
  for (const exp of parsed.exports ?? []) {
    console.log(`  ${exp.fileName}  score=${exp.score}  feasible=${exp.feasible}`);
  }
  console.log(`\nSummary: ${join(outDir, "search-summary.json")}`);
} catch {
  console.log(exportOut.slice(0, 2000));
}
