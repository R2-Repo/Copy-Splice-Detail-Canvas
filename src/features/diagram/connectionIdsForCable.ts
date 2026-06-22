import type { VisualCable } from "@/features/diagram/visualCables";

/** Fiber connection ids routed through a visual cable node (for incremental grid reroute). */
export function connectionIdsForVisualCable(
  visualCables: VisualCable[],
  visualCableId: string,
): string[] {
  const vc = visualCables.find((c) => c.id === visualCableId);
  if (!vc) return [];
  return vc.tubes.flatMap((tube) => tube.fibers.map((fiber) => fiber.connectionId));
}
