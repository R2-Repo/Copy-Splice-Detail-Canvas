/**
 * Optional localhost deep-search via Python sidecar (dev only).
 * Default import path uses the in-browser worker — unchanged unless wired explicitly.
 */
import type { ConnectionGraph } from "@/types/splice";

import type { LayoutSearchResult } from "./layoutSearch";
import type {
  LayoutSearchProgress,
  SerializableLayoutSearchConfig,
} from "./layoutSearchTypes";

const DEFAULT_DEEP_SEARCH_URL = "http://127.0.0.1:18780";

function deepSearchUrl(): string {
  const env =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_DEEP_SEARCH_URL
      : undefined;
  return typeof env === "string" && env.trim() ? env.trim() : DEFAULT_DEEP_SEARCH_URL;
}

export type DeepSearchClientConfig = SerializableLayoutSearchConfig & {
  strategy?: "evolutionary" | "python_beam" | "hybrid" | "incumbent";
  populationSize?: number;
  maxGenerations?: number;
  t0Max?: number;
  t1Max?: number;
  t2Max?: number;
  /** When set, sidecar loads CSV from repo path instead of inline graph. */
  csvPath?: string;
};

export async function isDeepSearchAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${deepSearchUrl()}/health`, { method: "GET" });
    if (!res.ok) return false;
    const body = (await res.json()) as { ok?: boolean };
    return body.ok === true;
  } catch {
    return false;
  }
}

export async function runDeepSearch(
  graph: ConnectionGraph,
  config: DeepSearchClientConfig,
  onProgress?: (progress: LayoutSearchProgress) => void,
): Promise<LayoutSearchResult | null> {
  const available = await isDeepSearchAvailable();
  if (!available) return null;

  try {
    const res = await fetch(`${deepSearchUrl()}/deep-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: String(Date.now()),
        csvPath: config.csvPath,
        graph: config.csvPath ? undefined : graph,
        config: {
          strategy: config.strategy ?? "evolutionary",
          timeBudgetMs: config.timeBudgetMs,
          maxGenerations: config.maxGenerations,
          populationSize: config.populationSize,
          seed: config.seed,
          t0Max: config.t0Max,
          t1Max: config.t1Max,
          t2Max: config.t2Max,
        },
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      type?: string;
      result?: {
        best?: { candidate?: unknown; evaluation?: unknown };
        bestScore?: number;
        incumbent?: { best?: unknown; bestScore?: number };
      };
    };
    if (body.type !== "done" || !body.result) return null;

    onProgress?.({
      phase: "finalizing",
      round: config.maxGenerations ?? 0,
      evaluations: 0,
      evaluationBudget: 0,
      bestScore: body.result.bestScore ?? Number.MAX_SAFE_INTEGER,
      feasible: body.result.bestScore != null,
      elapsedMs: 0,
      strandCount: 0,
      cableCount: 0,
    });

    const incumbentBest = body.result.incumbent?.best;
    const pythonBest = body.result.best?.candidate;
    if (!pythonBest && !incumbentBest) return null;

    return {
      best: (pythonBest ?? incumbentBest) as LayoutSearchResult["best"],
      evaluations: 0,
      bestScore: body.result.bestScore ?? Number.MAX_SAFE_INTEGER,
      diagnostics: undefined,
    };
  } catch {
    return null;
  }
}
