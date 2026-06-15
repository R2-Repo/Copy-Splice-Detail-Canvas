import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";

import { LaneAllocator, type QuadFrontiers } from "./quadChannels";
import { axisForSide } from "./quadTypes";
import type { QuadSide } from "@/types/splice";

export type QuadEndpoint = { x: number; y: number; side: QuadSide };

export type QuadRoutedSplice = {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
};

export type QuadRouter = {
  route(source: QuadEndpoint, target: QuadEndpoint): QuadRoutedSplice;
};

/** Inward inset for same-side (loop-back) meeting lines. */
const SAME_SIDE_INSET = 40;
const ALIGNED_TOLERANCE = 0.5;

function clampBetween(value: number, a: number, b: number, pad: number): number {
  const lo = Math.min(a, b) + pad;
  const hi = Math.max(a, b) - pad;
  if (lo > hi) return (a + b) / 2;
  return Math.min(hi, Math.max(lo, value));
}

function line(points: Array<{ x: number; y: number }>): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/**
 * Channel/lane router for quad mode. Instead of forcing every fusion dot onto
 * the diagram center line, splices are spread across open lanes between the side
 * frontiers, and each leg takes the fewest bends possible:
 *
 * - perpendicular pair  -> single L at the corner (0 interior bends),
 * - aligned opposite    -> straight line (0 interior bends),
 * - offset opposite     -> one jog onto its own nearest free lane (1 bend),
 * - same side           -> tight loop just inside the cables on its own lane.
 *
 * Lanes are packed by `LaneAllocator`, so overlapping runs separate by
 * `SPLICE_LANE_SEP` and the center stays readable.
 */
export function createQuadRouter(
  frontiers: QuadFrontiers,
  center: { x: number; y: number },
): QuadRouter {
  const inset = SPLICE_LANE_SEP;
  // Vertical lanes (x) carry left<->right jogs + same-side L/R loops.
  const vertLanes = new LaneAllocator(
    frontiers.leftX + inset,
    frontiers.rightX - inset,
  );
  // Horizontal lanes (y) carry top<->bottom jogs + same-side top/bottom loops.
  const horizLanes = new LaneAllocator(
    frontiers.topY + inset,
    frontiers.bottomY - inset,
  );

  function route(
    source: QuadEndpoint,
    target: QuadEndpoint,
  ): QuadRoutedSplice {
    const sAxis = axisForSide(source.side);
    const tAxis = axisForSide(target.side);

    // Perpendicular pair: meet at the corner where the two ports' axes cross.
    if (sAxis !== tAxis) {
      const dotX = sAxis === "horizontal" ? target.x : source.x;
      const dotY = sAxis === "horizontal" ? source.y : target.y;
      return {
        leftPath: line([source, { x: dotX, y: dotY }]),
        rightPath: line([{ x: dotX, y: dotY }, target]),
        spliceX: dotX,
        spliceY: dotY,
      };
    }

    const sameSide = source.side === target.side;

    if (sAxis === "horizontal") {
      if (sameSide) {
        const desired =
          source.side === "left"
            ? Math.max(source.x, target.x) + SAME_SIDE_INSET
            : Math.min(source.x, target.x) - SAME_SIDE_INSET;
        const dotX = vertLanes.alloc(desired);
        const dotY = (source.y + target.y) / 2;
        return {
          leftPath: line([
            source,
            { x: dotX, y: source.y },
            { x: dotX, y: dotY },
          ]),
          rightPath: line([
            { x: dotX, y: dotY },
            { x: dotX, y: target.y },
            target,
          ]),
          spliceX: dotX,
          spliceY: dotY,
        };
      }
      if (Math.abs(source.y - target.y) < ALIGNED_TOLERANCE) {
        const dotX = clampBetween(center.x, source.x, target.x, 8);
        return {
          leftPath: line([source, { x: dotX, y: source.y }]),
          rightPath: line([{ x: dotX, y: source.y }, target]),
          spliceX: dotX,
          spliceY: source.y,
        };
      }
      const dotX = vertLanes.alloc((source.x + target.x) / 2);
      return {
        leftPath: line([source, { x: dotX, y: source.y }]),
        rightPath: line([
          { x: dotX, y: source.y },
          { x: dotX, y: target.y },
          target,
        ]),
        spliceX: dotX,
        spliceY: source.y,
      };
    }

    // Vertical axis: top/bottom cables, dot rides a horizontal lane.
    if (sameSide) {
      const desired =
        source.side === "top"
          ? Math.max(source.y, target.y) + SAME_SIDE_INSET
          : Math.min(source.y, target.y) - SAME_SIDE_INSET;
      const dotY = horizLanes.alloc(desired);
      const dotX = (source.x + target.x) / 2;
      return {
        leftPath: line([
          source,
          { x: source.x, y: dotY },
          { x: dotX, y: dotY },
        ]),
        rightPath: line([
          { x: dotX, y: dotY },
          { x: target.x, y: dotY },
          target,
        ]),
        spliceX: dotX,
        spliceY: dotY,
      };
    }
    if (Math.abs(source.x - target.x) < ALIGNED_TOLERANCE) {
      const dotY = clampBetween(center.y, source.y, target.y, 8);
      return {
        leftPath: line([source, { x: source.x, y: dotY }]),
        rightPath: line([{ x: source.x, y: dotY }, target]),
        spliceX: source.x,
        spliceY: dotY,
      };
    }
    const dotY = horizLanes.alloc((source.y + target.y) / 2);
    return {
      leftPath: line([source, { x: source.x, y: dotY }]),
      rightPath: line([
        { x: source.x, y: dotY },
        { x: target.x, y: dotY },
        target,
      ]),
      spliceX: source.x,
      spliceY: dotY,
    };
  }

  return { route };
}
