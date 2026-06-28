import {
  DEFAULT_LAYOUT_EXPANSION,
  layoutExpansionForIteration,
} from "@/features/diagram/layoutExpansion";
import {
  minLayoutWidthForGraph,
  reportStorageKey,
} from "@/features/diagram/layoutSpliceDiagram";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph } from "@/types/splice";

import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";

import {
  ALL_LAYOUT_SIDES,
  candidateStableId,
  compareCandidates,
  defaultLayoutWidth,
  heuristicBaselineCandidate,
  reconcileStackOrder,
  type LayoutCandidate,
  type LayoutSide,
} from "./layoutCandidate";
import type { LayoutSearchProgress } from "./layoutSearchTypes";
import { analyzeTopology } from "./topology/analyzeTopology";
import {
  applyConstraintLocks,
  candidateViolatesForbiddenPairs,
} from "./topology/deriveConstraints";
import type { TopologyConstraints } from "./topology/topologyTypes";
import {
  evaluateCandidateTiered,
  type EvalTier,
} from "./tieredEvaluate";

export type { LayoutSearchPhase, LayoutSearchProgress } from "./layoutSearchTypes";

export type LayoutSearchConfig = {
  /** Candidate evaluations after round 0 (default 2000). */
  maxRounds?: number;
  /** Deterministic RNG seed; defaults to hash of `reportStorageKey(graph)`. */
  seed?: number;
  /** Optional wall-clock cap; returns best-so-far when exceeded. */
  timeBudgetMs?: number;
  /** Full enumeration when cable count ≤ this (default 8). */
  bruteForceMaxCables?: number;
  /** Log top-N candidates to console (also enabled via `VITE_DEBUG_LAYOUT_SEARCH=1`). */
  debug?: boolean;
  /** Random-restart interval for guided search (default 64). */
  restartInterval?: number;
  /**
   * Early exit when best is feasible and score has not improved for this many
   * consecutive rounds (default 128). Set 0 to disable plateau exit.
   */
  plateauRounds?: number;
  /** Dev logging: how many top candidates to print (default 5). */
  debugTopN?: number;
  /** Import UI — called after each search round with best-so-far. */
  onProgress?: (progress: LayoutSearchProgress) => void;
  /** Import UI — when true, stop search and return best-so-far. */
  shouldCancel?: () => boolean;
  /** Skip topology locks (perf A/B tests). */
  disableTopologyConstraints?: boolean;
  /** Always run full T2 eval (perf A/B tests). */
  disableTieredEval?: boolean;
};

export type LayoutSearchResult = {
  best: LayoutCandidate;
  evaluations: number;
  bestScore: number;
};

const DEFAULT_MAX_ROUNDS = 2000;
export { DEFAULT_MAX_ROUNDS };
const HEARTBEAT_MS = 50;
const DEFAULT_BRUTE_FORCE_MAX_CABLES = 8;
const DEFAULT_RESTART_INTERVAL = 64;
/** Plateau threshold — documented in ROUTING_FIRST_LAYOUT.md Phase 2 gate. */
const DEFAULT_PLATEAU_ROUNDS = 128;
const DEFAULT_DEBUG_TOP_N = 5;
const NARROW_WIDTH = 1200;
const MAX_EXPANSION_ITERATION = 8;
/** Skip brute force when estimated enumeration exceeds this (n≥5 factorial growth). */
const BRUTE_FORCE_CANDIDATE_CAP = 20_000;
export const INFEASIBLE_LAYOUT_SCORE = Number.MAX_SAFE_INTEGER;

function scoreFeasible(score: number): boolean {
  return score < INFEASIBLE_LAYOUT_SCORE;
}

type ProgressTrackerState = {
  startMs: number;
  lastEmitMs: number;
  lastEmittedEvaluations: number;
  evaluationBudget: number;
  strandCount: number;
  cableCount: number;
  lockedCableCount: number;
  currentTier?: EvalTier;
};

