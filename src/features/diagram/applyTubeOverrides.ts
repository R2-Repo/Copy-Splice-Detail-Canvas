import { tubeKeyFor, type TubeKey } from "@/features/diagram/tubeRowShift";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { TubeManualOverride, TubeOverrideKey } from "@/types/splice";

/** Apply persisted manual tube overrides onto in-memory visual cables. */
export function applyPersistedTubeOverrides(
  visualCables: VisualCable[],
  tubeOverrides?: Record<TubeOverrideKey, TubeManualOverride>,
): Set<TubeKey> {
  const locked = new Set<TubeKey>();
  if (!tubeOverrides) return locked;

  const vcById = new Map(visualCables.map((vc) => [vc.id, vc]));

  for (const [key, override] of Object.entries(tubeOverrides)) {
    const [vcId, tubeColor] = key.split("|") as [string, string];
    const vc = vcById.get(vcId);
    if (!vc) continue;
    const tube = vc.tubes.find((t) => t.tubeColor === tubeColor);
    if (!tube) continue;

    if (override.visualShiftY !== undefined) {
      tube.visualShiftY = override.visualShiftY;
    }
    if (override.stemReachX !== undefined) {
      tube.stemReachX = override.stemReachX;
    }
    locked.add(tubeKeyFor(vcId, tube.tubeColor));
  }

  return locked;
}
