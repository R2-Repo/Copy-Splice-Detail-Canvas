import { describe, expect, it } from "vitest";

import {
  FUSION_DOT_MIN_CORNER_CLEARANCE,
  FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE,
  pathCornerClearanceFromFusionDot,
  pathDistanceToNearestCorner,
} from "@/features/canvas/edges/splicePathGeometry";

import {
  clampVerticalLaneDeltaForCornerClearance,
  distanceVerticalSegmentsToFusionDot,
  fusionDotCornerClearanceOk,
  fusionDotOnHorizontalSegment,
  fusionDotVerticalLaneClearanceOk,
  legCommitBlockedMessage,
  validateLegPaths,
} from "./constraints";

describe("DOT-003 fusion dot constraints", () => {
  it("requires 48px corner clearance constant", () => {
    expect(FUSION_DOT_MIN_CORNER_CLEARANCE).toBe(48);
  });

  it("accepts dot on horizontal segment with clearance", () => {
    const leftPath = "M 100,80 L 300,80";
    const rightPath = "M 300,80 L 500,80";
    expect(fusionDotOnHorizontalSegment(300, 80, leftPath, rightPath)).toBe(
      true,
    );
    expect(fusionDotCornerClearanceOk(200, 80, leftPath, rightPath)).toBe(
      true,
    );
  });

  it("validateLegPaths accepts valid straight splice", () => {
    const leftPath = "M 100,80 L 300,80";
    const rightPath = "M 300,80 L 500,80";
    expect(validateLegPaths(leftPath, rightPath, 300, 80)).toBeNull();
  });

  it("validateLegPaths rejects excess bends", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120 L 300,120 L 300,80";
    const rightPath = "M 300,80 L 500,80";
    expect(validateLegPaths(leftPath, rightPath, 300, 80)).toBe("EDGE-004");
    expect(legCommitBlockedMessage("EDGE-004")).toContain("2-corner");
  });

  it("rejects dot within 48px of right-leg corner even on short horizontal span", () => {
    const leftPath = "M 100,80 L 252,80";
    const rightPath = "M 252,80 L 280,80 L 280,200 L 500,200";
    expect(pathDistanceToNearestCorner(rightPath, "forward")).toBe(28);
    expect(
      fusionDotCornerClearanceOk(252, 80, leftPath, rightPath),
    ).toBe(false);
    expect(validateLegPaths(leftPath, rightPath, 252, 80)).toBe("DOT-004");
  });

  it("accepts hv_demarcated splice with 48px path clearance to both corners", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120 L 252,120";
    const rightPath = "M 252,120 L 300,120 L 300,200 L 500,200";
    expect(pathCornerClearanceFromFusionDot(leftPath, rightPath)).toBe(48);
    expect(
      fusionDotCornerClearanceOk(252, 120, leftPath, rightPath),
    ).toBe(true);
  });

  it("clampVerticalLaneDeltaForCornerClearance stops corner within 48px of dot", () => {
    const segment = { kind: "v" as const, index: 2, x: 340, y0: 80, y1: 200 };
    const delta = clampVerticalLaneDeltaForCornerClearance(
      segment,
      -20,
      300,
      80,
    );
    expect(segment.x + delta).toBe(348);
  });
});

describe("DOT-004 vertical lane clearance", () => {
  it("requires 48px vertical lane clearance constant", () => {
    expect(FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE).toBe(48);
  });

  it("rejects vertical leg through fusion dot row", () => {
    const leftPath = "M 100,80 L 300,80";
    const rightPath = "M 300,80 L 300,200 L 500,200";
    expect(
      fusionDotVerticalLaneClearanceOk(300, 80, leftPath, rightPath),
    ).toBe(false);
    expect(validateLegPaths(leftPath, rightPath, 300, 80)).toBe("DOT-004");
    expect(legCommitBlockedMessage("DOT-004")).toContain("48px");
  });

  it("rejects vertical leg within 48px of dot on same row", () => {
    const leftPath = "M 100,80 L 300,80";
    const rightPath = "M 300,80 L 340,80 L 340,200 L 500,200";
    expect(distanceVerticalSegmentsToFusionDot(300, 80, [
      { kind: "v", index: 2, x: 340, y0: 80, y1: 200 },
    ])).toBe(40);
    expect(validateLegPaths(leftPath, rightPath, 300, 80)).toBe("DOT-004");
  });

  it("accepts vertical leg at least 48px from dot", () => {
    const leftPath = "M 100,80 L 300,80";
    const rightPath = "M 300,80 L 360,80 L 360,200 L 500,200";
    expect(
      fusionDotVerticalLaneClearanceOk(300, 80, leftPath, rightPath),
    ).toBe(true);
    expect(validateLegPaths(leftPath, rightPath, 300, 80)).toBeNull();
  });
});
