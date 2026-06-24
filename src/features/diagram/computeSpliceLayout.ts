import type { Edge } from "@xyflow/react";

import {
  buildButtSplicePath,
  buildSplicePath,
  buildSpliceHandleEntries,
  defaultSideCircuitLabelSpan,
  reconcileBufferTubeDotColumns,
  routingLaneDataFromLane,
} from "@/features/canvas/edges/spliceEdgeRouting";
import {
  routeCenterSplices,
  type SpliceHandleEntry,
  type SpliceRoutingLane,
} from "@/features/diagram/centerRouter";
import { routeAllOnGrid, rerouteLocalOnGrid } from "@/features/grid/gridRouter";
import { useGridRoutingEngine } from "@/features/diagram/routingEngine";
import { applyRoutingParameterOverrides } from "@/features/manualAdjust/connectionOverrides";
import { assignSpliceRoutingLanesFromLiveHandles } from "@/features/diagram/spliceCenterLanes";
import { logLaneAssignmentDiff } from "@/features/diagram/debugLaneDiff";
import type { LayoutMode, LayoutOverrides } from "@/types/splice";
import type { LayoutEndpointSync } from "@/features/diagram/spliceCenterLanes";
import {
  connectionIdFromHandleEntryId,
  layoutRuleHandleEndpointsForConnection,
} from "@/features/canvas/edges/spliceHandleEntries";
import type { VisualCable } from "@/features/diagram/visualCables";

export type PrecomputedSpliceEdgeData = {
  routingPrecomputed: true;
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
  routingMidX: number;
  routingJogX?: number;
  routingSourceHorizY?: number;
  routingTargetHorizY?: number;
  routingSourceBendX?: number;
  routingTargetBendX?: number;
};

export type SpliceLayoutPassResult = {
  handleEntries: SpliceHandleEntry[];
  lanes: Map<string, SpliceRoutingLane>;
  edges: Edge[];
  gridRoutes?: Map<string, import("@/features/grid/gridTypes").GridRoute>;
};

export type ComputeSpliceLayoutOptions = {
  overrides?: Pick<
    LayoutOverrides,
    | "routingEngine"
    | "gridLocks"
    | "layoutMode"
    | "connectionOverrides"
    | "bundleOverrides"
    | "legOverrides"
    | "autoAdjustEnabled"
  >;
  layoutWidth?: number;
  rerouteConnectionIds?: string[];
  dragCacheEdges?: Edge[];
  priorGridRoutes?: Map<string, import("@/features/grid/gridTypes").GridRoute>;
  /** Live cable drag — refresh rowOffset from handle Y (bundle members keep layout rank). */
  useLiveHandleLanes?: boolean;
  layoutEndpointSync?: LayoutEndpointSync;
};

export function computeSpliceEdgeLayout(
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: unknown;
  }>,
  edges: Edge[],
  visualCables: VisualCable[],
  diagramCenterX: number,
  options?: ComputeSpliceLayoutOptions,
): SpliceLayoutPassResult {
  const handleEntries = buildSpliceHandleEntries(nodes, edges, visualCables);

  if (useGridRoutingEngine(options?.overrides)) {
    const gridInput = {
      nodes,
      edges,
      visualCables,
      diagramCenterX,
      layoutWidth: options?.layoutWidth ?? diagramCenterX * 2,
      layoutMode: (options?.overrides?.layoutMode ?? "horizontal") as LayoutMode,
      lockedSegmentIds: options?.overrides?.gridLocks?.segments,
      overrides: options?.overrides,
      rerouteConnectionIds: options?.rerouteConnectionIds,
      dragCacheEdges: options?.dragCacheEdges,
      priorGridRoutes: options?.priorGridRoutes,
      useLiveHandleLanes: options?.useLiveHandleLanes,
      layoutEndpointSync: options?.layoutEndpointSync,
    };
    const gridResult = options?.rerouteConnectionIds?.length
      ? rerouteLocalOnGrid(gridInput, options.rerouteConnectionIds)
      : routeAllOnGrid(gridInput);
    return {
      handleEntries,
      lanes: gridResult.lanes,
      edges: gridResult.edges,
      gridRoutes: gridResult.routes,
    };
  }

  const packedLanes = options?.useLiveHandleLanes
    ? assignSpliceRoutingLanesFromLiveHandles(
        handleEntries,
        diagramCenterX,
      ).lanes
    : routeCenterSplices(handleEntries, diagramCenterX);
  if (options?.useLiveHandleLanes) {
    logLaneAssignmentDiff(
      "nodes live-handle lanes",
      routeCenterSplices(handleEntries, diagramCenterX),
      packedLanes,
    );
  }
  const lanes = applyRoutingParameterOverrides(
    packedLanes,
    handleEntries,
    options?.overrides,
  );
  const tubeDotColumns = reconcileBufferTubeDotColumns(
    handleEntries,
    lanes,
    diagramCenterX,
  );
  const routedEdges = attachPrecomputedPaths(
    edges,
    handleEntries,
    lanes,
    diagramCenterX,
    tubeDotColumns,
  );
  return { handleEntries, lanes, edges: routedEdges };
}

