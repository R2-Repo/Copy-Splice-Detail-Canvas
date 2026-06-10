import { describe, expect, it } from "vitest";

import {
  fiberRowLayoutXs,
  fixedHandleOutsetFromStem,
} from "./cableLabels";
import {
  BREAKOUT,
  computeCableBreakout,
  computeDiagramScale,
  computeSheathSize,
  computeSideStemAlignment,
  fiberFanPathD,
  fiberFanTailPathD,
  fiberFanTopPathD,
  SHEATH_SIZE,
  tubeLabelPosition,
} from "./cableBreakoutGeometry";

function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = clamp01(((px - x1) * dx + (py - y1) * dy) / lenSq);
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}
import type { VisualTube } from "./visualCables";

function mockTube(
  tubeColor: string,
  fibers: {
    rowIndex: number;
    rowYOffset?: number;
    handleId: string;
    fiberColor: string;
    circuitName?: string;
  }[],
  pitch = 40,
): VisualTube {
  return {
    tubeColor: tubeColor as VisualTube["tubeColor"],
    fibers: fibers.map((f) => ({
      connectionId: f.handleId,
      fiberNumber: 1,
      fiberColor: f.fiberColor as "BL",
      tubeColor: tubeColor as VisualTube["tubeColor"],
      handleId: f.handleId,
      rowIndex: f.rowIndex,
      rowYOffset: f.rowYOffset ?? f.rowIndex * pitch,
      circuitName: f.circuitName,
    })),
  };
}

describe("computeSheathSize", () => {
  const aspect = SHEATH_SIZE.baseWidth / SHEATH_SIZE.baseHeight;

  it("preserves aspect ratio at every scale", () => {
    for (const tubeCount of [1, 2, 4]) {
      const size = computeSheathSize(1, tubeCount);
      expect(size.width / size.height).toBeCloseTo(aspect, 5);
    }
  });

  it("scales uniformly with tube count", () => {
    const one = computeSheathSize(1, 1);
    const three = computeSheathSize(1, 3);
    expect(three.width).toBeGreaterThan(one.width);
    expect(three.height).toBeGreaterThan(one.height);
    expect(three.width / three.height).toBeCloseTo(one.width / one.height, 5);
  });

  it("provides enough width for in-rectangle labels", () => {
    const size = computeSheathSize(1);
    expect(size.width).toBeGreaterThanOrEqual(SHEATH_SIZE.minWidth);
  });
});

describe("computeDiagramScale", () => {
  it("scales down for large diagrams", () => {
    expect(computeDiagramScale(4)).toBeGreaterThan(computeDiagramScale(28));
  });
});

