import { describe, expect, it } from "vitest";

import {
  computeCableBreakout,
  computeDiagramScale,
  computeSheathSize,
  computeSideStemAlignment,
  SHEATH_SIZE,
} from "./cableBreakoutGeometry";
import type { VisualTube } from "./visualCables";

function mockTube(
  tubeColor: string,
  fibers: {
    rowIndex: number;
    rowYOffset?: number;
    handleId: string;
    fiberColor: string;
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

  it("ignores visualShiftY for expanded tube and fan geometry", () => {
    const tubes = [
      {
        ...mockTube("BL", [
          { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
          { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
        ]),
        visualShiftY: 10,
      },
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const tube = geo.tubes[0]!;
    expect(tube.origin.y).toBeCloseTo(tube.end.y, 5);
    const rowYs = tube.fibers.map((f) => f.rowY);
    const fiberCenterY = (Math.min(...rowYs) + Math.max(...rowYs)) / 2;
    expect(tube.end.y).toBeCloseTo(fiberCenterY, 5);
  });

  it("fans each strand from the tube tip to its row at the stem", () => {
    const tubes = [
      mockTube("BL", [
        { rowIndex: 0, rowYOffset: 0, handleId: "f0", fiberColor: "BL" },
        { rowIndex: 1, rowYOffset: 40, handleId: "f1", fiberColor: "OR" },
      ]),
    ];
    const geo = computeCableBreakout(tubes, "left", 40, 56, 18);
    const tube = geo.tubes[0]!;
    expect(tube.fibers[0]!.fanFrom).toEqual(tube.end);
    expect(tube.fibers[0]!.fanTo.y).not.toBe(tube.end.y);
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
    }

    const right = computeCableBreakout(tubes, "right", 40, 56, 18);
    for (const fiber of right.tubes[0]!.fibers) {
      expect(fiber.fanTo.x).toBeLessThan(fiber.fanFrom.x);
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
