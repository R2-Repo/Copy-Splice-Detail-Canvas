import type { ConnectionGraph } from "@/types/splice";

import {
  adaptiveMaxRounds,
  cableKeysFromGraph,
  INFEASIBLE_LAYOUT_SCORE,
  pickBestPassingFinalist,
  seedFromReportKey,
  type LayoutSearchConfig,
} from "./layoutSearch";
import { layoutSearchViaWorker } from "./layoutSearchClient";
import type { LayoutCandidate, LayoutSide } from "./layoutCandidate";
import { analyzeTopology } from "./topology/analyzeTopology";
import type { LayoutSearchProgress } from "./layoutSearchTypes";

export type SideDragReoptimizeOptions = {
  seed?: number;
  timeBudgetMs?: number;
  maxRounds?: number;
  onProgress?: (progress: LayoutSearchProgress) => void;
  shouldCancel?: () => boolean;
  reportKey?: string;
};

/** Reduced search budget for post-drag side re-optimize (~1–3s on SP-class CSVs). */
export function sideDragReoptimizeBudget(strandCount: number): {
  maxRounds: number;
  timeBudgetMs: number;
} {
  return {
    maxRounds: Math.min(512, Math.max(256, 64 + strandCount * 24)),
    timeBudgetMs: Math.min(5000, Math.max(2000, 1500 + strandCount * 250)),
  };
}

/**
 * Constrained layout re-search after cable side drag — co-tunes partner sides,
 * stack order, and width while honoring user-locked cable sides.
 */
export async function reoptimizeAfterSideDrag(
  graph: ConnectionGraph,
  seedCandidate: LayoutCandidate,
  lockedSides: Record<string, LayoutSide>,
  options: SideDragReoptimizeOptions = {},
): Promise<LayoutCandidate | null> {
  const strandCount = graph.connections.length;
  const cableCount = cableKeysFromGraph(graph).length;
  const budget = sideDragReoptimizeBudget(strandCount);
  const maxRounds = options.maxRounds ?? budget.maxRounds;
  const timeBudgetMs = options.timeBudgetMs ?? budget.timeBudgetMs;

  const topology = analyzeTopology(graph);
  const mergedLocks = {
    ...topology.constraints.lockedCableSides,
    ...lockedSides,
  };
  const evaluationBudget = adaptiveMaxRounds(
    { ...topology.constraints, lockedCableSides: mergedLocks },
    maxRounds,
  );

  const searchConfig: LayoutSearchConfig = {
    seed:
      options.seed ??
      (options.reportKey ? seedFromReportKey(options.reportKey) : undefined),
    maxRounds,
    timeBudgetMs,
    searchProfile: "background",
    seedCandidate,
    lockedCableSides: lockedSides,
    onProgress: options.onProgress,
    shouldCancel: options.shouldCancel,
  };

  try {
    const result = await layoutSearchViaWorker(
      graph,
      searchConfig,
      {
        strandCount,
        cableCount,
        evaluationBudget,
      },
    );

    const finalist = pickBestPassingFinalist(result.finalists ?? []);
    if (finalist) return finalist.candidate;
    if (result.bestScore < INFEASIBLE_LAYOUT_SCORE) return result.best;
    return result.best;
  } catch {
    return null;
  }
}
