import type { LayoutOverrides, TubeOverrideKey } from "@/types/splice";
import type { GridMap } from "@/features/grid/gridTypes";
import { applyGridLocksToMap } from "@/features/grid/reservation";

export type HybridLockPatch = {
  locks?: LayoutOverrides["locks"];
  gridLocks?: LayoutOverrides["gridLocks"];
};

/** Merge a cable position lock after user drag. */
export function lockCablePosition(
  overrides: LayoutOverrides,
  cableId: string,
  position: { x: number; y: number },
): LayoutOverrides {
  return {
    ...overrides,
    positions: { ...overrides.positions, [cableId]: position },
    locks: {
      ...overrides.locks,
      cables: { ...overrides.locks?.cables, [cableId]: true },
    },
    gridLocks: {
      segments: overrides.gridLocks?.segments ?? [],
      dots: overrides.gridLocks?.dots ?? [],
      cables: [...new Set([...(overrides.gridLocks?.cables ?? []), cableId])],
      tubeGroups: overrides.gridLocks?.tubeGroups ?? [],
    },
  };
}

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
      cables: overrides.gridLocks?.cables ?? [],
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
      segments: [...new Set([...(overrides.gridLocks?.segments ?? []), ...segmentIds])],
      dots: overrides.gridLocks?.dots ?? [],
      cables: overrides.gridLocks?.cables ?? [],
      tubeGroups: overrides.gridLocks?.tubeGroups ?? [],
    },
  };
}

/** Apply persisted grid locks onto a live grid map before routing. */
export function applyLocksToGrid(
  map: GridMap,
  overrides?: LayoutOverrides,
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
    fanoutOverrides: undefined,
    tubeOverrides: undefined,
    gridLocks: undefined,
    locks: undefined,
    autoAdjustEnabled: true,
  };
}

/** Unlock one cable or tube group key. */
export function unlockHybridItem(
  overrides: LayoutOverrides,
  kind: "cable" | "tubeGroup" | "segment",
  key: string,
): LayoutOverrides {
  if (kind === "cable") {
    const cables = { ...overrides.locks?.cables };
    delete cables[key];
    return {
      ...overrides,
      locks: { ...overrides.locks, cables },
      gridLocks: overrides.gridLocks
        ? {
            ...overrides.gridLocks,
            cables: overrides.gridLocks.cables.filter((id) => id !== key),
          }
        : undefined,
    };
  }
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
