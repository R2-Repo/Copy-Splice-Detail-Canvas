import type { LayoutOverrides, TubeOverrideKey } from "@/types/splice";
import type { GridMap } from "@/features/grid/gridTypes";
import { applyGridLocksToMap } from "@/features/grid/reservation";

export type HybridLockPatch = {
  locks?: LayoutOverrides["locks"];
  gridLocks?: LayoutOverrides["gridLocks"];
};

/** Lock a tube/fan-out group after manual edit. */
export function lockTubeGroup(
  overrides: LayoutOverrides,
  tubeKey: TubeOverrideKey,
): LayoutOverrides {
  return {
    ...overrides,
    locks: {
      ...overrides.locks,
      tubeGroups: { ...overrides.locks?.tubeGroups, [tubeKey]: true },
    },
    gridLocks: {
      segments: overrides.gridLocks?.segments ?? [],
      dots: overrides.gridLocks?.dots ?? [],
      tubeGroups: [
        ...new Set([...(overrides.gridLocks?.tubeGroups ?? []), tubeKey]),
      ],
    },
  };
}

/** Lock grid lane segments after leg drag. */
export function lockGridSegments(
  overrides: LayoutOverrides,
  segmentIds: string[],
): LayoutOverrides {
  return {
    ...overrides,
    gridLocks: {
      segments: [
        ...new Set([...(overrides.gridLocks?.segments ?? []), ...segmentIds]),
      ],
      dots: overrides.gridLocks?.dots ?? [],
      tubeGroups: overrides.gridLocks?.tubeGroups ?? [],
    },
  };
}

/** Apply persisted grid locks onto a live grid map before routing. */
export function applyLocksToGrid(
  map: GridMap,
  overrides?: Pick<LayoutOverrides, "gridLocks">,
): void {
  applyGridLocksToMap(map, overrides?.gridLocks?.segments);
}

/** Clear all manual locks — reset to pure auto layout. */
export function clearAllHybridLocks(
  overrides: LayoutOverrides,
): LayoutOverrides {
  return {
    ...overrides,
    legOverrides: undefined,
    connectionOverrides: undefined,
    bundleOverrides: undefined,
    fanoutOverrides: undefined,
    tubeOverrides: undefined,
    gridLocks: undefined,
    locks: undefined,
    autoAdjustEnabled: true,
  };
}

/** Unlock one tube group, leg segment, or fusion-dot lock. */
export function unlockHybridItem(
  overrides: LayoutOverrides,
  kind: "tubeGroup" | "segment" | "fusionDot",
  key: string,
): LayoutOverrides {
  if (kind === "tubeGroup") {
    const tubeGroups = { ...overrides.locks?.tubeGroups };
    delete tubeGroups[key as TubeOverrideKey];
    return {
      ...overrides,
      locks: { ...overrides.locks, tubeGroups },
      gridLocks: overrides.gridLocks
        ? {
            ...overrides.gridLocks,
            tubeGroups: overrides.gridLocks.tubeGroups.filter((id) => id !== key),
          }
        : undefined,
    };
  }
  if (kind === "fusionDot") {
    const legOverrides = { ...(overrides.legOverrides ?? {}) };
    const leg = legOverrides[key];
    if (leg) {
      const nextLeg = { ...leg };
      delete nextLeg.dotShiftX;
      const hasLegEdits =
        (nextLeg.leftSegments && Object.keys(nextLeg.leftSegments).length > 0) ||
        (nextLeg.rightSegments && Object.keys(nextLeg.rightSegments).length > 0);
      if (hasLegEdits) legOverrides[key] = nextLeg;
      else delete legOverrides[key];
    }
    return {
      ...overrides,
      legOverrides: Object.keys(legOverrides).length ? legOverrides : undefined,
      gridLocks: overrides.gridLocks
        ? {
            ...overrides.gridLocks,
            dots: overrides.gridLocks.dots.filter((id) => id !== key),
          }
        : undefined,
    };
  }
  return {
    ...overrides,
    gridLocks: overrides.gridLocks
      ? {
          ...overrides.gridLocks,
          segments: overrides.gridLocks.segments.filter((id) => id !== key),
        }
      : undefined,
  };
}

/** Drop legacy cable lock keys from stored overrides. */
export function stripLegacyCableLocks(
  overrides: LayoutOverrides,
): LayoutOverrides {
  let next = overrides;
  const legacyLocks = overrides.locks as
    | (LayoutOverrides["locks"] & { cables?: Record<string, true> })
    | undefined;
  if (legacyLocks?.cables) {
    const { cables: _cables, ...restLocks } = legacyLocks;
    next = {
      ...next,
      locks: Object.keys(restLocks).length > 0 ? restLocks : undefined,
    };
  }
  const legacyGrid = overrides.gridLocks as
    | (NonNullable<LayoutOverrides["gridLocks"]> & { cables?: string[] })
    | undefined;
  if (legacyGrid && legacyGrid.cables?.length) {
    const { cables: _cables, ...restGridLocks } = legacyGrid;
    next = { ...next, gridLocks: restGridLocks };
  }
  return next;
}
