import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { inspectBentleyCsv } from "./inspectBentleyCsv";

const dir = join(process.cwd(), "docs/reference/examples");

describe("CSV Splice Detail Examples (paired with images)", () => {
  it.each([
    { n: 1, leftRows: 4, pairs: 4 },
    { n: 2, leftRows: 6, pairs: 6 },
    { n: 3, leftRows: 28, pairs: 28 },
  ])("Example #$n parses all Left rows", ({ n, leftRows, pairs }) => {
    const csv = readFileSync(
      join(dir, `CSV Splice Detail Example #${n}.csv`),
      "utf8",
    );
    const r = inspectBentleyCsv(csv);
    expect(r.rawRowCounts.left).toBe(leftRows);
    expect(r.parsedPairCount).toBe(pairs);
    expect(r.parseGap).toBe(0);
  });
});
