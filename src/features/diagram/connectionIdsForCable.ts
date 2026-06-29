import type { VisualCable } from "@/features/diagram/visualCables";

/** Fiber connection ids routed through a visual cable node. */
export function connectionIdsForVisualCable(
  visualCables: VisualCable[],
  visualCableId: string,
): string[] {
  const vc = visualCables.find((c) => c.id === visualCableId);
  if (!vc) return [];
  return vc.tubes.flatMap((tube) => tube.fibers.map((fiber) => fiber.connectionId));
}

function visualCableIdsForConnection(
  visualCables: VisualCable[],
  connectionId: string,
): string[] {
  const ids: string[] = [];
  for (const vc of visualCables) {
    const hasConn = vc.tubes.some((tube) =>
      tube.fibers.some((fiber) => fiber.connectionId === connectionId),
    );
    if (hasConn) ids.push(vc.id);
  }
  return ids;
}

/**
 * Incremental grid reroute scope for a cable drag.
 * Includes every connection on the dragged cable plus all connections on
 * partner cables that share a splice — so midX nest order (SDC-ROUTE-002/011)
 * repacks when e.g. one right-side target moves but the left source is shared.
 */
export function rerouteConnectionIdsForVisualCableDrag(
  visualCables: VisualCable[],
  draggedVisualCableId: string,
): string[] {
  const draggedConnIds = connectionIdsForVisualCable(
    visualCables,
    draggedVisualCableId,
  );
  if (draggedConnIds.length === 0) return [];

  const partnerCableIds = new Set<string>();
  for (const connId of draggedConnIds) {
    for (const vcId of visualCableIdsForConnection(visualCables, connId)) {
      if (vcId !== draggedVisualCableId) partnerCableIds.add(vcId);
    }
  }

  const reroute = new Set(draggedConnIds);
  for (const partnerId of partnerCableIds) {
    for (const connId of connectionIdsForVisualCable(
      visualCables,
      partnerId,
    )) {
      reroute.add(connId);
    }
  }
  return [...reroute];
}
