/**
 * Run sdc-workspace: find CSV in input/, export top N .sdc.json to output/.
 *
 * Usage: node scripts/sdc-workspace-run.mjs [workspaceDir]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tsxCli = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");
const defaultWorkspace = join(ROOT, "sdc-workspace");

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

  // Also accept a single CSV placed directly in the workspace folder
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

const workspaceDir = normalizeDir(process.argv[2]);
const csvPath = findCsv(workspaceDir);
const outDir = join(workspaceDir, "output");
const relCsv = csvPath.startsWith(ROOT)
  ? csvPath.slice(ROOT.length + 1).replace(/\\/g, "/")
  : csvPath.replace(/\\/g, "/");

console.log("SDC workspace run");
console.log(`  CSV:    ${csvPath}`);
console.log(`  Output: ${outDir}`);
console.log("");

if (!existsSync(tsxCli)) {
  console.error("tsx missing — run npm install in repo root first.");
  process.exit(1);
}

const payload = JSON.stringify({
  csvPath: relCsv,
  outDir,
  top: 5,
  sourceFileName: csvPath.split(/[/\\]/).pop(),
  config: {
    maxRounds: 2000,
    plateauRounds: 128,
  },
});

const result = spawnSync(
  process.execPath,
  [
    tsxCli,
    "--tsconfig",
    "tools/sdc-eval/tsconfig.json",
    "tools/sdc-eval/cli.ts",
    "export-top",
  ],
  {
    cwd: ROOT,
    encoding: "utf8",
    input: payload,
    shell: false,
  },
);

if (result.status !== 0) {
  console.error(result.stderr || result.stdout || "export-top failed");
  process.exit(result.status ?? 1);
}

process.stdout.write(result.stdout);

try {
  const parsed = JSON.parse(result.stdout);
  console.log("");
  console.log("Done. Import in the web app (Import file):");
  for (const exp of parsed.exports ?? []) {
    console.log(`  ${exp.fileName}  score=${exp.score}  feasible=${exp.feasible}`);
  }
  console.log(`\nSummary: ${join(outDir, "search-summary.json")}`);
} catch {
  /* stdout already printed */
}
