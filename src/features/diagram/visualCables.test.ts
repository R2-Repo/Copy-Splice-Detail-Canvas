import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { FIBER_ROW_PITCH, fiberRowOffsetInCable } from "./cableLayoutMetrics";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

describe("buildVisualCables", () => {
  it("Example #1: one 144 visual cable (no ring-cut split), drop unchanged", () => {
    const csv = readReferenceCsv("CSV Splice Detail Example #1.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { visualCables: visual } = buildVisualCablesForLayout(graph);

    const drop = visual.filter((v) => v.cable.includes("DROP"));
    expect(drop).toHaveLength(1);
    expect(drop[0]!.tubes.flatMap((t) => t.fibers)).toHaveLength(4);

    const dist = visual.filter((v) => v.cable.includes("144-SMF"));
    expect(dist).toHaveLength(1);
    const fibers = dist[0]!.tubes.flatMap((t) => t.fibers);
    expect(fibers.length).toBeGreaterThanOrEqual(2);
    const off0 = fiberRowOffsetInCable(dist[0]!, fibers[0]!.connectionId);
    const off1 = fiberRowOffsetInCable(dist[0]!, fibers[1]!.connectionId);
    expect(off1 - off0).toBe(FIBER_ROW_PITCH);
  });
});
