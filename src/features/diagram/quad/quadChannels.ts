import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";
import type { QuadSide } from "@/types/splice";

/**
 * Inner edges of the open routing region, derived from the placed fiber handles.
 * `leftX` is the right-most left-cable handle (open space lies to its right),
 * `topY` is the bottom-most top-cable handle, etc. Splice lanes live between
 * these frontiers instead of all piling onto the diagram center line.
 */
export type QuadFrontiers = {
  leftX: number;
  rightX: number;
  topY: number;
  bottomY: number;
};

export type QuadAnchorRef = { x: number; y: number; side: QuadSide };

/** Build the open-region frontiers from every fiber handle in the diagram. */
export function computeQuadFrontiers(
  anchors: QuadAnchorRef[],
  bounds: { width: number; height: number },
  fallbackMargin = 80,
): QuadFrontiers {
  let leftX = Number.NEGATIVE_INFINITY;
  let rightX = Number.POSITIVE_INFINITY;
  let topY = Number.NEGATIVE_INFINITY;
  let bottomY = Number.POSITIVE_INFINITY;

  for (const a of anchors) {
    if (a.side === "left") leftX = Math.max(leftX, a.x);
    else if (a.side === "right") rightX = Math.min(rightX, a.x);
    else if (a.side === "top") topY = Math.max(topY, a.y);
    else if (a.side === "bottom") bottomY = Math.min(bottomY, a.y);
  }

  return {
    leftX: Number.isFinite(leftX) ? leftX : fallbackMargin,
    rightX: Number.isFinite(rightX) ? rightX : bounds.width - fallbackMargin,
    topY: Number.isFinite(topY) ? topY : fallbackMargin,
    bottomY: Number.isFinite(bottomY) ? bottomY : bounds.height - fallbackMargin,
  };
}

/**
 * Packs routing lanes onto a 1-D grid. Each request returns the nearest free
 * slot to the desired coordinate, so overlapping splices spread into adjacent
 * open lanes (spaced by `SPLICE_LANE_SEP`) instead of stacking on one line.
 */
export class LaneAllocator {
  private readonly used = new Set<number>();
  private readonly lo: number;
  private readonly hi: number;
  private readonly sep: number;
  private readonly maxSlot: number;

  constructor(lo: number, hi: number, sep: number = SPLICE_LANE_SEP) {
    this.lo = Math.min(lo, hi);
    this.hi = Math.max(lo, hi);
    this.sep = Math.max(1, sep);
    this.maxSlot = Math.max(0, Math.floor((this.hi - this.lo) / this.sep));
  }

  /** Nearest free lane coordinate to `desired`, clamped to the band. */
  alloc(desired: number): number {
    const clamped = Math.min(this.hi, Math.max(this.lo, desired));
    const base = Math.round((clamped - this.lo) / this.sep);
    for (let d = 0; d <= this.maxSlot; d++) {
      const candidates = d === 0 ? [base] : [base - d, base + d];
      for (const slot of candidates) {
        if (slot < 0 || slot > this.maxSlot) continue;
        if (!this.used.has(slot)) {
          this.used.add(slot);
          return this.lo + slot * this.sep;
        }
      }
    }
    return clamped;
  }
}
