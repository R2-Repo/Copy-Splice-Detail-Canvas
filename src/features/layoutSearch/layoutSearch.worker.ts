/// <reference lib="webworker" />

import { layoutSearch } from "./layoutSearch";
import type {
  LayoutSearchWorkerRequest,
  LayoutSearchWorkerResponse,
} from "./layoutSearchTypes";

let activeId = 0;
let cancelRequested = false;

self.onmessage = (event: MessageEvent<LayoutSearchWorkerRequest>) => {
  const msg = event.data;

  if (msg.type === "cancel") {
    if (msg.id === activeId) cancelRequested = true;
    return;
  }

  if (msg.type !== "start") return;

  activeId = msg.id;
  cancelRequested = false;

  try {
    const result = layoutSearch(msg.graph, {
      ...msg.config,
      shouldCancel: () => cancelRequested && activeId === msg.id,
      onProgress: (progress) => {
        const response: LayoutSearchWorkerResponse = {
          type: "progress",
          id: msg.id,
          progress: {
            ...progress,
            phase: "optimizing",
            strandCount: msg.meta.strandCount,
            cableCount: msg.meta.cableCount,
            evaluationBudget: msg.meta.evaluationBudget,
          },
        };
        self.postMessage(response);
      },
    });

    if (activeId !== msg.id) return;

    const done: LayoutSearchWorkerResponse = {
      type: "done",
      id: msg.id,
      result,
    };
    self.postMessage(done);
  } catch (err) {
    const response: LayoutSearchWorkerResponse = {
      type: "error",
      id: msg.id,
      message: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(response);
  }
};