function createProgressTracker(
  config: LayoutSearchConfig,
  state: ProgressTrackerState,
): (progress: Pick<
  LayoutSearchProgress,
  "round" | "evaluations" | "bestScore" | "feasible" | "currentTier"
>) => void {
  return (partial) => {
    if (!config.onProgress) return;

    const now = performance.now();
    const elapsedMs = now - state.startMs;
    const evalAdvanced = partial.evaluations !== state.lastEmittedEvaluations;
    if (partial.currentTier) state.currentTier = partial.currentTier;
    const shouldEmit =
      partial.evaluations === 1 ||
      (evalAdvanced && now - state.lastEmitMs >= HEARTBEAT_MS) ||
      now - state.lastEmitMs >= HEARTBEAT_MS;

    if (!shouldEmit) return;

    state.lastEmitMs = now;
    state.lastEmittedEvaluations = partial.evaluations;

    const evalsPerSecond =
      elapsedMs > 0
        ? Math.round((partial.evaluations / elapsedMs) * 1000)
        : undefined;

    config.onProgress({
      phase: "optimizing",
      round: partial.round,
      evaluations: partial.evaluations,
      evaluationBudget: state.evaluationBudget,
      bestScore: partial.bestScore,
      feasible: partial.feasible,
      elapsedMs: Math.round(elapsedMs),
      evalsPerSecond,
      strandCount: state.strandCount,
      cableCount: state.cableCount,
      lockedCableCount: state.lockedCableCount,
      currentTier: state.currentTier,
    });
  };
}

/** FNV-1a 32-bit hash for deterministic seeds from report keys. */
export function seedFromReportKey(reportKey: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < reportKey.length; i++) {
    hash ^= reportKey.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Mulberry32 PRNG — deterministic for a fixed seed. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function cableKeysFromGraph(graph: ConnectionGraph): string[] {
  return [...new Set(graph.legs.map((leg) => cableNameKey(leg.cable)))].sort(
    (a, b) => a.localeCompare(b),
  );
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const perm of permutations(rest)) {
      out.push([items[i]!, ...perm]);
    }
  }
  return out;
}

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

export function widthStepsForGraph(graph: ConnectionGraph): number[] {
  const minW = Math.ceil(minLayoutWidthForGraph(graph));
  const defaultW = defaultLayoutWidth();
  const steps = new Set<number>([minW, defaultW, NARROW_WIDTH]);
  return [...steps].sort((a, b) => a - b);
}

export function expansionIterations(): number[] {
  return Array.from({ length: MAX_EXPANSION_ITERATION + 1 }, (_, i) => i);
}

/** n! × 4^n side/stack combinations (upper bound for brute-force sizing). */
export function estimateBruteForceCandidateCount(cableCount: number): number {
  let factorial = 1;
  for (let i = 2; i <= cableCount; i++) factorial *= i;
  return factorial * 4 ** cableCount;
}

function expansionItersForBrute(cableCount: number): number[] {
  // 4-side enumeration grows quickly — keep brute-force expansion steps minimal.
  if (cableCount <= 2) return [0, 1, 2];
  return [0];
}

function shouldUseBruteForce(
  cableCount: number,
  bruteForceMaxCables: number,
  widths: number[],
  expansionIters: number[],
): boolean {
  if (cableCount > bruteForceMaxCables) return false;
  const estimated =
    estimateBruteForceCandidateCount(cableCount) *
    widths.length *
    expansionIters.length;
  return estimated <= BRUTE_FORCE_CANDIDATE_CAP;
}

/** Full enumeration for tiny splices (test oracle + brute-force path). */
export function enumerateCandidates(
  cableKeys: string[],
  layoutWidths: number[],
  expansionIters: number[] = [0],
  constraints?: TopologyConstraints,
): LayoutCandidate[] {
  const n = cableKeys.length;
  const candidates: LayoutCandidate[] = [];

  for (const layoutWidth of layoutWidths) {
    for (const expIter of expansionIters) {
      const layoutExpansion =
        expIter <= 0
          ? DEFAULT_LAYOUT_EXPANSION
          : layoutExpansionForIteration(expIter);

      for (let encoding = 0; encoding < 4 ** n; encoding++) {
        const sideKeys: Record<LayoutSide, string[]> = {
          left: [],
          right: [],
          top: [],
          bottom: [],
        };
        const cableSides: Record<string, LayoutSide> = {};
        let violatesLock = false;

        cableKeys.forEach((cable, index) => {
          const side = ALL_LAYOUT_SIDES[
            Math.floor(encoding / 4 ** index) % 4
          ]!;
          const locked = constraints?.lockedCableSides[cable];
          if (locked && locked !== side) {
            violatesLock = true;
          }
          cableSides[cable] = locked ?? side;
          sideKeys[locked ?? side].push(cable);
        });

        if (violatesLock) continue;
        if (
          constraints &&
          candidateViolatesForbiddenPairs(
            { cableSides, stackOrder: sideKeys, layoutWidth, layoutExpansion },
            constraints,
          )
        ) {
          continue;
        }

        const sidePerms = (keys: string[]) =>
          keys.length > 0 ? permutations(keys) : [[]];

        const leftPerms = sidePerms(sideKeys.left);
        const rightPerms = sidePerms(sideKeys.right);
        const topPerms = sidePerms(sideKeys.top);
        const bottomPerms = sidePerms(sideKeys.bottom);

        for (const left of leftPerms) {
          for (const right of rightPerms) {
            for (const top of topPerms) {
              for (const bottom of bottomPerms) {
                candidates.push(
                  normalizeCandidate({
                    cableSides,
                    stackOrder: { left, right, top, bottom },
                    layoutWidth,
                    layoutExpansion,
                  }),
                );
              }
            }
          }
        }
      }
    }
  }

  return candidates;
}

