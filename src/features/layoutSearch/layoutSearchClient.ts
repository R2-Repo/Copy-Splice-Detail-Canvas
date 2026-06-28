import type { ConnectionGraph } from "@/types/splice";

import LayoutSearchWorker from "./layoutSearch.worker?worker";
import {
  layoutSearchAsync,
  type LayoutSearchConfig,
  type LayoutSearchResult,
} from "./layoutSearch";
import type {
  LayoutSearchProgress,
  LayoutSearchWorkerRequest,
  LayoutSearchWorkerResponse,
} from "./layoutSearchTypes";

let nextWorkerId = 1;

const CANCEL_POLL_MS = 50;
/** Extra wall time beyond `timeBudgetMs` before the client terminates the worker. */
const SEARCH_GRACE_MS = 45_000;

function workerAvailable(): boolean {
  return typeof Worker !== "undefined";
}

/**
 * Run layout search off the main thread. Falls back to `layoutSearchAsync` when
 * Workers are unavailable (e.g. some test environments).
 */
export function layoutSearchViaWorker(
  graph: ConnectionGraph,
  config: LayoutSearchConfig,
  meta: {
    strandCount: number;
    cableCount: number;
    evaluationBudget: number;
  },
): Promise<LayoutSearchResult> {
  if (!workerAvailable()) {
    return layoutSearchAsync(graph, config);
  }

  return new Promise((resolve, reject) => {
    const id = nextWorkerId++;
    const worker = new LayoutSearchWorker();
    let settled = false;
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;

    const finish = (handler: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(cancelPoll);
      if (deadlineTimer !== undefined) clearTimeout(deadlineTimer);
      worker.terminate();
      handler();
    };

    const { onProgress, shouldCancel, timeBudgetMs, ...serializableConfig } =
      config;

    const cancelPoll = setInterval(() => {
      if (shouldCancel?.()) {
        const req: LayoutSearchWorkerRequest = { type: "cancel", id };
        worker.postMessage(req);
      }
    }, CANCEL_POLL_MS);

    if (timeBudgetMs !== undefined) {
      deadlineTimer = setTimeout(() => {
        const req: LayoutSearchWorkerRequest = { type: "cancel", id };
        worker.postMessage(req);
        finish(() =>
          reject(
            new Error(
              `Layout search timed out after ${Math.round((timeBudgetMs + SEARCH_GRACE_MS) / 1000)}s`,
            ),
          ),
        );
      }, timeBudgetMs + SEARCH_GRACE_MS);
    }

    worker.onmessage = (event: MessageEvent<LayoutSearchWorkerResponse>) => {
      const msg = event.data;
      if (msg.id !== id) return;

      switch (msg.type) {
        case "progress":
          onProgress?.(msg.progress);
          break;
        case "done":
          finish(() => resolve(msg.result));
          break;
        case "error":
          finish(() => reject(new Error(msg.message)));
          break;
      }
    };

    worker.onerror = (event) => {
      finish(() =>
        reject(event.error ?? new Error("Layout search worker failed")),
      );
    };

    const startReq: LayoutSearchWorkerRequest = {
      type: "start",
      id,
      graph,
      config: serializableConfig,
      meta,
    };
    worker.postMessage(startReq);
  });
}

export function initialSearchProgress(
  meta: {
    phase: LayoutSearchProgress["phase"];
    strandCount: number;
    cableCount: number;
    evaluationBudget: number;
  },
  partial?: Partial<Omit<LayoutSearchProgress, "phase" | "strandCount" | "cableCount" | "evaluationBudget">>,
): LayoutSearchProgress {
  return {
    phase: meta.phase,
    round: 0,
    evaluations: 0,
    evaluationBudget: meta.evaluationBudget,
    bestScore: Number.MAX_SAFE_INTEGER,
    feasible: false,
    elapsedMs: 0,
    strandCount: meta.strandCount,
    cableCount: meta.cableCount,
    ...partial,
  };
}
