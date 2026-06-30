import { describe, expect, it } from "vitest";

import {
  CABLE_LAYOUT,
  fiberRowY,
  FIBER_ROW_PITCH,
  MIN_FIBER_LINE_GAP,
  resolveCableDragStopX,
  resolveCableDragStopY,
  SPLICE_LANE_SEP,
} from "./cableLayoutMetrics";

describe("fiber line spacing", () => {
  it("enforces minimum gap between adjacent splice rows", () => {
    expect(CABLE_LAYOUT.fiberRowH).toBeGreaterThanOrEqual(MIN_FIBER_LINE_GAP);
    const y0 = fiberRowY(0);
    const y1 = fiberRowY(1);
    expect(y1 - y0).toBe(MIN_FIBER_LINE_GAP);
  });

  it("uses equal gap for vertical rows and horizontal splice lanes", () => {
    expect(SPLICE_LANE_SEP).toBe(FIBER_ROW_PITCH);
    expect(SPLICE_LANE_SEP).toBe(MIN_FIBER_LINE_GAP);
  });
});

describe("resolveCableDragStopX", () => {
  const bounds = { leftX: 24, rightX: 9000 };

  it("magnetically snaps when released near the side column", () => {
    expect(resolveCableDragStopX(8985, "right", bounds)).toBe(9000);
    expect(resolveCableDragStopX(40, "left", bounds)).toBe(24);
  });

  it("keeps custom spread when released away from the column", () => {
    expect(resolveCableDragStopX(5000, "right", bounds)).toBe(5000);
    expect(resolveCableDragStopX(7500, "right", bounds)).toBe(7500);
  });

  it("clamps to bounds", () => {
    expect(resolveCableDragStopX(9500, "right", bounds)).toBe(9000);
  });
});

describe("resolveCableDragStopY", () => {
  const yBounds = { topY: 100, bottomY: 700 };

  it("magnetically snaps when released near the top/bottom band", () => {
    expect(resolveCableDragStopY(110, "top", yBounds)).toBe(100);
    expect(resolveCableDragStopY(690, "bottom", yBounds)).toBe(700);
  });

  it("keeps custom spread when released away from the band", () => {
    expect(resolveCableDragStopY(300, "top", yBounds)).toBe(300);
    expect(resolveCableDragStopY(500, "bottom", yBounds)).toBe(500);
  });
});
