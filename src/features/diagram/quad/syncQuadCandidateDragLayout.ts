import type { Edge, Node } from "@xyflow/react";

import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import { rerouteConnectionIdsForVisualCableDrag } from "@/features/diagram/connectionIdsForCable";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { buildCanvasFromCandidate } from "@/features/layoutSearch/candidateToGraph";
import {
  cloneGraphForCandidate,
  deriveLayoutMode,
} from "@/features/layoutSearch/layoutCandidate";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

export type SyncQuadCandidateDragLayoutArgs = {
  graph: ConnectionGraph;
  overrides: LayoutOverrides;
  positions: Record<string, { x: number; y: number }>;
  draggedNode: Node;
  dragCacheEdges?: Edge[];
  preservedNodes?: Node[];
};

/** Lightweight quad live-drag sync — incremental reroute for dragged cable only. */
export function syncQuadCandidateDragLayout({
  graph,
  overrides,
  positions,
  draggedNode,
  dragCacheEdges,
  preservedNodes = [],
}: SyncQuadCandidateDragLayoutArgs): { nodes: Node[]; edges: Edge[] } {
  const rawCandidate = overrides.optimizedLayoutCandidate;
  if (!rawCandidate) {
    return { nodes: [], edges: [] };
  }

  const candidate = toLayoutCandidate(rawCandidate);
  if (deriveLayoutMode(candidate) !== "quad") {
    return { nodes: [], edges: [] };
  }

  const appliedGraph = cloneGraphForCandidate(graph, candidate);
  const { visualCables } = buildVisualCablesForLayout(appliedGraph);
  const visualId = visualCableIdFromNodeId(draggedNode.id);
  const rerouteConnectionIds =
    visualId != null
      ? rerouteConnectionIdsForVisualCableDrag(visualCables, visualId)
      : undefined;

  const { nodes: engineNodes, edges } = buildCanvasFromCandidate(
    graph,
    candidate,
    { ...overrides, positions },
    {
      dragSync: true,
      skipTubeAutoAlign: true,
      dragCacheEdges,
      rerouteConnectionIds,
    },
  );

  const engineIds = new Set(engineNodes.map((n) => n.id));
  const extras = preservedNodes.filter((n) => !engineIds.has(n.id));
  const nodes = engineNodes.map((node) =>
    node.id === draggedNode.id
      ? { ...node, position: draggedNode.position }
      : node,
  );

  return { nodes: [...nodes, ...extras], edges };
}
