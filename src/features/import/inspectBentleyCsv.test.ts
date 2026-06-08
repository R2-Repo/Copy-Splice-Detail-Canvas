import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { inspectBentleyCsv } from "./inspectBentleyCsv";

const examples = join(process.cwd(), "docs/reference/examples");

describe("inspectBentleyCsv", () => {
  it("Example #2: no parse gap", () => {
    const csv = readFileSync(
      join(examples, "CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const r = inspectBentleyCsv(csv);
    expect(r.parseGap).toBe(0);
    expect(r.parsedPairCount).toBe(6);
  });

  it("Example #1: no parse gap", () => {
    const csv = readFileSync(
      join(examples, "CSV Splice Detail Example #1.csv"),
      "utf8",
    );
    const r = inspectBentleyCsv(csv);
    expect(r.rawRowCounts.left).toBe(4);
    expect(r.parsedPairCount).toBe(4);
    expect(r.parseGap).toBe(0);
    expect(r.failureBreakdown).toHaveLength(0);
  });
});
