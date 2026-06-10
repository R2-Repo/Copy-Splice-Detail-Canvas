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
): SpliceLayoutPassResult {
  const handleEntries = buildSpliceHandleEntries(nodes, edges, visualCables);
  const lanes = routeCenterSplices(handleEntries, diagramCenterX);
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

    const pathResult = fullButt
      ? buildButtSplicePath(
          entry.sourceX,
          entry.sourceY,
          entry.targetX,
          entry.targetY,
          midX,
          sideSpans,
          diagramCenterX,
          fallbackLane,
          laneCount,
        )
      : buildSplicePath(
          entry.sourceX,
          entry.sourceY,
          entry.targetX,
          entry.targetY,
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
