import type { Edge, Node } from "@xyflow/react";

import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { rerouteConnectionIdsForVisualCableDrag } from "@/features/diagram/connectionIdsForCable";
import { useGridRoutingEngine } from "@/features/diagram/routingEngine";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import type { GridRoute } from "@/features/grid/gridTypes";
import {
  candidateToPlacementMap,
  cloneGraphForCandidate,
  deriveLayoutMode,
} from "@/features/layoutSearch/layoutCandidate";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

export type SyncNodesEngineDragLayoutArgs = {
  graph: ConnectionGraph;
  overrides: LayoutOverrides;
  layoutWidth: number;
  positions: Record<string, { x: number; y: number }>;
  draggedNode: Node;
  /** Pre-drag edges for incremental grid lane cache. */
  dragCacheEdges?: Edge[];
  priorGridRoutes?: Map<string, GridRoute>;
  /** Non-engine nodes to preserve (e.g. cable callouts). */
  preservedNodes?: Node[];
};

/** Lightweight live-drag sync: routing + anchors only, no stack collision. */
export function syncNodesEngineDragLayout({
  graph,
  overrides,
  layoutWidth,
  positions,
  draggedNode,
  dragCacheEdges,
  priorGridRoutes,
  preservedNodes = [],
}: SyncNodesEngineDragLayoutArgs): { nodes: Node[]; edges: Edge[] } {
  let appliedGraph = graph;
  const buildOptions: Parameters<typeof buildReactFlowGraph>[3] = {
    dragSync: true,
    skipTubeAutoAlign: true,
    dragCacheEdges,
    priorGridRoutes,
  };

  if (overrides.optimizedLayoutCandidate) {
    const candidate = toLayoutCandidate(overrides.optimizedLayoutCandidate);
    if (deriveLayoutMode(candidate) === "horizontal") {
      appliedGraph = cloneGraphForCandidate(graph, candidate);
      const { visualCables: candidateVisualCables } =
        buildVisualCablesForLayout(appliedGraph);
      buildOptions.fixedPlacement = candidateToPlacementMap(
        candidate,
        candidateVisualCables,
      );
    }
  }

  const { visualCables } = buildVisualCablesForLayout(appliedGraph);
  const visualId = visualCableIdFromNodeId(draggedNode.id);
  const rerouteConnectionIds =
    visualId && useGridRoutingEngine(overrides)
      ? rerouteConnectionIdsForVisualCableDrag(visualCables, visualId)
      : undefined;
  if (rerouteConnectionIds) {
    buildOptions.rerouteConnectionIds = rerouteConnectionIds;
  }

  const { nodes: engineNodes, edges } = buildReactFlowGraph(
    appliedGraph,
    {
      ...overrides,
      positions,
    },
    layoutWidth,
    buildOptions,
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
