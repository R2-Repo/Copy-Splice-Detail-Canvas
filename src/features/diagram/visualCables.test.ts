import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { FIBER_ROW_PITCH, fiberRowOffsetInCable } from "./cableLayoutMetrics";
import { buildVisualCables } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

describe("buildVisualCables", () => {
  it("Example #1: two 144 cylinders on right (ring cut), drop unchanged", () => {
    const csv = readFileSync(
      join(
        process.cwd(),
        "docs/reference/examples/CSV Splice Detail Example #1.csv",
      ),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const visual = buildVisualCables(graph);

    const drop = visual.filter((v) => v.cable.includes("DROP"));
    expect(drop).toHaveLength(1);
    expect(drop[0]!.tubes.flatMap((t) => t.fibers)).toHaveLength(4);

    const dist = visual.filter((v) => v.cable.includes("144-SMF"));
    expect(dist).toHaveLength(2);
    expect(dist.every((v) => v.tubes[0]!.fibers.length === 2)).toBe(true);

    const fibers = dist[0]!.tubes.flatMap((t) => t.fibers);
    expect(fibers.map((f) => f.rowIndex)).toEqual([0, 1]);
    const off0 = fiberRowOffsetInCable(dist[0]!, fibers[0]!.connectionId);
    const off1 = fiberRowOffsetInCable(dist[0]!, fibers[1]!.connectionId);
    expect(off1 - off0).toBe(FIBER_ROW_PITCH);
  });
});
