import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";
import type { LayoutOverrides } from "@/types/splice";

import { applyHybridFusionDotLocks, applyLegOverridesToEdge } from "./applyManualAdjust";

function spliceEdge(leftPath: string, rightPath: string, spliceX: number, spliceY: number): Edge {
  return {
    id: "splice-left-conn-a",
    source: "a",
    target: "b",
    type: "splice",
    data: { leftPath, rightPath, spliceX, spliceY, routingPrecomputed: true },
  };
}

function buttEdge(leftPath: string, rightPath: string, spliceX: number, spliceY: number): Edge {
  return {
    id: "butt-test",
    source: "a",
    target: "b",
    type: "splice",
    data: { leftPath, rightPath, spliceX, spliceY, fullButtSplice: true },
  };
}

describe("applyHybridFusionDotLocks", () => {
  it("applies dotShiftX when auto is on but fusion dot is grid-locked", () => {
    const edge = spliceEdge("M 100,100 L 300,100", "M 300,100 L 500,100", 300, 100);
    const overrides: LayoutOverrides = {
      reportKey: "hybrid-dot",
      positions: {},
      autoAdjustEnabled: true,
      gridLocks: { segments: [], dots: ["conn-a"], cables: [], tubeGroups: [] },
      legOverrides: { "conn-a": { dotShiftX: 24 } },
    };
    const [out] = applyHybridFusionDotLocks([edge], overrides, undefined, undefined);
    const data = out!.data as { spliceX: number; leftPath: string; rightPath: string };
    expect(data.spliceX).toBeCloseTo(324, 0);
    expect(parseOrthogonalPathPoints(data.leftPath).at(-1)!.x).toBeCloseTo(324, 0);
  });

  it("skips when dot is not in gridLocks", () => {
    const edge = spliceEdge("M 100,100 L 300,100", "M 300,100 L 500,100", 300, 100);
    const overrides: LayoutOverrides = {
      reportKey: "hybrid-dot",
      positions: {},
      autoAdjustEnabled: true,
      legOverrides: { "conn-a": { dotShiftX: 24 } },
    };
    const [out] = applyHybridFusionDotLocks([edge], overrides);
    expect((out!.data as { spliceX: number }).spliceX).toBe(300);
  });
});

describe("applyLegOverridesToEdge — collapsed butt square dotShiftX", () => {
  it("slides a bent butt square horizontally and keeps the legs joined", () => {
    const edge = buttEdge(
      "M 100,100 L 200,100 L 200,200",
      "M 200,200 L 200,300 L 400,300",
      200,
      200,
    );
    const out = applyLegOverridesToEdge(edge, { dotShiftX: 20 }, 100, 100, 400, 300);
    const data = out!.data as { leftPath: string; rightPath: string; spliceX: number };
    expect(data.spliceX).toBeCloseTo(220, 0);
    const leftEnd = parseOrthogonalPathPoints(data.leftPath).at(-1)!;
    const rightStart = parseOrthogonalPathPoints(data.rightPath)[0]!;
    expect(leftEnd.x).toBeCloseTo(220, 0);
    expect(rightStart.x).toBeCloseTo(220, 0);
    expect(leftEnd.y).toBeCloseTo(200, 0);
    expect(rightStart.y).toBeCloseTo(200, 0);
  });

  it("slides a straight (same-row) butt square along the line", () => {
    const edge = buttEdge("M 100,100 L 200,100", "M 200,100 L 400,100", 200, 100);
    const out = applyLegOverridesToEdge(edge, { dotShiftX: 30 }, 100, 100, 400, 100);
    const data = out!.data as { leftPath: string; rightPath: string; spliceX: number };
    expect(data.spliceX).toBeCloseTo(230, 0);
    expect(parseOrthogonalPathPoints(data.leftPath).at(-1)!.x).toBeCloseTo(230, 0);
    expect(parseOrthogonalPathPoints(data.rightPath)[0]!.x).toBeCloseTo(230, 0);
  });

  it("leaves the butt square in place when there is no dot shift", () => {
    const edge = buttEdge("M 100,100 L 200,100 L 200,200", "M 200,200 L 200,300 L 400,300", 200, 200);
    const out = applyLegOverridesToEdge(edge, {}, 100, 100, 400, 300);
    const data = out!.data as { spliceX: number };
    expect(data.spliceX).toBeCloseTo(200, 0);
  });
});
