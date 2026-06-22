import { describe, expect, it } from "vitest";

import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import {
  applyRoutingParameterOverrides,
  connectionOverrideFromLeg,
  effectiveConnectionOverrides,
  normalizeLayoutOverridesOnLoad,
  syncConnectionOverridesFromLegs,
} from "./connectionOverrides";
import { LAYOUT_OVERRIDE_VERSION } from "@/types/splice";

describe("connectionOverrideFromLeg", () => {
  it("maps dotShiftX and summed lane dx to parameter fields", () => {
    expect(
      connectionOverrideFromLeg({
        dotShiftX: 12,
        leftSegments: { 1: { dx: 8 }, 2: { dx: -3 } },
        rightSegments: { 0: { dx: 5 } },
      }),
    ).toEqual({
      dotOffsetX: 12,
      laneOffsetX: 10,
    });
  });
});

describe("effectiveConnectionOverrides", () => {
  it("stored connectionOverrides win over bridged leg fields", () => {
    const map = effectiveConnectionOverrides({
      legOverrides: { conn1: { dotShiftX: 10, leftSegments: { 0: { dx: 4 } } } },
      connectionOverrides: { conn1: { dotOffsetX: 20, laneOffsetX: 99 } },
    });
    expect(map.get("conn1")).toEqual({ dotOffsetX: 20, laneOffsetX: 99 });
  });
});

describe("syncConnectionOverridesFromLegs", () => {
  it("dual-writes derived params on leg commit", () => {
    const synced = syncConnectionOverridesFromLegs(
      { connA: { dotShiftX: 6, leftSegments: { 0: { dx: 14 } } } },
      undefined,
    );
    expect(synced?.connA).toEqual({ dotOffsetX: 6, laneOffsetX: 14 });
  });
});

describe("normalizeLayoutOverridesOnLoad", () => {
  it("bridges leg overrides when connection map is missing", () => {
    const normalized = normalizeLayoutOverridesOnLoad({
      reportKey: "r",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: {},
      legOverrides: { connB: { dotShiftX: 8 } },
    });
    expect(normalized.connectionOverrides?.connB).toEqual({ dotOffsetX: 8 });
  });
});

describe("applyRoutingParameterOverrides", () => {
  it("shifts midX for manual connection laneOffsetX", () => {
    const lanes = new Map<string, SpliceRoutingLane>([
      ["splice-conn1", { midX: 400, jogX: 420 }],
    ]);
    const entries = [
      {
        id: "splice-conn1",
        sourceX: 100,
        sourceY: 80,
        targetX: 500,
        targetY: 80,
        sourceNodeId: "cable-a",
        targetNodeId: "cable-b",
      },
    ] as Parameters<typeof applyRoutingParameterOverrides>[1];

    const next = applyRoutingParameterOverrides(lanes, entries, {
      autoAdjustEnabled: false,
      connectionOverrides: { conn1: { laneOffsetX: 16 } },
    });

    expect(next.get("splice-conn1")?.midX).toBe(416);
    expect(next.get("splice-conn1")?.jogX).toBe(436);
  });

  it("skips routing offsets while auto adjust is enabled", () => {
    const lanes = new Map<string, SpliceRoutingLane>([
      ["splice-conn1", { midX: 400 }],
    ]);
    const entries = [
      {
        id: "splice-conn1",
        sourceX: 100,
        sourceY: 80,
        targetX: 500,
        targetY: 80,
        sourceNodeId: "cable-a",
        targetNodeId: "cable-b",
      },
    ] as Parameters<typeof applyRoutingParameterOverrides>[1];

    const next = applyRoutingParameterOverrides(lanes, entries, {
      autoAdjustEnabled: true,
      connectionOverrides: { conn1: { laneOffsetX: 16 } },
    });
    expect(next.get("splice-conn1")?.midX).toBe(400);
  });
});
