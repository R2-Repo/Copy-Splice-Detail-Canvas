import { describe, expect, it } from "vitest";

import { inspectBentleyCsv } from "./inspectBentleyCsv";
import { LEFT_REFERENCE_CSVS, readLeftCsv } from "@/testHelpers/leftCsvPaths";

const LEFT_PARSE_GAPS: Record<(typeof LEFT_REFERENCE_CSVS)[number], number> = {
  "Left-SP-3254.5.csv": 10,
  "Left-STATE_OFFICE.csv": 52,
  "Left-SPI-215_I-80.csv": 68,
};

describe("Left reference CSVs", () => {
  it.each(LEFT_REFERENCE_CSVS)("%s parses without row failures", (file) => {
    const r = inspectBentleyCsv(readLeftCsv(file));
    expect(r.parseGap).toBe(LEFT_PARSE_GAPS[file]);
    expect(r.parsedPairCount).toBeGreaterThan(0);
    expect(r.failureBreakdown).toHaveLength(0);
  });
});
