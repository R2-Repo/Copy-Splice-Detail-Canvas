import type { CablePlacement } from "@/features/diagram/canvasPlacement";
import { LAYOUT } from "@/features/diagram/layoutSpliceDiagram";
import type { VisualCable } from "@/features/diagram/visualCables";

/** Canvas X threshold: node position left of center → left-facing cable. */
export function displaySideFromCanvasX(
  x: number,
  centerX: number = LAYOUT.centerX,
): "left" | "right" {
  return x < centerX ? "left" : "right";
}

export function visualCableIdFromNodeId(nodeId: string): string | null {
  return nodeId.startsWith("cable-") ? nodeId.slice("cable-".length) : null;
}

export function applyCableSideOverrides(
  placement: Map<string, CablePlacement>,
  visualCables: VisualCable[],
  cableSides?: Record<string, "left" | "right">,
): void {
  if (!cableSides) return;
  for (const vc of visualCables) {
    const side = cableSides[vc.id];
    if (!side) continue;
    const current = placement.get(vc.id) ?? {
      side: vc.side,
      order: vc.order,
    };
    placement.set(vc.id, { ...current, side });
  }
}
