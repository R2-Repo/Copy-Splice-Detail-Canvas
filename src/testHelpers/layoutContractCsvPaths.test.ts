import { describe, expect, it } from "vitest";

import {
  LAYOUT_CONTRACT_CSVS,
  readReferenceCsv,
  referenceCsvAvailable,
  resolveReferenceCsvPath,
} from "./layoutContractCsvPaths";

describe("layoutContractCsvPaths", () => {
  it("resolves layout-contract examples from public/qa-fixtures", () => {
    for (const file of Object.values(LAYOUT_CONTRACT_CSVS)) {
      expect(referenceCsvAvailable(file)).toBe(true);
      expect(resolveReferenceCsvPath(file)).toContain("/public/qa-fixtures/");
      expect(readReferenceCsv(file).length).toBeGreaterThan(0);
    }
  });

  it("resolves Left reference CSVs from docs/reference/examples", () => {
    expect(referenceCsvAvailable("Left-SP-3254.5.csv")).toBe(true);
    expect(resolveReferenceCsvPath("Left-SP-3254.5.csv")).toContain(
      "/docs/reference/examples/",
    );
  });
});
