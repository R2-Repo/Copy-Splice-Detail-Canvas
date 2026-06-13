import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Legacy layout-contract CSVs (automated `npm run test:layout` only).
 * User QA and agent sessions use `leftCsvPaths.ts` instead.
 */
const contractDir = join(process.cwd(), "docs/reference/examples");
const legacyDir = join(contractDir, "old csv examples");

export const LAYOUT_CONTRACT_CSVS = {
  ringCut: "CSV Splice Detail Example #1.csv",
  dominantPair: "CSV Splice Detail Example #2.csv",
  multiCable: "CSV Splice Detail Example #3.csv",
} as const;

export function resolveReferenceCsvPath(file: string): string {
  const legacy = join(legacyDir, file);
  if (existsSync(legacy)) return legacy;
  const direct = join(contractDir, file);
  if (existsSync(direct)) return direct;
  return legacy;
}

export function readReferenceCsv(file: string): string {
  return readFileSync(resolveReferenceCsvPath(file), "utf8");
}

/** @deprecated Use resolveReferenceCsvPath — layout-contract CSVs only */
export const resolveLayoutContractCsvPath = resolveReferenceCsvPath;

/** @deprecated Use readReferenceCsv */
export const readLayoutContractCsv = readReferenceCsv;
