import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Bentley Left-section exports used for manual QA and agent testing. */
export const LEFT_REFERENCE_CSVS = [
  "Left-STATE_OFFICE.csv",
  "Left-SPI-215_I-80.csv",
  "Left-SP-3254.5.csv",
] as const;

export type LeftReferenceCsv = (typeof LEFT_REFERENCE_CSVS)[number];

export const leftCsvDir = join(process.cwd(), "docs/reference/examples");

export function resolveLeftCsvPath(file: LeftReferenceCsv | string): string {
  const direct = join(leftCsvDir, file);
  if (existsSync(direct)) return direct;
  throw new Error(`Left reference CSV not found: ${file} (expected under ${leftCsvDir})`);
}

export function readLeftCsv(file: LeftReferenceCsv): string {
  return readFileSync(resolveLeftCsvPath(file), "utf8");
}
