import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const examplesDir = join(process.cwd(), "docs/reference/examples");
const legacyExamplesDir = join(examplesDir, "old csv examples");

/** Resolve Bentley example CSV whether it lives in examples/ or old csv examples/. */
export function resolveExampleCsvPath(file: string): string {
  const legacy = join(legacyExamplesDir, file);
  if (existsSync(legacy)) return legacy;
  const direct = join(examplesDir, file);
  if (existsSync(direct)) return direct;
  return legacy;
}

export function readExampleCsv(file: string): string {
  return readFileSync(resolveExampleCsvPath(file), "utf8");
}

export { examplesDir, legacyExamplesDir };
