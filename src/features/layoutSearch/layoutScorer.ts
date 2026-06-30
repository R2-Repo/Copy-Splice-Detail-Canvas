import { pairEndpointsForSide } from "@/features/diagram/buildConnectionGraph";
import { stackOrderCrossingCount } from "@/features/diagram/canvasPlacement";
import { MAX_SPLICE_BENDS } from "@/features/canvas/edges/splicePathGeometry";
import {
  CABLE_LAYOUT,
  compactVisualCableHeight,
} from "@/features/diagram/cableLayoutMetrics";
import type { GridMap, GridPoint, GridRoute } from "@/features/grid/gridTypes";
import type { RuleResult } from "@/features/rules/types";
import type { VisualCable } from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph, FiberConnection } from "@/types/splice";

import {
  ALL_LAYOUT_SIDES,
  candidateStableId,
  sidesUsedCount,
  type LayoutCandidate,
  type LayoutSide,
} from "./layoutCandidate";

/** SDC-SCORE-001 initial weights (see ROUTING_FIRST_LAYOUT.md). */
export type SoftScoreWeights = {
  crossings: number;
  bendsOverBudget: number;
  sameSideLoopbacks: number;
  sidesUsed: number;
  centerWidth: number;
  heightImbalance: number;
  pathLength: number;
};

export const DEFAULT_SOFT_SCORE_WEIGHTS: SoftScoreWeights = {
  crossings: 1000,
  bendsOverBudget: 100,
  sameSideLoopbacks: 500,
  sidesUsed: 50,
  centerWidth: 1,
  heightImbalance: 10,
  pathLength: 0.1,
};

export type SoftScoreBreakdown = {
  crossings: number;
  bendsOverBudget: number;
  sameSideLoopbacks: number;
  sidesUsed: number;
  centerWidth: number;
  heightImbalance: number;
  pathLength: number;
  total: number;
};

export type LayoutScoreResult = {
  feasible: boolean;
  score: number;
  softScore: SoftScoreBreakdown;
  tieBreak: {
    sidesUsed: number;
    candidateId: string;
  };
};

export type SidePairKind = "same" | "opposite" | "adjacent";

type OrthogonalSeg = {
  axis: "h" | "v";
  fixed: number;
  start: number;
  end: number;
};

const INFEASIBLE_SCORE = Number.MAX_SAFE_INTEGER;
const ADJACENT_SIDE_PAIR_WEIGHT = 25;

function oppositeSide(side: LayoutSide): LayoutSide {
  if (side === "left") return "right";
  if (side === "right") return "left";
  if (side === "top") return "bottom";
  return "top";
}

export function sidePairKind(
  sideA: LayoutSide,
  sideB: LayoutSide,
): SidePairKind {
  if (sideA === sideB) return "same";
  if (oppositeSide(sideA) === sideB) return "opposite";
  return "adjacent";
}

export function getConnectionEndpointSides(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
  connection: FiberConnection,
): { sideA: LayoutSide; sideB: LayoutSide } {
  const { left, right } = pairEndpointsForSide(connection.pair, graph);
  const cableA = cableNameKey(left.cable);
  const cableB = cableNameKey(right.cable);
  return {
    sideA: candidate.cableSides[cableA] ?? "left",
    sideB: candidate.cableSides[cableB] ?? "right",
  };
}

export function countSameSideLoopbacksFromCandidate(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
): number {
  let count = 0;
  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const { sideA, sideB } = getConnectionEndpointSides(candidate, graph, conn);
    if (sideA === sideB) count += 1;
  }
  return count;
}

export function sidePairRoutingPenalty(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
  weights: SoftScoreWeights = DEFAULT_SOFT_SCORE_WEIGHTS,
): number {
  let penalty = 0;
  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const { sideA, sideB } = getConnectionEndpointSides(candidate, graph, conn);
    const kind = sidePairKind(sideA, sideB);
    if (kind === "same") penalty += weights.sameSideLoopbacks;
    else if (kind === "adjacent") penalty += ADJACENT_SIDE_PAIR_WEIGHT;
  }
  return penalty;
}

function visualCableOrderForSide(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
  side: LayoutSide,
): VisualCable[] {
  const stack = candidate.stackOrder[side];
  const byCable = new Map<string, VisualCable>();
  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    const vcSide = candidate.cableSides[key] ?? vc.side;
    if (vcSide !== side) continue;
    if (!byCable.has(key)) byCable.set(key, vc);
  }
  const ordered: VisualCable[] = [];
  for (const cable of stack) {
    const vc = byCable.get(cable);
    if (vc) ordered.push(vc);
  }
  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    const vcSide = candidate.cableSides[key] ?? vc.side;
    if (vcSide !== side) continue;
    if (!ordered.some((o) => o.id === vc.id)) ordered.push(vc);
  }
  return ordered;
}

