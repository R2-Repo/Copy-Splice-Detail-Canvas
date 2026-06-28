import type { Node } from "@xyflow/react";

/** Node types whose handles must be measured before React Flow paints splice edges. */
export function updateSpliceRoutingNodeInternals(
  nodes: Node[],
  updateNodeInternals: (nodeId: string) => void,
): void {
  for (const node of nodes) {
    if (
      node.type === "cable" ||
      node.type === "fiberAnchor" ||
      node.type === "splicePoint" ||
      node.type === "tubeAnchor"
    ) {
      updateNodeInternals(node.id);
    }
  }
}
