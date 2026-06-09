import { describe, expect, it } from "vitest";

import { handleEntriesToCandidates } from "./spliceCenterLanes";
import type { SpliceHandleEntry } from "./spliceCenterLanes";

describe("handleEntriesToCandidates", () => {
  it("maps handle entry fields to midX lane candidates", () => {
    const entries: SpliceHandleEntry[] = [
      {
        id: "splice-a",
        sourceNodeId: "cable-left",
        targetNodeId: "cable-right",
        sourceX: 100,
        sourceY: 200,
        targetX: 900,
        targetY: 250,
        fallbackLane: 2,
        rowOffset: 48,
        tubeBundleKey: "left|BL|right",
      },
    ];

    const candidates = handleEntriesToCandidates(entries);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      id: "splice-a",
      sourceX: 100,
      targetY: 250,
      rowOffset: 48,
      tubeBundleKey: "left|BL|right",
    });
  });

  it("falls back to fallbackLane when rowOffset is missing", () => {
    const candidates = handleEntriesToCandidates([
      {
        id: "splice-b",
        sourceNodeId: "cable-a",
        targetNodeId: "cable-b",
        sourceX: 0,
        sourceY: 0,
        targetX: 10,
        targetY: 10,
        fallbackLane: 3,
      },
    ]);
    expect(candidates[0]!.rowOffset).toBe(3);
  });
});
