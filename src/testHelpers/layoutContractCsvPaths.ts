import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { DEV_FIXTURE_META } from "@/features/import/devFixtureMeta";

/**
 * Legacy layout-contract CSVs (automated `npm run test:layout` only).
 * User QA and agent sessions use `leftCsvPaths.ts` instead.
 */
const contractDir = join(process.cwd(), "docs/reference/examples");
const legacyDir = join(contractDir, "old csv examples");
const qaFixtureDir = join(process.cwd(), "public/qa-fixtures");

export const LAYOUT_CONTRACT_CSVS = {
  ringCut: "CSV Splice Detail Example #1.csv",
  dominantPair: "CSV Splice Detail Example #2.csv",
  multiCable: "CSV Splice Detail Example #3.csv",
} as const;

function qaFixturePathForFileName(file: string): string | undefined {
  const meta = DEV_FIXTURE_META.find((m) => m.fileName === file);
  if (!meta) return undefined;
  const path = join(qaFixtureDir, `${meta.id}.csv`);
  return existsSync(path) ? path : undefined;
}

function candidatePaths(file: string): string[] {
  const paths: string[] = [
    join(legacyDir, file),
    join(contractDir, file),
  ];
  const qa = qaFixturePathForFileName(file);
  if (qa) paths.push(qa);
  return paths;
}

export function resolveReferenceCsvPath(file: string): string {
  for (const path of candidatePaths(file)) {
    if (existsSync(path)) return path;
  }
  throw new Error(
    `Reference CSV not found: ${file} (checked ${candidatePaths(file).join(", ")})`,
  );
}

export function referenceCsvAvailable(file: string): boolean {
  return candidatePaths(file).some((path) => existsSync(path));
}

export function readReferenceCsv(file: string): string {
  return readFileSync(resolveReferenceCsvPath(file), "utf8");
}

/** @deprecated Use resolveReferenceCsvPath — layout-contract CSVs only */
export const resolveLayoutContractCsvPath = resolveReferenceCsvPath;

/** @deprecated Use readReferenceCsv */
export const readLayoutContractCsv = readReferenceCsv;
