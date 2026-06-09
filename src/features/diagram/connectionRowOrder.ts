import {
  orderedFiberConnections,
  pairEndpointsForSide,
} from "@/features/diagram/buildConnectionGraph";
import {
  CABLE_LAYOUT,
  compactVisualCableHeight,
  FIBER_ROW_PITCH,
  TUBE_GROUP_GAP,
} from "@/features/diagram/cableLayoutMetrics";
import type { DominantCablePair } from "@/features/diagram/dominantCablePair";
import { parentVisualGroupKey } from "@/features/diagram/dominantCablePair";
import {
  connectionInDominantPair,
  dominantPairFiberSortKey,
} from "@/features/diagram/dominantCablePair";
import {
  canonicalLayoutEndpoint,
  isThroughCable,
} from "@/features/diagram/throughCable";
import type {
  ConnectionGraph,
  FiberConnection,
  FiberEndpoint,
} from "@/types/splice";

function layoutSortKey(
  left: FiberEndpoint,
  right: FiberEndpoint,
  graph: ConnectionGraph,
): [number, number, string] {
  const ep = canonicalLayoutEndpoint(left, right, graph);
  const throughRank = isThroughCable(ep.cable, graph) ? 0 : 1;
  const fiberKey =
    isThroughCable(left.cable, graph) || isThroughCable(right.cable, graph)
      ? ep.fiberNumber
      : Math.max(left.fiberNumber, right.fiberNumber);
  return [throughRank, fiberKey, ep.tubeColor];
}

/** Row order: dominant pair block first, then through-cable fiber # / tube / CSV order. */
export function connectionsInRowLayoutOrder(
  graph: ConnectionGraph,
  visualCables?: RowLayoutVisualCableRef[],
  dominant?: DominantCablePair | null,
  excludeConnectionIds?: ReadonlySet<string>,
): FiberConnection[] {
  const list = orderedFiberConnections(graph).filter(
    (c) => !excludeConnectionIds?.has(c.id),
  );
  const index = new Map(list.map((c, i) => [c.id, i]));
  return [...list].sort((a, b) => {
    if (dominant && visualCables) {
      const aDom = connectionInDominantPair(a, graph, visualCables, dominant)
        ? 0
        : 1;
      const bDom = connectionInDominantPair(b, graph, visualCables, dominant)
        ? 0
        : 1;
      if (aDom !== bDom) return aDom - bDom;
      if (aDom === 0) {
        return (
          dominantPairFiberSortKey(a, graph) -
            dominantPairFiberSortKey(b, graph) ||
          (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0)
        );
      }
    }

    const aEnds = pairEndpointsForSide(a.pair, graph);
    const bEnds = pairEndpointsForSide(b.pair, graph);
    const aKey = layoutSortKey(aEnds.left, aEnds.right, graph);
    const bKey = layoutSortKey(bEnds.left, bEnds.right, graph);
    return (
      aKey[0] - bKey[0] ||
      aKey[1] - bKey[1] ||
      aKey[2].localeCompare(bKey[2]) ||
      (index.get(a.id) ?? 0) - (index.get(b.id) ?? 0)
    );
  });
}

function layoutTubeKey(
  conn: FiberConnection,
  graph: ConnectionGraph,
): string {
  const { left, right } = pairEndpointsForSide(conn.pair, graph);
  const ep = canonicalLayoutEndpoint(left, right);
  return `${ep.cable}::${ep.tubeColor}`;
}

function rowStepAfter(
  current: FiberConnection,
  next: FiberConnection,
  graph: ConnectionGraph,
  visualCables?: RowLayoutVisualCableRef[],
  dominant?: DominantCablePair | null,
): number {
  const sameTube =
    layoutTubeKey(current, graph) === layoutTubeKey(next, graph);
  let step = FIBER_ROW_PITCH + (sameTube ? 0 : TUBE_GROUP_GAP);
  if (visualCables) {
    step += splitInstanceGapAtBoundary(current, next, visualCables);
    step += stubGroupGapAtBoundary(
      current,
      next,
      graph,
      visualCables,
      dominant,
    );
  }
  return step;
}

/**
 * Adaptive row gap at cable-group boundaries — small enough to avoid tall diagrams;
 * collision pass handles same-side cable stack height.
 */
export function adaptiveBoundaryRowGap(shortFiberCount: number): number {
  const pitchSteps = Math.min(Math.max(1, shortFiberCount), 2);
  return Math.max(TUBE_GROUP_GAP, pitchSteps * FIBER_ROW_PITCH);
}

