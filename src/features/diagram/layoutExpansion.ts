/** Import-time layout expansion when strict EDGE routing needs more room. */
export type LayoutExpansion = {
  /** Extra px added to center gap / layout width beyond content minimum. */
  centerGapPadding: number;
  /** Added to same-side cable stack gap (32px floor). */
  cableGapExtra: number;
  /** Added to tube-boundary row gaps (8px floor within adaptiveBoundaryRowGap). */
  tubeGroupGapExtra: number;
};

export const DEFAULT_LAYOUT_EXPANSION: LayoutExpansion = {
  centerGapPadding: 0,
  cableGapExtra: 0,
  tubeGroupGapExtra: 0,
};

let activeExpansion: LayoutExpansion = DEFAULT_LAYOUT_EXPANSION;

export function getLayoutExpansion(): LayoutExpansion {
  return activeExpansion;
}

export function runWithLayoutExpansion<T>(
  expansion: LayoutExpansion,
  fn: () => T,
): T {
  const prev = activeExpansion;
  activeExpansion = expansion;
  try {
    return fn();
  } finally {
    activeExpansion = prev;
  }
}

/** Step expansion for feasibility loop iteration `i` (0 = default). */
export function layoutExpansionForIteration(iteration: number): LayoutExpansion {
  if (iteration <= 0) return DEFAULT_LAYOUT_EXPANSION;
  return {
    centerGapPadding: iteration * 96,
    cableGapExtra: iteration >= 10 ? (iteration - 9) * 12 : 0,
    tubeGroupGapExtra: iteration >= 14 ? (iteration - 13) * 12 : 0,
  };
}

export const MAX_LAYOUT_FEASIBILITY_ITERATIONS = 20;

export function effectiveCableGap(): number {
  const { cableGapExtra } = getLayoutExpansion();
  return 32 + cableGapExtra;
}
