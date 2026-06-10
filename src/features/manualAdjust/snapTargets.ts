import type { Edge } from "@xyflow/react";

import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import { snapToNearestTarget } from "@/features/diagram/snapGuides";

const SNAP_TOLERANCE = 8;

export function snapManualDeltaY(
  rawDelta: number,
  targets: number[],
  baseY: number,
): number {
  const snapped = snapToNearestTarget(
    baseY + rawDelta,
    targets,
    SNAP_TOLERANCE,
  );
  return snapped - baseY;
}

export function snapManualY(value: number, targets: number[]): number {
  return snapToNearestTarget(value, targets, SNAP_TOLERANCE);
}

export function snapManualX(value: number, targets: number[]): number {
  return snapToNearestTarget(value, targets, SNAP_TOLERANCE);
}

export function collectHandleSnapTargetsYs(
  anchorYs: number[],
  tubeTipYs: number[],
): number[] {
  const pitchTargets = anchorYs.flatMap((y) => [
    y,
    y + FIBER_ROW_PITCH,
    y - FIBER_ROW_PITCH,
  ]);
  return [...new Set([...anchorYs, ...tubeTipYs, ...pitchTargets])].sort(
    (a, b) => a - b,
  );
}

export function collectSegmentSnapTargetsXs(midXs: number[], dotXs: number[]): number[] {
  return [...new Set([...midXs, ...dotXs])].sort((a, b) => a - b);
}

/** Peer vertical lane X lines for leg segment snap (routingMidX / jogX). */
export function collectLegLaneSnapTargetsXs(
  edges: Edge[],
  excludeConnectionId?: string,
): number[] {
  const xs: number[] = [];
  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    const connId = edge.id.replace(/^splice-(?:left|right)-/, "");
    if (excludeConnectionId && connId === excludeConnectionId) continue;
    const data = edge.data as { routingMidX?: number; jogX?: number };
    if (data.routingMidX !== undefined) {
      xs.push(Number(data.routingMidX));
    }
    if (data.jogX !== undefined) {
      xs.push(Number(data.jogX));
    }
  }
  return [...new Set(xs)].sort((a, b) => a - b);
}
