import type { Node } from "@xyflow/react";

import type { LayoutCalloutRecord } from "@/types/splice";

export function mergeCalloutNodes(
  nodes: Node[],
  callouts?: Record<string, LayoutCalloutRecord>,
  positions?: Record<string, { x: number; y: number }>,
): Node[] {
  const withoutCallouts = nodes.filter((n) => n.type !== "cableCallout");
  if (!callouts || Object.keys(callouts).length === 0) {
    return withoutCallouts;
  }

  const calloutNodes: Node[] = Object.entries(callouts).map(([id, meta]) => ({
    id,
    type: "cableCallout",
    position: positions?.[id] ?? { x: 0, y: 0 },
    width: 200,
    height: 52,
    data: {
      targetCableNodeId: meta.targetCableNodeId,
      text: meta.text,
    },
    draggable: true,
    selectable: true,
  }));

  return [...withoutCallouts, ...calloutNodes];
}