type RankedCandidate = {
  candidate: LayoutCandidate;
  score: number;
};

function debugEnabled(config: LayoutSearchConfig): boolean {
  return (
    config.debug === true ||
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_DEBUG_LAYOUT_SEARCH === "1")
  );
}

function logTopCandidates(
  ranked: RankedCandidate[],
  topN: number,
  evaluations: number,
): void {
  const sorted = [...ranked].sort((a, b) =>
    compareCandidates(
      { score: a.score, candidate: a.candidate },
      { score: b.score, candidate: b.candidate },
    ),
  );
  const slice = sorted.slice(0, topN);
  console.info(
    `[layoutSearch] evaluations=${evaluations} top-${topN}:`,
    slice.map((r) => ({
      id: r.candidate.id,
      score: r.score,
      width: r.candidate.layoutWidth,
    })),
  );
}

function tryImproveBest(
  best: RankedCandidate,
  candidate: LayoutCandidate,
  score: number,
): RankedCandidate {
  const next = { candidate, score };
  if (
    compareCandidates(
      { score: next.score, candidate: next.candidate },
      { score: best.score, candidate: best.candidate },
    ) < 0
  ) {
    return next;
  }
  return best;
}

function evaluateCandidate(
  graph: ConnectionGraph,
  candidate: LayoutCandidate,
  constraints: TopologyConstraints,
  bestScore: number,
  tieredEvalEnabled: boolean,
  evalCache?: {
    visualCables: ReturnType<typeof buildVisualCablesForLayout>["visualCables"];
    rowIndex: Map<string, number>;
    dominant: ReturnType<typeof buildVisualCablesForLayout>["dominant"];
  },
): { score: number; feasible: boolean; tier: EvalTier } {
  const result = evaluateCandidateTiered(
    graph,
    candidate,
    {
      constraints,
      bestScore,
      tieredEvalEnabled,
    },
    evalCache,
  );
  return { score: result.score, feasible: result.feasible, tier: result.tier };
}

function removeFromAllStacks(
  stacks: Record<LayoutSide, string[]>,
  cable: string,
): Record<LayoutSide, string[]> {
  const next = { ...stacks };
  for (const side of ALL_LAYOUT_SIDES) {
    next[side] = stacks[side].filter((c) => c !== cable);
  }
  return next;
}

function mutateFlipSide(
  candidate: LayoutCandidate,
  cable: string,
  nextSide: LayoutSide,
): LayoutCandidate {
  const stacks = removeFromAllStacks(candidate.stackOrder, cable);
  stacks[nextSide] = [...stacks[nextSide], cable];

  return normalizeCandidate({
    ...candidate,
    cableSides: { ...candidate.cableSides, [cable]: nextSide },
    stackOrder: stacks,
  });
}

function mutateSwapNeighbors(
  candidate: LayoutCandidate,
  side: LayoutSide,
  index: number,
): LayoutCandidate | null {
  const stack = [...candidate.stackOrder[side]];
  if (index < 0 || index >= stack.length - 1) return null;
  [stack[index], stack[index + 1]] = [stack[index + 1]!, stack[index]!];
  return normalizeCandidate({
    ...candidate,
    stackOrder: {
      ...candidate.stackOrder,
      [side]: stack,
    },
  });
}

function mutateWidth(
  candidate: LayoutCandidate,
  widths: number[],
  delta: number,
): LayoutCandidate {
  const idx = widths.indexOf(candidate.layoutWidth);
  const base = idx >= 0 ? idx : 0;
  const nextIdx = Math.max(0, Math.min(widths.length - 1, base + delta));
  return normalizeCandidate({
    ...candidate,
    layoutWidth: widths[nextIdx]!,
  });
}

