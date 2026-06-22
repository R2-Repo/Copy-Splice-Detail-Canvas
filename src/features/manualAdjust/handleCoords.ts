import type { Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import {
  fiberHandlePosition,
  parseTubeHandleId,
  tubeHandlePosition,
} from "@/features/canvas/edges/splicePathGeometry";
import type { ConnectionGraph } from "@/types/splice";
import {
  buildVisualCablesForLayout,
  endpointOnVisualSide,
  type VisualCable,
} from "@/features/diagram/visualCables";

import { isButtEdgeId } from "./buttLegAdjust";

export function visualCableFromCableNode(
  vc: VisualCable,
  cableData: CableNodeData,
): VisualCable {
  const tubeByColor = new Map(cableData.tubes.map((t) => [t.tubeColor, t]));
  return {
    ...vc,
    // Use the live rendered side (node data). graph.cableSides can be stale
    // relative to a manually-dragged position, so the node side is the truth.
    side: cableData.side ?? vc.side,
    tubes: vc.tubes.map((tube) => {
      const live = tubeByColor.get(tube.tubeColor);
      if (!live) return tube;
      return {
        ...tube,
        visualShiftY: live.visualShiftY ?? tube.visualShiftY,
        stemReachX: live.stemReachX ?? tube.stemReachX,
      };
    }),
  };
}

export type HandleCoordsCache = {
  visualCables: VisualCable[];
  cableById: Map<string, Node>;
};

export function buildHandleCoordsCache(
  nodes: Node[],
  graph: ConnectionGraph,
): HandleCoordsCache {
  return {
    visualCables: buildVisualCablesForLayout(graph).visualCables,
    cableById: new Map(
      nodes.filter((n) => n.type === "cable").map((n) => [n.id, n]),
    ),
  };
}

export function handleCoordsForConnection(
  connectionId: string,
  nodes: Node[],
  graph: ConnectionGraph,
  cache?: HandleCoordsCache,
): {
  source: { x: number; y: number };
  target: { x: number; y: number };
  sourceVisualCableId: string;
  targetVisualCableId: string;
} | null {
  const conn = graph.connections.find((c) => c.id === connectionId);
  if (!conn || !("pair" in conn)) return null;

  const visualCables =
    cache?.visualCables ?? buildVisualCablesForLayout(graph).visualCables;
  const csvLeft = endpointOnVisualSide(conn, graph, visualCables, "left");
  const csvRight = endpointOnVisualSide(conn, graph, visualCables, "right");
  if (!csvLeft || !csvRight) return null;

  const cableNodeFor = (vcId: string) =>
    cache?.cableById.get(`cable-${vcId}`) ??
    nodes.find((n) => n.id === `cable-${vcId}`);

  // The rendered cable side (node.data.side, placement-derived) is the source of
  // truth for where the fiber handles sit. graph.cableSides can be stale after a
  // manual drag (side persisted ≠ dragged position), which would pick the wrong
  // source/target and detach the legs on a mirror. Prefer the live node side.
  const leftNode = cableNodeFor(csvLeft.visualCableId);
  const rightNode = cableNodeFor(csvRight.visualCableId);
  const leftSide =
    (leftNode?.data as CableNodeData | undefined)?.side ?? csvLeft.canvasSide;
  const rightSide =
    (rightNode?.data as CableNodeData | undefined)?.side ?? csvRight.canvasSide;

  let source = csvLeft;
  let target = csvRight;
  let sourceCable = leftNode;
  let targetCable = rightNode;
  if (leftSide === "right" && rightSide === "left") {
    source = csvRight;
    target = csvLeft;
    sourceCable = rightNode;
    targetCable = leftNode;
  }
  if (!sourceCable || !targetCable) return null;

  const sourceVcRaw = visualCables.find((vc) => vc.id === source.visualCableId);
  const targetVcRaw = visualCables.find((vc) => vc.id === target.visualCableId);
  if (!sourceVcRaw || !targetVcRaw) return null;

  const sourceData = sourceCable.data as CableNodeData;
  const targetData = targetCable.data as CableNodeData;
  const sourceVc = visualCableFromCableNode(sourceVcRaw, sourceData);
  const targetVc = visualCableFromCableNode(targetVcRaw, targetData);

  return {
    source: fiberHandlePosition(
      sourceVc,
      connectionId,
      sourceCable.position,
      sourceData.diagramScale ?? 1,
      sourceData.alignedStemX,
    ),
    target: fiberHandlePosition(
      targetVc,
      connectionId,
      targetCable.position,
      targetData.diagramScale ?? 1,
      targetData.alignedStemX,
    ),
    sourceVisualCableId: source.visualCableId,
    targetVisualCableId: target.visualCableId,
  };
}

/** Canonical fiber-anchor center for manual hit-testing and marquee selection. */
export function fiberAnchorCenter(
  connectionId: string,
  _visualCableId: string,
  vc: VisualCable,
  cableNode: Node,
): { x: number; y: number } {
  const cableData = cableNode.data as CableNodeData;
  const liveVc = visualCableFromCableNode(vc, cableData);
  return fiberHandlePosition(
    liveVc,
    connectionId,
    cableNode.position,
    cableData.diagramScale ?? 1,
    cableData.alignedStemX,
  );
}

/** Top-left React Flow position for a fiber anchor node (matches buildNodesEngineGraph). */
export function fiberAnchorNodePosition(
  connectionId: string,
  vc: VisualCable,
  cableNode: Node,
  anchorDotSize = 6,
): { x: number; y: number } {
  const center = fiberAnchorCenter(connectionId, vc.id, vc, cableNode);
  return {
    x: center.x - anchorDotSize / 2,
    y: center.y - anchorDotSize / 2,
  };
}

/** Handle centers for a collapsed full-butt-splice edge. */
export function handleCoordsForButtEdge(
  buttEdgeId: string,
  nodes: Node[],
  edges: Array<{
    id: string;
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }>,
  graph: ConnectionGraph,
  cache?: HandleCoordsCache,
): {
  source: { x: number; y: number };
  target: { x: number; y: number };
} | null {
  if (!isButtEdgeId(buttEdgeId)) return null;
  const edge = edges.find((e) => e.id === buttEdgeId);
  if (!edge) return null;
  return handleCoordsForButtEdgeFromNodes(nodes, graph, cache, edge);
}

export function handleCoordsForButtEdgeFromNodes(
  nodes: Node[],
  graph: ConnectionGraph,
  cache: HandleCoordsCache | undefined,
  edge: {
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): {
  source: { x: number; y: number };
  target: { x: number; y: number };
} | null {
  const visualCables =
    cache?.visualCables ?? buildVisualCablesForLayout(graph).visualCables;
  const cableById =
    cache?.cableById ??
    new Map(nodes.filter((n) => n.type === "cable").map((n) => [n.id, n]));

  const sourceNodeId = edge.source;
  const targetNodeId = edge.target;
  if (!sourceNodeId || !targetNodeId) return null;

  const sourceNode =
    cableById.get(String(sourceNodeId)) ??
    nodes.find((n) => n.id === sourceNodeId);
  const targetNode =
    cableById.get(String(targetNodeId)) ??
    nodes.find((n) => n.id === targetNodeId);
  if (!sourceNode || !targetNode) return null;

  const sourceVcId = String(sourceNodeId).replace(/^cable-/, "");
  const targetVcId = String(targetNodeId).replace(/^cable-/, "");
  const sourceVcRaw = visualCables.find((vc) => vc.id === sourceVcId);
  const targetVcRaw = visualCables.find((vc) => vc.id === targetVcId);
  if (!sourceVcRaw || !targetVcRaw) return null;

  const sourceTube = parseTubeHandleId(edge.sourceHandle);
  const targetTube = parseTubeHandleId(edge.targetHandle);
  if (!sourceTube || !targetTube) return null;

  const sourceData = sourceNode.data as CableNodeData;
  const targetData = targetNode.data as CableNodeData;
  const sourceVc = visualCableFromCableNode(sourceVcRaw, sourceData);
  const targetVc = visualCableFromCableNode(targetVcRaw, targetData);

  return {
    source: tubeHandlePosition(
      sourceVc,
      sourceTube.tubeColor,
      sourceNode.position,
      sourceData.diagramScale ?? 1,
      sourceData.alignedStemX,
    ),
    target: tubeHandlePosition(
      targetVc,
      targetTube.tubeColor,
      targetNode.position,
      targetData.diagramScale ?? 1,
      targetData.alignedStemX,
    ),
  };
}
