import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";

describe("buildConnectionGraph", () => {
  it("layout contract CSV: six pairs, multiple cable legs", () => {
    const report = parseBentleyCsv(
      readFileSync(
        resolveReferenceCsvPath("CSV Splice Detail Example #2.csv"),
        "utf8",
      ),
    );
    const graph = buildConnectionGraph(report);

    expect(graph.report.pairs).toHaveLength(6);
    expect(graph.connections.filter((c) => c.kind === "fiber")).toHaveLength(6);
    expect(graph.legs.length).toBeGreaterThanOrEqual(4);

    const distLegs = graph.legs.filter((l) => l.cable.includes("DIST 18"));
    expect(distLegs.length).toBeGreaterThanOrEqual(2);
  });
});
