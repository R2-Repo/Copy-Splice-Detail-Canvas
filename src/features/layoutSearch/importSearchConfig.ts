import type { LayoutSide } from "./layoutCandidate";

/** Wall-clock cap for import search — scales with strand count, capped at 5 min. */
export function importTimeBudgetMs(strandCount: number): number {
  return Math.min(300_000, 90_000 + strandCount * 2_500);
}

export type LayoutSearchMode = "beam" | "legacy-guided";

/** Default structured beam search; `legacy-guided` keeps hill-climb restarts. */
export function layoutSearchMode(): LayoutSearchMode {
  const mode =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_LAYOUT_SEARCH_MODE
      : undefined;
  if (mode === "legacy-guided") return "legacy-guided";
  return "beam";
}

export type ForcedCableSide = { cable: string; side: LayoutSide };

/** Parse `VITE_FORCE_LAYOUT_SIDES=CableA:top,CableB:right` for debug seed injection. */
export function parseForcedLayoutSides(): ForcedCableSide[] {
  const raw =
    typeof import.meta !== "undefined"
      ? import.meta.env?.VITE_FORCE_LAYOUT_SIDES
      : undefined;
  if (!raw || typeof raw !== "string" || !raw.trim()) return [];

  const validSides = new Set<LayoutSide>(["left", "right", "top", "bottom"]);
  const out: ForcedCableSide[] = [];

  for (const part of raw.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    if (colon <= 0) continue;
    const cable = trimmed.slice(0, colon).trim();
    const side = trimmed.slice(colon + 1).trim() as LayoutSide;
    if (!cable || !validSides.has(side)) continue;
    out.push({ cable, side });
  }

  return out;
}

export function debugLayoutSearchEnabled(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_DEBUG_LAYOUT_SEARCH === "1"
  );
}

export function debugImportCandidatesEnabled(): boolean {
  return (
    debugImportOptimizerEnabled() ||
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_DEBUG_IMPORT_CANDIDATES === "1")
  );
}

export function debugImportOptimizerEnabled(): boolean {
  return (
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_DEBUG_IMPORT_OPTIMIZER === "1"
  );
}

export function debugImportTimingEnabled(): boolean {
  return (
    debugImportOptimizerEnabled() ||
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_DEBUG_IMPORT_TIMING === "1")
  );
}

export function debugImportRulesEnabled(): boolean {
  return (
    debugImportOptimizerEnabled() ||
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_DEBUG_IMPORT_RULES === "1")
  );
}

export function debugImportTopBottomEnabled(): boolean {
  return (
    debugImportOptimizerEnabled() ||
    (typeof import.meta !== "undefined" &&
      import.meta.env?.VITE_DEBUG_IMPORT_TOP_BOTTOM === "1")
  );
}

/** Tier evaluation caps — tune search breadth vs wall time. */
export const SEARCH_CAPS = {
  t0Max: 300,
  t1Max: 40,
  t2Max: 8,
  beamWidth: 10,
  beamDepth: 4,
  t1Promote: 25,
} as const;

/** Reduced caps when heuristic already passes — background refinement only. */
export const BACKGROUND_SEARCH_CAPS = {
  t0Max: 120,
  t1Max: 20,
  t2Max: 4,
  beamWidth: 6,
  beamDepth: 2,
  t1Promote: 12,
} as const;

export type SearchCaps = {
  t0Max: number;
  t1Max: number;
  t2Max: number;
  beamWidth: number;
  beamDepth: number;
  t1Promote: number;
};

export function searchCapsForProfile(
  profile: "full" | "background",
): SearchCaps {
  return profile === "background" ? BACKGROUND_SEARCH_CAPS : SEARCH_CAPS;
}

/** Non-debug optimizer wall budget — warn / fail thresholds (ms). */
export const IMPORT_PERF_BUDGET_WARN_MS = 10_000;
export const IMPORT_PERF_BUDGET_FAIL_MS = 15_000;

export type ImportPerformanceBudgetResult = {
  warn: boolean;
  exceeded: boolean;
  warnThresholdMs: number;
  failThresholdMs: number;
  actualMs: number;
};

export function importPerformanceBudgetEnabled(): boolean {
  return !debugImportOptimizerEnabled();
}

export function checkImportPerformanceBudget(
  actualMs: number,
): ImportPerformanceBudgetResult {
  return {
    warn: actualMs >= IMPORT_PERF_BUDGET_WARN_MS,
    exceeded: actualMs >= IMPORT_PERF_BUDGET_FAIL_MS,
    warnThresholdMs: IMPORT_PERF_BUDGET_WARN_MS,
    failThresholdMs: IMPORT_PERF_BUDGET_FAIL_MS,
    actualMs,
  };
}
