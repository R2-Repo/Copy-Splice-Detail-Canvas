import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import { compareTubeColorsTia } from "@/features/diagram/colorCode";
import type { VisualCable } from "@/features/diagram/visualCables";

/** TIA strand order within one buffer tube: top → bottom by fiber #, even 24px pitch. */
export function compactTubeFiberLayoutOk(visualCables: VisualCable[]): boolean {
  for (const vc of visualCables) {
    for (const tube of vc.tubes) {
      const fibers = tube.fibers;
      for (let i = 1; i < fibers.length; i++) {
        if (fibers[i]!.fiberNumber <= fibers[i - 1]!.fiberNumber) return false;
        if (fibers[i]!.rowYOffset - fibers[i - 1]!.rowYOffset !== FIBER_ROW_PITCH) {
          return false;
        }
      }
    }
  }
  return true;
}

/** Top-to-bottom within each cable: rowYOffset strictly increases. */
export function cableFiberTopToBottomOk(visualCables: VisualCable[]): boolean {
  for (const vc of visualCables) {
    const ordered = vc.tubes.flatMap((t) => t.fibers);
    for (let i = 1; i < ordered.length; i++) {
      if (ordered[i]!.rowYOffset <= ordered[i - 1]!.rowYOffset) return false;
    }
  }
  return true;
}

/** Buffer tubes top→bottom follow TIA solid then striped order. */
export function tubesInTiaOrderOk(visualCables: VisualCable[]): boolean {
  for (const vc of visualCables) {
    for (let i = 1; i < vc.tubes.length; i++) {
      if (
        compareTubeColorsTia(
          vc.tubes[i - 1]!.tubeColor,
          vc.tubes[i]!.tubeColor,
        ) >= 0
      ) {
        return false;
      }
    }
  }
  return true;
}
