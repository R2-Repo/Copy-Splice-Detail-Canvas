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

function runPython(args, label) {
  const python = process.platform === "win32" ? "python" : "python3";
  const sidecarCwd = join(ROOT, "tools/sdc-sidecar");
  const sidecarEnv = { ...process.env, SDC_REPO_ROOT: ROOT };
  const result = spawnSync(python, ["-m", "sdc", ...args], {
    cwd: sidecarCwd,
    encoding: "utf8",
    env: sidecarEnv,
    timeout: 120_000,
  });
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

runTsEval("TS analyze-topology", "analyze-topology", { csvPath: FIXTURE });

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

runPython(["daemon", "start", "--workers", "1"], "Python daemon start");
runPython(["topology", FIXTURE_ABS], "Python topology");
runPython(["parse", FIXTURE_ABS], "Python parse");
runPython(["search", FIXTURE_ABS, "--max-rounds", "15"], "Python search");

const calOut = runPython(
  ["calibrate-t0", FIXTURE_ABS, "--sample-size", "16"],
  "Python T0 calibrate",
);
const cal = parseJson(calOut);
if (!cal.ok) {
  console.warn("[warn] T0 mirror calibration had false rejects:", cal.falseRejects);
}

console.log("\nAll sidecar checks passed.");
console.log(`Fixture: ${FIXTURE}`);
console.log(`TS best score: ${searched.result.bestScore}`);
