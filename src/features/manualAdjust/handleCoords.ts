import type { Node } from "@xyflow/react";

import { fiberHandlePosition } from "@/features/canvas/edges/splicePathGeometry";
import type { ConnectionGraph } from "@/types/splice";
import {
  buildVisualCablesForLayout,
  endpointOnVisualSide,
} from "@/features/diagram/visualCables";

export function handleCoordsForConnection(
  connectionId: string,
  nodes: Node[],
  graph: ConnectionGraph,
): {
  source: { x: number; y: number };
  target: { x: number; y: number };
} | null {
  const conn = graph.connections.find((c) => c.id === connectionId);
  if (!conn || !("pair" in conn)) return null;

  const { visualCables } = buildVisualCablesForLayout(graph);
  const csvLeft = endpointOnVisualSide(conn, graph, visualCables, "left");
  const csvRight = endpointOnVisualSide(conn, graph, visualCables, "right");
  if (!csvLeft || !csvRight) return null;

  let source = csvLeft;
  let target = csvRight;
  if (csvLeft.canvasSide === "right" && csvRight.canvasSide === "left") {
    source = csvRight;
    target = csvLeft;
  }

  const sourceCable = nodes.find((n) => n.id === `cable-${source.visualCableId}`);
  const targetCable = nodes.find((n) => n.id === `cable-${target.visualCableId}`);
  if (!sourceCable || !targetCable) return null;

  const sourceVc = visualCables.find((vc) => vc.id === source.visualCableId);
  const targetVc = visualCables.find((vc) => vc.id === target.visualCableId);
  if (!sourceVc || !targetVc) return null;

  const sourceData = sourceCable.data as {
    diagramScale?: number;
    alignedStemX?: number;
  };
  const targetData = targetCable.data as {
    diagramScale?: number;
    alignedStemX?: number;
  };

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