describe("computeCableBreakout", () => {
  it("single tube exits horizontally from fiber group center", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, handleId: "f1", fiberColor: "OR" },
      ]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    expect(geo.tubes).toHaveLength(1);
    const tube = geo.tubes[0]!;
    expect(tube.origin.y).toBeCloseTo(tube.end.y, 5);
    expect(tube.origin.x).toBe(geo.sheath.width);
  });

  it("viewWidth fits fixed handle column; fan paths start at label anchor", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, handleId: "f1", fiberColor: "OR" },
      ]),
    ];
    const handleCol = fixedHandleOutsetFromStem();
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    expect(geo.viewWidth).toBeGreaterThanOrEqual(geo.stemX + handleCol - 1);
    const labelStart = fiberRowLayoutXs(geo.stemX).labelStartX;
    for (const fiber of geo.tubes[0]!.fibers) {
      expect(fiber.fanTo.x).toBeCloseTo(labelStart, 5);
      expect(fiberFanTopPathD(fiber).startsWith(`M ${fiber.fanTo.x}`)).toBe(
        true,
      );
    }
  });

  it("fan elbow X is identical for every row in a tube", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, handleId: "a", fiberColor: "BL", circuitName: "CH 1" },
        {
          rowIndex: 1,
          handleId: "b",
          fiberColor: "OR",
          circuitName: "ATMS CENTRAL UTAH",
        },
      ]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const elbows = geo.tubes[0]!.fibers.map((f) => f.fanElbow?.x);
    expect(elbows.every((x) => x === elbows[0])).toBe(true);
  });

  it("fan meets label start; long labels extend fan horizontal toward tube", () => {
    const tubes = [
      mockTube("BL", [
        {
          rowIndex: 0,
          handleId: "short",
          fiberColor: "BL",
          circuitName: "CH 3254",
        },
        {
          rowIndex: 1,
          handleId: "long",
          fiberColor: "OR",
          circuitName: "ATMS CENTRAL UTAH COUNTY HUB",
        },
      ]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const shortFiber = geo.tubes[0]!.fibers.find((f) => f.handleId === "short")!;
    const longFiber = geo.tubes[0]!.fibers.find((f) => f.handleId === "long")!;
    expect(shortFiber.fanTo.x).toBeGreaterThan(longFiber.fanTo.x);
    expect(shortFiber.fanElbow!.x).toBe(longFiber.fanElbow!.x);
    const shortRun = shortFiber.fanTo.x - shortFiber.fanElbow!.x;
    const longRun = longFiber.fanTo.x - longFiber.fanElbow!.x;
    expect(shortRun).toBeGreaterThan(longRun);
    expect(shortFiber.fanTo.x).toBeCloseTo(
      fiberRowLayoutXs(geo.stemX, "CH 3254").fanToX,
      2,
    );
    expect(longFiber.fanTo.x).toBeCloseTo(
      fiberRowLayoutXs(geo.stemX, "ATMS CENTRAL UTAH COUNTY HUB").fanToX,
      2,
    );
  });

  it("scales sheath uniformly with buffer tube count", () => {
    const tubes = [
      mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }]),
      mockTube("OR", [{ rowIndex: 12, handleId: "f1", fiberColor: "OR" }]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const aspect = SHEATH_SIZE.baseWidth / SHEATH_SIZE.baseHeight;
    expect(geo.sheath.width / geo.sheath.height).toBeCloseTo(aspect, 5);
    expect(geo.sheath.height).toBeGreaterThan(SHEATH_SIZE.baseHeight * 0.9);
  });

  it("centers sheath vertically on buffer tube group", () => {
    const tubes = [
      mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }]),
      mockTube("OR", [{ rowIndex: 4, handleId: "f1", fiberColor: "OR" }]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    expect(geo.sheath.y + geo.sheath.height / 2).toBeCloseTo(
      geo.cableCenterY,
      5,
    );
  });

  it("multi-tube cables fan from sheath center when groups exceed sheath height", () => {
    const tubes = [
      mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }]),
      mockTube("OR", [{ rowIndex: 6, handleId: "f1", fiberColor: "OR" }]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    for (const tube of geo.tubes) {
      expect(tube.origin.y).toBeCloseTo(geo.cableCenterY, 5);
      const rowYs = tube.fibers.map((f) => f.rowY);
      const fiberCenterY = (Math.min(...rowYs) + Math.max(...rowYs)) / 2;
      expect(tube.end.y).toBeCloseTo(fiberCenterY, 5);
    }
    expect(geo.tubes[0]!.end.y).not.toBeCloseTo(geo.tubes[1]!.end.y, 0);
  });

  it("applies visualShiftY to expanded tube tip, fan-out, and fiber rows", () => {
    const tubes = [
      {
        ...mockTube("BL", [
          { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
          { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
        ]),
        visualShiftY: 10,
      },
    ];
    const noShift = [
      mockTube("BL", [
        { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
      ]),
    ];
    const base = computeCableBreakout(noShift, "left", 40, 56, 18, 1, undefined);
    const shifted = computeCableBreakout(tubes, "left", 40, 56, 18, 1, undefined);
    const tube = shifted.tubes[0]!;
    expect(tube.end.y - base.tubes[0]!.end.y).toBeCloseTo(10, 5);
    expect(tube.fibers[0]!.rowY - base.tubes[0]!.fibers[0]!.rowY).toBeCloseTo(
      10,
      5,
    );
  });

  it("shortens tube stem and uses smooth curved fan legs", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
      ]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const tube = geo.tubes[0]!;
    const rowYs = tube.fibers.map((f) => f.rowY);
    expect(tube.end.y).toBeCloseTo(
      (Math.min(...rowYs) + Math.max(...rowYs)) / 2,
      5,
    );
    expect(geo.stemX - tube.end.x).toBeCloseTo(
      BREAKOUT.fiberStemGap + BREAKOUT.tubeFanInset,
      0,
    );
    for (const fiber of tube.fibers) {
      expect(fiber.fanFrom).toEqual(tube.end);
      expect(fiber.fanElbow).toBeDefined();
      expect(fiber.fanCurve).toBeDefined();
      expect(fiber.fanElbow!.y).toBe(fiber.rowY);
      expect(fiber.fanTo.y).not.toBe(tube.end.y);
      expect(fiberFanPathD(fiber)).toContain(" C ");
      expect(fiberFanTailPathD(fiber)).toContain(" C ");
      expect(fiberFanTopPathD(fiber)).not.toContain(" C ");
    }
  });

  it("splits fan legs into tail-under and stub-over paths for layering", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
        { rowIndex: 2, rowYOffset: 80, handleId: "f2", fiberColor: "GR" },
      ]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const tube = geo.tubes[0]!;
    const center = tube.fibers.find((f) => f.rowIndex === 1)!;
    const outer = tube.fibers.find((f) => f.rowIndex === 0)!;
    expect(fiberFanTailPathD(center)).toMatch(/^M .* L .*/);
    expect(fiberFanTopPathD(center)).toMatch(/^M .* L .*/);
    expect(fiberFanTailPathD(outer)).toContain(" C ");
    expect(fiberFanTopPathD(outer)).not.toContain(" C ");
  });

  it("keeps the centered fiber straight for odd fiber counts", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
        { rowIndex: 2, rowYOffset: 80, handleId: "f2", fiberColor: "GR" },
      ]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const tube = geo.tubes[0]!;
    const center = tube.fibers.find((f) => f.rowIndex === 1)!;
    const outer = tube.fibers.filter((f) => f.rowIndex !== 1);
    expect(center.fanElbow).toBeUndefined();
    expect(center.fanCurve).toBeUndefined();
    expect(center.fanTo.y).toBeCloseTo(tube.end.y, 5);
    expect(fiberFanPathD(center)).not.toContain(" C ");
    for (const fiber of outer) {
      expect(fiber.fanElbow).toBeDefined();
      expect(fiber.fanCurve).toBeDefined();
    }
  });

  it("places tube labels in the fan crest with direction-aware offset", () => {
    const tubes = [
      mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }]),
      mockTube("OR", [{ rowIndex: 6, handleId: "f1", fiberColor: "OR" }]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const expectedOffset =
      BREAKOUT.tubeThickness / 2 + BREAKOUT.tubeLabelGap;
    const bl = geo.tubes.find((t) => t.tubeColor === "BL")!;
    const or = geo.tubes.find((t) => t.tubeColor === "OR")!;
    expect(bl.labelPos.placement).toBe("above");
    expect(or.labelPos.placement).toBe("below");
    for (const tube of geo.tubes) {
      const dist = pointToSegmentDistance(
        tube.labelPos.x,
        tube.labelPos.y,
        tube.origin.x,
        tube.origin.y,
        tube.end.x,
        tube.end.y,
      );
      expect(dist).toBeCloseTo(expectedOffset, 0);
      expect(tubeLabelPosition(tube.origin, tube.end)).toEqual(tube.labelPos);
    }
    expect(bl.labelPos.y).toBeLessThan(Math.min(bl.origin.y, bl.end.y));
    expect(or.labelPos.y).toBeGreaterThan(Math.max(or.origin.y, or.end.y));
  });

  it("centers each tube endpoint on its fiber group", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
      ]),
      mockTube("OR", [
        { rowIndex: 2, rowYOffset: 120, handleId: "f2", fiberColor: "GR" },
        { rowIndex: 3, rowYOffset: 160, handleId: "f3", fiberColor: "BR" },
      ]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    for (const tube of geo.tubes) {
      const rowYs = tube.fibers.map((f) => f.rowY);
      const fiberCenterY = (Math.min(...rowYs) + Math.max(...rowYs)) / 2;
      expect(tube.end.y).toBeCloseTo(fiberCenterY, 5);
    }
  });

  it("extends tube reach for more buffer tubes", () => {
    const one = computeCableBreakout(
      [mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }])],
      "left",
      40,
      56,
      18,
    );
    const two = computeCableBreakout(
      [
        mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }]),
        mockTube("OR", [{ rowIndex: 4, handleId: "f1", fiberColor: "OR" }]),
      ],
      "left",
      40,
      56,
      18,
    );
    expect(two.stemX - two.sheath.width).toBeGreaterThan(
      one.stemX - one.sheath.width,
    );
  });

  it("aligns fiber stem X when alignedStemX exceeds natural reach", () => {
    const sparse = [
      mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }]),
    ];
    const dense = [
      mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }]),
      mockTube("OR", [{ rowIndex: 4, handleId: "f1", fiberColor: "OR" }]),
      mockTube("GR", [{ rowIndex: 8, handleId: "f2", fiberColor: "GR" }]),
    ];
    const align = computeSideStemAlignment(
      [
        { tubes: sparse, side: "left" },
        { tubes: dense, side: "left" },
      ],
      40,
      56,
      18,
    );
    const sparseGeo = computeCableBreakout(
      sparse,
      "left",
      40,
      56,
      18,
      1,
      align.left,
    );
    const denseGeo = computeCableBreakout(
      dense,
      "left",
      40,
      56,
      18,
      1,
      align.left,
    );
    expect(sparseGeo.stemX).toBe(denseGeo.stemX);
    expect(sparseGeo.tubes[0]!.end.x).toBeGreaterThan(
      computeCableBreakout(sparse, "left", 40, 56, 18).tubes[0]!.end.x,
    );
  });

  it("mirrors geometry for right-side cables", () => {
    const tubes = [
      mockTube("BL", [{ rowIndex: 0, handleId: "f0", fiberColor: "BL" }]),
    ];
    const left = computeCableBreakout(tubes, "left", 40, 56, 18);
    const right = computeCableBreakout(tubes, "right", 40, 56, 18);
    expect(right.sheath.x).toBeGreaterThan(left.sheath.x);
    expect(right.tubes[0]!.origin.x).toBeGreaterThan(left.tubes[0]!.origin.x);
  });

  it("fans fiber strands toward the splice center", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
      ]),
    ];
    const left = computeCableBreakout(tubes, "left", 40, 56, 18);
    for (const fiber of left.tubes[0]!.fibers) {
      expect(fiber.fanTo.x).toBeGreaterThan(fiber.fanFrom.x);
      expect(fiber.fanElbow!.x).toBeLessThan(fiber.fanTo.x);
      expect(fiber.fanElbow!.x).toBeGreaterThan(fiber.fanFrom.x);
    }

    const right = computeCableBreakout(tubes, "right", 40, 56, 18);
    for (const fiber of right.tubes[0]!.fibers) {
      expect(fiber.fanTo.x).toBeLessThan(fiber.fanFrom.x);
      expect(fiber.fanElbow!.x).toBeGreaterThan(fiber.fanTo.x);
      expect(fiber.fanElbow!.x).toBeLessThan(fiber.fanFrom.x);
    }
  });
});

describe("cableXForSide", () => {
  it("returns the same column regardless of tube count", async () => {
    const { cableXForSide, CABLE_LAYOUT } = await import("./cableLayoutMetrics");
    expect(cableXForSide("left", 1)).toBe(CABLE_LAYOUT.leftX);
    expect(cableXForSide("left", 3)).toBe(CABLE_LAYOUT.leftX);
    expect(cableXForSide("right", 3)).toBe(CABLE_LAYOUT.rightX);
  });
});
