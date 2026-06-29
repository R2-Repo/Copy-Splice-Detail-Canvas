import { parentVisualGroupKey } from "@/features/diagram/visualCables";
import { isThroughCable } from "@/features/diagram/throughCable";
import { cableNameKey, computeCableCanvasSides } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph } from "@/types/splice";
import type { VisualCable } from "@/features/diagram/visualCables";

import {
  ALL_LAYOUT_SIDES,
  candidateStableId,
  reconcileStackOrder,
  type LayoutCandidate,
  type LayoutSide,
} from "../layoutCandidate";
import type {
  CableAffinity,
  PrimaryPairLock,
  ProxyBundleGroup,
  TopologyConstraints,
} from "./topologyTypes";
import {
  FORBID_SAME_SIDE_MAX_RATE,
  LOCK_OPPOSITE_MIN_AFFINITY,
  LOCK_OPPOSITE_MIN_COUNT,
} from "./topologyTypes";

function cableFromVisualGroup(
  groupKey: string,
  visualCables: VisualCable[],
): string | undefined {
  const vc = visualCables.find(
    (v) => parentVisualGroupKey(v.id) === groupKey,
  );
  if (vc) return cableNameKey(vc.cable);
  const sep = groupKey.indexOf("::");
  return sep >= 0 ? groupKey.slice(sep + 2) : groupKey;
}

type DeriveInput = {
  graph: ConnectionGraph;
  cableKeys: string[];
  affinities: CableAffinity[];
  visualCables: VisualCable[];
  throughCableConfidence: Record<string, number>;
  hubCables: string[];
  satelliteCables: string[];
  proxyBundleGroups: ProxyBundleGroup[];
};

function heuristicSides(graph: ConnectionGraph): Map<string, LayoutSide> {
  const sides = computeCableCanvasSides(graph.report.pairs);
  const out = new Map<string, LayoutSide>();
  for (const [cable, side] of sides) {
    out.set(cable, side);
  }
  return out;
}

function oppositeSide(side: LayoutSide): LayoutSide {
  if (side === "left") return "right";
  if (side === "right") return "left";
  if (side === "top") return "bottom";
  return "top";
}

function adaptiveLockCountThreshold(totalConnections: number): number {
  return Math.min(
    LOCK_OPPOSITE_MIN_COUNT,
    Math.max(4, Math.floor(totalConnections * 0.45)),
  );
}

function lockSymmetricThroughPair(
  graph: ConnectionGraph,
  cableKeys: string[],
  throughCableConfidence: Record<string, number>,
  heuristic: Map<string, LayoutSide>,
): PrimaryPairLock | undefined {
  const throughCables = cableKeys
    .filter((c) => isThroughCable(c, graph))
    .filter((c) => (throughCableConfidence[c] ?? 0) >= 0.5)
    .sort((a, b) => (throughCableConfidence[b] ?? 0) - (throughCableConfidence[a] ?? 0));

  if (throughCables.length < 2) return undefined;

  const cableA = throughCables[0]!;
  const cableB = throughCables[1]!;
  const sideA = heuristic.get(cableA) ?? "left";
  let sideB = heuristic.get(cableB) ?? "right";
  if (sideA === sideB) sideB = oppositeSide(sideA);
  return { cableA, cableB, sideA, sideB };
}

function lockFromHighAffinity(
  affinities: CableAffinity[],
  totalConnections: number,
  throughCableConfidence: Record<string, number>,
  graph: ConnectionGraph,
  heuristic: Map<string, LayoutSide>,
): PrimaryPairLock | undefined {
  const threshold = adaptiveLockCountThreshold(totalConnections);
  const sorted = [...affinities].sort(
    (a, b) => b.connectionCount - a.connectionCount,
  );
  for (const affinity of sorted) {
    if (affinity.connectionCount < threshold) continue;
    if (
      affinity.affinityA < LOCK_OPPOSITE_MIN_AFFINITY &&
      affinity.affinityB < LOCK_OPPOSITE_MIN_AFFINITY
    ) {
      continue;
    }
    const throughScore =
      (isThroughCable(affinity.cableA, graph)
        ? throughCableConfidence[affinity.cableA] ?? 0
        : 0) +
      (isThroughCable(affinity.cableB, graph)
        ? throughCableConfidence[affinity.cableB] ?? 0
        : 0);
    if (throughScore < 0.5 && affinity.connectionCount < LOCK_OPPOSITE_MIN_COUNT) {
      continue;
    }
    const sideA = heuristic.get(affinity.cableA) ?? "left";
    let sideB = heuristic.get(affinity.cableB) ?? "right";
    if (sideA === sideB) sideB = oppositeSide(sideA);
    return {
      cableA: affinity.cableA,
      cableB: affinity.cableB,
      sideA,
      sideB,
    };
  }
  return undefined;
}

