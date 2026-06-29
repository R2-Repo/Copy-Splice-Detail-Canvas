import {
  countOrthogonalBends,
  FUSION_DOT_MIN_CORNER_CLEARANCE,
  FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE,
  MAX_SPLICE_BENDS,
  pathCornerClearanceFromFusionDot,
  SPLICE_PATH_EPS,
} from "@/features/canvas/edges/splicePathGeometry";

import { MAX_MANUAL_FANOUT_SHIFT_Y } from "@/features/diagram/tubeRowShift";
import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";

import type { LegSegment } from "./legSegments";
import { pathToLegSegments } from "./legSegments";

export function verticalSegmentSpansSpliceY(
  segment: LegSegment,
  spliceY: number,
): boolean {
  if (segment.kind !== "v") return false;
  const yMin = Math.min(segment.y0, segment.y1);
  const yMax = Math.max(segment.y0, segment.y1);
  return (
    spliceY >= yMin - SPLICE_PATH_EPS && spliceY <= yMax + SPLICE_PATH_EPS
  );
}

export function distanceVerticalSegmentsToFusionDot(
  spliceX: number,
  spliceY: number,
  segments: LegSegment[],
): number {
  let min = Infinity;
  for (const seg of segments) {
    if (seg.kind !== "v") continue;
    if (!verticalSegmentSpansSpliceY(seg, spliceY)) continue;
    min = Math.min(min, Math.abs(seg.x - spliceX));
  }
  return min;
}

export function fusionDotOnHorizontalSegment(
  spliceX: number,
  spliceY: number,
  leftPath: string,
  rightPath: string,
): boolean {
  const left = pathToLegSegments(leftPath);
  const right = pathToLegSegments(rightPath);
  const onLeft = left.some(
    (s) =>
      s.kind === "h" &&
      Math.abs(s.y - spliceY) <= SPLICE_PATH_EPS &&
      spliceX >= Math.min(s.x0, s.x1) - SPLICE_PATH_EPS &&
      spliceX <= Math.max(s.x0, s.x1) + SPLICE_PATH_EPS,
  );
  const onRight = right.some(
    (s) =>
      s.kind === "h" &&
      Math.abs(s.y - spliceY) <= SPLICE_PATH_EPS &&
      spliceX >= Math.min(s.x0, s.x1) - SPLICE_PATH_EPS &&
      spliceX <= Math.max(s.x0, s.x1) + SPLICE_PATH_EPS,
  );
  return onLeft || onRight;
}

export function fusionDotCornerClearanceOk(
  spliceX: number,
  spliceY: number,
  leftPath: string,
  rightPath: string,
): boolean {
  void spliceX;
  void spliceY;
  return (
    pathCornerClearanceFromFusionDot(leftPath, rightPath) >=
    FUSION_DOT_MIN_CORNER_CLEARANCE
  );
}

/** SDC-UX-001-E: no vertical leg lane may run through or within 48px of the fusion dot row. */
export function fusionDotVerticalLaneClearanceOk(
  spliceX: number,
  spliceY: number,
  leftPath: string,
  rightPath: string,
): boolean {
  const left = pathToLegSegments(leftPath);
  const right = pathToLegSegments(rightPath);
  const clearance = Math.min(
    distanceVerticalSegmentsToFusionDot(spliceX, spliceY, left),
    distanceVerticalSegmentsToFusionDot(spliceX, spliceY, right),
  );
  return clearance >= FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE;
}

export function pathsWithinBendBudget(leftPath: string, rightPath: string): boolean {
  return countOrthogonalBends(leftPath, rightPath) <= MAX_SPLICE_BENDS;
}

export type LegPathValidationCode =
  | "SDC-ROUTE-004-A"
  | "SDC-UX-001-B"
  | "SDC-UX-001-D"
  | "SDC-UX-001-E";

export function validateLegPaths(
  leftPath: string,
  rightPath: string,
  spliceX: number,
  spliceY: number,
): LegPathValidationCode | null {
  if (!pathsWithinBendBudget(leftPath, rightPath)) {
    return "SDC-ROUTE-004-A";
  }
  if (!fusionDotOnHorizontalSegment(spliceX, spliceY, leftPath, rightPath)) {
    return "SDC-UX-001-B";
  }
  if (!fusionDotVerticalLaneClearanceOk(spliceX, spliceY, leftPath, rightPath)) {
    return "SDC-UX-001-E";
  }
  if (!fusionDotCornerClearanceOk(spliceX, spliceY, leftPath, rightPath)) {
    return "SDC-UX-001-D";
  }
  return null;
}

export function legCommitBlockedMessage(code: LegPathValidationCode): string {
  switch (code) {
    case "SDC-ROUTE-004-A":
      return "Move blocked — 2-corner bend limit (SDC-ROUTE-004-A)";
    case "SDC-UX-001-B":
      return "Move blocked — fusion dot must stay on horizontal leg (SDC-UX-001-B)";
    case "SDC-UX-001-D":
      return "Move blocked — fusion dot needs 48px corner clearance (SDC-UX-001-D)";
    case "SDC-UX-001-E":
      return "Move blocked — vertical leg within 48px of fusion dot (SDC-UX-001-E)";
  }
}

export function clampHorizontalLaneDeltaNearFusionDot(
  segment: Extract<LegSegment, { kind: "v" }>,
  delta: number,
  spliceX: number,
  spliceY: number,
): number {
  if (!verticalSegmentSpansSpliceY(segment, spliceY)) return delta;
  const proposedX = segment.x + delta;
  if (Math.abs(proposedX - spliceX) >= FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE) {
    return delta;
  }
  const away = segment.x >= spliceX ? 1 : -1;
  const limitX = spliceX + away * FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE;
  return limitX - segment.x;
}

/** SDC-UX-001-D live clamp: vertical lane corners on the dot row stay ≥48px from the fusion dot. */
export function clampVerticalLaneDeltaForCornerClearance(
  segment: Extract<LegSegment, { kind: "v" }>,
  delta: number,
  spliceX: number,
  spliceY: number,
): number {
  if (!verticalSegmentSpansSpliceY(segment, spliceY)) return delta;
  const proposedX = segment.x + delta;
  if (Math.abs(proposedX - spliceX) >= FUSION_DOT_MIN_CORNER_CLEARANCE) {
    return delta;
  }
  const away = segment.x >= spliceX ? 1 : -1;
  const limitX = spliceX + away * FUSION_DOT_MIN_CORNER_CLEARANCE;
  return limitX - segment.x;
}

export function clampFanoutShiftY(
  shiftY: number,
  maxShift = MAX_MANUAL_FANOUT_SHIFT_Y,
): number {
  return Math.max(-maxShift, Math.min(maxShift, shiftY));
}

/** Horizontal stem reach override (px along fan-out direction). */
export function clampStemReachX(reachX: number, maxReach = FIBER_ROW_PITCH * 3): number {
  return Math.max(-maxReach, Math.min(maxReach, reachX));
}
