/**
 * Run Python sidecar from repo root without cd.
 * Usage: npm run sdc:sidecar -- search docs/reference/examples/Left-SP-3254.5.csv
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const python = process.platform === "win32" ? "python" : "python3";
const rawArgs = process.argv.slice(2);

if (rawArgs.length === 0) {
  console.error("Usage: npm run sdc:sidecar -- <sdc-args...>");
  console.error("Example: npm run sdc:sidecar -- search docs/reference/examples/Left-SP-3254.5.csv");
  process.exit(1);
}

const args = rawArgs.map((arg) => {
  if (!arg.endsWith(".csv")) return arg;
  const fromRoot = resolve(ROOT, arg);
  if (existsSync(fromRoot)) return fromRoot;
  return arg;
});

const result = spawnSync(python, ["-m", "sdc", ...args], {
  cwd: resolve(ROOT, "tools/sdc-sidecar"),
  stdio: "inherit",
  env: { ...process.env, SDC_REPO_ROOT: ROOT },
});

process.exit(result.status ?? 1);