/** Build locks, forbidden pairs, and searchable cable set. */
export function deriveConstraints(input: DeriveInput): TopologyConstraints {
  const {
    graph,
    cableKeys,
    affinities,
    throughCableConfidence,
    hubCables,
    satelliteCables,
    proxyBundleGroups,
  } = input;

  const totalConnections = graph.connections.filter(
    (c) => c.kind === "fiber",
  ).length;
  const heuristic = heuristicSides(graph);
  const lockedCableSides: Record<string, LayoutSide> = {};

  const primaryPairLock =
    lockFromHighAffinity(
      affinities,
      totalConnections,
      throughCableConfidence,
      graph,
      heuristic,
    ) ??
    lockSymmetricThroughPair(
      graph,
      cableKeys,
      throughCableConfidence,
      heuristic,
    );

  if (primaryPairLock) {
    lockedCableSides[primaryPairLock.cableA] = primaryPairLock.sideA;
    lockedCableSides[primaryPairLock.cableB] = primaryPairLock.sideB;
  }

  const forbiddenSameSidePairs = affinities
    .filter((a) => a.sameSideRate <= FORBID_SAME_SIDE_MAX_RATE)
    .map((a) => ({ cableA: a.cableA, cableB: a.cableB }));

  const searchableCables =
    satelliteCables.length > 0
      ? [...satelliteCables]
      : cableKeys.filter((c) => !(c in lockedCableSides));

  return {
    lockedCableSides,
    forbiddenSameSidePairs,
    searchableCables,
    hubCables: [...hubCables],
    satelliteCables: [...satelliteCables],
    proxyBundleGroups,
    primaryPairLock,
    lockedCableCount: Object.keys(lockedCableSides).length,
  };
}

export function candidateViolatesLocks(
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
): boolean {
  for (const [cable, lockedSide] of Object.entries(
    constraints.lockedCableSides,
  )) {
    if (candidate.cableSides[cable] !== lockedSide) return true;
  }
  return false;
}

export function candidateViolatesForbiddenPairs(
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
): boolean {
  for (const pair of constraints.forbiddenSameSidePairs) {
    const sideA = candidate.cableSides[pair.cableA];
    const sideB = candidate.cableSides[pair.cableB];
    if (sideA && sideB && sideA === sideB) return true;
  }
  return false;
}

export function applyConstraintLocks(
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
): LayoutCandidate {
  const cableSides = { ...candidate.cableSides };
  for (const [cable, side] of Object.entries(constraints.lockedCableSides)) {
    cableSides[cable] = side;
  }

  const stacks: Record<LayoutSide, string[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  for (const side of ALL_LAYOUT_SIDES) {
    stacks[side] = candidate.stackOrder[side].filter(
      (c) => cableSides[c] === side,
    );
  }
  for (const [cable, side] of Object.entries(cableSides)) {
    if (!stacks[side].includes(cable)) {
      stacks[side].push(cable);
    }
  }

  const next: LayoutCandidate = {
    ...candidate,
    cableSides,
    stackOrder: reconcileStackOrder({
      ...candidate,
      cableSides,
      stackOrder: stacks,
    }),
  };
  next.id = candidateStableId(next);
  return next;
}

export function forcePrimaryPairOpposite(
  candidate: LayoutCandidate,
  lock: PrimaryPairLock,
): LayoutCandidate {
  return applyConstraintLocks(candidate, {
    lockedCableSides: {
      [lock.cableA]: lock.sideA,
      [lock.cableB]: lock.sideB,
    },
    forbiddenSameSidePairs: [],
    searchableCables: [],
    hubCables: [lock.cableA, lock.cableB],
    satelliteCables: [],
    proxyBundleGroups: [],
    primaryPairLock: lock,
    lockedCableCount: 2,
  });
}

/** @deprecated Use `forcePrimaryPairOpposite`. */
export const forceDominantPairOpposite = forcePrimaryPairOpposite;

export { cableFromVisualGroup as cableFromDominantGroup };
