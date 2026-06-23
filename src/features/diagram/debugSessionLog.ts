/** Debug session dafd70 — remove after verification. */
export function debugSessionLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
): void {
  // #region agent log
  fetch("http://127.0.0.1:7692/ingest/76af12d0-a987-40d1-88e0-d22d15ff6bad", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "dafd70",
    },
    body: JSON.stringify({
      sessionId: "dafd70",
      location,
      message,
      data,
      hypothesisId,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

/** GR/BR/BL/OR lane snapshot from routed splice edges. */
export function debugWatchFiberLanes(
  edges: Array<{
    id: string;
    type?: string | null;
    source?: string | null;
    target?: string | null;
    data?: unknown;
  }>,
): Record<string, unknown> {
  const watch = ["|BL|GR|", "|BL|BR|", "|BL|SL|", "|BL|OR|"];
  const out: Record<string, unknown> = {};
  for (const e of edges) {
    if (e.type !== "splice") continue;
    const connId = e.id.replace(/^splice-(?:left-|right-)?/, "");
    if (!watch.some((w) => connId.includes(w.slice(1, -1)))) continue;
    const d = (e.data ?? {}) as Record<string, unknown>;
    const key = connId.split("::").pop()?.slice(0, 40) ?? connId.slice(0, 40);
    out[key] = {
      midX: d.routingMidX ?? d.midX,
      source: e.source,
      target: e.target,
    };
  }
  return out;
}
