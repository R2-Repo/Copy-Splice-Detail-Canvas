import { formattedCircuitTagWidth } from "@/features/diagram/cableLabels";
import type { SideCircuitLabelSpan } from "@/features/diagram/cableLabels";
import type { VisualCable } from "@/features/diagram/visualCables";

import {
  fiberHandlePosition,
  parseButtTubeEndpointsFromEdgeId,
  parseTubeHandleId,
  tubeHandlePosition,
} from "@/features/canvas/edges/splicePathGeometry";

export type SpliceHandleEntry = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  fallbackLane: number;
  rowOffset?: number;
  tubeBundleKey?: string;
  sourceTubeDotGroupKey?: string;
  fullButtSplice?: boolean;
  sideCircuitSpan?: SideCircuitLabelSpan;
  sourceTagWidth?: number;
  targetTagWidth?: number;
};

export function buildSpliceHandleEntries(
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: unknown;
  }>,
  edges: Array<{
    id: string;
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
    type?: string | null;
    data?: unknown;
  }>,
  visualCables: VisualCable[],
  options?: { cableNodeId?: string },
): SpliceHandleEntry[] {
  const vcByNodeId = new Map<string, VisualCable>(
    visualCables.map((vc) => [`cable-${vc.id}`, vc]),
  );
  const entries: SpliceHandleEntry[] = [];

  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    if (
      options?.cableNodeId &&
      edge.source !== options.cableNodeId &&
      edge.target !== options.cableNodeId
    ) {
      continue;
    }

    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    const sourceVc = edge.source ? vcByNodeId.get(edge.source) : undefined;
    const targetVc = edge.target ? vcByNodeId.get(edge.target) : undefined;
    if (!sourceNode || !targetNode || !sourceVc || !targetVc) continue;

    const edgeData = (edge.data ?? {}) as {
      rowOffset?: number;
      tubeBundleKey?: string;
      sourceTubeDotGroupKey?: string;
      fullButtSplice?: boolean;
      laneIndex?: number;
      sideCircuitSpan?: SideCircuitLabelSpan;
      circuitName?: string;
    };
    const isButtEdge =
      edgeData.fullButtSplice === true || edge.id.startsWith("butt-");
    const connectionId = edge.id.replace(/^splice-/, "").replace(/^butt-/, "");
    const sourceFiber = sourceVc.tubes
      .flatMap((t) => t.fibers)
      .find((f) => f.connectionId === connectionId);
    const targetFiber = targetVc.tubes
      .flatMap((t) => t.fibers)
      .find((f) => f.connectionId === connectionId);
    const sourceScale =
      (sourceNode.data as { diagramScale?: number }).diagramScale ?? 1;
    const targetScale =
      (targetNode.data as { diagramScale?: number }).diagramScale ?? 1;
    const sourceAligned = (sourceNode.data as { alignedStemX?: number })
      .alignedStemX;
    const targetAligned = (targetNode.data as { alignedStemX?: number })
      .alignedStemX;

    let sourcePos: { x: number; y: number };
    let targetPos: { x: number; y: number };
    let sourceTagWidth = 0;
    let targetTagWidth = 0;

    if (isButtEdge) {
      const sourceTube =
        parseTubeHandleId(edge.sourceHandle) ??
        parseButtTubeEndpointsFromEdgeId(edge.id)?.endpointA;
      const targetTube =
        parseTubeHandleId(edge.targetHandle) ??
        parseButtTubeEndpointsFromEdgeId(edge.id)?.endpointB;
      if (!sourceTube || !targetTube) continue;
      sourcePos = tubeHandlePosition(
        sourceVc,
        sourceTube.tubeColor,
        sourceNode.position,
        sourceScale,
        sourceAligned,
      );
      targetPos = tubeHandlePosition(
        targetVc,
        targetTube.tubeColor,
        targetNode.position,
        targetScale,
        targetAligned,
      );
    } else {
      sourcePos = fiberHandlePosition(
        sourceVc,
        connectionId,
        sourceNode.position,
        sourceScale,
        sourceAligned,
        sourceFiber?.circuitName ?? edgeData.circuitName,
      );
      targetPos = fiberHandlePosition(
        targetVc,
        connectionId,
        targetNode.position,
        targetScale,
        targetAligned,
        targetFiber?.circuitName ?? edgeData.circuitName,
      );
      sourceTagWidth = formattedCircuitTagWidth(
        sourceFiber?.circuitName ?? edgeData.circuitName,
      );
      targetTagWidth = formattedCircuitTagWidth(
        targetFiber?.circuitName ?? edgeData.circuitName,
      );
    }

    entries.push({
      id: edge.id,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceX: sourcePos.x,
      sourceY: sourcePos.y,
      targetX: targetPos.x,
      targetY: targetPos.y,
      fallbackLane: edgeData.laneIndex ?? 0,
      rowOffset: edgeData.rowOffset,
      tubeBundleKey: edgeData.tubeBundleKey,
      sourceTubeDotGroupKey: edgeData.sourceTubeDotGroupKey,
      fullButtSplice: isButtEdge,
      sideCircuitSpan: edgeData.sideCircuitSpan,
      sourceTagWidth,
      targetTagWidth,
    });
  }

  return entries;
}
