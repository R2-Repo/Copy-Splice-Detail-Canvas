import type { Edge, Node } from "@xyflow/react";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import { handleCoordsForConnection } from "./handleCoords";

import {
  fusionDotCornerClearanceOk,
  fusionDotOnHorizontalSegment,
  pathsWithinBendBudget,
} from "./constraints";
import {
  applySegmentDelta,
  connectLegPathsAtSplice,
  legSegmentsFromPaths,
  routeTemplateForHandles,
  segmentsToPath,
  setPathEnd,
  setPathStart,
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

  const spliceStart = parseOrthogonalPathPoints(rightPath)[0] ?? {
    x: Number(data.spliceX ?? sourceX),
    y: Number(data.spliceY ?? sourceY),
  };

  let nextLeft = segmentsToPath(left, { x: sourceX, y: sourceY });
  let nextRight = segmentsToPath(right, spliceStart);
  nextLeft = setPathStart(nextLeft, { x: sourceX, y: sourceY });
  nextRight = setPathEnd(nextRight, { x: targetX, y: targetY });
  const connected = connectLegPathsAtSplice(nextLeft, nextRight, "left");
  nextLeft = connected.leftPath;
  nextRight = connected.rightPath;
  const splicePoint = {
    x: connected.spliceX,
    y: connected.spliceY,
  };

  if (!pathsWithinBendBudget(nextLeft, nextRight)) return null;
  if (
    !fusionDotOnHorizontalSegment(
      splicePoint.x,
      splicePoint.y,
      nextLeft,
      nextRight,
    )
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
  nodes?: Node[],
  graph?: ConnectionGraph,
): Edge[] {
  const legMap = overrides?.legOverrides;
  if (!legMap) return edges;
  return edges.map((edge) => {
    const connId = edge.id.replace(/^splice-(?:left|right)-/, "");
    if (!legMap[connId]) return edge;
    const handles =
      nodes != null && graph != null
        ? handleCoordsForConnection(connId, nodes, graph)
        : null;
    const updated = applyLegOverridesToEdge(
      edge,
      legMap[connId],
      handles?.source.x ?? 0,
      handles?.source.y ?? 0,
      handles?.target.x ?? 0,
      handles?.target.y ?? 0,
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
