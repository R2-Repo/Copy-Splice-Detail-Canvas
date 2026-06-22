import type { Edge } from "@xyflow/react";

import { buildSpliceHandleEntries } from "@/features/canvas/edges/spliceHandleEntries";
import { defaultSideCircuitLabelSpan } from "@/features/canvas/edges/splicePathGeometry";
import { reconcileBufferTubeDotColumns } from "@/features/canvas/edges/spliceEdgeRouting";
import { attachPrecomputedPaths } from "@/features/diagram/computeSpliceLayout";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import {
  assignSpliceRoutingLanes,
  handleEntriesToCandidates,
  handleEntriesWithLiveRowOffsets,
} from "@/features/diagram/spliceCenterLanes";
import { logLaneAssignmentDiff } from "@/features/diagram/debugLaneDiff";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { LayoutMode, LayoutOverrides } from "@/types/splice";

import { assignGridLanes, gridRouteFromPaths } from "./gridLaneAssign";
import { cachedLanesFromEdges, priorRoutesFromEdges } from "./gridDragCache";
import { buildGridMap } from "./gridMap";
import { reserveRouteSegments } from "./reservation";
import { applyRoutingParameterOverrides } from "@/features/manualAdjust/connectionOverrides";
import type { GridAnchorRef, GridMap, GridRoute } from "./gridTypes";

export type GridRouterInput = {
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: unknown;
  }>;
  edges: Edge[];
  visualCables: VisualCable[];
  diagramCenterX: number;
  layoutWidth: number;
  layoutHeight?: number;
  layoutMode?: LayoutMode;
  lockedSegmentIds?: string[];
  overrides?: Pick<
    LayoutOverrides,
    | "gridLocks"
    | "connectionOverrides"
    | "bundleOverrides"
    | "legOverrides"
    | "autoAdjustEnabled"
  >;
  /** Incremental cable drag — reroute only these connection ids. */
  rerouteConnectionIds?: string[];
  /** Live edge lanes/routes from pre-drag state (drag perf). */
  dragCacheEdges?: Edge[];
  priorGridRoutes?: Map<string, GridRoute>;
  /** Live cable drag — refresh non-bundle rowOffset from handle Y before routing. */
  useLiveHandleLanes?: boolean;
};

export type GridRouterResult = {
  edges: Edge[];
  grid: GridMap;
  routes: Map<string, GridRoute>;
  lanes: Map<string, SpliceRoutingLane>;
  /** Pre-snap packed lanes (assignSpliceRoutingLanes) for nesting rule checks. */
  packedLanes: Map<string, SpliceRoutingLane>;
};

function anchorsFromEntries(
  entries: ReturnType<typeof buildSpliceHandleEntries>,
): GridAnchorRef[] {
  const anchors: GridAnchorRef[] = [];
  for (const e of entries) {
    anchors.push({ x: e.sourceX, y: e.sourceY, side: e.sourceX < e.targetX ? "left" : "right" });
    anchors.push({ x: e.targetX, y: e.targetY, side: e.targetX > e.sourceX ? "right" : "left" });
  }
  return anchors;
}

function connectionIdFromEdge(edge: Edge): string | undefined {
  if (edge.id.startsWith("splice-")) {
    return edge.id.replace(/^splice-(?:left-|right-)?/, "");
  }
  return undefined;
}

function packedBaselineLanes(
  entries: ReturnType<typeof buildSpliceHandleEntries>,
): Map<string, SpliceRoutingLane> {
  if (!entries.length) return new Map();
  const sideSpans =
    entries.find((entry) => entry.sideCircuitSpan)?.sideCircuitSpan ??
    defaultSideCircuitLabelSpan();
  return assignSpliceRoutingLanes(handleEntriesToCandidates(entries), sideSpans);
}

function lanesByConnectionId(
  lanes: Map<string, SpliceRoutingLane>,
): Map<string, SpliceRoutingLane> {
  const byConn = new Map<string, SpliceRoutingLane>();
  for (const [edgeId, lane] of lanes) {
    const connId = edgeId
      .replace(/^splice-left-/, "")
      .replace(/^splice-right-/, "")
      .replace(/^splice-/, "")
      .replace(/^butt-/, "");
    byConn.set(connId, lane);
  }
  return byConn;
}

