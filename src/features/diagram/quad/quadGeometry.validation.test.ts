import { describe, expect, it } from "vitest";

import type { VisualTube } from "@/features/diagram/visualCables";

import {
  quadFansTowardCenter,
  quadSameSideStemColumnsAligned,
  quadStemAlignCanvasValue,
} from "./quadGeometry";

function sampleTubes(): VisualTube[] {
  return [
    {
      tubeColor: "BL",
      fibers: [
        {
          handleId: "h1",
          fiberNumber: 1,
          fiberColor: "BL",
          tubeColor: "BL",
          rowIndex: 0,
          rowYOffset: 0,
          connectionId: "c1",
        },
        {
          handleId: "h2",
          fiberNumber: 2,
          fiberColor: "OR",
          tubeColor: "BL",
          rowIndex: 1,
          rowYOffset: 24,
          connectionId: "c2",
        },
      ],
    },
  ];
}

describe("quad fan-out validation helpers", () => {
  it("reports aligned stem columns for stacked left quad cables", () => {
    const tubes = sampleTubes();
    const stem = 180;
    const nodes = [
      {
        position: { x: 40, y: 100 },
        data: { quadSide: "left" as const, tubes, diagramScale: 1, alignedStemX: stem },
      },
      {
        position: { x: 40, y: 320 },
        data: { quadSide: "left" as const, tubes, diagramScale: 1, alignedStemX: stem },
      },
    ];
    expect(quadSameSideStemColumnsAligned(nodes)).toBe(true);
    const a = quadStemAlignCanvasValue(nodes[0]!.position, tubes, "left", 1, stem);
    const b = quadStemAlignCanvasValue(nodes[1]!.position, tubes, "left", 1, stem);
    expect(a).toBe(b);
  });

  it("flags misaligned stem columns on the same quad side", () => {
    const tubes = sampleTubes();
    const nodes = [
      {
        position: { x: 40, y: 100 },
        data: { quadSide: "left" as const, tubes, diagramScale: 1, alignedStemX: 180 },
      },
      {
        position: { x: 40, y: 320 },
        data: { quadSide: "left" as const, tubes, diagramScale: 1, alignedStemX: 220 },
      },
    ];
    expect(quadSameSideStemColumnsAligned(nodes)).toBe(false);
  });

  it("does not mix top and left quad sides when checking alignment", () => {
    const tubes = sampleTubes();
    const stem = 180;
    const nodes = [
      {
        position: { x: 200, y: 40 },
        data: { quadSide: "top" as const, tubes, diagramScale: 1, alignedStemX: stem },
      },
      {
        position: { x: 500, y: 40 },
        data: { quadSide: "top" as const, tubes, diagramScale: 1, alignedStemX: stem },
      },
    ];
    expect(quadSameSideStemColumnsAligned(nodes)).toBe(true);
  });

  it("requires quad fans to point inward", () => {
    const tubes = sampleTubes();
    expect(quadFansTowardCenter({ x: 40, y: 100 }, tubes, "left", 1, 180)).toBe(
      true,
    );
    expect(quadFansTowardCenter({ x: 900, y: 100 }, tubes, "right", 1, 180)).toBe(
      true,
    );
  });
});