/** Extra gap when leaving the dominant pair row block for stub cables. */
function stubGroupGapAtBoundary(
  current: FiberConnection,
  next: FiberConnection,
  graph: ConnectionGraph,
  visualCables: RowLayoutVisualCableRef[],
  dominant?: DominantCablePair | null,
): number {
  if (!dominant) return 0;
  const currDom = connectionInDominantPair(
    current,
    graph,
    visualCables,
    dominant,
  );
  const nextDom = connectionInDominantPair(
    next,
    graph,
    visualCables,
    dominant,
  );
  if (!currDom || nextDom) return 0;
  const currCount = visualCableFiberCount(visualCables, current.id);
  const nextCount = visualCableFiberCount(visualCables, next.id);
  return adaptiveBoundaryRowGap(Math.min(currCount, nextCount));
}

function visualCableFiberCount(
  visualCables: RowLayoutVisualCableRef[],
  connectionId: string,
): number {
  for (const vc of visualCables) {
    const has = vc.tubes.some((t) =>
      t.fibers.some((f) => f.connectionId === connectionId),
    );
    if (has) {
      return vc.tubes.flatMap((t) => t.fibers).length;
    }
  }
  return 1;
}

/** Minimal visual-cable shape — avoids import cycle with visualCables.ts. */
export type RowLayoutVisualCableRef = {
  id: string;
  side: "left" | "right";
  tubes: { fibers: { connectionId: string }[] }[];
};

function parentVisualCableKey(visualId: string): string {
  return visualId.replace(/~\d+$/, "");
}

function visualCableForConnection(
  visualCables: RowLayoutVisualCableRef[],
  connectionId: string,
  side: "left" | "right",
): RowLayoutVisualCableRef | undefined {
  return visualCables.find(
    (vc) =>
      vc.side === side &&
      vc.tubes.some((t) =>
        t.fibers.some((f) => f.connectionId === connectionId),
      ),
  );
}

/**
 * Ring-cut splits (e.g. two 144 cylinders) need extra row spacing so each
 * visual cable can row-align without overlapping the sibling instance.
 */
export function ringCutSplitBoundaryBetween(
  current: FiberConnection,
  next: FiberConnection,
  visualCables: RowLayoutVisualCableRef[],
): boolean {
  for (const side of ["left", "right"] as const) {
    const currVc = visualCableForConnection(visualCables, current.id, side);
    const nextVc = visualCableForConnection(visualCables, next.id, side);
    if (!currVc || !nextVc || currVc.id === nextVc.id) continue;
    if (parentVisualGroupKey(currVc.id) === parentVisualGroupKey(nextVc.id)) {
      return true;
    }
  }
  return false;
}

function splitInstanceGapAtBoundary(
  current: FiberConnection,
  next: FiberConnection,
  visualCables: RowLayoutVisualCableRef[],
): number {
  for (const side of ["left", "right"] as const) {
    const currVc = visualCableForConnection(visualCables, current.id, side);
    const nextVc = visualCableForConnection(visualCables, next.id, side);
    if (!currVc || !nextVc || currVc.id === nextVc.id) continue;
    if (parentVisualCableKey(currVc.id) !== parentVisualCableKey(nextVc.id)) {
      continue;
    }
    const currCount = currVc.tubes.flatMap((t) => t.fibers).length;
    const nextCount = nextVc.tubes.flatMap((t) => t.fibers).length;
    const shortCount = Math.min(currCount, nextCount);
    const tallCount = Math.max(currCount, nextCount);
    const adaptive = adaptiveBoundaryRowGap(shortCount);
    const stackClearance = Math.max(
      0,
      compactVisualCableHeight(tallCount) + CABLE_LAYOUT.cableGap - FIBER_ROW_PITCH,
    );
    return Math.max(adaptive, stackClearance);
  }
  return 0;
}

/** Stable row index per splice — drives vertical spacing and fiber order in cable nodes. */
export function connectionRowIndexMap(
  graph: ConnectionGraph,
  visualCables?: RowLayoutVisualCableRef[],
  dominant?: DominantCablePair | null,
  excludeConnectionIds?: ReadonlySet<string>,
): Map<string, number> {
  const map = new Map<string, number>();
  connectionsInRowLayoutOrder(
    graph,
    visualCables,
    dominant,
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
  dominant?: DominantCablePair | null,
  excludeConnectionIds?: ReadonlySet<string>,
): Map<string, number> {
  const map = new Map<string, number>();
  const connections = connectionsInRowLayoutOrder(
    graph,
    visualCables,
    dominant,
    excludeConnectionIds,
  );
  let y = 0;

  for (let i = 0; i < connections.length; i++) {
    map.set(connections[i]!.id, y);
    if (i < connections.length - 1) {
      y += rowStepAfter(
        connections[i]!,
        connections[i + 1]!,
        graph,
        visualCables,
        dominant,
      );
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
