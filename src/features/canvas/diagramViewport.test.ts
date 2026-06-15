import { describe, expect, it } from "vitest";

import {
  boundsFromFlowNodes,
  stageInnerWidth,
  viewportAtUnitZoom,
  viewportAtUnitZoomFocused,
  viewportForFitPage,
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

  it("fitPage centers bounds and uses the tighter zoom axis", () => {
    const bounds = { x: 24, y: 100, width: 1000, height: 4000 };
    const pageW = 1536;
    const pageH = 960;
    const vp = viewportForFitPage(bounds, pageW, pageH, { paddingRatio: 0.08 });

    const innerW = pageW * (1 - 2 * 0.08);
    const innerH = pageH * (1 - 2 * 0.08);
    expect(vp.zoom).toBeCloseTo(Math.min(innerW / 1000, innerH / 4000), 3);

    const contentW = bounds.width * vp.zoom;
    const contentH = bounds.height * vp.zoom;
    expect(vp.x).toBeCloseTo((pageW - contentW) / 2 - bounds.x * vp.zoom, 1);
    expect(vp.y).toBeCloseTo((pageH - contentH) / 2 - bounds.y * vp.zoom, 1);
  });

  it("stageInnerWidth matches fit padding band", () => {
    expect(stageInnerWidth(1920)).toBeCloseTo(1920 * 0.84, 1);
  });

  it("viewportAtUnitZoom keeps zoom at 1", () => {
    const bounds = { x: 24, y: 100, width: 1600, height: 4000 };
    const vp = viewportAtUnitZoom(bounds, 1920, 900);
    expect(vp.zoom).toBe(1);
    expect(vp.x).toBeCloseTo(1920 * 0.08 - 24, 1);
  });

  it("viewportAtUnitZoomFocused centers diagram X at zoom 1", () => {
    const bounds = { x: 24, y: 100, width: 2800, height: 4000 };
    const focusX = 1436.8;
    const vp = viewportAtUnitZoomFocused(bounds, 1920, 900, focusX);
    expect(vp.zoom).toBe(1);
    expect(vp.x).toBeCloseTo(1920 / 2 - focusX, 1);
    expect(vp.y).toBeCloseTo(900 * 0.08 - 100, 1);
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
