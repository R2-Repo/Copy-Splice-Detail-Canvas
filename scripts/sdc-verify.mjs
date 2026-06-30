/**
 * Verify headless sdc-eval + Python sidecar (dev tooling smoke test).
 *
 * Usage: npm run sdc:verify
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FIXTURE = "docs/reference/examples/Left-SP-3254.5.csv";
const FIXTURE_ABS = join(ROOT, FIXTURE);
const tsxCli = join(ROOT, "node_modules", "tsx", "dist", "cli.mjs");

function runTsEval(label, command, payload) {
  const result = spawnSync(
    process.execPath,
    [
      tsxCli,
      "--tsconfig",
      "tools/sdc-eval/tsconfig.json",
      "tools/sdc-eval/cli.ts",
      command,
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      input: JSON.stringify(payload),
      shell: false,
    },
  );
  if (result.status !== 0) {
    console.error(`\n[FAIL] ${label}`);
    console.error(result.stderr || result.stdout);
    process.exit(1);
  }
  console.log(`[ok] ${label}`);
  return result.stdout;
}

function parseJson(text) {
  return JSON.parse(text.trim());
}

console.log("SDC sidecar verify\n");

if (!existsSync(tsxCli)) {
  console.error("tsx missing — run npm install first");
  process.exit(1);
}

const parseOut = runTsEval("TS parse", "parse", { csvPath: FIXTURE });
const parsed = parseJson(parseOut);
if (!parsed.ok || parsed.summary?.cableCount !== 4) {
  console.error("[FAIL] parse response unexpected", parsed);
  process.exit(1);
}

const searchOut = runTsEval("TS search", "search", {
  csvPath: FIXTURE,
  config: { maxRounds: 20 },
});
const searched = parseJson(searchOut);
if (!searched.result?.feasible) {
  console.error("[FAIL] search not feasible", searched.result);
  process.exit(1);
}

const evalPath = join(ROOT, "tools/sdc-sidecar/fixtures/evaluate-request.example.json");
if (!existsSync(evalPath)) {
  console.error("[FAIL] missing", evalPath);
  process.exit(1);
}
const evalResult = spawnSync(
  process.execPath,
  [
    tsxCli,
    "--tsconfig",
    "tools/sdc-eval/tsconfig.json",
    "tools/sdc-eval/cli.ts",
    "evaluate",
    "--file",
    evalPath,
  ],
  { cwd: ROOT, encoding: "utf8", shell: false },
);
if (evalResult.status !== 0) {
  console.error("\n[FAIL] TS evaluate");
  console.error(evalResult.stderr || evalResult.stdout);
  process.exit(1);
}
console.log("[ok] TS evaluate");
const evaluated = parseJson(evalResult.stdout);
if (!evaluated.evaluation?.feasible) {
  console.error("[FAIL] evaluate not feasible");
  process.exit(1);
}

const python = process.platform === "win32" ? "python" : "python3";
const sidecarCwd = join(ROOT, "tools/sdc-sidecar");
const sidecarEnv = { ...process.env, SDC_REPO_ROOT: ROOT };

const pyParse = spawnSync(python, ["-m", "sdc", "parse", FIXTURE_ABS], {
  cwd: sidecarCwd,
  encoding: "utf8",
  env: sidecarEnv,
});
if (pyParse.status !== 0) {
  console.error("\n[FAIL] Python sidecar parse");
  console.error(pyParse.stderr || pyParse.stdout);
  console.error("\nNeed Python 3.11+. Try: cd tools/sdc-sidecar && python -m pip install -e .");
  process.exit(1);
}
console.log("[ok] Python parse");

const pySearch = spawnSync(
  python,
  ["-m", "sdc", "search", FIXTURE_ABS, "--max-rounds", "15"],
  { cwd: sidecarCwd, encoding: "utf8", env: sidecarEnv },
);
if (pySearch.status !== 0) {
  console.error("\n[FAIL] Python sidecar search");
  console.error(pySearch.stderr || pySearch.stdout);
  process.exit(1);
}
const pyResult = parseJson(pySearch.stdout);
if (!pyResult.result?.feasible) {
  console.error("[FAIL] Python search not feasible");
  process.exit(1);
}
console.log("[ok] Python search");

console.log("\nAll sidecar checks passed.");
console.log(`Fixture: ${FIXTURE}`);
console.log(`TS best score: ${searched.result.bestScore}`);
