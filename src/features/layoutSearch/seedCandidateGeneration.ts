import {
  DEFAULT_LAYOUT_EXPANSION,
  layoutExpansionForIteration,
} from "@/features/diagram/layoutExpansion";
import type { ConnectionGraph } from "@/types/splice";

import {
  ALL_LAYOUT_SIDES,
  candidateStableId,
  defaultLayoutWidth,
  heuristicBaselineCandidate,
  reconcileStackOrder,
  type LayoutCandidate,
  type LayoutSide,
} from "./layoutCandidate";
import type { ForcedCableSide } from "./importSearchConfig";
import type { RoutingIntent } from "./routingIntent";
import { preferredOppositeSides } from "./routingIntent";
import {
  applyConstraintLocks,
  candidateViolatesForbiddenPairs,
} from "./topology/deriveConstraints";
import type { TopologyConstraints } from "./topology/topologyTypes";

export type SeedGenerationOptions = {
  cableKeys: string[];
  layoutWidths: number[];
  expansionIters: number[];
  seed: number;
  forcedSides?: ForcedCableSide[];
};

function normalizeCandidate(candidate: LayoutCandidate): LayoutCandidate {
  const next: LayoutCandidate = {
    cableSides: { ...candidate.cableSides },
    stackOrder: reconcileStackOrder(candidate),
    layoutWidth: candidate.layoutWidth,
    layoutExpansion: { ...candidate.layoutExpansion },
  };
  next.id = candidateStableId(next);
  return next;
}

function emptyStacks(): Record<LayoutSide, string[]> {
  return { left: [], right: [], top: [], bottom: [] };
}

function buildFromSideMap(
  cableKeys: string[],
  sideMap: Record<string, LayoutSide>,
  layoutWidth: number,
  stackSort?: (side: LayoutSide, cables: string[]) => string[],
): LayoutCandidate {
  const stacks = emptyStacks();
  const cableSides: Record<string, LayoutSide> = {};

  for (const cable of cableKeys) {
    const side = sideMap[cable] ?? "left";
    cableSides[cable] = side;
    stacks[side].push(cable);
  }

  for (const side of ALL_LAYOUT_SIDES) {
    if (stackSort) {
      stacks[side] = stackSort(side, stacks[side]);
    } else {
      stacks[side].sort((a, b) => a.localeCompare(b));
    }
  }

  return normalizeCandidate({
    cableSides,
    stackOrder: stacks,
    layoutWidth,
    layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
  });
}

function medianSortStacks(
  intent: RoutingIntent,
  cables: string[],
): string[] {
  return [...cables].sort((a, b) => {
    const medianFor = (cable: string) => {
      let best = Number.POSITIVE_INFINITY;
      for (const [key, median] of Object.entries(intent.medianRowByCablePair)) {
        const [ca, cb] = key.split("\0") as [string, string];
        if (ca === cable || cb === cable) {
          best = Math.min(best, median);
        }
      }
      return best;
    };
    const diff = medianFor(a) - medianFor(b);
    return diff !== 0 ? diff : a.localeCompare(b);
  });
}

function pushUnique(
  out: LayoutCandidate[],
  seen: Set<string>,
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
): void {
  const locked = applyConstraintLocks(candidate, constraints);
  if (
    candidateViolatesForbiddenPairs(locked, constraints)
  ) {
    return;
  }
  const id = locked.id ?? candidateStableId(locked);
  if (seen.has(id)) return;
  seen.add(id);
  out.push(locked);
}

export function buildForcedSidesCandidate(
  cableKeys: string[],
  layoutWidth: number,
  constraints: TopologyConstraints,
  forcedSides: ForcedCableSide[],
): LayoutCandidate | null {
  if (!forcedSides.length) return null;

  const sideMap: Record<string, LayoutSide> = {};
  for (const cable of cableKeys) {
    const locked = constraints.lockedCableSides[cable];
    sideMap[cable] = locked ?? "left";
  }
  for (const { cable, side } of forcedSides) {
    if (!cableKeys.includes(cable)) continue;
    if (constraints.lockedCableSides[cable]) continue;
    sideMap[cable] = side;
  }

  return buildFromSideMap(cableKeys, sideMap, layoutWidth);
}

