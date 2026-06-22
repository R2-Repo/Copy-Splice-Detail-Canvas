import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { gridSegmentIdsFromLegPaths } from "./gridSegmentIdsFromPaths";

describe("gridSegmentIdsFromLegPaths", () => {
  it("returns segment ids for a simple orthogonal leg path", () => {
    const edges = [
      {
        id: "splice-left-conn-1",
        type: "splice",
        source: "a",
        target: "b",
        data: {
          leftPath: "M 100 200 L 400 200 L 400 240",
          rightPath: "M 400 240 L 700 240",
          spliceX: 400,
          spliceY: 240,
        },
      },
    ] as Edge[];

    const segmentIds = gridSegmentIdsFromLegPaths(
      [],
      edges,
      ["conn-1"],
      1920,
    );

    expect(segmentIds.length).toBeGreaterThan(0);
    expect(segmentIds.some((id) => id.startsWith("horizontal:"))).toBe(true);
  });
});
