import {
  LAYOUT_OVERRIDE_VERSION,
  type LayoutOverrides,
} from "@/types/splice";
import { normalizeLayoutOverridesOnLoad } from "@/features/manualAdjust/connectionOverrides";
import { stripLegacyCableLocks } from "@/features/layoutHybrid/applyLocksToGrid";

export function loadLayoutOverrides(
  reportKey: string,
): LayoutOverrides | undefined {
  try {
    const raw = localStorage.getItem(reportKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as LayoutOverrides;
    if (parsed.layoutVersion !== LAYOUT_OVERRIDE_VERSION) return undefined;
    return normalizeLayoutOverridesOnLoad(stripLegacyCableLocks(parsed));
  } catch {
    return undefined;
  }
}

export function saveLayoutOverrides(overrides: LayoutOverrides): void {
  try {
    localStorage.setItem(
      overrides.reportKey,
      JSON.stringify(stripLegacyCableLocks(overrides)),
    );
  } catch {
    /* quota / private mode */
  }
}

export function positionsFromNodes(
  nodes: { id: string; position: { x: number; y: number } }[],
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    positions[node.id] = { x: node.position.x, y: node.position.y };
  }
  return positions;
}

export function existingIdsFromEdges(
  edges: { id: string; data?: { existing?: boolean } }[],
): string[] {
  // Normalize split fiber legs (`splice-left-*` / `splice-right-*`) to the
  // composite connection id so an "existing" splice restores on both legs;
  // butt (`butt-*`) ids are kept as-is.
  const ids = new Set<string>();
  for (const e of edges) {
    if (!e.data?.existing) continue;
    if (e.id.startsWith("splice-left-")) {
      ids.add(`splice-${e.id.slice("splice-left-".length)}`);
    } else if (e.id.startsWith("splice-right-")) {
      ids.add(`splice-${e.id.slice("splice-right-".length)}`);
    } else {
      ids.add(e.id);
    }
  }
  return [...ids];
}

function mergeOverrideMap<T extends Record<string, unknown>>(
  existing: T | undefined,
  patch: T | undefined,
): T | undefined {
  if (patch === undefined) {
    return existing !== undefined ? { ...existing } : undefined;
  }
  if (Object.keys(patch).length === 0) {
    return {} as T;
  }
  return { ...existing, ...patch };
}

export function calloutsShouldShow(
  overrides?: Pick<LayoutOverrides, "callouts" | "calloutsVisible">,
): boolean {
  if (overrides?.calloutsVisible === true) return true;
  if (overrides?.calloutsVisible === false) return false;
  return Boolean(
    overrides?.callouts && Object.keys(overrides.callouts).length > 0,
  );
}

export function mergeLayoutOverrides(
  reportKey: string,
  patch: Partial<LayoutOverrides>,
): LayoutOverrides {
  const existing = loadLayoutOverrides(reportKey);
  const merged: LayoutOverrides = {
    reportKey,
    layoutVersion: LAYOUT_OVERRIDE_VERSION,
    positions: patch.positions ?? existing?.positions ?? {},
    autoLayoutY: patch.autoLayoutY ?? existing?.autoLayoutY,
    existingEdgeIds: patch.existingEdgeIds ?? existing?.existingEdgeIds,
    cableSides: { ...existing?.cableSides, ...patch.cableSides },
    collapseFullButtSplices:
      patch.collapseFullButtSplices ?? existing?.collapseFullButtSplices,
    layoutWidth: patch.layoutWidth ?? existing?.layoutWidth,
    layoutExpansion: patch.layoutExpansion ?? existing?.layoutExpansion,
    callouts: patch.callouts ?? existing?.callouts,
    calloutsVisible: patch.calloutsVisible ?? existing?.calloutsVisible,
    calloutScale: patch.calloutScale ?? existing?.calloutScale,
    calloutAutoZoom: patch.calloutAutoZoom ?? existing?.calloutAutoZoom,
    titleBlock:
      patch.titleBlock !== undefined
        ? { ...existing?.titleBlock, ...patch.titleBlock }
        : existing?.titleBlock,
    autoAdjustEnabled:
      patch.autoAdjustEnabled ?? existing?.autoAdjustEnabled ?? true,
    tubeOverrides: mergeOverrideMap(
      existing?.tubeOverrides,
      patch.tubeOverrides,
    ),
    fanoutOverrides: mergeOverrideMap(
      existing?.fanoutOverrides,
      patch.fanoutOverrides,
    ),
    legOverrides: mergeOverrideMap(existing?.legOverrides, patch.legOverrides),
    connectionOverrides: mergeOverrideMap(
      existing?.connectionOverrides,
      patch.connectionOverrides,
    ),
    bundleOverrides: mergeOverrideMap(
      existing?.bundleOverrides,
      patch.bundleOverrides,
    ),
    layoutMode: patch.layoutMode ?? existing?.layoutMode,
    quadCableSides: { ...existing?.quadCableSides, ...patch.quadCableSides },
    // Replace-when-provided: lock toggles pass the complete desired `locks`
    // object (so a removed key actually unlocks); other patches preserve it.
    locks: patch.locks !== undefined ? patch.locks : existing?.locks,
    routingEngine: patch.routingEngine ?? existing?.routingEngine,
    gridRoutes: patch.gridRoutes ?? existing?.gridRoutes,
    gridLocks: patch.gridLocks ?? existing?.gridLocks,
    optimizedLayoutCandidate:
      patch.optimizedLayoutCandidate ?? existing?.optimizedLayoutCandidate,
  };
  return stripLegacyCableLocks(merged);
}
