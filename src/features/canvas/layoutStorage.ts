import {
  LAYOUT_OVERRIDE_VERSION,
  type LayoutOverrides,
} from "@/types/splice";

import { bridgeLegOverridesToConnectionOverrides } from "@/features/manualAdjust/connectionOverrides";

export function loadLayoutOverrides(
  reportKey: string,
): LayoutOverrides | undefined {
  try {
    const raw = localStorage.getItem(reportKey);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as LayoutOverrides;
    if (parsed.layoutVersion !== LAYOUT_OVERRIDE_VERSION) return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

export function saveLayoutOverrides(overrides: LayoutOverrides): void {
  try {
    localStorage.setItem(overrides.reportKey, JSON.stringify(overrides));
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
  return edges.filter((e) => e.data?.existing).map((e) => e.id);
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
  return {
    reportKey,
    layoutVersion: LAYOUT_OVERRIDE_VERSION,
    positions: patch.positions ?? existing?.positions ?? {},
    autoLayoutY: patch.autoLayoutY ?? existing?.autoLayoutY,
    existingEdgeIds: patch.existingEdgeIds ?? existing?.existingEdgeIds,
    cableSides: { ...existing?.cableSides, ...patch.cableSides },
    collapseFullButtSplices:
      patch.collapseFullButtSplices ?? existing?.collapseFullButtSplices,
    layoutWidth: patch.layoutWidth ?? existing?.layoutWidth,
    callouts: patch.callouts ?? existing?.callouts,
    calloutsVisible: patch.calloutsVisible ?? existing?.calloutsVisible,
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
      existing?.connectionOverrides ??
        bridgeLegOverridesToConnectionOverrides(existing?.legOverrides),
      patch.connectionOverrides ??
        bridgeLegOverridesToConnectionOverrides(patch.legOverrides),
    ),
    bundleOverrides: mergeOverrideMap(
      existing?.bundleOverrides,
      patch.bundleOverrides,
    ),
  };
}
