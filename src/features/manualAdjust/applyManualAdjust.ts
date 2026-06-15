import type { Edge, Node } from "@xyflow/react";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import {
  applyButtCenterVerticalDelta,
  isButtEdgeId,
} from "./buttLegAdjust";
import {
  handleCoordsForButtEdge,
  handleCoordsForConnection,
} from "./handleCoords";
import {
  applySegmentDelta,
  reconnectEditedLegPaths,
  legSegmentsFromPaths,
  pathEndPoint,
  repinLegEnd,
  repinLegStart,
  routeTemplateForHandles,
  segmentsToPath,
  shiftVerticalLaneX,
  type LegSegment,
  type SegmentDragAxis,
} from "./legSegments";
import type { ConnectionLegOverrides, LegSide } from "./types";

function primaryEditedSide(legOverrides: ConnectionLegOverrides): LegSide {
  const hasLeft =
    legOverrides.leftSegments != null &&
    Object.keys(legOverrides.leftSegments).length > 0;
  const hasRight =
    legOverrides.rightSegments != null &&
    Object.keys(legOverrides.rightSegments).length > 0;
  if (hasRight && !hasLeft) return "right";
  return "left";
}

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

  const isButt =
    data.fullButtSplice === true || isButtEdgeId(String(edge.id ?? ""));

  if (isButt) {
    // Butt (tube-to-tube) keeps the segment-based reshape + reconnect.
    const template = routeTemplateForHandles(sourceX, sourceY, targetX, targetY);
    let { left, right } = legSegmentsFromPaths(leftPath, rightPath);
    left = applyStoredSegmentOverrides(
      left,
      legOverrides.leftSegments,
      template,
      "left",
      undefined,
      true,
    );
    right = applyStoredSegmentOverrides(
      right,
      legOverrides.rightSegments,
      template,
      "right",
      undefined,
      true,
    );
    const spliceStart = parseOrthogonalPathPoints(rightPath)[0] ?? {
      x: Number(data.spliceX ?? sourceX),
      y: Number(data.spliceY ?? sourceY),
    };
    const nextLeft = segmentsToPath(left, { x: sourceX, y: sourceY });
    const nextRight = segmentsToPath(right, spliceStart);
    const connected = reconnectEditedLegPaths(
      nextLeft,
      nextRight,
      primaryEditedSide(legOverrides),
      {
        handles: {
          source: { x: sourceX, y: sourceY },
          target: { x: targetX, y: targetY },
        },
      },
    );
    let buttLeft = connected.leftPath;
    let buttRight = connected.rightPath;
    let buttSpliceX = connected.spliceX;
    const buttSpliceY = connected.spliceY;
    const buttDotShiftX = legOverrides.dotShiftX ?? 0;
    if (buttDotShiftX) {
      // Slide the collapsed-tube butt square horizontally (re-pin both legs
      // around the new square position — same as a fusion dot slide).
      const dot = { x: buttSpliceX + buttDotShiftX, y: buttSpliceY };
      buttLeft = repinLegEnd(buttLeft, dot);
      buttRight = repinLegStart(buttRight, dot);
      buttSpliceX = dot.x;
    }
    return {
      ...edge,
      data: {
        ...data,
        leftPath: buttLeft,
        rightPath: buttRight,
        spliceX: buttSpliceX,
        spliceY: buttSpliceY,
        routingMidX: buttSpliceX,
        routingPrecomputed: true,
      },
    };
  }

  // NON-BUTT fiber legs: clean point-based lane shifts (move only the dragged
  // vertical's bend points) — direction preserved, splice preserved, and the
  // lossy segment round-trip is avoided so a drag never adds an extra bend.
  let finalLeftPath = applyLaneShiftsToPath(leftPath, legOverrides.leftSegments);
  let finalRightPath = applyLaneShiftsToPath(rightPath, legOverrides.rightSegments);
  const splice = pathEndPoint(finalLeftPath);
  let dotX = splice.x;
  const dotShiftX = legOverrides.dotShiftX ?? 0;
  if (dotShiftX) {
    // Fusion-dot slide (= leg color-transition point) along its leg.
    dotX = splice.x + dotShiftX;
    const dot = { x: dotX, y: splice.y };
    finalLeftPath = repinLegEnd(finalLeftPath, dot);
    finalRightPath = repinLegStart(finalRightPath, dot);
  }

  // Manual mode is fully manual: apply even if it trips a readability rule
  // (EDGE-004 / DOT-*) — the drag-time banner already flagged it.
  return {
    ...edge,
    data: {
      ...data,
      leftPath: finalLeftPath,
      rightPath: finalRightPath,
      spliceX: dotX,
      spliceY: splice.y,
    },
  };
}

/** Apply each stored vertical-lane dx to a leg path (point-based, no bend added). */
function applyLaneShiftsToPath(
  path: string,
  segments: Record<number, { dx?: number; dy?: number }> | undefined,
): string {
  if (!segments) return path;
  let next = path;
  for (const [indexRaw, patch] of Object.entries(segments)) {
    if (patch.dx) next = shiftVerticalLaneX(next, Number(indexRaw), patch.dx);
  }
  return next;
}

function applyStoredSegmentOverrides(
  segments: LegSegment[],
  overrides: Record<number, { dx?: number; dy?: number }> | undefined,
  template: ReturnType<typeof routeTemplateForHandles>,
  side: LegSide,
  splice?: { x: number; y: number },
  isButt = false,
): LegSegment[] {
  if (!overrides) return segments;
  let next = segments;
  for (const [indexRaw, patch] of Object.entries(overrides)) {
    const index = Number(indexRaw);
    if (patch.dx) {
      next = isButt
        ? applyButtCenterVerticalDelta(next, index, patch.dx)
        : applySegmentDelta(
            next,
            index,
            "horizontal",
            patch.dx,
            template,
            side,
            splice,
          );
    }
    if (patch.dy) {
      next = applySegmentDelta(next, index, "vertical", patch.dy, template, side, splice);
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
  if (overrides?.autoAdjustEnabled !== false) return edges;
  const legMap = overrides?.legOverrides;
  if (!legMap) return edges;
  return edges.map((edge) => {
    if (isButtEdgeId(edge.id) && legMap[edge.id]) {
      const handles =
        nodes != null && graph != null
          ? handleCoordsForButtEdge(edge.id, nodes, edges, graph)
          : null;
      const updated = applyLegOverridesToEdge(
        edge,
        legMap[edge.id],
        handles?.source.x ?? 0,
        handles?.source.y ?? 0,
        handles?.target.x ?? 0,
        handles?.target.y ?? 0,
      );
      return updated ?? edge;
    }

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

/** Accumulate a manual fusion-dot horizontal slide (= leg color transition). */
export function accumulateDotShift(
  existing: ConnectionLegOverrides | undefined,
  deltaX: number,
): ConnectionLegOverrides {
  return { ...existing, dotShiftX: (existing?.dotShiftX ?? 0) + deltaX };
}
