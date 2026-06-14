import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";
import type { QuadSide } from "@/types/splice";

import { axisForSide } from "./quadTypes";

export type QuadEndpoint = { x: number; y: number; side: QuadSide };

export type QuadRoutedSplice = {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
};

/** Inward inset for same-side (loop-back) meeting lines. */
const SAME_SIDE_INSET = 48;

function clampBetween(value: number, a: number, b: number, pad: number): number {
  const lo = Math.min(a, b) + pad;
  const hi = Math.max(a, b) - pad;
  if (lo > hi) return (a + b) / 2;
  return Math.min(hi, Math.max(lo, value));
}

function line(points: Array<{ x: number; y: number }>): string {
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
}

/**
 * Orthogonal port-to-dot routing for quad mode. Perpendicular cable pairs meet
 * at an L corner (0 interior bends — the bend-elimination win); opposite pairs
 * meet on a center lane; same-side pairs loop back just inside the cables.
 */
export function routeQuadSplice(
  source: QuadEndpoint,
  target: QuadEndpoint,
  laneIndex: number,
  center: { x: number; y: number },
): QuadRoutedSplice {
  const sAxis = axisForSide(source.side);
  const tAxis = axisForSide(target.side);
  const laneShift = (((laneIndex % 9) - 4) * SPLICE_LANE_SEP) / 2;
  const sameSide = source.side === target.side;

  if (sAxis === "horizontal" && tAxis === "horizontal") {
    let mx: number;
    if (sameSide) {
      mx =
        source.side === "left"
          ? Math.max(source.x, target.x) + SAME_SIDE_INSET + Math.abs(laneShift)
          : Math.min(source.x, target.x) - SAME_SIDE_INSET - Math.abs(laneShift);
    } else {
      mx = clampBetween(center.x + laneShift, source.x, target.x, 8);
    }
    const dotX = mx;
    const dotY = source.y;
    const left = line([source, { x: dotX, y: dotY }]);
    const right =
      Math.abs(source.y - target.y) < 0.5
        ? line([{ x: dotX, y: dotY }, target])
        : line([
            { x: dotX, y: dotY },
            { x: dotX, y: target.y },
            target,
          ]);
    return { leftPath: left, rightPath: right, spliceX: dotX, spliceY: dotY };
  }

  if (sAxis === "vertical" && tAxis === "vertical") {
    let my: number;
    if (sameSide) {
      my =
        source.side === "top"
          ? Math.max(source.y, target.y) + SAME_SIDE_INSET + Math.abs(laneShift)
          : Math.min(source.y, target.y) - SAME_SIDE_INSET - Math.abs(laneShift);
    } else {
      my = clampBetween(center.y + laneShift, source.y, target.y, 8);
    }
    const dotX = source.x;
    const dotY = my;
    const left = line([source, { x: dotX, y: dotY }]);
    const right =
      Math.abs(source.x - target.x) < 0.5
        ? line([{ x: dotX, y: dotY }, target])
        : line([
            { x: dotX, y: dotY },
            { x: target.x, y: dotY },
            target,
          ]);
    return { leftPath: left, rightPath: right, spliceX: dotX, spliceY: dotY };
  }

  // Perpendicular: dot at the corner where the two ports' axes intersect.
  const dotX = sAxis === "horizontal" ? target.x : source.x;
  const dotY = sAxis === "horizontal" ? source.y : target.y;
  return {
    leftPath: line([source, { x: dotX, y: dotY }]),
    rightPath: line([{ x: dotX, y: dotY }, target]),
    spliceX: dotX,
    spliceY: dotY,
  };
}
