import type { Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import { fiberHandlePosition } from "@/features/canvas/edges/splicePathGeometry";
import type { ConnectionGraph } from "@/types/splice";
import {
  buildVisualCablesForLayout,
  endpointOnVisualSide,
  type VisualCable,
} from "@/features/diagram/visualCables";

function visualCableFromCableNode(
  vc: VisualCable,
  cableData: CableNodeData,
): VisualCable {
  const tubeByColor = new Map(cableData.tubes.map((t) => [t.tubeColor, t]));
  return {
    ...vc,
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
} | null {
  const conn = graph.connections.find((c) => c.id === connectionId);
  if (!conn || !("pair" in conn)) return null;

  const visualCables =
    cache?.visualCables ?? buildVisualCablesForLayout(graph).visualCables;
  const csvLeft = endpointOnVisualSide(conn, graph, visualCables, "left");
  const csvRight = endpointOnVisualSide(conn, graph, visualCables, "right");
  if (!csvLeft || !csvRight) return null;

  let source = csvLeft;
  let target = csvRight;
  if (csvLeft.canvasSide === "right" && csvRight.canvasSide === "left") {
    source = csvRight;
    target = csvLeft;
  }

  const sourceCable =
    cache?.cableById.get(`cable-${source.visualCableId}`) ??
    nodes.find((n) => n.id === `cable-${source.visualCableId}`);
  const targetCable =
    cache?.cableById.get(`cable-${target.visualCableId}`) ??
    nodes.find((n) => n.id === `cable-${target.visualCableId}`);
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
  };
}
