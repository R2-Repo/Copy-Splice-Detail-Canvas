/** Legacy heuristic import (`computeCanvasPlacement` + width loop). */
export function legacyImportLayoutEnabled(): boolean {
  return import.meta.env.VITE_USE_LEGACY_IMPORT_LAYOUT === "1";
}

/** Dev-only: show Left/right ↔ 4-side toolbar toggle. */
export function showLayoutModeToggle(): boolean {
  return import.meta.env.VITE_SHOW_LAYOUT_MODE_TOGGLE === "1";
}
