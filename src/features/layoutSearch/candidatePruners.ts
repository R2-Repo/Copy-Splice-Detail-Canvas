import { CABLE_LAYOUT, compactVisualCableHeight } from "@/features/diagram/cableLayoutMetrics";
import type { VisualCable } from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph } from "@/types/splice";

import {
  candidateUsesQuadSides,
  type LayoutCandidate,
} from "./layoutCandidate";
import {
  getConnectionEndpointSides,
  sidePairKind,
  topBottomBenefit,
} from "./layoutScorer";
import type { TopologyConstraints } from "./topology/topologyTypes";
import {
  candidateViolatesForbiddenPairs,
  candidateViolatesLocks,
} from "./topology/deriveConstraints";

export type EarlyRejectReason =
  | "locks-forbidden"
  | "top-bottom-no-relief"
  | "layout002-span"
  | "route-adjacent-heavy";

export type EarlyRejectResult = {
  reject: boolean;
  reason?: EarlyRejectReason;
  /** SDC rule ids we expect to fail if promoted past T0. */
  predictedRules: string[];
};

function fiberCountForCable(visualCables: VisualCable[], cable: string): number {
  return visualCables
    .filter((vc) => cableNameKey(vc.cable) === cable)
    .reduce((n, vc) => n + vc.tubes.reduce((t, tube) => t + tube.fibers.length, 0), 0);
}

/** Horizontal span estimate for top/bottom cable stacks (left→right). */
export function topBottomStackSpanPx(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
  side: "top" | "bottom",
): number {
  const stack = candidate.stackOrder[side];
  if (stack.length === 0) return 0;
  let span = 0;
  for (const cable of stack) {
    const fibers = fiberCountForCable(visualCables, cable);
    span += compactVisualCableHeight(Math.max(1, Math.ceil(fibers / 2)));
    span += CABLE_LAYOUT.cableGap;
  }
  return Math.max(0, span - CABLE_LAYOUT.cableGap);
}

function countAdjacentSidePairConnections(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
): number {
  let count = 0;
  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const { sideA, sideB } = getConnectionEndpointSides(candidate, graph, conn);
    if (sidePairKind(sideA, sideB) === "adjacent") count += 1;
  }
  return count;
}

function usesTopOrBottom(candidate: LayoutCandidate): boolean {
  return (
    candidate.stackOrder.top.length > 0 ||
    candidate.stackOrder.bottom.length > 0
  );
}

/** Cheap T0 screen — quad span / adjacent-pair predictors only (no proxy route). */
export function predictEarlyRejectAtT0(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
  constraints: TopologyConstraints,
  visualCables: VisualCable[],
  _rowIndex: Map<string, number>,
): EarlyRejectResult {
  if (
    candidateViolatesLocks(candidate, constraints) ||
    candidateViolatesForbiddenPairs(candidate, constraints)
  ) {
    return { reject: true, reason: "locks-forbidden", predictedRules: [] };
  }

  const predictedRules: string[] = [];

  if (candidateUsesQuadSides(candidate)) {
    const topSpan = topBottomStackSpanPx(candidate, visualCables, "top");
    const bottomSpan = topBottomStackSpanPx(candidate, visualCables, "bottom");
    const maxSpan = Math.max(topSpan, bottomSpan);
    const available = candidate.layoutWidth * 0.85;
    if (maxSpan > available) {
      predictedRules.push("SDC-LAYOUT-002");
      return {
        reject: true,
        reason: "layout002-span",
        predictedRules,
      };
    }

    const adjacentPairs = countAdjacentSidePairConnections(candidate, graph);
    const fiberCount = graph.connections.filter((c) => c.kind === "fiber").length;
    if (adjacentPairs > Math.max(4, Math.floor(fiberCount * 0.15))) {
      predictedRules.push("SDC-ROUTE-002", "SDC-ROUTE-003");
      return {
        reject: true,
        reason: "route-adjacent-heavy",
        predictedRules,
      };
    }
  }

  return { reject: false, predictedRules: [] };
}

/** T1 gate — skip proxy routing for hopeless top/bottom and tight spans. */
export function predictEarlyRejectAtT1(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
  constraints: TopologyConstraints,
  visualCables: VisualCable[],
  rowIndex: Map<string, number>,
): EarlyRejectResult {
  const t0 = predictEarlyRejectAtT0(
    candidate,
    graph,
    constraints,
    visualCables,
    rowIndex,
  );
  if (t0.reject) return t0;

  if (usesTopOrBottom(candidate)) {
    const relief = topBottomBenefit(
      candidate,
      graph,
      visualCables,
      rowIndex,
    );
    if (relief >= 0) {
      return {
        reject: true,
        reason: "top-bottom-no-relief",
        predictedRules: [
          "SDC-LAYOUT-002",
          "SDC-ROUTE-002",
          "SDC-ROUTE-003",
        ],
      };
    }
  }

  if (!usesTopOrBottom(candidate)) {
    return { reject: false, predictedRules: [] };
  }

  for (const side of ["top", "bottom"] as const) {
    if (candidate.stackOrder[side].length < 2) continue;
    const span = topBottomStackSpanPx(candidate, visualCables, side);
    if (span > candidate.layoutWidth * 0.7) {
      return {
        reject: true,
        reason: "layout002-span",
        predictedRules: ["SDC-LAYOUT-002", "SDC-ROUTE-002"],
      };
    }
  }

  return { reject: false, predictedRules: [] };
}

export function recordPrunePredictedRules(
  counts: Record<string, number>,
  predictedRules: string[],
): void {
  for (const id of predictedRules) {
    counts[id] = (counts[id] ?? 0) + 1;
  }
}