function stackIndexForCable(candidate: LayoutCandidate, cable: string): number {
  const side = candidate.cableSides[cable] ?? "left";
  const idx = candidate.stackOrder[side].indexOf(cable);
  return idx >= 0 ? idx : candidate.stackOrder[side].length;
}

function crossingEstimateForSidePair(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
  rowIndex: Map<string, number>,
): number {
  let crossings = 0;
  const seen = new Set<string>();
  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const { left, right } = pairEndpointsForSide(conn.pair, graph);
    const cableA = cableNameKey(left.cable);
    const cableB = cableNameKey(right.cable);
    const key =
      cableA < cableB ? `${cableA}\0${cableB}` : `${cableB}\0${cableA}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const idxA = stackIndexForCable(candidate, cableA);
    const idxB = stackIndexForCable(candidate, cableB);
    const row = rowIndex.get(conn.id) ?? 0;
    if ((idxA - idxB) * row < 0) crossings += 1;
  }
  return crossings;
}

export function fourSideCrossingEstimate(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  rowIndex: Map<string, number>,
): number {
  const leftOrder = visualCableOrderForSide(candidate, visualCables, "left");
  const rightOrder = visualCableOrderForSide(candidate, visualCables, "right");
  let total = stackOrderCrossingCount(
    leftOrder,
    rightOrder,
    graph,
    rowIndex,
    visualCables,
  );

  const sidePairs: Array<[LayoutSide, LayoutSide]> = [
    ["left", "top"],
    ["left", "bottom"],
    ["right", "top"],
    ["right", "bottom"],
    ["top", "bottom"],
  ];

  for (const [sideA, sideB] of sidePairs) {
    if (
      candidate.stackOrder[sideA].length === 0 ||
      candidate.stackOrder[sideB].length === 0
    ) {
      continue;
    }
    const orderA = visualCableOrderForSide(candidate, visualCables, sideA);
    const orderB = visualCableOrderForSide(candidate, visualCables, sideB);
    total += stackOrderCrossingCount(
      orderA,
      orderB,
      graph,
      rowIndex,
      visualCables,
    );
  }

  total += crossingEstimateForSidePair(candidate, graph, rowIndex);
  return total;
}

function collapseToHorizontalSides(
  candidate: LayoutCandidate,
): LayoutCandidate {
  const cableSides: Record<string, LayoutSide> = {};
  const sideKeys: Record<LayoutSide, string[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };

  for (const [cable, side] of Object.entries(candidate.cableSides)) {
    const mapped: LayoutSide = side === "right" ? "right" : "left";
    cableSides[cable] = mapped;
    if (!sideKeys[mapped].includes(cable)) {
      sideKeys[mapped].push(cable);
    }
  }

  for (const side of ALL_LAYOUT_SIDES) {
    for (const cable of candidate.stackOrder[side]) {
      const mapped = cableSides[cable] ?? "left";
      if (!sideKeys[mapped].includes(cable)) {
        sideKeys[mapped].push(cable);
      }
    }
  }

  return {
    ...candidate,
    cableSides,
    stackOrder: sideKeys,
  };
}

/** Reward top/bottom only when it reduces loopback or crossing vs L/R-only baseline. */
export function topBottomBenefit(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  rowIndex: Map<string, number>,
  weights: SoftScoreWeights = DEFAULT_SOFT_SCORE_WEIGHTS,
): number {
  const usesTopBottom =
    candidate.stackOrder.top.length > 0 ||
    candidate.stackOrder.bottom.length > 0;
  if (!usesTopBottom) return 0;

  const lrOnly = collapseToHorizontalSides(candidate);
  const loopbackDelta =
    countSameSideLoopbacksFromCandidate(lrOnly, graph) -
    countSameSideLoopbacksFromCandidate(candidate, graph);
  const crossingDelta =
    fourSideCrossingEstimate(lrOnly, graph, visualCables, rowIndex) -
    fourSideCrossingEstimate(candidate, graph, visualCables, rowIndex);

  if (loopbackDelta <= 0 && crossingDelta <= 0) return 0;

  return -(
    loopbackDelta * weights.sameSideLoopbacks +
    crossingDelta * weights.crossings
  );
}

function bendCountFromPoints(points: GridPoint[]): number {
  let bends = 0;
  for (let i = 2; i < points.length; i++) {
    const a = points[i - 2]!;
    const b = points[i - 1]!;
    const c = points[i]!;
    const dir1 = Math.abs(a.x - b.x) < 0.5 ? "v" : "h";
    const dir2 = Math.abs(b.x - c.x) < 0.5 ? "v" : "h";
    if (dir1 !== dir2) bends++;
  }
  return bends;
}

function orthogonalSegments(points: GridPoint[]): OrthogonalSeg[] {
  const segments: OrthogonalSeg[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (Math.abs(a.x - b.x) < 0.5) {
      segments.push({
        axis: "v",
        fixed: a.x,
        start: Math.min(a.y, b.y),
        end: Math.max(a.y, b.y),
      });
    } else if (Math.abs(a.y - b.y) < 0.5) {
      segments.push({
        axis: "h",
        fixed: a.y,
        start: Math.min(a.x, b.x),
        end: Math.max(a.x, b.x),
      });
    }
  }
  return segments.filter((s) => Math.abs(s.end - s.start) > 0.5);
}

function segmentsIntersect(a: OrthogonalSeg, b: OrthogonalSeg): boolean {
  if (a.axis === b.axis) return false;
  const h = a.axis === "h" ? a : b;
  const v = a.axis === "v" ? a : b;
  return (
    v.fixed > h.start + 0.5 &&
    v.fixed < h.end - 0.5 &&
    h.fixed > v.start + 0.5 &&
    h.fixed < v.end - 0.5
  );
}

export function countRouteCrossings(routes: Map<string, GridRoute>): number {
  const tagged: Array<{ connId: string; seg: OrthogonalSeg }> = [];
  for (const [connId, route] of routes) {
    for (const seg of orthogonalSegments(route.points)) {
      tagged.push({ connId, seg });
    }
  }
  let crossings = 0;
  for (let i = 0; i < tagged.length; i++) {
    for (let j = i + 1; j < tagged.length; j++) {
      if (tagged[i]!.connId === tagged[j]!.connId) continue;
      if (segmentsIntersect(tagged[i]!.seg, tagged[j]!.seg)) {
        crossings += 1;
      }
    }
  }
  return crossings;
}

export function countBendsOverBudget(
  routes: Map<string, GridRoute>,
  headroom = 1,
): number {
  let total = 0;
  for (const route of routes.values()) {
    const bends = bendCountFromPoints(route.points);
    total += Math.max(0, bends - headroom);
  }
  return total;
}

/** Route-geometry loopbacks — prefer `countSameSideLoopbacksFromCandidate` for screening. */
export function countSameSideLoopbacks(
  routes: Map<string, GridRoute>,
  centerX: number,
): number {
  let count = 0;
  for (const route of routes.values()) {
    const pts = route.points;
    if (pts.length < 2) continue;
    const start = pts[0]!;
    const end = pts[pts.length - 1]!;
    const startSide = start.x < centerX ? "left" : "right";
    const endSide = end.x < centerX ? "left" : "right";
    if (startSide === endSide) count += 1;
  }
  return count;
}

export function totalRoutePathLength(routes: Map<string, GridRoute>): number {
  let total = 0;
  for (const route of routes.values()) {
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1]!;
      const b = route.points[i]!;
      total += Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }
  }
  return total;
}

function fiberCountForCable(visualCables: VisualCable[], cable: string): number {
  return visualCables
    .filter((vc) => cableNameKey(vc.cable) === cable)
    .reduce((n, vc) => n + vc.tubes.reduce((t, tube) => t + tube.fibers.length, 0), 0);
}

function sideStackHeight(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
  side: LayoutSide,
): number {
  const stack = candidate.stackOrder[side];
  let height = 0;
  for (const cable of stack) {
    const fibers = fiberCountForCable(visualCables, cable);
    height +=
      compactVisualCableHeight(Math.max(1, Math.ceil(fibers / 2))) +
      CABLE_LAYOUT.cableGap;
  }
  if (stack.length > 0) height -= CABLE_LAYOUT.cableGap;
  return height;
}

export function heightImbalanceForCandidate(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
): number {
  const heights: number[] = [];
  for (const side of ALL_LAYOUT_SIDES) {
    if (candidate.stackOrder[side].length > 0) {
      heights.push(sideStackHeight(candidate, visualCables, side));
    }
  }
  if (heights.length <= 1) return 0;
  return Math.max(...heights) - Math.min(...heights);
}

export type CandidateScreenScore = SoftScoreBreakdown & {
  sidePairPenalty: number;
  topBottomRelief: number;
};

/** T0 cheap screen — four-side-aware, no grid route. */
export function scoreCandidateScreen(
  candidate: LayoutCandidate,
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  rowIndex: Map<string, number>,
  weights: SoftScoreWeights = DEFAULT_SOFT_SCORE_WEIGHTS,
): CandidateScreenScore {
  const crossings = fourSideCrossingEstimate(
    candidate,
    graph,
    visualCables,
    rowIndex,
  );
  const sameSideLoopbacks = countSameSideLoopbacksFromCandidate(
    candidate,
    graph,
  );
  const sidePairPenalty = sidePairRoutingPenalty(candidate, graph, weights);
  const topBottomRelief = topBottomBenefit(
    candidate,
    graph,
    visualCables,
    rowIndex,
    weights,
  );
  const sidesUsed = sidesUsedCount(candidate);
  const heightImbalance = heightImbalanceForCandidate(candidate, visualCables);

  const total =
    crossings * weights.crossings +
    sameSideLoopbacks * weights.sameSideLoopbacks +
    sidePairPenalty +
    topBottomRelief +
    sidesUsed * weights.sidesUsed +
    heightImbalance * weights.heightImbalance;

  return {
    crossings,
    bendsOverBudget: 0,
    sameSideLoopbacks,
    sidesUsed,
    centerWidth: 0,
    heightImbalance,
    pathLength: 0,
    sidePairPenalty,
    topBottomRelief,
    total,
  };
}

export function computeSoftScore(
  candidate: LayoutCandidate,
  routes: Map<string, GridRoute>,
  grid: GridMap | undefined,
  visualCables: VisualCable[] | undefined,
  graph: ConnectionGraph | undefined,
  centerX: number,
  weights: SoftScoreWeights = DEFAULT_SOFT_SCORE_WEIGHTS,
): SoftScoreBreakdown {
  const crossings = countRouteCrossings(routes);
  const bendsOverBudget = countBendsOverBudget(routes);
  const sameSideLoopbacks =
    graph && visualCables
      ? countSameSideLoopbacksFromCandidate(candidate, graph)
      : countSameSideLoopbacks(routes, centerX);
  const sidesUsed = sidesUsedCount(candidate);
  const centerWidth = grid?.routingZone.width ?? 0;
  const heightImbalance =
    visualCables && visualCables.length > 0
      ? heightImbalanceForCandidate(candidate, visualCables)
      : 0;
  const pathLength = totalRoutePathLength(routes);

  const total =
    crossings * weights.crossings +
    bendsOverBudget * weights.bendsOverBudget +
    sameSideLoopbacks * weights.sameSideLoopbacks +
    sidesUsed * weights.sidesUsed +
    centerWidth * weights.centerWidth +
    heightImbalance * weights.heightImbalance +
    pathLength * weights.pathLength;

  return {
    crossings,
    bendsOverBudget,
    sameSideLoopbacks,
    sidesUsed,
    centerWidth,
    heightImbalance,
    pathLength,
    total,
  };
}

/** Tier 1: any `severity: "fail"` → infeasible. Tier 2: weighted soft score. */
export function scoreLayoutEvaluation(
  violations: RuleResult[],
  candidate: LayoutCandidate,
  routes: Map<string, GridRoute>,
  grid: GridMap | undefined,
  visualCables: VisualCable[] | undefined,
  layoutWidth: number,
  graph?: ConnectionGraph,
  weights: SoftScoreWeights = DEFAULT_SOFT_SCORE_WEIGHTS,
): LayoutScoreResult {
  const hasFail = violations.some((r) => !r.ok && r.severity === "fail");
  const centerX = layoutWidth / 2;
  const softScore = computeSoftScore(
    candidate,
    routes,
    grid,
    visualCables,
    graph,
    centerX,
    weights,
  );
  const candidateId = candidate.id ?? candidateStableId(candidate);
  const tieBreak = {
    sidesUsed: sidesUsedCount(candidate),
    candidateId,
  };

  if (hasFail) {
    return {
      feasible: false,
      score: INFEASIBLE_SCORE,
      softScore,
      tieBreak,
    };
  }

  return {
    feasible: true,
    score: softScore.total,
    softScore,
    tieBreak,
  };
}

/** Exported for tests — bend budget reference. */
export { MAX_SPLICE_BENDS };
