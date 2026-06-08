import type { CsvColumnRole, FiberEndpoint, SplicePair } from "@/types/splice";

import {
  pickBestSideAssignment,
  mirrorSideAssignment,
  scoreCableSideAssignment,
  compareSideAssignments,
} from "@/features/diagram/layoutScoring";

export type SectionColumnCounts = { from: number; to: number };

/** From/To appearance counts per cable in Left --- vs Right --- sections. */
export type CableAppearanceSummary = {
  /** Remote Bentley device — diagnostic only; not used for leg identity. */
  device: string;
  cable: string;
  left: SectionColumnCounts;
  right: SectionColumnCounts;
};

/** Physical cable at this splice — Bentley name only (device ignored). */
export function cableNameKey(cable: string): string {
  return cable.trim();
}

const emptyCounts = (): SectionColumnCounts => ({ from: 0, to: 0 });

export function recordCableAppearance(
  map: Map<string, CableAppearanceSummary>,
  ep: FiberEndpoint,
  column: CsvColumnRole,
  section: "left" | "right",
): void {
  const key = cableNameKey(ep.cable);
  const entry = map.get(key) ?? {
    device: "",
    cable: ep.cable,
    left: emptyCounts(),
    right: emptyCounts(),
  };
  entry[section][column] += 1;
  map.set(key, entry);
}

const MAX_EXHAUSTIVE_CABLES = 14;

function cloneSideMap(
  sides: Map<string, "left" | "right">,
): Map<string, "left" | "right"> {
  return new Map(sides);
}

function fiberCountForCable(pairs: SplicePair[], cable: string): number {
  let count = 0;
  for (const pair of pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      if (cableNameKey(ep.cable) === cableNameKey(cable)) count += 1;
    }
  }
  return count;
}

function biggestCableFirstSides(
  cables: string[],
  base: Map<string, "left" | "right">,
  pairs: SplicePair[],
): Map<string, "left" | "right"> {
  const sorted = [...cables].sort(
    (a, b) => fiberCountForCable(pairs, b) - fiberCountForCable(pairs, a),
  );
  const sides = cloneSideMap(base);
  sorted.forEach((cable, index) => {
    sides.set(cable, index % 2 === 0 ? "left" : "right");
  });
  return sides;
}

function pickBestSideFromCandidates(
  seeds: Map<string, "left" | "right">[],
  pairs: SplicePair[],
): Map<string, "left" | "right"> {
  const candidates: Map<string, "left" | "right">[] = [];
  const seen = new Set<string>();
  const add = (map: Map<string, "left" | "right">) => {
    const key = [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join("|");
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push(map);
  };

  for (const seed of seeds) {
    add(cloneSideMap(seed));
    add(mirrorSideAssignment(seed));
    const cables = [...seed.keys()].sort((a, b) => a.localeCompare(b));
    add(biggestCableFirstSides(cables, seed, pairs));
  }

  return pickBestSideAssignment(candidates, pairs);
}

/**
 * One canvas side per physical cable for node placement.
 * Minimizes same-side pairs (hard-prefer zero) then crossings; tie-breaks with From→left preference.
 */
export function computeCableCanvasSides(
  pairs: SplicePair[],
): Map<string, "left" | "right"> {
  const counts = new Map<string, { from: number; to: number }>();

  for (const pair of pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      const key = cableNameKey(ep.cable);
      const tally = counts.get(key) ?? { from: 0, to: 0 };
      tally[ep.csvColumn] += 1;
      counts.set(key, tally);
    }
  }

  const cables = [...counts.keys()].sort((a, b) => a.localeCompare(b));

  function preferredSide(cable: string): "left" | "right" {
    const tally = counts.get(cableNameKey(cable)) ?? { from: 0, to: 0 };
    return tally.from >= tally.to ? "left" : "right";
  }

  if (cables.length === 0) return new Map();

  if (cables.length <= MAX_EXHAUSTIVE_CABLES) {
    let bestScored: ReturnType<typeof scoreCableSideAssignment> | null = null;
    let tied: Map<string, "left" | "right">[] = [];

    for (let mask = 0; mask < 1 << cables.length; mask++) {
      const sides = new Map<string, "left" | "right">();
      cables.forEach((cable, index) => {
        sides.set(cable, (mask >> index) & 1 ? "right" : "left");
      });
      const scored = scoreCableSideAssignment(pairs, sides);
      if (
        !bestScored ||
        compareSideAssignments(scored, bestScored) < 0
      ) {
        bestScored = scored;
        tied = [new Map(sides)];
      } else if (bestScored && compareSideAssignments(scored, bestScored) === 0) {
        tied.push(new Map(sides));
      }
    }
    return tied.length === 1 ? tied[0]! : pickBestSideFromCandidates(tied, pairs);
  }

  const sides = new Map<string, "left" | "right">();
  for (const cable of cables) {
    sides.set(cable, preferredSide(cable));
  }
  return pickBestSideFromCandidates([sides], pairs);
}

/**
 * Bentley often reuses the same cable name for in/out legs at a mid-span case.
 * Mirror pattern: appears as To in Left --- and From in Right --- only → two legs.
 * Drop pattern: From in Left --- and To in Right --- only → one leg on the left.
 */
export function csvColumnsForCable(counts: {
  left: { from: number; to: number };
  right: { from: number; to: number };
}): CsvColumnRole[] {
  const leftFrom = counts.left.from > 0;
  const leftTo = counts.left.to > 0;
  const rightFrom = counts.right.from > 0;
  const rightTo = counts.right.to > 0;

  if (leftTo && !leftFrom && rightFrom && !rightTo) {
    return ["from", "to"];
  }
  if (leftFrom && !leftTo && rightTo && !rightFrom) {
    return ["from"];
  }
  if (leftFrom && leftTo) {
    return ["from", "to"];
  }
  if (leftFrom) return ["from"];
  if (leftTo) return ["to"];
  if (rightFrom) return ["from"];
  if (rightTo) return ["to"];
  return [];
}

export function diagramSideForCsvColumn(
  column: CsvColumnRole,
): "left" | "right" {
  return column === "from" ? "left" : "right";
}
