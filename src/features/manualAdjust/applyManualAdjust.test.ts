import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";

import { applyLegOverridesToEdge } from "./applyManualAdjust";

function buttEdge(leftPath: string, rightPath: string, spliceX: number, spliceY: number): Edge {
  return {
    id: "butt-test",
    source: "a",
    target: "b",
    type: "splice",
    data: { leftPath, rightPath, spliceX, spliceY, fullButtSplice: true },
  };
}

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
    // Square stays at the same height (horizontal-only shift).
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
