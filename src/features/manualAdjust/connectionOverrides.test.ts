import { describe, expect, it } from "vitest";

import { mergeLayoutOverrides } from "@/features/canvas/layoutStorage";
import {
  applyConnectionOverridesToLanes,
  bridgeLegOverridesToConnectionOverrides,
} from "@/features/manualAdjust/connectionOverrides";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";

describe("connectionOverrides v14", () => {
  it("bridges legOverrides segment deltas into laneOffsetX", () => {
    const bridged = bridgeLegOverridesToConnectionOverrides({
      conn1: { leftSegments: { 2: { dx: 12 } }, rightSegments: { 1: { dy: 4 } } },
    });
    expect(bridged?.conn1).toEqual({ laneOffsetX: 12, spliceRowOffsetY: 4 });
  });

  it("mergeLayoutOverrides persists bridged connectionOverrides", () => {
    const merged = mergeLayoutOverrides("v14-bridge", {
      legOverrides: { connA: { leftSegments: { 2: { dx: 8 } } } },
    });
    expect(merged.connectionOverrides?.connA?.laneOffsetX).toBe(8);
  });

  it("applyConnectionOverridesToLanes shifts midX", () => {
    const lanes = new Map<string, SpliceRoutingLane>([
      ["splice-left-connA", { midX: 400 }],
    ]);
    const patched = applyConnectionOverridesToLanes(lanes, {
      connA: { laneOffsetX: 10 },
    });
    expect(patched.get("splice-left-connA")?.midX).toBe(410);
  });
});
