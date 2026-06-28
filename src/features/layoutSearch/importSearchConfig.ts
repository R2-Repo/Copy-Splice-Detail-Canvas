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
    typeof import.meta !== "undefined" &&
    import.meta.env?.VITE_DEBUG_IMPORT_CANDIDATES === "1"
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