export function attachPrecomputedPaths(
  edges: Edge[],
  entries: SpliceHandleEntry[],
  lanes: Map<string, SpliceRoutingLane>,
  diagramCenterX: number,
  tubeDotColumns: Map<string, number> = new Map(),
  layoutEndpointSync?: LayoutEndpointSync,
): Edge[] {
  const byId = new Map(entries.map((e) => [e.id, e]));

  return edges.map((edge) => {
    if (edge.type !== "splice") return edge;
    const entry = byId.get(edge.id);
    const lane = lanes.get(edge.id);
    if (!entry || !lane) return edge;

    const data = (edge.data ?? {}) as Record<string, unknown>;
    const sideSpans =
      (data.sideCircuitSpan as ReturnType<typeof defaultSideCircuitLabelSpan>) ??
      entry.sideCircuitSpan ??
      defaultSideCircuitLabelSpan();
    const fallbackLane = (data.laneIndex as number | undefined) ?? entry.fallbackLane;
    const laneCount = Math.max(1, (data.laneCount as number | undefined) ?? 1);
    const fullButt = data.fullButtSplice === true || entry.fullButtSplice === true;

    const { midX, jogX, sourceHorizY, targetHorizY, sourceBendX, targetBendX } =
      lane;

    let sourceX = entry.sourceX;
    let sourceY = entry.sourceY;
    let targetX = entry.targetX;
    let targetY = entry.targetY;
    if (layoutEndpointSync) {
      const layoutEp = layoutRuleHandleEndpointsForConnection(
        layoutEndpointSync.graph,
        layoutEndpointSync.visualCables,
        layoutEndpointSync.nodes,
        connectionIdFromHandleEntryId(entry.id),
      );
      if (layoutEp) {
        sourceX = layoutEp.sourceX;
        sourceY = layoutEp.sourceY;
        targetX = layoutEp.targetX;
        targetY = layoutEp.targetY;
      }
    }

    const pathResult = fullButt
      ? buildButtSplicePath(
          sourceX,
          sourceY,
          targetX,
          targetY,
          midX,
          sideSpans,
          diagramCenterX,
          fallbackLane,
          laneCount,
        )
      : buildSplicePath(
          sourceX,
          sourceY,
          targetX,
          targetY,
          midX,
          jogX,
          { sourceHorizY, targetHorizY, sourceBendX, targetBendX },
          sideSpans,
          diagramCenterX,
          entry.sourceTagWidth ?? 0,
          entry.targetTagWidth ?? 0,
          {
            tubeDotColumnX: tubeDotColumns.get(edge.id),
          },
        );

    const precomputed: PrecomputedSpliceEdgeData = {
      routingPrecomputed: true,
      leftPath: pathResult.leftPath,
      rightPath: pathResult.rightPath,
      spliceX: pathResult.spliceX,
      spliceY: pathResult.spliceY,
      ...routingLaneDataFromLane(lane),
    };

    const tubeDotColumnX = tubeDotColumns.get(edge.id);

    return {
      ...edge,
      data: {
        ...data,
        ...precomputed,
        diagramCenterX,
        ...(tubeDotColumnX !== undefined ? { tubeDotColumnX } : {}),
      },
    };
  });
}
