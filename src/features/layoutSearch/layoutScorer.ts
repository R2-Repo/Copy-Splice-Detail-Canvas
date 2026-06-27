import { MAX_SPLICE_BENDS } from "@/features/canvas/edges/splicePathGeometry";
import {
  CABLE_LAYOUT,
  compactVisualCableHeight,
} from "@/features/diagram/cableLayoutMetrics";
import type { GridMap, GridPoint, GridRoute } from "@/features/grid/gridTypes";
import type { RuleResult } from "@/features/rules/types";
import type { VisualCable } from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";

import {
  candidateStableId,
  sidesUsedCount,
  type LayoutCandidate,
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

type OrthogonalSeg = {
  axis: "h" | "v";
  fixed: number;
  start: number;
  end: number;
};

const INFEASIBLE_SCORE = Number.MAX_SAFE_INTEGER;

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
  side: "left" | "right",
): number {
  const stack = candidate.stackOrder[side];
  let height = 0;
  for (const cable of stack) {
    const fibers = fiberCountForCable(visualCables, cable);
    height += compactVisualCableHeight(Math.max(1, Math.ceil(fibers / 2))) + CABLE_LAYOUT.cableGap;
  }
  if (stack.length > 0) height -= CABLE_LAYOUT.cableGap;
  return height;
}

export function heightImbalanceForCandidate(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
): number {
  const left = sideStackHeight(candidate, visualCables, "left");
  const right = sideStackHeight(candidate, visualCables, "right");
  return Math.abs(left - right);
}

export function computeSoftScore(
  candidate: LayoutCandidate,
  routes: Map<string, GridRoute>,
  grid: GridMap | undefined,
  visualCables: VisualCable[] | undefined,
  centerX: number,
  weights: SoftScoreWeights = DEFAULT_SOFT_SCORE_WEIGHTS,
): SoftScoreBreakdown {
  const crossings = countRouteCrossings(routes);
  const bendsOverBudget = countBendsOverBudget(routes);
  const sameSideLoopbacks = countSameSideLoopbacks(routes, centerX);
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
  weights: SoftScoreWeights = DEFAULT_SOFT_SCORE_WEIGHTS,
): LayoutScoreResult {
  const hasFail = violations.some((r) => !r.ok && r.severity === "fail");
  const centerX = layoutWidth / 2;
  const softScore = computeSoftScore(
    candidate,
    routes,
    grid,
    visualCables,
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
