import { describe, expect, it } from "vitest";

import type { SpliceHandleEntry } from "@/features/canvas/edges/spliceHandleEntries";
import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import {
  assignSpliceRoutingLanesFromLiveHandles,
  handleEntriesWithLiveRowOffsets,
} from "@/features/diagram/spliceCenterLanes";

function entry(
  id: string,
  sourceY: number,
  targetY: number,
  bundleKey?: string,
): SpliceHandleEntry {
  return {
    id: `splice-${id}`,
    sourceNodeId: "cable-a",
    targetNodeId: "cable-b",
    sourceX: 100,
    sourceY,
    targetX: 500,
    targetY,
    fallbackLane: 0,
    rowOffset: 0,
    tubeBundleKey: bundleKey,
  };
}

describe("handleEntriesWithLiveRowOffsets", () => {
  it("re-ranks non-bundle entries by live handle Y", () => {
    const entries = [
      entry("low", 200, 200),
      entry("high", 100, 100),
    ];
    const ranked = handleEntriesWithLiveRowOffsets(entries);
    expect(ranked.find((e) => e.id === "splice-high")?.rowOffset).toBe(0);
    expect(ranked.find((e) => e.id === "splice-low")?.rowOffset).toBe(
      FIBER_ROW_PITCH,
    );
  });

  it("preserves layout rowOffset for bundled entries", () => {
    const entries = [
      { ...entry("b1", 300, 100, "vc|BL|vc2"), rowOffset: 48 },
      { ...entry("b0", 100, 300, "vc|BL|vc2"), rowOffset: 0 },
      entry("solo", 150, 150),
    ];
    const ranked = handleEntriesWithLiveRowOffsets(entries);
    expect(ranked.find((e) => e.id === "splice-b1")?.rowOffset).toBe(48);
    expect(ranked.find((e) => e.id === "splice-b0")?.rowOffset).toBe(0);
  });
});

describe("assignSpliceRoutingLanesFromLiveHandles", () => {
  it("returns lanes and rowOffsets maps", () => {
    const entries = [entry("a", 120, 120), entry("b", 180, 180)];
    const { lanes, rowOffsets } = assignSpliceRoutingLanesFromLiveHandles(
      entries,
      600,
    );
    expect(lanes.size).toBeGreaterThan(0);
    expect(rowOffsets.get("splice-a")).toBe(0);
    expect(rowOffsets.get("splice-b")).toBe(FIBER_ROW_PITCH);
  });
});
