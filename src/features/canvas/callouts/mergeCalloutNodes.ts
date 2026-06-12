import type { Node } from "@xyflow/react";

import { CALLOUT_BOX } from "@/features/canvas/callouts/cableCalloutGeometry";
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
    width: CALLOUT_BOX.width,
    height: CALLOUT_BOX.minHeight,
    data: {
      targetCableNodeId: meta.targetCableNodeId,
      text: meta.text,
    },
    draggable: true,
    selectable: true,
  }));

  return [...withoutCallouts, ...calloutNodes];
}
