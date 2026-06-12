import {
  countOrthogonalBends,
  FUSION_DOT_MIN_CORNER_CLEARANCE,
  FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE,
  MAX_SPLICE_BENDS,
  SPLICE_PATH_EPS,
} from "@/features/canvas/edges/splicePathGeometry";

import { MAX_MANUAL_FANOUT_SHIFT_Y } from "@/features/diagram/tubeRowShift";

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

export function distancePointToCorner(
  point: { x: number; y: number },
  segments: LegSegment[],
): number {
  const horizontal = segments.filter(
    (s): s is Extract<LegSegment, { kind: "h" }> =>
      s.kind === "h" &&
      Math.abs(s.y - point.y) <= SPLICE_PATH_EPS &&
      point.x >= Math.min(s.x0, s.x1) - SPLICE_PATH_EPS &&
      point.x <= Math.max(s.x0, s.x1) + SPLICE_PATH_EPS,
  );
  if (horizontal.length === 0) return Infinity;

  let min = Infinity;
  for (const seg of horizontal) {
    for (const cornerX of [seg.x0, seg.x1]) {
      const hasVertical =
        segments.some(
          (other) =>
            other.kind === "v" &&
            Math.abs(other.x - cornerX) <= SPLICE_PATH_EPS &&
            ((Math.abs(other.y0 - seg.y) <= SPLICE_PATH_EPS) ||
              (Math.abs(other.y1 - seg.y) <= SPLICE_PATH_EPS)),
        ) ?? false;
      if (!hasVertical) continue;
      min = Math.min(min, Math.abs(point.x - cornerX));
    }
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

function horizontalSpanAtPoint(
  segments: LegSegment[],
  point: { x: number; y: number },
): number {
  let span = 0;
  for (const seg of segments) {
    if (seg.kind !== "h") continue;
    if (Math.abs(seg.y - point.y) > SPLICE_PATH_EPS) continue;
    if (
      point.x < Math.min(seg.x0, seg.x1) - SPLICE_PATH_EPS ||
      point.x > Math.max(seg.x0, seg.x1) + SPLICE_PATH_EPS
    ) {
      continue;
    }
    span = Math.max(span, Math.abs(seg.x1 - seg.x0));
  }
  return span;
}

export function fusionDotCornerClearanceOk(
  spliceX: number,
  spliceY: number,
  leftPath: string,
  rightPath: string,
): boolean {
  const left = pathToLegSegments(leftPath);
  const right = pathToLegSegments(rightPath);
  const point = { x: spliceX, y: spliceY };
  const span = Math.max(
    horizontalSpanAtPoint(left, point),
    horizontalSpanAtPoint(right, point),
  );
  if (span < FUSION_DOT_MIN_CORNER_CLEARANCE * 2) {
    return true;
  }
  const clearance = Math.min(
    distancePointToCorner(point, left),
    distancePointToCorner(point, right),
  );
  return clearance >= FUSION_DOT_MIN_CORNER_CLEARANCE;
}

/** DOT-004: no vertical leg lane may run through or within 48px of the fusion dot row. */
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
  | "EDGE-004"
  | "DOT-001"
  | "DOT-003"
  | "DOT-004";

export function validateLegPaths(
  leftPath: string,
  rightPath: string,
  spliceX: number,
  spliceY: number,
): LegPathValidationCode | null {
  if (!pathsWithinBendBudget(leftPath, rightPath)) {
    return "EDGE-004";
  }
  if (!fusionDotOnHorizontalSegment(spliceX, spliceY, leftPath, rightPath)) {
    return "DOT-001";
  }
  if (!fusionDotVerticalLaneClearanceOk(spliceX, spliceY, leftPath, rightPath)) {
    const left = pathToLegSegments(leftPath);
    const right = pathToLegSegments(rightPath);
    // #region agent log
    fetch('http://127.0.0.1:7692/ingest/76af12d0-a987-40d1-88e0-d22d15ff6bad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6eead'},body:JSON.stringify({sessionId:'c6eead',location:'constraints.ts:validateLegPaths',message:'DOT-004 fail',data:{spliceX,spliceY,leftLaneClearance:distanceVerticalSegmentsToFusionDot(spliceX,spliceY,left),rightLaneClearance:distanceVerticalSegmentsToFusionDot(spliceX,spliceY,right),minRequired:FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
    // #endregion
    return "DOT-004";
  }
  if (!fusionDotCornerClearanceOk(spliceX, spliceY, leftPath, rightPath)) {
    // #region agent log
    fetch('http://127.0.0.1:7692/ingest/76af12d0-a987-40d1-88e0-d22d15ff6bad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6eead'},body:JSON.stringify({sessionId:'c6eead',location:'constraints.ts:validateLegPaths',message:'DOT-003 fail',data:{spliceX,spliceY},timestamp:Date.now(),hypothesisId:'H5'})}).catch(()=>{});
    // #endregion
    return "DOT-003";
  }
  return null;
}

export function legCommitBlockedMessage(code: LegPathValidationCode): string {
  switch (code) {
    case "EDGE-004":
      return "Move blocked — 2-corner bend limit (EDGE-004)";
    case "DOT-001":
      return "Move blocked — fusion dot must stay on horizontal leg (DOT-001)";
    case "DOT-003":
      return "Move blocked — fusion dot needs 48px corner clearance (DOT-003)";
    case "DOT-004":
      return "Move blocked — vertical leg within 48px of fusion dot (DOT-004)";
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

export function clampFanoutShiftY(
  shiftY: number,
  maxShift = MAX_MANUAL_FANOUT_SHIFT_Y,
): number {
  return Math.max(-maxShift, Math.min(maxShift, shiftY));
}
