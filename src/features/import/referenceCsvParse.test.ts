import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { inspectBentleyCsv } from "./inspectBentleyCsv";
import { parseBentleyCsv } from "./parseBentleyCsv";
import { readExampleCsv } from "@/testHelpers/exampleCsvPaths";

type ReferenceCsvCase = {
  file: string;
  leftRows: number;
  pairs: number;
  uniqueCables: number;
  parseGap?: number;
};

const REFERENCE_CSVS: ReferenceCsvCase[] = [
  { file: "300N_MAIN.csv", leftRows: 266, pairs: 278, uniqueCables: 4 },
  { file: "I-215_4700S.csv", leftRows: 142, pairs: 146, uniqueCables: 7 },
  { file: "SP-I-15_11400S.csv", leftRows: 316, pairs: 314, uniqueCables: 6 },
  { file: "SPI-215_I-80.csv", leftRows: 70, pairs: 68, uniqueCables: 7 },
  { file: "STATE_OFFICE.csv", leftRows: 52, pairs: 52, uniqueCables: 5 },
  { file: "US-89SBMP228.25.csv", leftRows: 144, pairs: 144, uniqueCables: 2 },
  {
    file: "Left-SP-3254.5.csv",
    leftRows: 20,
    pairs: 10,
    uniqueCables: 4,
    parseGap: 10,
  },
  {
    file: "Left-STATE_OFFICE.csv",
    leftRows: 104,
    pairs: 52,
    uniqueCables: 5,
    parseGap: 52,
  },
  {
    file: "Left-SPI-215_I-80.csv",
    leftRows: 136,
    pairs: 68,
    uniqueCables: 7,
    parseGap: 68,
  },
];

describe("reference CSV parse contract", () => {
  it.each(REFERENCE_CSVS)(
    "$file parses with zero failures",
    ({ file, leftRows, pairs, uniqueCables, parseGap }) => {
      const csv = readExampleCsv(file);
      const inspection = inspectBentleyCsv(csv);
      const report = parseBentleyCsv(csv);

      expect(inspection.rawRowCounts.left).toBe(leftRows);
      expect(inspection.parsedPairCount).toBe(pairs);
      expect(inspection.parseGap).toBe(parseGap ?? leftRows - pairs);
      expect(
        inspection.failureBreakdown.reduce((sum, f) => sum + f.count, 0),
      ).toBe(0);

      const failures = (report.rowResults ?? []).filter((r) => !r.ok);
      expect(failures).toHaveLength(0);

      const cableNames = new Set(
        report.pairs.flatMap((p) => [p.endpointA.cable, p.endpointB.cable]),
      );
      expect(cableNames.size).toBe(uniqueCables);
      expect(report.cableAppearances.length).toBe(uniqueCables);

      const graph = buildConnectionGraph(report);
      expect(graph.legs.length).toBeGreaterThan(0);
      expect(graph.connections.length).toBe(pairs);
    },
  );
});