/** Deterministic 8–30 seed candidates from topology intent. */
export function generateSeedCandidates(
  graph: ConnectionGraph,
  intent: RoutingIntent,
  constraints: TopologyConstraints,
  options: SeedGenerationOptions,
): LayoutCandidate[] {
  const { cableKeys, layoutWidths, forcedSides } = options;
  const width = layoutWidths[0] ?? defaultLayoutWidth();
  const seen = new Set<string>();
  const seeds: LayoutCandidate[] = [];

  const baseline = heuristicBaselineCandidate(graph, width);
  pushUnique(seeds, seen, baseline, constraints);

  const forced = buildForcedSidesCandidate(
    cableKeys,
    width,
    constraints,
    forcedSides ?? [],
  );
  if (forced) pushUnique(seeds, seen, forced, constraints);

  const dominant = intent.dominantPairs[0];
  const lock = constraints.primaryPairLock;
  const { sideA, sideB } = preferredOppositeSides(intent, lock);

  if (dominant) {
    const lrMap: Record<string, LayoutSide> = {};
    for (const cable of cableKeys) {
      lrMap[cable] = constraints.lockedCableSides[cable] ?? "left";
    }
    lrMap[dominant.cableA] = constraints.lockedCableSides[dominant.cableA] ?? sideA;
    lrMap[dominant.cableB] = constraints.lockedCableSides[dominant.cableB] ?? sideB;
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, lrMap, width), constraints);

    const rlMap = { ...lrMap };
    rlMap[dominant.cableA] =
      constraints.lockedCableSides[dominant.cableA] ?? sideB;
    rlMap[dominant.cableB] =
      constraints.lockedCableSides[dominant.cableB] ?? sideA;
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, rlMap, width), constraints);

    const tbMap = { ...lrMap };
    if (!constraints.lockedCableSides[dominant.cableA]) {
      tbMap[dominant.cableA] = "top";
    }
    if (!constraints.lockedCableSides[dominant.cableB]) {
      tbMap[dominant.cableB] = "bottom";
    }
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, tbMap, width), constraints);

    const btMap = { ...lrMap };
    if (!constraints.lockedCableSides[dominant.cableA]) {
      btMap[dominant.cableA] = "bottom";
    }
    if (!constraints.lockedCableSides[dominant.cableB]) {
      btMap[dominant.cableB] = "top";
    }
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, btMap, width), constraints);
  }

  if (constraints.hubCables.length > 0 && constraints.satelliteCables.length > 0) {
    const hubMap: Record<string, LayoutSide> = {};
    for (const cable of cableKeys) {
      hubMap[cable] = constraints.lockedCableSides[cable] ?? "left";
    }
    for (const hub of constraints.hubCables) {
      if (!constraints.lockedCableSides[hub]) hubMap[hub] = "left";
    }
    for (const satellite of constraints.satelliteCables) {
      if (constraints.lockedCableSides[satellite]) continue;
      const anchor = intent.satelliteToAnchor[satellite];
      const anchorSide = anchor ? (hubMap[anchor] ?? "left") : "right";
      hubMap[satellite] = anchorSide === "left" ? "right" : "left";
    }
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, hubMap, width), constraints);
  }

  if (cableKeys.length >= 3) {
    const balanced: Record<string, LayoutSide> = {};
    const order: LayoutSide[] = ["left", "right", "top", "bottom"];
    cableKeys.forEach((cable, index) => {
      balanced[cable] =
        constraints.lockedCableSides[cable] ??
        order[index % order.length]!;
    });
    pushUnique(
      seeds,
      seen,
      buildFromSideMap(cableKeys, balanced, width),
      constraints,
    );
  }

  pushUnique(
    seeds,
    seen,
    buildFromSideMap(cableKeys, {}, width, (_side, cables) =>
      medianSortStacks(intent, cables),
    ),
    constraints,
  );

  for (const cable of intent.topBottomReliefCandidates.slice(0, 3)) {
    if (constraints.lockedCableSides[cable]) continue;
    const reliefMap: Record<string, LayoutSide> = {};
    for (const key of cableKeys) {
      reliefMap[key] = constraints.lockedCableSides[key] ?? "left";
    }
    reliefMap[cable] = "top";
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, reliefMap, width), constraints);

    const reliefBottom = { ...reliefMap, [cable]: "bottom" as LayoutSide };
    pushUnique(
      seeds,
      seen,
      buildFromSideMap(cableKeys, reliefBottom, width),
      constraints,
    );
  }

  if (cableKeys.length === 2) {
    const [a, b] = cableKeys;
    const twoSided: Record<string, LayoutSide> = {
      [a!]: constraints.lockedCableSides[a!] ?? "left",
      [b!]: constraints.lockedCableSides[b!] ?? "right",
    };
    pushUnique(
      seeds,
      seen,
      buildFromSideMap(cableKeys, twoSided, width),
      constraints,
    );

    const topBottom: Record<string, LayoutSide> = {
      [a!]: constraints.lockedCableSides[a!] ?? "top",
      [b!]: constraints.lockedCableSides[b!] ?? "bottom",
    };
    pushUnique(
      seeds,
      seen,
      buildFromSideMap(cableKeys, topBottom, width),
      constraints,
    );
    const bottomTop: Record<string, LayoutSide> = {
      [a!]: constraints.lockedCableSides[a!] ?? "bottom",
      [b!]: constraints.lockedCableSides[b!] ?? "top",
    };
    pushUnique(
      seeds,
      seen,
      buildFromSideMap(cableKeys, bottomTop, width),
      constraints,
    );
  }

  for (const widthStep of layoutWidths.slice(0, 2)) {
    if (widthStep === width) continue;
    const scaled = { ...baseline, layoutWidth: widthStep };
    pushUnique(seeds, seen, scaled, constraints);
  }

  for (const expIter of options.expansionIters.slice(0, 2)) {
    if (expIter <= 0) continue;
    const expanded = {
      ...baseline,
      layoutExpansion: layoutExpansionForIteration(expIter),
    };
    pushUnique(seeds, seen, expanded, constraints);
  }

  for (const pair of intent.sameSideRiskPairs.slice(0, 3)) {
    const riskMap: Record<string, LayoutSide> = {};
    for (const cable of cableKeys) {
      riskMap[cable] = constraints.lockedCableSides[cable] ?? "left";
    }
    if (!constraints.lockedCableSides[pair.cableA]) {
      riskMap[pair.cableA] = "left";
    }
    if (!constraints.lockedCableSides[pair.cableB]) {
      riskMap[pair.cableB] = "right";
    }
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, riskMap, width), constraints);

    const tbRisk: Record<string, LayoutSide> = { ...riskMap };
    if (!constraints.lockedCableSides[pair.cableA]) tbRisk[pair.cableA] = "top";
    if (!constraints.lockedCableSides[pair.cableB]) tbRisk[pair.cableB] = "bottom";
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, tbRisk, width), constraints);
  }

  const secondaryCables = cableKeys.filter(
    (c) =>
      !constraints.lockedCableSides[c] &&
      !constraints.hubCables.includes(c) &&
      intent.topBottomReliefCandidates.includes(c),
  );
  if (dominant && secondaryCables.length > 0) {
    const domTop: Record<string, LayoutSide> = {};
    for (const cable of cableKeys) {
      domTop[cable] = constraints.lockedCableSides[cable] ?? "left";
    }
    if (!constraints.lockedCableSides[dominant.cableA]) {
      domTop[dominant.cableA] = "top";
    }
    if (!constraints.lockedCableSides[dominant.cableB]) {
      domTop[dominant.cableB] = "right";
    }
    for (const sec of secondaryCables.slice(0, 2)) {
      domTop[sec] = sec === secondaryCables[0] ? "bottom" : "left";
    }
    pushUnique(
      seeds,
      seen,
      buildFromSideMap(cableKeys, domTop, width, (_side, cables) =>
        medianSortStacks(intent, cables),
      ),
      constraints,
    );

    const domBottom: Record<string, LayoutSide> = { ...domTop };
    if (!constraints.lockedCableSides[dominant.cableA]) {
      domBottom[dominant.cableA] = "bottom";
    }
    for (const sec of secondaryCables.slice(0, 2)) {
      domBottom[sec] = sec === secondaryCables[0] ? "top" : "right";
    }
    pushUnique(
      seeds,
      seen,
      buildFromSideMap(cableKeys, domBottom, width, (_side, cables) =>
        medianSortStacks(intent, cables),
      ),
      constraints,
    );
  }

  for (const group of intent.bundleGroups.slice(0, 2)) {
    if (group.cables.length < 2) continue;
    const bundleMap: Record<string, LayoutSide> = {};
    for (const cable of cableKeys) {
      bundleMap[cable] = constraints.lockedCableSides[cable] ?? "left";
    }
    const [first, second] = group.cables;
    if (first && !constraints.lockedCableSides[first]) bundleMap[first] = "top";
    if (second && !constraints.lockedCableSides[second]) {
      bundleMap[second] = "bottom";
    }
    pushUnique(seeds, seen, buildFromSideMap(cableKeys, bundleMap, width), constraints);
  }

  for (const cable of intent.topBottomReliefCandidates.slice(0, 2)) {
    if (constraints.lockedCableSides[cable]) continue;
    for (const widthStep of layoutWidths.slice(0, 2)) {
      const reliefMap: Record<string, LayoutSide> = {};
      for (const key of cableKeys) {
        reliefMap[key] = constraints.lockedCableSides[key] ?? "left";
      }
      reliefMap[cable] = "top";
      pushUnique(
        seeds,
        seen,
        buildFromSideMap(cableKeys, reliefMap, widthStep),
        constraints,
      );
      const reliefBottom = { ...reliefMap, [cable]: "bottom" as LayoutSide };
      pushUnique(
        seeds,
        seen,
        buildFromSideMap(cableKeys, reliefBottom, widthStep),
        constraints,
      );
    }
  }

  if (cableKeys.length >= 3) {
    const reversed = buildFromSideMap(
      cableKeys,
      Object.fromEntries(
        cableKeys.map((cable, index) => [
          cable,
          constraints.lockedCableSides[cable] ??
            (["right", "left", "bottom", "top"] as LayoutSide[])[index % 4]!,
        ]),
      ),
      width,
      (_side, cables) => medianSortStacks(intent, [...cables].reverse()),
    );
    pushUnique(seeds, seen, reversed, constraints);
  }

  return seeds.slice(0, 36);
}