/** Route all splices on the internal grid with segment reservation (SDC-GRID-001). */
export function routeAllOnGrid(input: GridRouterInput): GridRouterResult {
  const layoutMode = input.layoutMode === "quad" ? "quad" : "horizontal";
  let handleEntries = buildSpliceHandleEntries(
    input.nodes,
    input.edges,
    input.visualCables,
  );
  if (input.useLiveHandleLanes) {
    const beforeBaseline = packedBaselineLanes(handleEntries);
    handleEntries = handleEntriesWithLiveRowOffsets(handleEntries);
    const liveBaseline = packedBaselineLanes(handleEntries);
    logLaneAssignmentDiff(
      "live-handle rowOffset",
      beforeBaseline,
      liveBaseline,
    );
  }

  const baseline = packedBaselineLanes(handleEntries);
  const anchors = anchorsFromEntries(handleEntries);
  const grid = buildGridMap({
    anchors,
    bounds: {
      width: input.layoutWidth,
      height: input.layoutHeight ?? 800,
    },
    layoutMode,
    lockedSegmentIds: input.lockedSegmentIds,
    extraVerticalXs: [...baseline.values()].map((lane) => lane.midX),
  });

  const { lanes, routes: reservedRoutes } = assignGridLanes(
    handleEntries,
    grid,
    input.diagramCenterX,
    input.overrides,
    baseline,
    input.rerouteConnectionIds?.length
      ? {
          rerouteConnectionIds: new Set(input.rerouteConnectionIds),
          cachedLanesByEdgeId: input.dragCacheEdges
            ? cachedLanesFromEdges(input.dragCacheEdges)
            : undefined,
          priorRoutes: input.priorGridRoutes
            ? priorRoutesFromEdges(
                input.dragCacheEdges ?? input.edges,
                input.priorGridRoutes,
              )
            : undefined,
        }
      : undefined,
  );

  const adjustedLanes = applyRoutingParameterOverrides(
    lanes,
    handleEntries,
    input.overrides,
  );

  const tubeDotColumns = reconcileBufferTubeDotColumns(
    handleEntries,
    adjustedLanes,
    input.diagramCenterX,
  );

  const routedEdges = attachPrecomputedPaths(
    input.edges,
    handleEntries,
    adjustedLanes,
    input.diagramCenterX,
    tubeDotColumns,
  );

  const routes = new Map<string, GridRoute>(reservedRoutes);

  for (const edge of routedEdges) {
    if (edge.type !== "splice") continue;
    const connId = connectionIdFromEdge(edge);
    if (!connId) continue;
    const data = edge.data as Record<string, unknown> | undefined;
    const leftPath = data?.leftPath as string | undefined;
    const rightPath = data?.rightPath as string | undefined;
    const spliceX = data?.spliceX as number | undefined;
    const spliceY = data?.spliceY as number | undefined;
    if (!leftPath || !rightPath || spliceX == null || spliceY == null) continue;

    const route = gridRouteFromPaths(
      grid,
      connId,
      leftPath,
      rightPath,
      spliceX,
      spliceY,
    );

    const prior = routes.get(connId);
    if (prior) {
      for (const segId of prior.segmentIds) {
        const seg = grid.segments.get(segId);
        if (seg?.connectionId === connId) {
          seg.status = "available";
          seg.connectionId = undefined;
        }
      }
    }

    reserveRouteSegments(grid, route);
    routes.set(connId, route);
  }

  return {
    edges: routedEdges,
    grid,
    routes,
    lanes: adjustedLanes,
    packedLanes: lanesByConnectionId(baseline),
  };
}

/** Re-route only affected connections after a drag (incremental). */
export function rerouteLocalOnGrid(
  input: GridRouterInput,
  connectionIds: string[],
): GridRouterResult {
  if (!connectionIds.length) return routeAllOnGrid(input);
  return routeAllOnGrid({
    ...input,
    rerouteConnectionIds: connectionIds,
    dragCacheEdges: input.dragCacheEdges ?? input.edges,
    priorGridRoutes: input.priorGridRoutes,
  });
}
