import type { Edge } from "@xyflow/react";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { LayoutOverrides } from "@/types/splice";

import {
  fusionDotCornerClearanceOk,
  fusionDotOnHorizontalSegment,
  pathsWithinBendBudget,
} from "./constraints";
import {
  applySegmentDelta,
  legSegmentsFromPaths,
  routeTemplateForHandles,
  segmentsToPath,
  type LegSegment,
  type SegmentDragAxis,
} from "./legSegments";
import type { ConnectionLegOverrides, LegSide } from "./types";

export function mergeFanoutOverridesIntoTubes(
  visualCables: VisualCable[],
  overrides?: LayoutOverrides,
): void {
  const fanout = overrides?.fanoutOverrides;
  if (!fanout) return;
  for (const vc of visualCables) {
    for (const tube of vc.tubes) {
      const key = `${vc.id}|${tube.tubeColor}` as const;
      const entry = fanout[key];
      if (entry?.shiftY !== undefined) {
        tube.visualShiftY = entry.shiftY;
      }
    }
  }
}

export function applyLegOverridesToEdge(
  edge: Edge,
  legOverrides: ConnectionLegOverrides | undefined,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): Edge | null {
  if (!legOverrides || edge.type !== "splice") return edge;
  const data = edge.data as Record<string, unknown>;
  const leftPath = String(data.leftPath ?? "");
  const rightPath = String(data.rightPath ?? "");
  if (!leftPath || !rightPath) return edge;

  const template = routeTemplateForHandles(sourceX, sourceY, targetX, targetY);
  let { left, right } = legSegmentsFromPaths(leftPath, rightPath);

  left = applyStoredSegmentOverrides(left, legOverrides.leftSegments, template, "left");
  right = applyStoredSegmentOverrides(
    right,
    legOverrides.rightSegments,
    template,
    "right",
  );

  const leftStart = parseOrthogonalPathPoints(leftPath)[0] ?? {
    x: sourceX,
    y: sourceY,
  };
  const rightStart = parseOrthogonalPathPoints(rightPath)[0] ?? {
    x: Number(data.spliceX ?? sourceX),
    y: Number(data.spliceY ?? sourceY),
  };

  const nextLeft = segmentsToPath(left, leftStart);
  const nextRight = segmentsToPath(right, rightStart);
  const splicePoint =
    parseOrthogonalPathPoints(nextRight)[0] ??
    parseOrthogonalPathPoints(nextLeft).at(-1) ?? rightStart;

  if (!pathsWithinBendBudget(nextLeft, nextRight)) return null;
  if (
    !fusionDotOnHorizontalSegment(splicePoint.x, splicePoint.y, nextLeft, nextRight)
  ) {
    return null;
  }
  if (
    !fusionDotCornerClearanceOk(
      splicePoint.x,
      splicePoint.y,
      nextLeft,
      nextRight,
    )
  ) {
    return null;
  }

  return {
    ...edge,
    data: {
      ...data,
      leftPath: nextLeft,
      rightPath: nextRight,
      spliceX: splicePoint.x,
      spliceY: splicePoint.y,
    },
  };
}

function applyStoredSegmentOverrides(
  segments: LegSegment[],
  overrides: Record<number, { dx?: number; dy?: number }> | undefined,
  template: ReturnType<typeof routeTemplateForHandles>,
  side: LegSide,
): LegSegment[] {
  if (!overrides) return segments;
  let next = segments;
  for (const [indexRaw, patch] of Object.entries(overrides)) {
    const index = Number(indexRaw);
    if (patch.dx) {
      next = applySegmentDelta(next, index, "horizontal", patch.dx, template, side);
    }
    if (patch.dy) {
      next = applySegmentDelta(next, index, "vertical", patch.dy, template, side);
    }
  }
  return next;
}

export function applyAllLegOverrides(
  edges: Edge[],
  overrides: LayoutOverrides | undefined,
): Edge[] {
  const legMap = overrides?.legOverrides;
  if (!legMap) return edges;
  return edges.map((edge) => {
    const connId = edge.id.replace(/^splice-(?:left|right)-/, "");
    if (!legMap[connId]) return edge;
    const leftEdge = edges.find((e) => e.id === `splice-left-${connId}`);
    const data = (leftEdge?.data ?? {}) as {
      sourceX?: number;
      sourceY?: number;
      targetX?: number;
      targetY?: number;
    };
    const updated = applyLegOverridesToEdge(
      edge,
      legMap[connId],
      Number(data.sourceX ?? 0),
      Number(data.sourceY ?? 0),
      Number(data.targetX ?? 0),
      Number(data.targetY ?? 0),
    );
    return updated ?? edge;
  });
}

export function accumulateLegOverride(
  existing: ConnectionLegOverrides | undefined,
  side: LegSide,
  segmentIndex: number,
  axis: SegmentDragAxis,
  delta: number,
): ConnectionLegOverrides {
  const key = side === "left" ? "leftSegments" : "rightSegments";
  const segments = { ...(existing?.[key] ?? {}) };
  const prev = segments[segmentIndex] ?? {};
  segments[segmentIndex] = {
    ...prev,
    ...(axis === "horizontal"
      ? { dx: (prev.dx ?? 0) + delta }
      : { dy: (prev.dy ?? 0) + delta }),
  };
  return { ...existing, [key]: segments };
}
