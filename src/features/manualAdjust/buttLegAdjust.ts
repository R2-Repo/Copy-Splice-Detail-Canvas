import type { Edge } from "@xyflow/react";

import {
  countOrthogonalBends,
  MAX_SPLICE_BENDS,
  parseTubeHandleId,
  SPLICE_PATH_EPS,
} from "@/features/canvas/edges/splicePathGeometry";

import {
  legSegmentsFromPaths,
  shiftVerticalLane,
  type LegSegment,
} from "./legSegments";
import type { LegSide } from "./types";

export function isButtEdgeId(id: string): boolean {
  return id.startsWith("butt-");
}

export function isButtSpliceEdge(edge: Edge): boolean {
  const data = (edge.data ?? {}) as { fullButtSplice?: boolean };
  return data.fullButtSplice === true || isButtEdgeId(edge.id);
}

/** Center vertical run on a collapsed butt splice (draggable ↔ like fiber legs). */
export function isButtCenterVerticalSegment(
  segment: LegSegment,
  spliceX: number,
): boolean {
  if (segment.kind !== "v") return false;
  if (Math.abs(segment.x - spliceX) > SPLICE_PATH_EPS + 1) return false;
  return segment.y1 - segment.y0 >= 8;
}

export type ButtDraggableSegment = {
  edgeId: string;
  side: LegSide;
  segmentIndex: number;
  segment: LegSegment;
};

export function draggableButtCenterSegments(edge: Edge): ButtDraggableSegment[] {
  if (!isButtSpliceEdge(edge)) return [];
  const data = (edge.data ?? {}) as {
    leftPath?: string;
    rightPath?: string;
    spliceX?: number;
  };
  const leftPath = String(data.leftPath ?? "");
  const rightPath = String(data.rightPath ?? "");
  if (!leftPath || !rightPath) return [];

  const spliceX = Number(data.spliceX ?? NaN);
  if (!Number.isFinite(spliceX)) return [];

  const { left, right } = legSegmentsFromPaths(leftPath, rightPath);
  const items: ButtDraggableSegment[] = [];

  for (const side of ["left", "right"] as const) {
    const segments = side === "left" ? left : right;
    for (const seg of segments) {
      if (!isButtCenterVerticalSegment(seg, spliceX)) continue;
      items.push({
        edgeId: edge.id,
        side,
        segmentIndex: seg.index,
        segment: seg,
      });
    }
  }

  return items;
}

/** Shift collapsed butt center vertical lane ↔ (bypasses fusion-dot segment guards). */
export function applyButtCenterVerticalDelta(
  segments: LegSegment[],
  segmentIndex: number,
  delta: number,
): LegSegment[] {
  if (Math.abs(delta) < 0.5) return segments;
  return shiftVerticalLane(segments, segmentIndex, delta);
}

export function buttLegPathsWithinBendBudget(
  leftPath: string,
  rightPath: string,
): boolean {
  return countOrthogonalBends(leftPath, rightPath) <= MAX_SPLICE_BENDS;
}

export function parseButtTubeColorsFromEdge(
  edge: Edge,
): { sourceTubeColor: string; targetTubeColor: string } | null {
  const sourceTube = parseTubeHandleId(edge.sourceHandle);
  const targetTube = parseTubeHandleId(edge.targetHandle);
  if (!sourceTube || !targetTube) return null;
  return {
    sourceTubeColor: sourceTube.tubeColor,
    targetTubeColor: targetTube.tubeColor,
  };
}
