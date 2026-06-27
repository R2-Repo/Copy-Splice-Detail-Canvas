import type { ConnectionGraph, OptimizedLayoutCandidate } from "@/types/splice";

import { evaluateLayoutCandidate } from "./evaluateCandidate";
import type { LayoutCandidate } from "./layoutCandidate";

export function toLayoutCandidate(
  snapshot: OptimizedLayoutCandidate,
): LayoutCandidate {
  return {
    cableSides: { ...snapshot.cableSides },
    stackOrder: {
      left: [...snapshot.stackOrder.left],
      right: [...snapshot.stackOrder.right],
      top: [...snapshot.stackOrder.top],
      bottom: [...snapshot.stackOrder.bottom],
    },
    layoutWidth: snapshot.layoutWidth,
    layoutExpansion: { ...snapshot.layoutExpansion },
    id: snapshot.id,
  };
}

export function verifyLayoutCandidate(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
): { feasible: boolean; failedRules: string[] } {
  const result = evaluateLayoutCandidate(graph, candidate);
  const failedRules = result.violations
    .filter((r) => !r.ok && r.severity === "fail")
    .map((r) => r.detail ?? r.id);
  return { feasible: result.feasible, failedRules };
}
