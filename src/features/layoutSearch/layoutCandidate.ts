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
import type { ConnectionGraph, LayoutMode, QuadSide } from "@/types/splice";

/** Phase 3 — all four canvas sides available to search. */
export type LayoutSide = QuadSide;

export const ALL_LAYOUT_SIDES: readonly LayoutSide[] = [
  "left",
  "right",
  "top",
  "bottom",
] as const;

export type LayoutCandidate = {
  /** Per physical cable (`cableNameKey`) → canvas side. */
  cableSides: Record<string, LayoutSide>;
  /** Stack order per side (cable name keys). Left/right = top→bottom; top/bottom = left→right. */
  stackOrder: Record<LayoutSide, string[]>;
  layoutWidth: number;
  layoutExpansion: LayoutExpansion;
  /** Stable id for deterministic tie-breaks. */
  id?: string;
};

export function defaultLayoutWidth(): number {
  return CABLE_LAYOUT.width;
}

function emptyStackOrder(): Record<LayoutSide, string[]> {
  return { left: [], right: [], top: [], bottom: [] };
}

/** Graph `cableSides` only stores horizontal L/R — map vertical sides to left. */
function toGraphCableSide(side: LayoutSide): "left" | "right" {
  return side === "right" ? "right" : "left";
}

export function candidateUsesQuadSides(candidate: LayoutCandidate): boolean {
  return (
    candidate.stackOrder.top.length > 0 ||
    candidate.stackOrder.bottom.length > 0
  );
}

/** Derive grid/build layout mode from populated sides (per ROUTING_FIRST_LAYOUT.md). */
export function deriveLayoutMode(candidate: LayoutCandidate): LayoutMode {
  return candidateUsesQuadSides(candidate) ? "quad" : "horizontal";
}

export function cloneGraphForCandidate(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
): ConnectionGraph {
  const cableSides = new Map(graph.cableSides);
  for (const [cable, side] of Object.entries(candidate.cableSides)) {
    cableSides.set(cable, toGraphCableSide(side));
  }
  return {
    ...graph,
    cableSides,
    legs: graph.legs.map((leg) => ({ ...leg })),
  };
}

/** Map candidate stack + sides → `CablePlacement` per visual cable id (L/R only). */
export function candidateToPlacementMap(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
): Map<string, CablePlacement> {
  const placement = new Map<string, CablePlacement>();
  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    const side = candidate.cableSides[key] ?? vc.side;
    if (side !== "left" && side !== "right") continue;
    const stack = candidate.stackOrder[side];
    const order = stack.indexOf(key);
    placement.set(vc.id, {
      side,
      order: order >= 0 ? order : stack.length,
    });
  }
  return placement;
}

/** Visual cable id → side (for `LayoutOverrides.cableSides`, horizontal L/R proxy). */
export function candidateToCableSidesRecord(
  candidate: LayoutCandidate,
  visualCables: VisualCable[],
): Record<string, "left" | "right"> {
  const record: Record<string, "left" | "right"> = {};
  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    const side = candidate.cableSides[key] ?? vc.side;
    record[vc.id] = toGraphCableSide(side);
  }
  return record;
}

/** Visual cable id → quad side (for `LayoutOverrides.quadCableSides`). */
export function candidateToQuadCableSidesRecord(
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

/** Stack order keyed by cable name for quad placement adapter. */
export function candidateQuadStackOrder(
  candidate: LayoutCandidate,
): Partial<Record<LayoutSide, string[]>> {
  return {
    left: [...candidate.stackOrder.left],
    right: [...candidate.stackOrder.right],
    top: [...candidate.stackOrder.top],
    bottom: [...candidate.stackOrder.bottom],
  };
}

export function placementMapToCandidate(
  placement: Map<string, CablePlacement>,
  visualCables: VisualCable[],
  layoutWidth: number = defaultLayoutWidth(),
  layoutExpansion: LayoutExpansion = DEFAULT_LAYOUT_EXPANSION,
): LayoutCandidate {
  const cableSides: Record<string, LayoutSide> = {};
  const orderBySide: Record<LayoutSide, Map<string, number>> = {
    left: new Map(),
    right: new Map(),
    top: new Map(),
    bottom: new Map(),
  };

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

  const stackOrder: Record<LayoutSide, string[]> = {
    left: stackFromBucket(orderBySide.left),
    right: stackFromBucket(orderBySide.right),
    top: stackFromBucket(orderBySide.top),
    bottom: stackFromBucket(orderBySide.bottom),
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
  const { visualCables } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables);
  const placement = computeCanvasPlacement(
    graph, visualCables, rowIndex,
  );
  return placementMapToCandidate(placement, visualCables, layoutWidth);
}

export function candidateStableId(candidate: LayoutCandidate): string {
  const left = candidate.stackOrder.left.join(",");
  const right = candidate.stackOrder.right.join(",");
  const top = candidate.stackOrder.top.join(",");
  const bottom = candidate.stackOrder.bottom.join(",");
  const sides = Object.entries(candidate.cableSides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([cable, side]) => `${cable}:${side}`)
    .join("|");
  return `T[${top}]B[${bottom}]L[${left}]R[${right}]S{${sides}}W${candidate.layoutWidth}`;
}

export function sidesUsedCount(candidate: LayoutCandidate): number {
  let count = 0;
  for (const side of ALL_LAYOUT_SIDES) {
    if (candidate.stackOrder[side].length > 0) count += 1;
  }
  return count;
}

export function compareCandidates(
  a: { score: number; candidate: LayoutCandidate },
  b: { score: number; candidate: LayoutCandidate },
): number {
  if (a.score !== b.score) return a.score - b.score;
  const idA = a.candidate.id ?? candidateStableId(a.candidate);
  const idB = b.candidate.id ?? candidateStableId(b.candidate);
  return idA.localeCompare(idB);
}

/** Normalize stack order to match `cableSides` (drop orphans, append missing). */
export function reconcileStackOrder(
  candidate: LayoutCandidate,
): Record<LayoutSide, string[]> {
  const stacks = emptyStackOrder();
  for (const side of ALL_LAYOUT_SIDES) {
    const seen = new Set<string>();
    for (const cable of candidate.stackOrder[side]) {
      if (candidate.cableSides[cable] === side && !seen.has(cable)) {
        stacks[side].push(cable);
        seen.add(cable);
      }
    }
  }
  for (const [cable, side] of Object.entries(candidate.cableSides)) {
    if (!stacks[side].includes(cable)) {
      stacks[side].push(cable);
    }
  }
  return stacks;
}
