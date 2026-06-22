import type { Edge } from "@xyflow/react";

import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import { gridRoutesFromEdges } from "@/features/grid/splicePathFromEdges";

function routingEdgeId(connectionId: string): string {
  return `splice-${connectionId}`;
}

/** Read lane params from live precomputed splice edge data (drag cache). */
export function cachedLanesFromEdges(edges: Edge[]): Map<string, SpliceRoutingLane> {
  const lanes = new Map<string, SpliceRoutingLane>();
  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    if (edge.id.startsWith("splice-right-") || edge.id.startsWith("butt-")) {
      continue;
    }
    const data = edge.data as Record<string, unknown> | undefined;
    const midX = data?.routingMidX as number | undefined;
    if (midX == null) continue;
    lanes.set(edge.id, {
      midX,
      jogX: data?.routingJogX as number | undefined,
      sourceHorizY: data?.routingSourceHorizY as number | undefined,
      targetHorizY: data?.routingTargetHorizY as number | undefined,
      sourceBendX: data?.routingSourceBendX as number | undefined,
      targetBendX: data?.routingTargetBendX as number | undefined,
    });
  }
  return lanes;
}

export { gridRoutesFromEdges };

export function priorRoutesFromEdges(
  edges: Edge[],
  routes: Map<string, import("./gridTypes").GridRoute>,
): Map<string, import("./gridTypes").GridRoute> {
  if (!routes.size) return routes;
  const out = new Map<string, import("./gridTypes").GridRoute>();
  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    if (edge.id.startsWith("splice-right-") || edge.id.startsWith("butt-")) continue;
    const connId = edge.id
      .replace(/^splice-left-/, "")
      .replace(/^splice-/, "");
    const route = routes.get(connId);
    if (route) out.set(connId, route);
  }
  return out;
}

export { routingEdgeId };
