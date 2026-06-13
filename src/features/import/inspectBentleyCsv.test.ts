import { describe, expect, it } from "vitest";

import { inspectBentleyCsv } from "./inspectBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

describe("inspectBentleyCsv", () => {
  it("Left-SP-3254.5: expected left-row vs pair gap", () => {
    const r = inspectBentleyCsv(readLeftCsv("Left-SP-3254.5.csv"));
    expect(r.parseGap).toBe(10);
    expect(r.parsedPairCount).toBe(10);
    expect(r.failureBreakdown).toHaveLength(0);
  });

  it("layout contract ring-cut CSV: no parse gap", () => {
    const r = inspectBentleyCsv(
      readReferenceCsv("CSV Splice Detail Example #1.csv"),
    );
    expect(r.rawRowCounts.left).toBe(4);
    expect(r.parsedPairCount).toBe(4);
    expect(r.parseGap).toBe(0);
    expect(r.failureBreakdown).toHaveLength(0);
  });
});
