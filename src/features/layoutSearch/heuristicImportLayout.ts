/** Heuristic import path (`computeCanvasPlacement` + width loop) — skip optimized search. */
export function heuristicImportLayoutEnabled(): boolean {
  return (
    import.meta.env.VITE_USE_HEURISTIC_IMPORT === "1" ||
    import.meta.env.VITE_USE_LEGACY_IMPORT_LAYOUT === "1"
  );
}

/** @deprecated Use `heuristicImportLayoutEnabled`. */
export const legacyImportLayoutEnabled = heuristicImportLayoutEnabled;

/** Dev-only: show Left/right ↔ 4-side toolbar toggle. */
export function showLayoutModeToggle(): boolean {
  return import.meta.env.VITE_SHOW_LAYOUT_MODE_TOGGLE === "1";
}