function expansionIndex(
  candidate: LayoutCandidate,
  iterations: number[],
): number {
  for (let i = 0; i < iterations.length; i++) {
    const exp =
      iterations[i]! <= 0
        ? DEFAULT_LAYOUT_EXPANSION
        : layoutExpansionForIteration(iterations[i]!);
    if (
      exp.centerGapPadding === candidate.layoutExpansion.centerGapPadding &&
      exp.cableGapExtra === candidate.layoutExpansion.cableGapExtra &&
      exp.tubeGroupGapExtra === candidate.layoutExpansion.tubeGroupGapExtra
    ) {
      return i;
    }
  }
  return 0;
}

function mutateExpansion(
  candidate: LayoutCandidate,
  iterations: number[],
  delta: number,
): LayoutCandidate {
  const base = expansionIndex(candidate, iterations);
  const nextIdx = Math.max(0, Math.min(iterations.length - 1, base + delta));
  const iter = iterations[nextIdx]!;
  return normalizeCandidate({
    ...candidate,
    layoutExpansion:
      iter <= 0 ? DEFAULT_LAYOUT_EXPANSION : layoutExpansionForIteration(iter),
  });
}

function randomCandidate(
  rng: () => number,
  cableKeys: string[],
  widths: number[],
  expansionIters: number[],
  constraints?: TopologyConstraints,
): LayoutCandidate {
  const sideKeys: Record<LayoutSide, string[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  const cableSides: Record<string, LayoutSide> = {};

  for (const cable of cableKeys) {
    const locked = constraints?.lockedCableSides[cable];
    if (locked) {
      cableSides[cable] = locked;
      sideKeys[locked].push(cable);
      continue;
    }
    const side =
      ALL_LAYOUT_SIDES[Math.floor(rng() * ALL_LAYOUT_SIDES.length)]!;
    cableSides[cable] = side;
    sideKeys[side].push(cable);
  }

  const shuffle = (arr: string[]) => {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  };

  const width = widths[Math.floor(rng() * widths.length)]!;
  const expIter =
    expansionIters[Math.floor(rng() * expansionIters.length)] ?? 0;

  return normalizeCandidate({
    cableSides,
    stackOrder: {
      left: shuffle(sideKeys.left),
      right: shuffle(sideKeys.right),
      top: shuffle(sideKeys.top),
      bottom: shuffle(sideKeys.bottom),
    },
    layoutWidth: width,
    layoutExpansion:
      expIter <= 0
        ? DEFAULT_LAYOUT_EXPANSION
        : layoutExpansionForIteration(expIter),
  });
}

type Mutation =
  | { kind: "flip"; cable: string; nextSide: LayoutSide }
  | { kind: "swap"; side: LayoutSide; index: number }
  | { kind: "width"; delta: -1 | 1 }
  | { kind: "expansion"; delta: -1 | 1 };

function pickMutation(
  rng: () => number,
  cableKeys: string[],
  candidate: LayoutCandidate,
  constraints?: TopologyConstraints,
): Mutation {
  const flippable =
    constraints && constraints.searchableCables.length > 0
      ? constraints.searchableCables
      : cableKeys.filter((c) => !constraints?.lockedCableSides[c]);

  const roll = rng();
  if (roll < 0.4 && flippable.length > 0) {
    const cable = flippable[Math.floor(rng() * flippable.length)]!;
    const current = candidate.cableSides[cable] ?? "left";
    const alternatives = ALL_LAYOUT_SIDES.filter((s) => s !== current);
    const nextSide =
      alternatives[Math.floor(rng() * alternatives.length)] ?? "left";
    return { kind: "flip", cable, nextSide };
  }
  if (roll < 0.65) {
    const swappable = ALL_LAYOUT_SIDES.filter(
      (side) => candidate.stackOrder[side].length > 1,
    );
    if (swappable.length > 0) {
      const side =
        swappable[Math.floor(rng() * swappable.length)] ?? "left";
      const stack = candidate.stackOrder[side];
      const index = Math.floor(rng() * (stack.length - 1));
      return { kind: "swap", side, index };
    }
  }
  if (roll < 0.82) {
    return { kind: "width", delta: rng() < 0.5 ? -1 : 1 };
  }
  return { kind: "expansion", delta: rng() < 0.5 ? -1 : 1 };
}

function applyMutation(
  candidate: LayoutCandidate,
  mutation: Mutation,
  widths: number[],
  expansionIters: number[],
): LayoutCandidate {
  switch (mutation.kind) {
    case "flip":
      return mutateFlipSide(candidate, mutation.cable, mutation.nextSide);
    case "swap": {
      const swapped = mutateSwapNeighbors(
        candidate,
        mutation.side,
        mutation.index,
      );
      return swapped ?? candidate;
    }
    case "width":
      return mutateWidth(candidate, widths, mutation.delta);
    case "expansion":
      return mutateExpansion(candidate, expansionIters, mutation.delta);
  }
}

function timeExceeded(startMs: number, budgetMs?: number): boolean {
  return budgetMs !== undefined && performance.now() - startMs >= budgetMs;
}

function runBruteForce(
  graph: ConnectionGraph,
  cableKeys: string[],
  widths: number[],
  expansionIters: number[],
  seedBest: RankedCandidate,
  startMs: number,
  timeBudgetMs: number | undefined,
  config: LayoutSearchConfig,
  constraints: TopologyConstraints,
  tieredEvalEnabled: boolean,
  evalCache: {
    visualCables: ReturnType<typeof buildVisualCablesForLayout>["visualCables"];
    rowIndex: Map<string, number>;
    dominant: ReturnType<typeof buildVisualCablesForLayout>["dominant"];
  },
  emitProgress: ReturnType<typeof createProgressTracker>,
): { best: RankedCandidate; evaluations: number; seen: RankedCandidate[] } {
  const candidates = enumerateCandidates(
    cableKeys,
    widths,
    expansionIters,
    constraints,
  );
  let best = seedBest;
  let evaluations = 1;
  const seen: RankedCandidate[] = [{ ...seedBest }];

  for (const candidate of candidates) {
    if (timeExceeded(startMs, timeBudgetMs) || config.shouldCancel?.()) break;
    const { score, tier } = evaluateCandidate(
      graph,
      candidate,
      constraints,
      best.score,
      tieredEvalEnabled,
      evalCache,
    );
    evaluations += 1;
    const ranked = { candidate, score };
    seen.push(ranked);
    best = tryImproveBest(best, candidate, score);
    emitProgress({
      round: evaluations - 1,
      evaluations,
      bestScore: best.score,
      feasible: scoreFeasible(best.score),
      currentTier: tier,
    });
  }

  return { best, evaluations, seen };
}

function runGuidedSearch(
  graph: ConnectionGraph,
  cableKeys: string[],
  widths: number[],
  expansionIters: number[],
  seedBest: RankedCandidate,
  rng: () => number,
  maxRounds: number,
  restartInterval: number,
  plateauRounds: number,
  startMs: number,
  timeBudgetMs: number | undefined,
  config: LayoutSearchConfig,
  constraints: TopologyConstraints,
  tieredEvalEnabled: boolean,
  evalCache: {
    visualCables: ReturnType<typeof buildVisualCablesForLayout>["visualCables"];
    rowIndex: Map<string, number>;
    dominant: ReturnType<typeof buildVisualCablesForLayout>["dominant"];
  },
  emitProgress: ReturnType<typeof createProgressTracker>,
): { best: RankedCandidate; evaluations: number; seen: RankedCandidate[] } {
  let best = seedBest;
  let current = seedBest.candidate;
  let evaluations = 1;
  let roundsWithoutImprovement = 0;
  const seen: RankedCandidate[] = [{ ...seedBest }];

  emitProgress({
    round: 0,
    evaluations,
    bestScore: best.score,
    feasible: scoreFeasible(best.score),
    currentTier: "T2",
  });

  for (let round = 1; round <= maxRounds; round++) {
    if (timeExceeded(startMs, timeBudgetMs) || config.shouldCancel?.()) break;

    let trial: LayoutCandidate;
    if (restartInterval > 0 && round % restartInterval === 0) {
      trial = randomCandidate(
        rng,
        cableKeys,
        widths,
        expansionIters,
        constraints,
      );
    } else {
      const mutation = pickMutation(rng, cableKeys, current, constraints);
      trial = applyMutation(current, mutation, widths, expansionIters);
    }

    trial = applyConstraintLocks(trial, constraints);

    const { score, tier } = evaluateCandidate(
      graph,
      trial,
      constraints,
      best.score,
      tieredEvalEnabled,
      evalCache,
    );
    evaluations += 1;
    seen.push({ candidate: trial, score });

    const prevBest = best;
    best = tryImproveBest(best, trial, score);

    if (
      compareCandidates(
        { score: best.score, candidate: best.candidate },
        { score: prevBest.score, candidate: prevBest.candidate },
      ) < 0
    ) {
      roundsWithoutImprovement = 0;
      current = best.candidate;
    } else {
      roundsWithoutImprovement += 1;
      current = best.candidate;
    }

    emitProgress({
      round,
      evaluations,
      bestScore: best.score,
      feasible: scoreFeasible(best.score),
      currentTier: tier,
    });

    const bestFeasible = scoreFeasible(best.score);
    if (
      plateauRounds > 0 &&
      bestFeasible &&
      roundsWithoutImprovement >= plateauRounds
    ) {
      break;
    }
  }

  return { best, evaluations, seen };
}

async function runGuidedSearchAsync(
  graph: ConnectionGraph,
  cableKeys: string[],
  widths: number[],
  expansionIters: number[],
  seedBest: RankedCandidate,
  rng: () => number,
  maxRounds: number,
  restartInterval: number,
  plateauRounds: number,
  startMs: number,
  timeBudgetMs: number | undefined,
  config: LayoutSearchConfig,
  constraints: TopologyConstraints,
  tieredEvalEnabled: boolean,
  evalCache: {
    visualCables: ReturnType<typeof buildVisualCablesForLayout>["visualCables"];
    rowIndex: Map<string, number>;
    dominant: ReturnType<typeof buildVisualCablesForLayout>["dominant"];
  },
  emitProgress: ReturnType<typeof createProgressTracker>,
): Promise<{ best: RankedCandidate; evaluations: number; seen: RankedCandidate[] }> {
  let best = seedBest;
  let current = seedBest.candidate;
  let evaluations = 1;
  let roundsWithoutImprovement = 0;
  const seen: RankedCandidate[] = [{ ...seedBest }];

  emitProgress({
    round: 0,
    evaluations,
    bestScore: best.score,
    feasible: scoreFeasible(best.score),
    currentTier: "T2",
  });

  for (let round = 1; round <= maxRounds; round++) {
    if (timeExceeded(startMs, timeBudgetMs) || config.shouldCancel?.()) break;

    let trial: LayoutCandidate;
    if (restartInterval > 0 && round % restartInterval === 0) {
      trial = randomCandidate(
        rng,
        cableKeys,
        widths,
        expansionIters,
        constraints,
      );
    } else {
      const mutation = pickMutation(rng, cableKeys, current, constraints);
      trial = applyMutation(current, mutation, widths, expansionIters);
    }

    trial = applyConstraintLocks(trial, constraints);

    const { score, tier } = evaluateCandidate(
      graph,
      trial,
      constraints,
      best.score,
      tieredEvalEnabled,
      evalCache,
    );
    evaluations += 1;
    seen.push({ candidate: trial, score });

    const prevBest = best;
    best = tryImproveBest(best, trial, score);

    if (
      compareCandidates(
        { score: best.score, candidate: best.candidate },
        { score: prevBest.score, candidate: prevBest.candidate },
      ) < 0
    ) {
      roundsWithoutImprovement = 0;
      current = best.candidate;
    } else {
      roundsWithoutImprovement += 1;
      current = best.candidate;
    }

    emitProgress({
      round,
      evaluations,
      bestScore: best.score,
      feasible: scoreFeasible(best.score),
      currentTier: tier,
    });

    const bestFeasible = scoreFeasible(best.score);
    if (
      plateauRounds > 0 &&
      bestFeasible &&
      roundsWithoutImprovement >= plateauRounds
    ) {
      break;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  }

  return { best, evaluations, seen };
}

function runLayoutSearchCore(
  graph: ConnectionGraph,
  config: LayoutSearchConfig,
  guidedRunner: typeof runGuidedSearch | typeof runGuidedSearchAsync,
): LayoutSearchResult | Promise<LayoutSearchResult> {
  const maxRounds = config.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const bruteForceMaxCables =
    config.bruteForceMaxCables ?? DEFAULT_BRUTE_FORCE_MAX_CABLES;
  const restartInterval = config.restartInterval ?? DEFAULT_RESTART_INTERVAL;
  const plateauRounds = config.plateauRounds ?? DEFAULT_PLATEAU_ROUNDS;
  const debugTopN = config.debugTopN ?? DEFAULT_DEBUG_TOP_N;
  const seed =
    config.seed ?? seedFromReportKey(reportStorageKey(graph));
  const rng = createRng(seed);
  const startMs = performance.now();

  const topology = analyzeTopology(graph);
  const constraints = config.disableTopologyConstraints
    ? ({
        lockedCableSides: {},
        forbiddenSameSidePairs: [],
        searchableCables: cableKeysFromGraph(graph),
        hubCables: [],
        satelliteCables: cableKeysFromGraph(graph),
        proxyBundleGroups: [],
        lockedCableCount: 0,
      } satisfies TopologyConstraints)
    : topology.constraints;
  const tieredEvalEnabled = config.disableTieredEval !== true;

  const cableKeys = cableKeysFromGraph(graph);
  const widths = widthStepsForGraph(graph);
  const expansionIters = expansionIterations();
  const { visualCables, dominant } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
  const evalCache = { visualCables, rowIndex, dominant };

  const progressState: ProgressTrackerState = {
    startMs,
    lastEmitMs: 0,
    lastEmittedEvaluations: -1,
    evaluationBudget: maxRounds,
    strandCount: graph.connections.length,
    cableCount: cableKeys.length,
    lockedCableCount: constraints.lockedCableCount,
  };
  const emitProgress = createProgressTracker(config, progressState);

  let baseline = normalizeCandidate(
    applyConstraintLocks(heuristicBaselineCandidate(graph), constraints),
  );
  const seedEval = evaluateCandidate(
    graph,
    baseline,
    constraints,
    INFEASIBLE_LAYOUT_SCORE,
    tieredEvalEnabled,
    evalCache,
  );
  let best: RankedCandidate = {
    candidate: baseline,
    score: seedEval.score,
  };
  let evaluations = 1;
  let seen: RankedCandidate[] = [{ ...best }];

  emitProgress({
    round: 0,
    evaluations,
    bestScore: best.score,
    feasible: scoreFeasible(best.score),
    currentTier: seedEval.tier,
  });

  const finalize = (): LayoutSearchResult => {
    if (debugEnabled(config)) {
      logTopCandidates(seen, debugTopN, evaluations);
    }
    return {
      best: best.candidate,
      evaluations,
      bestScore: best.score,
    };
  };

  if (
    shouldUseBruteForce(
      cableKeys.length,
      bruteForceMaxCables,
      widths,
      expansionItersForBrute(cableKeys.length),
    )
  ) {
    const brute = runBruteForce(
      graph,
      cableKeys,
      widths,
      expansionItersForBrute(cableKeys.length),
      best,
      startMs,
      config.timeBudgetMs,
      config,
      constraints,
      tieredEvalEnabled,
      evalCache,
      emitProgress,
    );
    best = brute.best;
    evaluations = brute.evaluations;
    seen = brute.seen;
    return finalize();
  }

  const guidedPromise = guidedRunner(
    graph,
    cableKeys,
    widths,
    expansionIters,
    best,
    rng,
    maxRounds,
    restartInterval,
    plateauRounds,
    startMs,
    config.timeBudgetMs,
    config,
    constraints,
    tieredEvalEnabled,
    evalCache,
    emitProgress,
  );

  if (guidedPromise instanceof Promise) {
    return guidedPromise.then((guided) => {
      best = guided.best;
      evaluations = guided.evaluations;
      seen = guided.seen;
      return finalize();
    });
  }

  best = guidedPromise.best;
  evaluations = guidedPromise.evaluations;
  seen = guidedPromise.seen;
  return finalize();
}

/**
 * Routing-first layout search: seed heuristic baseline, then brute-force (tiny
 * graphs) or guided hill-climb with deterministic restarts.
 */
export function layoutSearch(
  graph: ConnectionGraph,
  config: LayoutSearchConfig = {},
): LayoutSearchResult {
  return runLayoutSearchCore(graph, config, runGuidedSearch) as LayoutSearchResult;
}

/** Async import path — yields between rounds for progress UI + cancel. */
export async function layoutSearchAsync(
  graph: ConnectionGraph,
  config: LayoutSearchConfig = {},
): Promise<LayoutSearchResult> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  return runLayoutSearchCore(
    graph,
    config,
    runGuidedSearchAsync,
  ) as Promise<LayoutSearchResult>;
}
