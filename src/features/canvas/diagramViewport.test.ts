import { describe, expect, it } from "vitest";

import {
  boundsFromFlowNodes,
  viewportForFitWidth,
} from "@/features/canvas/diagramViewport";

describe("diagramViewport", () => {
  it("fitWidth zoom is capped at 1 and top-aligns tall bounds", () => {
    const bounds = { x: 24, y: 100, width: 1000, height: 4000 };
    const vp = viewportForFitWidth(bounds, 1200, 800, { paddingRatio: 0.1 });

    expect(vp.zoom).toBeLessThanOrEqual(1);
    expect(vp.y).toBeCloseTo(80 - 100 * vp.zoom, 1);
    expect(vp.x).toBeCloseTo(120 - 24 * vp.zoom, 1);
  });

  it("fitWidth zooms out when diagram is wider than stage", () => {
    const bounds = { x: 0, y: 0, width: 8000, height: 12000 };
    const vp = viewportForFitWidth(bounds, 1200, 800, { paddingRatio: 0.1 });

    expect(vp.zoom).toBeLessThan(1);
    expect(vp.zoom).toBeCloseTo(960 / 8000, 3);
  });

  it("boundsFromFlowNodes uses measured dimensions", () => {
    const bounds = boundsFromFlowNodes([
      {
        position: { x: 10, y: 20 },
        width: 100,
        height: 50,
      },
      {
        position: { x: 200, y: 300 },
        measured: { width: 80, height: 120 },
      },
    ]);

    expect(bounds).toEqual({
      x: 10,
      y: 20,
      width: 270,
      height: 400,
    });
  });
});
