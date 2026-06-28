import { describe, expect, it } from "vitest";

import { buildGridMap } from "@/features/grid/gridMap";
import { lockSegments } from "@/features/grid/reservation";
import type { SdcRuleContext } from "@/features/rules/types";

import { sdcUx001 } from "./ux001";

const stubCtx = {
  report: { rows: [], header: {}, pairs: [], cableAppearances: {} },
  graph: { connections: [], cables: [] },
} as unknown as SdcRuleContext;

describe("SDC-UX-001", () => {
  it("passes when locked segments are manual-locked on grid", () => {
    const grid = buildGridMap({
      anchors: [
        { x: 100, y: 200, side: "left" },
        { x: 900, y: 400, side: "right" },
      ],
      bounds: { width: 1200, height: 800 },
      extraHorizontalYs: [200],
      extraVerticalXs: [400],
    });
    const segId = "horizontal:100,200:400,200";
    lockSegments(grid, [segId]);

    const results = sdcUx001.check({
      ...stubCtx,
      grid,
      overrides: {
        reportKey: "test",
        positions: {},
        gridLocks: { segments: [segId], dots: [], cables: [], tubeGroups: [] },
      },
    });

    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("warns when grid tube lock is missing from locks.tubeGroups", () => {
    const results = sdcUx001.check({
      ...stubCtx,
      overrides: {
        reportKey: "test",
        positions: {},
        gridLocks: {
          segments: [],
          dots: [],
          cables: [],
          tubeGroups: ["vc-left|BL"],
        },
        locks: { tubeGroups: {} },
      },
    });

    expect(results.some((r) => r.severity === "warn")).toBe(true);
  });

  it("warns when quad proxy side disagrees with quadCableSides", () => {
    const results = sdcUx001.check({
      ...stubCtx,
      overrides: {
        reportKey: "test",
        positions: {},
        cableSides: { "vc-a": "right" },
        quadCableSides: { "vc-a": "top" },
      },
    });

    expect(results.some((r) => r.severity === "warn")).toBe(true);
  });
});
