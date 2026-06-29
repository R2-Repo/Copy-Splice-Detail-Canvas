import {
  orderedFiberConnections,
} from "@/features/diagram/buildConnectionGraph";
import {
  FIBER_ROW_PITCH,
  TUBE_GROUP_GAP,
} from "@/features/diagram/cableLayoutMetrics";
import {
  pairEndpointsForSide,
} from "@/features/diagram/buildConnectionGraph";
import type {
  ConnectionGraph,
  FiberConnection,
} from "@/types/splice";

function layoutTubeKey(
  conn: FiberConnection,
  graph: ConnectionGraph,
): string {
  const { left, right } = pairEndpointsForSide(conn.pair, graph);
  const ep = left.fiberNumber <= right.fiberNumber ? left : right;
  return `${ep.cable}::${ep.tubeColor}`;
}

function rowStepAfter(
  current: FiberConnection,
  next: FiberConnection,
  graph: ConnectionGraph,
): number {
  const sameTube =
    layoutTubeKey(current, graph) === layoutTubeKey(next, graph);
  return FIBER_ROW_PITCH + (sameTube ? 0 : TUBE_GROUP_GAP);
}

/** Row order: group by buffer tube, stable CSV order within each tube. */
export function connectionsInRowLayoutOrder(
  graph: ConnectionGraph,
  _visualCables?: RowLayoutVisualCableRef[],
  excludeConnectionIds?: ReadonlySet<string>,
): FiberConnection[] {
  const list = orderedFiberConnections(graph).filter(
    (c) => !excludeConnectionIds?.has(c.id),
  );
  const index = new Map(list.map((c, i) => [c.id, i]));
  return [...list].sort((a, b) => {
    const tubeCmp = layoutTubeKey(a, graph).localeCompare(
      layoutTubeKey(b, graph),
    );
    if (tubeCmp !== 0) return tubeCmp;
    return (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0);
  });
}

/** Minimal visual-cable shape — avoids import cycle with visualCables.ts. */
export type RowLayoutVisualCableRef = {
  id: string;
  side: "left" | "right";
  tubes: { fibers: { connectionId: string }[] }[];
};

/** Stable row index per splice — drives vertical spacing and fiber order in cable nodes. */
export function connectionRowIndexMap(
  graph: ConnectionGraph,
  visualCables?: RowLayoutVisualCableRef[],
  excludeConnectionIds?: ReadonlySet<string>,
): Map<string, number> {
  const map = new Map<string, number>();
  connectionsInRowLayoutOrder(
    graph,
    visualCables,
    excludeConnectionIds,
  ).forEach((conn, index) => {
    map.set(conn.id, index);
  });
  return map;
}

/**
 * Cumulative vertical offset per splice row (px from first row).
 * Within a buffer tube rows are evenly spaced; tube boundaries add extra gap.
 */
export function connectionRowOffsets(
  graph: ConnectionGraph,
  visualCables?: RowLayoutVisualCableRef[],
  excludeConnectionIds?: ReadonlySet<string>,
): Map<string, number> {
  const map = new Map<string, number>();
  const connections = connectionsInRowLayoutOrder(
    graph,
    visualCables,
    excludeConnectionIds,
  );
  let y = 0;

  for (let i = 0; i < connections.length; i++) {
    map.set(connections[i]!.id, y);
    if (i < connections.length - 1) {
      y += rowStepAfter(connections[i]!, connections[i + 1]!, graph);
    }
  }

  return map;
}

export function maxConnectionRowOffset(
  rowOffsets: ReadonlyMap<string, number>,
): number {
  let max = 0;
  for (const offset of rowOffsets.values()) {
    if (offset > max) max = offset;
  }
  return max;
}
