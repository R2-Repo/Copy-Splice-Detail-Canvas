import type { Edge, Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import { fiberHandlePosition } from "@/features/canvas/edges/splicePathGeometry";
import type { ConnectionGraph } from "@/types/splice";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";

import {
  buildHandleCoordsCache,
  handleCoordsForConnection,
} from "./handleCoords";
import { finalizeConnectedLegPaths } from "./legSegments";
import { syncSplicePointNodes } from "./syncSplicePointNodes";

const ANCHOR_DOT = 6;

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

function visualCableIdFromAnchorId(anchorId: string): string | null {
  const raw = anchorId.replace(/^fiberAnchor-/, "");
  const idx = raw.indexOf("::");
  return idx >= 0 ? raw.slice(0, idx) : null;
}

function positionNear(
  a: { x: number; y: number },
  b: { x: number; y: number },
  tolerance = 0.5,
): boolean {
  return Math.abs(a.x - b.x) < tolerance && Math.abs(a.y - b.y) < tolerance;
}

/** Manual mode: move one cable's anchors + pin its leg ends only — no global reroute. */
export function syncManualVisualCable(
  nodes: Node[],
  edges: Edge[],
  graph: ConnectionGraph,
  visualCableId: string,
  cableNodeOverride?: Node,
): { nodes: Node[]; edges: Edge[]; touchedConnections: string[] } {
  const cableId = `cable-${visualCableId}`;
  const cableNode =
    cableNodeOverride?.id === cableId
      ? cableNodeOverride
      : nodes.find((n) => n.id === cableId);
  if (!cableNode || cableNode.type !== "cable") {
    return { nodes, edges, touchedConnections: [] };
  }

  const cableData = cableNode.data as CableNodeData;
  const { visualCables } = buildVisualCablesForLayout(graph);
  const vcRaw = visualCables.find((vc) => vc.id === visualCableId);
  if (!vcRaw) return { nodes, edges, touchedConnections: [] };

  const vc = visualCableFromCableNode(vcRaw, cableData);
  const connectionIds = vc.tubes.flatMap((t) =>
    t.fibers.map((f) => f.connectionId),
  );

  const anchorPositions = new Map<string, { x: number; y: number }>();
  for (const connectionId of connectionIds) {
    const pos = fiberHandlePosition(
      vc,
      connectionId,
      cableNode.position,
      cableData.diagramScale ?? 1,
      cableData.alignedStemX,
    );
    anchorPositions.set(`fiberAnchor-${visualCableId}::${connectionId}`, {
      x: pos.x - ANCHOR_DOT / 2,
      y: pos.y - ANCHOR_DOT / 2,
    });
  }

  let nodesChanged = false;
  const nextNodes = nodes.map((n) => {
    if (n.id === cableId && n !== cableNode) {
      nodesChanged = true;
      return cableNode;
    }
    const anchorPos = anchorPositions.get(n.id);
    if (!anchorPos) return n;
    if (positionNear(n.position, anchorPos)) return n;
    nodesChanged = true;
    return { ...n, position: anchorPos };
  });

  const handleCache = buildHandleCoordsCache(
    nodesChanged ? nextNodes : nodes,
    graph,
  );
  const edgeById = new Map(edges.map((e) => [e.id, e]));
  const edgePatches = new Map<string, Edge>();
  const touchedConnections: string[] = [];

  for (const connectionId of connectionIds) {
    const handles = handleCoordsForConnection(
      connectionId,
      nodesChanged ? nextNodes : nodes,
      graph,
      handleCache,
    );
    if (!handles) continue;

    const leftId = `splice-left-${connectionId}`;
    const rightId = `splice-right-${connectionId}`;
    const leftEdge = edgeById.get(leftId);
    const rightEdge = edgeById.get(rightId);
    if (!leftEdge) continue;

    const sourceVc = visualCableIdFromAnchorId(String(leftEdge.source));
    const targetVc = rightEdge
      ? visualCableIdFromAnchorId(String(rightEdge.target))
      : null;
    const pinsSource = sourceVc === visualCableId;
    const pinsTarget = targetVc === visualCableId;
    if (!pinsSource && !pinsTarget) continue;

    const data = (leftEdge.data ?? {}) as {
      leftPath?: string;
      rightPath?: string;
    };
    let leftPath = String(data.leftPath ?? "");
    let rightPath = String(data.rightPath ?? "");

    const editedSide = pinsSource ? ("left" as const) : ("right" as const);
    const connected = finalizeConnectedLegPaths(
      leftPath,
      rightPath,
      editedSide,
      handles,
    );

    const prevEdgeData = (edgePatches.get(leftId) ?? leftEdge).data as {
      leftPath?: string;
      rightPath?: string;
    };
    const prevLeft = String(prevEdgeData.leftPath ?? data.leftPath ?? "");
    const prevRight = String(prevEdgeData.rightPath ?? data.rightPath ?? "");

    if (prevLeft === connected.leftPath && prevRight === connected.rightPath) {
      continue;
    }

    touchedConnections.push(connectionId);
    const patchData = {
      leftPath: connected.leftPath,
      rightPath: connected.rightPath,
      spliceX: connected.spliceX,
      spliceY: connected.spliceY,
    };
    edgePatches.set(leftId, {
      ...leftEdge,
      data: { ...(leftEdge.data as Record<string, unknown>), ...patchData },
    });
    if (rightEdge) {
      edgePatches.set(rightId, {
        ...rightEdge,
        data: { ...(rightEdge.data as Record<string, unknown>), ...patchData },
      });
    }
  }

  let resultNodes = nodesChanged ? nextNodes : nodes;
  let resultEdges = edges;

  if (edgePatches.size > 0) {
    resultEdges = edges.map((e) => edgePatches.get(e.id) ?? e);
    resultNodes = syncSplicePointNodes(
      resultNodes,
      resultEdges,
      touchedConnections,
    );
    if (resultNodes !== nodes) nodesChanged = true;
  }

  if (!nodesChanged && edgePatches.size === 0) {
    return { nodes, edges, touchedConnections: [] };
  }

  return {
    nodes: resultNodes,
    edges: resultEdges,
    touchedConnections,
  };
}
