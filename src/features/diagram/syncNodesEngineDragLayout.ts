import type { Edge, Node } from "@xyflow/react";

import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

export type SyncNodesEngineDragLayoutArgs = {
  graph: ConnectionGraph;
  overrides: LayoutOverrides;
  layoutWidth: number;
  positions: Record<string, { x: number; y: number }>;
  draggedNode: Node;
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
  preservedNodes = [],
}: SyncNodesEngineDragLayoutArgs): { nodes: Node[]; edges: Edge[] } {
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
