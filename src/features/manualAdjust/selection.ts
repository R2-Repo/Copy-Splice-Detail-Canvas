import type { ManualAdjustSelection } from "./types";

export function emptySelection(): ManualAdjustSelection {
  return { connectionIds: new Set(), segmentKeys: new Set() };
}

export function toggleConnectionSelection(
  selection: ManualAdjustSelection,
  connectionId: string,
  additive: boolean,
): ManualAdjustSelection {
  const connectionIds = additive
    ? new Set(selection.connectionIds)
    : new Set<string>();
  if (connectionIds.has(connectionId)) {
    connectionIds.delete(connectionId);
  } else {
    connectionIds.add(connectionId);
  }
  return { ...selection, connectionIds };
}

export function setConnectionSelection(
  connectionIds: Iterable<string>,
): ManualAdjustSelection {
  return { connectionIds: new Set(connectionIds), segmentKeys: new Set() };
}

/** Union `connectionIds` into the current selection (Ctrl+click additive). */
export function addConnectionsToSelection(
  selection: ManualAdjustSelection,
  connectionIds: Iterable<string>,
): ManualAdjustSelection {
  const next = new Set(selection.connectionIds);
  for (const id of connectionIds) next.add(id);
  return { ...selection, connectionIds: next };
}

export function connectionsInMarquee(
  anchors: Array<{ connectionId: string; x: number; y: number }>,
  box: { x0: number; y0: number; x1: number; y1: number },
): string[] {
  const minX = Math.min(box.x0, box.x1);
  const maxX = Math.max(box.x0, box.x1);
  const minY = Math.min(box.y0, box.y1);
  const maxY = Math.max(box.y0, box.y1);
  return anchors
    .filter(
      (a) => a.x >= minX && a.x <= maxX && a.y >= minY && a.y <= maxY,
    )
    .map((a) => a.connectionId);
}

export function isConnectionSelected(
  selection: ManualAdjustSelection,
  connectionId: string,
): boolean {
  return selection.connectionIds.has(connectionId);
}
