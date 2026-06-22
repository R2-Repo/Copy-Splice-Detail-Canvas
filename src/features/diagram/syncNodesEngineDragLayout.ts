import type { Edge, Node } from "@xyflow/react";

import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { connectionIdsForVisualCable } from "@/features/diagram/connectionIdsForCable";
import { useGridRoutingEngine } from "@/features/diagram/routingEngine";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import type { GridRoute } from "@/features/grid/gridTypes";
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
  const { visualCables } = buildVisualCablesForLayout(graph);
  const visualId = visualCableIdFromNodeId(draggedNode.id);
  const rerouteConnectionIds =
    visualId && useGridRoutingEngine(overrides)
      ? connectionIdsForVisualCable(visualCables, visualId)
      : undefined;

  const { nodes: engineNodes, edges } = buildReactFlowGraph(
    graph,
    {
      ...overrides,
      positions,
    },
    layoutWidth,
    {
      dragSync: true,
      skipTubeAutoAlign: true,
      rerouteConnectionIds,
      dragCacheEdges,
      priorGridRoutes,
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
