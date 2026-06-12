import type { Edge } from "@xyflow/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  loadLayoutOverrides,
  mergeLayoutOverrides,
  saveLayoutOverrides,
} from "@/features/canvas/layoutStorage";
import { applyAllLegOverrides } from "@/features/manualAdjust/applyManualAdjust";
import { mergeFanoutOverridesIntoTubes } from "@/features/manualAdjust/applyManualAdjust";
import { applyPersistedTubeOverrides } from "@/features/diagram/applyTubeOverrides";
import type { VisualCable } from "@/features/diagram/visualCables";
import { LAYOUT_OVERRIDE_VERSION } from "@/types/splice";

describe("manual + auto engine persistence contract", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("toggle autoAdjustEnabled preserves leg and fanout overrides in storage", () => {
    saveLayoutOverrides({
      reportKey: "toggle-contract",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: {},
      autoAdjustEnabled: false,
      legOverrides: { connA: { leftSegments: { 2: { dx: 15 } } } },
      fanoutOverrides: { "vc-1|BL": { shiftY: 10 } },
    });

    const afterToggle = mergeLayoutOverrides("toggle-contract", {
      autoAdjustEnabled: true,
    });
    saveLayoutOverrides(afterToggle);

    const reloaded = loadLayoutOverrides("toggle-contract");
    expect(reloaded?.autoAdjustEnabled).toBe(true);
    expect(reloaded?.legOverrides?.connA).toEqual({
      leftSegments: { 2: { dx: 15 } },
    });
    expect(reloaded?.fanoutOverrides?.["vc-1|BL"]).toEqual({ shiftY: 10 });
  });

  it("callout-style partial save preserves manual overrides", () => {
    saveLayoutOverrides({
      reportKey: "callout-save",
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
      positions: { "cable-a": { x: 1, y: 2 } },
      legOverrides: { connB: { rightSegments: { 1: { dx: -8 } } } },
      fanoutOverrides: { "vc-2|RD": { shiftY: -6 } },
    });

    const merged = mergeLayoutOverrides("callout-save", {
      positions: { "cable-a": { x: 1, y: 2 } },
      callouts: { "callout-1": { targetCableNodeId: "cable-a", text: "A" } },
    });

    expect(merged.legOverrides?.connB).toBeDefined();
    expect(merged.fanoutOverrides?.["vc-2|RD"]).toEqual({ shiftY: -6 });
  });

  it("fanoutOverrides wins over tubeOverrides.visualShiftY on read", () => {
    const visualCables: VisualCable[] = [
      {
        id: "vc-1",
        legId: "leg-1",
        device: "dev",
        cable: "cable",
        side: "left",
        order: 0,
        tubes: [
          {
            tubeColor: "BL",
            fibers: [],
          },
        ],
      },
    ];
    const tube = visualCables[0]!.tubes[0]!;

    applyPersistedTubeOverrides(visualCables, {
      "vc-1|BL": { visualShiftY: 4 },
    });
    mergeFanoutOverridesIntoTubes(visualCables, {
      reportKey: "x",
      positions: {},
      fanoutOverrides: {
        "vc-1|BL": { shiftY: 12 },
      },
    });

    expect(tube.visualShiftY).toBe(12);
  });
});

describe("applyAllLegOverrides refresh contract", () => {
  it("applies stored leg segment dx to edge paths", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120";
    const rightPath = "M 200,120 L 400,120 L 400,50 L 500,50";
    const edges: Edge[] = [
      {
        id: "splice-left-conn1",
        source: "fiberAnchor-vc::conn1",
        target: "splicePoint-conn1",
        type: "splice",
        data: {
          leftPath,
          rightPath,
          spliceX: 200,
          spliceY: 120,
        },
      },
      {
        id: "splice-right-conn1",
        source: "splicePoint-conn1",
        target: "fiberAnchor-vc2::conn1",
        type: "splice",
        data: {
          leftPath,
          rightPath,
          spliceX: 200,
          spliceY: 120,
        },
      },
    ];

    const result = applyAllLegOverrides(edges, {
      reportKey: "r",
      positions: {},
      legOverrides: {
        conn1: { leftSegments: { 2: { dx: 10 } } },
      },
    });

    const left = result.find((e) => e.id === "splice-left-conn1");
    const data = (left?.data ?? {}) as { leftPath?: string };
    expect(data.leftPath).toBeTruthy();
    expect(data.leftPath).not.toBe(leftPath);
  });

  it("skips leg overrides while auto adjust is enabled", () => {
    const edges: Edge[] = [
      {
        id: "splice-left-conn1",
        source: "fiberAnchor-vc::conn1",
        target: "splicePoint-conn1",
        type: "splice",
        data: { leftPath: "M 0,0", rightPath: "M 0,0" },
      },
    ];
    const result = applyAllLegOverrides(edges, {
      reportKey: "r",
      positions: {},
      autoAdjustEnabled: true,
      legOverrides: { conn1: { leftSegments: { 2: { dx: 10 } } } },
    });
    expect(result).toBe(edges);
  });
});
