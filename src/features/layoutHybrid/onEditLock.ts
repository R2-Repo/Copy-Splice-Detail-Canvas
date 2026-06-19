import type { LayoutOverrides } from "@/types/splice";

import {
  clearAllHybridLocks,
  lockCablePosition,
  lockGridSegments,
  lockTubeGroup,
  unlockHybridItem,
} from "./applyLocksToGrid";

export type HybridEditKind =
  | "cable"
  | "tubeGroup"
  | "legSegments"
  | "fusionDot";

export function onEditLock(
  overrides: LayoutOverrides,
  kind: HybridEditKind,
  payload: {
    cableId?: string;
    position?: { x: number; y: number };
    tubeKey?: `${string}|${string}`;
    segmentIds?: string[];
    dotId?: string;
  },
): LayoutOverrides {
  switch (kind) {
    case "cable":
      if (!payload.cableId || !payload.position) return overrides;
      return lockCablePosition(overrides, payload.cableId, payload.position);
    case "tubeGroup":
      if (!payload.tubeKey) return overrides;
      return lockTubeGroup(overrides, payload.tubeKey);
    case "legSegments":
      return lockGridSegments(overrides, payload.segmentIds ?? []);
    case "fusionDot": {
      const dots = [...new Set([...(overrides.gridLocks?.dots ?? []), payload.dotId].filter(Boolean))] as string[];
      return {
        ...overrides,
        gridLocks: {
          segments: overrides.gridLocks?.segments ?? [],
          dots,
          cables: overrides.gridLocks?.cables ?? [],
          tubeGroups: overrides.gridLocks?.tubeGroups ?? [],
        },
      };
    }
    default:
      return overrides;
  }
}

export { clearAllHybridLocks, unlockHybridItem };
