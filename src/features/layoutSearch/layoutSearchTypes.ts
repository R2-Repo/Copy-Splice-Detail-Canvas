import type { ConnectionGraph } from "@/types/splice";

import type { LayoutSearchResult } from "./layoutSearch";

export type LayoutSearchPhase =
  | "parsing"
  | "analyzing"
  | "heuristic_paint"
  | "optimizing"
  | "finalizing";

export type LayoutSearchProgress = {
  phase: LayoutSearchPhase;
  round: number;
  evaluations: number;
  evaluationBudget: number;
  bestScore: number;
  feasible: boolean;
  elapsedMs: number;
  evalsPerSecond?: number;
  strandCount: number;
  cableCount: number;
  lockedCableCount?: number;
  currentTier?: "T0" | "T1" | "T2";
  message?: string;
};

/** Config fields safe to structured-clone into a worker. */
export type SerializableLayoutSearchConfig = {
  maxRounds?: number;
  seed?: number;
  timeBudgetMs?: number;
  bruteForceMaxCables?: number;
  debug?: boolean;
  restartInterval?: number;
  plateauRounds?: number;
  debugTopN?: number;
};

export type LayoutSearchWorkerRequest =
  | {
      type: "start";
      id: number;
      graph: ConnectionGraph;
      config: SerializableLayoutSearchConfig;
      meta: {
        strandCount: number;
        cableCount: number;
        evaluationBudget: number;
      };
    }
  | { type: "cancel"; id: number };

export type LayoutSearchWorkerResponse =
  | { type: "progress"; id: number; progress: LayoutSearchProgress }
  | { type: "done"; id: number; result: LayoutSearchResult }
  | { type: "error"; id: number; message: string };
