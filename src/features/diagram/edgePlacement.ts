import type { VisualCable } from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { LayoutSide } from "@/features/layoutSearch/layoutCandidate";
import type { QuadSide } from "@/types/splice";

import type { QuadCablePlacement } from "@/features/diagram/quad/quadPlacement";

/** Per-cable edge assignment for four-side spacing rules (L/R/T/B). */
export type EdgePlacement = {
  side: QuadSide;
  order: number;
};

/** Quad paint → four-edge placement for SDC-LAYOUT-001. */
export function edgePlacementFromQuad(
  quadPlacement: Map<string, QuadCablePlacement>,
  visualCables: VisualCable[],
  stackOrderByCableKey?: Partial<Record<QuadSide, string[]>>,
): Map<string, EdgePlacement> {
  const placement = new Map<string, EdgePlacement>();
  for (const vc of visualCables) {
    const qp = quadPlacement.get(vc.id);
    if (!qp) continue;
    const key = cableNameKey(vc.cable);
    const stack = stackOrderByCableKey?.[qp.side] ?? [];
    const order = stack.indexOf(key);
    placement.set(vc.id, {
      side: qp.side,
      order: order >= 0 ? order : stack.length,
    });
  }
  return placement;
}

/** Candidate stack order → four-edge placement. */
export function edgePlacementFromCandidate(
  cableSides: Record<string, LayoutSide>,
  stackOrder: Record<LayoutSide, string[]>,
  visualCables: VisualCable[],
): Map<string, EdgePlacement> {
  const placement = new Map<string, EdgePlacement>();
  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    const side = cableSides[key] ?? vc.side;
    const stack = stackOrder[side];
    const order = stack.indexOf(key);
    placement.set(vc.id, {
      side,
      order: order >= 0 ? order : stack.length,
    });
  }
  return placement;
}
