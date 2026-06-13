import type { Edge, Node } from "@xyflow/react";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import {
  applyButtCenterVerticalDelta,
  buttLegPathsWithinBendBudget,
  isButtEdgeId,
} from "./buttLegAdjust";
import {
  buildHandleCoordsCache,
  handleCoordsForButtEdge,
  handleCoordsForConnection,
} from "./handleCoords";
import { validateLegPaths } from "./constraints";
import {
  applySegmentDelta,
  reconnectEditedLegPaths,
  legSegmentsFromPaths,
  routeTemplateForHandles,
  segmentsToPath,
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
  const template = routeTemplateForHandles(sourceX, sourceY, targetX, targetY);
  const preserveSplice =
    !isButt &&
    Number.isFinite(Number(data.spliceX)) &&
    Number.isFinite(Number(data.spliceY))
      ? { x: Number(data.spliceX), y: Number(data.spliceY) }
      : undefined;
  let { left, right } = legSegmentsFromPaths(leftPath, rightPath);

  left = applyStoredSegmentOverrides(
    left,
    legOverrides.leftSegments,
    template,
    "left",
    preserveSplice,
    isButt,
  );
  right = applyStoredSegmentOverrides(
    right,
    legOverrides.rightSegments,
    template,
    "right",
    preserveSplice,
    isButt,
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
      handles: { source: { x: sourceX, y: sourceY }, target: { x: targetX, y: targetY } },
      preserveSplice,
    },
  );
  const splicePoint = {
    x: connected.spliceX,
    y: connected.spliceY,
  };

  if (isButt) {
    if (!buttLegPathsWithinBendBudget(connected.leftPath, connected.rightPath)) {
      return null;
    }
    return {
      ...edge,
      data: {
        ...data,
        leftPath: connected.leftPath,
        rightPath: connected.rightPath,
        spliceX: splicePoint.x,
        spliceY: splicePoint.y,
        routingMidX: splicePoint.x,
        routingPrecomputed: true,
      },
    };
  }

  if (
    validateLegPaths(
      connected.leftPath,
      connected.rightPath,
      splicePoint.x,
      splicePoint.y,
    ) !== null
  ) {
    return null;
  }

  return {
    ...edge,
    data: {
      ...data,
      leftPath: connected.leftPath,
      rightPath: connected.rightPath,
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

/**
 * Manual cable drag re-routes legs with the auto router, dropping the user's
 * saved per-segment shape. This restores that shape — but ONLY for the
 * connections the drag actually rebuilt, so already-overridden edges elsewhere
 * are never shifted twice. Non-butt edges keep their fusion dot via
 * `preserveSplice`, so splice-point nodes stay valid without a re-sync.
 */
export function applyLegOverridesForConnections(
  edges: Edge[],
  legOverrides: LayoutOverrides["legOverrides"] | undefined,
  nodes: Node[],
  graph: ConnectionGraph,
  connectionIds: Iterable<string>,
): Edge[] {
  if (!legOverrides) return edges;
  const ids = new Set(connectionIds);
  if (ids.size === 0) return edges;
  const cache = buildHandleCoordsCache(nodes, graph);
  return edges.map((edge) => {
    const isButt = isButtEdgeId(edge.id);
    const connId = isButt
      ? edge.id
      : edge.id.replace(/^splice-(?:left|right)-/, "");
    if (!ids.has(connId)) return edge;
    const override = legOverrides[connId];
    if (!override) return edge;
    const handles = isButt
      ? handleCoordsForButtEdge(edge.id, nodes, edges, graph, cache)
      : handleCoordsForConnection(connId, nodes, graph, cache);
    const updated = applyLegOverridesToEdge(
      edge,
      override,
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
