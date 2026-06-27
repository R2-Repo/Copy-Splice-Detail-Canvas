import type { CablePlacement } from "@/features/diagram/canvasPlacement";
import { CABLE_LAYOUT } from "@/features/diagram/cableLayoutMetrics";
import {
  computeCanvasPlacement,
} from "@/features/diagram/canvasPlacement";
import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import {
  DEFAULT_LAYOUT_EXPANSION,
  type LayoutExpansion,
} from "@/features/diagram/layoutExpansion";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph } from "@/types/splice";

/** Phase 1 — horizontal sides only (top/bottom in Phase 3). */
export type LayoutSide = "left" | "right";

export type LayoutCandidate = {
  /** Per physical cable (`cableNameKey`) → canvas side. */
  cableSides: Record<string, LayoutSide>;
  /** Stack order top→bottom per side (cable name keys). */
  stackOrder: {
    left: string[];
    right: string[];
  };
  layoutWidth: number;
  layoutExpansion: LayoutExpansion;
  /** Stable id for deterministic tie-breaks. */
  id?: string;
};

export function defaultLayoutWidth(): number {
  return CABLE_LAYOUT.width;
}

export function cloneGraphForCandidate(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
): ConnectionGraph {
  const cableSides = new Map(graph.cableSides);
  for (const [cable, side] of Object.entries(candidate.cableSides)) {
    cableSides.set(cable, side);
  }
  return {
    ...graph,
    cableSides,
    legs: graph.legs.map((leg) => ({ ...leg })),
  };
}

/** Map candidate stack + sides → `CablePlacement` per visual cable id. */
export function candidateToPlacementMap(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
): Map<string, CablePlacement> {
  const placement = new Map<string, CablePlacement>();
  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    const side = candidate.cableSides[key] ?? vc.side;
    const stack = candidate.stackOrder[side];
    const order = stack.indexOf(key);
    placement.set(vc.id, {
      side,
      order: order >= 0 ? order : stack.length,
    });
  }
  return placement;
}

/** Visual cable id → side (for `LayoutOverrides.cableSides`). */
export function candidateToCableSidesRecord(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
): Record<string, LayoutSide> {
  const record: Record<string, LayoutSide> = {};
  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    record[vc.id] = candidate.cableSides[key] ?? vc.side;
  }
  return record;
}

export function placementMapToCandidate(
  placement: Map<string, CablePlacement>,
  visualCables: VisualCable[],
  layoutWidth: number = defaultLayoutWidth(),
  layoutExpansion: LayoutExpansion = DEFAULT_LAYOUT_EXPANSION,
): LayoutCandidate {
  const cableSides: Record<string, LayoutSide> = {};
  const orderBySide: {
    left: Map<string, number>;
    right: Map<string, number>;
  } = { left: new Map(), right: new Map() };

  for (const vc of visualCables) {
    const p = placement.get(vc.id) ?? { side: vc.side, order: vc.order };
    const key = cableNameKey(vc.cable);
    cableSides[key] = p.side;
    const bucket = orderBySide[p.side];
    const prev = bucket.get(key);
    if (prev === undefined || p.order < prev) {
      bucket.set(key, p.order);
    }
  }

  const stackFromBucket = (bucket: Map<string, number>): string[] =>
    [...bucket.entries()]
      .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
      .map(([key]) => key);

  const stackOrder = {
    left: stackFromBucket(orderBySide.left),
    right: stackFromBucket(orderBySide.right),
  };

  const candidate: LayoutCandidate = {
    cableSides,
    stackOrder,
    layoutWidth,
    layoutExpansion,
  };
  candidate.id = candidateStableId(candidate);
  return candidate;
}

/** Heuristic seed: `computeCableCanvasSides` (on graph) + `computeCanvasPlacement`. */
export function heuristicBaselineCandidate(
  graph: ConnectionGraph,
  layoutWidth: number = defaultLayoutWidth(),
): LayoutCandidate {
  const { visualCables, dominant } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
  const placement = computeCanvasPlacement(
    graph,
    visualCables,
    dominant,
    rowIndex,
  );
  return placementMapToCandidate(placement, visualCables, layoutWidth);
}

export function candidateStableId(candidate: LayoutCandidate): string {
  const left = candidate.stackOrder.left.join(",");
  const right = candidate.stackOrder.right.join(",");
  const sides = Object.entries(candidate.cableSides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cable, side]) => `${cable}:${side}`)
    .join("|");
  return `L[${left}]R[${right}]S{${sides}}W${candidate.layoutWidth}`;
}

export function sidesUsedCount(candidate: LayoutCandidate): number {
  let count = 0;
  if (candidate.stackOrder.left.length > 0) count += 1;
  if (candidate.stackOrder.right.length > 0) count += 1;
  return count;
}

export function compareCandidates(
  a: { score: number; candidate: LayoutCandidate },
  b: { score: number; candidate: LayoutCandidate },
): number {
  if (a.score !== b.score) return a.score - b.score;
  const sidesDiff =
    sidesUsedCount(a.candidate) - sidesUsedCount(b.candidate);
  if (sidesDiff !== 0) return sidesDiff;
  const idA = a.candidate.id ?? candidateStableId(a.candidate);
  const idB = b.candidate.id ?? candidateStableId(b.candidate);
  return idA.localeCompare(idB);
}
