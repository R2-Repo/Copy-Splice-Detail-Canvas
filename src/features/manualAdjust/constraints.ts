import {
  countOrthogonalBends,
  FUSION_DOT_MIN_CORNER_CLEARANCE,
  MAX_SPLICE_BENDS,
  SPLICE_PATH_EPS,
} from "@/features/canvas/edges/splicePathGeometry";

import type { LegSegment } from "./legSegments";
import { pathToLegSegments } from "./legSegments";

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

export function pathsWithinBendBudget(leftPath: string, rightPath: string): boolean {
  return countOrthogonalBends(leftPath, rightPath) <= MAX_SPLICE_BENDS;
}

export function clampFanoutShiftY(shiftY: number, maxShift = 48): number {
  return Math.max(-maxShift, Math.min(maxShift, shiftY));
}
