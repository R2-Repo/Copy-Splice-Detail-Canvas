import type { LayoutOverrides } from "@/types/splice";

import {
  clearAllHybridLocks,
  lockGridSegments,
  lockTubeGroup,
  unlockHybridItem,
} from "./applyLocksToGrid";

export type HybridEditKind = "tubeGroup" | "legSegments" | "fusionDot";

export function onEditLock(
  overrides: LayoutOverrides,
  kind: HybridEditKind,
  payload: {
    tubeKey?: `${string}|${string}`;
    segmentIds?: string[];
    dotId?: string;
  },
): LayoutOverrides {
  switch (kind) {
    case "tubeGroup":
      if (!payload.tubeKey) return overrides;
      return lockTubeGroup(overrides, payload.tubeKey);
    case "legSegments":
      return lockGridSegments(overrides, payload.segmentIds ?? []);
    case "fusionDot": {
      const dots = [
        ...new Set(
          [...(overrides.gridLocks?.dots ?? []), payload.dotId].filter(Boolean),
        ),
      ] as string[];
      return {
        ...overrides,
        gridLocks: {
          segments: overrides.gridLocks?.segments ?? [],
          dots,
          tubeGroups: overrides.gridLocks?.tubeGroups ?? [],
        },
      };
    }
    default:
      return overrides;
  }
}

export { clearAllHybridLocks, unlockHybridItem };
