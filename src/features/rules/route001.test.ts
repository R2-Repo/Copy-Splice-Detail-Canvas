import { describe, expect, it } from "vitest";

import { buildGridMap } from "@/features/grid/gridMap";
import type { GridRoute } from "@/features/grid/gridTypes";

import { sdcRoute001 } from "./route001";
import type { SdcRuleContext } from "./types";

const stubCtx = {
  report: { rows: [], header: {}, pairs: [], cableAppearances: {} },
  graph: { connections: [], cables: [] },
} as unknown as SdcRuleContext;

function ctxWithRoutes(routes: Map<string, GridRoute>): SdcRuleContext {
  const grid = buildGridMap({
    anchors: [
      { x: 200, y: 120, side: "left" },
      { x: 200, y: 480, side: "left" },
      { x: 1100, y: 200, side: "right" },
    ],
    bounds: { width: 1400, height: 600 },
  });
  return { ...stubCtx, grid, gridRoutes: routes };
}

describe("SDC-ROUTE-001", () => {
  it("passes when all grid routes stay inside the routing box", () => {
    const routes = new Map<string, GridRoute>([
      [
        "conn-a",
        {
          connectionId: "conn-a",
          segmentIds: [],
          points: [
            { x: 250, y: 200 },
            { x: 600, y: 200 },
            { x: 600, y: 350 },
            { x: 1050, y: 350 },
          ],
        },
      ],
    ]);
    const results = sdcRoute001.check(ctxWithRoutes(routes));
    expect(results.every((r) => r.ok)).toBe(true);
  });

  it("fails when a route point leaves the routing box", () => {
    const routes = new Map<string, GridRoute>([
      [
        "conn-high-loop",
        {
          connectionId: "conn-high-loop",
          segmentIds: [],
          points: [
            { x: 250, y: 200 },
            { x: 600, y: 50 },
            { x: 600, y: 350 },
            { x: 1050, y: 350 },
          ],
        },
      ],
    ]);
    const results = sdcRoute001.check(ctxWithRoutes(routes));
    expect(results.some((r) => !r.ok && r.severity === "fail")).toBe(true);
    expect(results[0]?.detail).toContain("conn-high-loop");
  });

  it("fails when routing zone is empty", () => {
    const grid = buildGridMap({
      anchors: [],
      bounds: { width: 100, height: 100 },
    });
    const results = sdcRoute001.check({
      ...stubCtx,
      grid: {
        ...grid,
        routingZone: {
          ...grid.routingZone,
          width: 0,
          height: 0,
        },
      },
      gridRoutes: new Map(),
    });
    expect(results.some((r) => !r.ok && r.severity === "fail")).toBe(true);
  });
});
