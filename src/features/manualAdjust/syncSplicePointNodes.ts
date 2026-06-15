import type { Edge, Node } from "@xyflow/react";

const SPLICE_DOT_HALF = 4.5;

export function syncSplicePointNodes(
  nodes: Node[],
  edges: Edge[],
  connectionIds: Iterable<string>,
): Node[] {
  const updates = new Map<string, { x: number; y: number }>();
  for (const connectionId of connectionIds) {
    const leftEdge = edges.find((e) => e.id === `splice-left-${connectionId}`);
    const data = (leftEdge?.data ?? {}) as {
      spliceX?: number;
      spliceY?: number;
    };
    if (data.spliceX === undefined || data.spliceY === undefined) continue;
    updates.set(`splicePoint-${connectionId}`, {
      x: data.spliceX - SPLICE_DOT_HALF,
      y: data.spliceY - SPLICE_DOT_HALF,
    });
  }
  if (updates.size === 0) return nodes;
  let changed = false;
  const result = nodes.map((node) => {
    const next = updates.get(node.id);
    if (!next) return node;
    const dy = Math.abs(next.y - node.position.y);
    const dx = Math.abs(next.x - node.position.x);
    if (dx < 0.5 && dy < 0.5) return node;
    changed = true;
    return { ...node, position: next };
  });
  return changed ? result : nodes;
}
