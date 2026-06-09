import {
  orderedFiberConnections,
  pairEndpointsForSide,
} from "@/features/diagram/buildConnectionGraph";
import {
  canonicalLayoutEndpoint,
  isThroughCable,
} from "@/features/diagram/throughCable";
import type { ConnectionGraph, FiberConnection } from "@/types/splice";

export type VisualCableGroupRef = {
  id: string;
  side: "left" | "right";
  tubes: { fibers: { connectionId: string }[] }[];
};

export type DominantCablePair = {
  leftGroupKey: string;
  rightGroupKey: string;
  connectionCount: number;
};

export function parentVisualGroupKey(visualId: string): string {
  return visualId.replace(/~\d+$/, "");
}

export function visualGroupForConnection(
  visualCables: VisualCableGroupRef[],
  connectionId: string,
  side: "left" | "right",
): string | undefined {
  const vc = visualCables.find(
    (v) =>
      v.side === side &&
      v.tubes.some((t) =>
        t.fibers.some((f) => f.connectionId === connectionId),
      ),
  );
  return vc ? parentVisualGroupKey(vc.id) : undefined;
}

/** Left↔right visual-cable group with the most fiber splice rows. */
export function findDominantCablePair(
  graph: ConnectionGraph,
  visualCables: VisualCableGroupRef[],
): DominantCablePair | null {
  const counts = new Map<
    string,
    { leftGroupKey: string; rightGroupKey: string; connectionCount: number }
  >();

  for (const conn of orderedFiberConnections(graph)) {
    const leftGroup = visualGroupForConnection(visualCables, conn.id, "left");
    const rightGroup = visualGroupForConnection(visualCables, conn.id, "right");
    if (!leftGroup || !rightGroup) continue;

    const key = `${leftGroup}\0${rightGroup}`;
    const entry = counts.get(key) ?? {
      leftGroupKey: leftGroup,
      rightGroupKey: rightGroup,
      connectionCount: 0,
    };
    entry.connectionCount += 1;
    counts.set(key, entry);
  }

  let best: DominantCablePair | null = null;
  let bestScore: [number, number, number] | null = null;

  for (const entry of counts.values()) {
    const score = scoreDominantPair(entry, visualCables, graph);
    if (
      !best ||
      !bestScore ||
      score[0] > bestScore[0] ||
      (score[0] === bestScore[0] && score[1] > bestScore[1]) ||
      (score[0] === bestScore[0] &&
        score[1] === bestScore[1] &&
        score[2] > bestScore[2])
    ) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

function cableNameFromGroupKey(groupKey: string): string {
  const sep = groupKey.indexOf("::");
  return sep >= 0 ? groupKey.slice(sep + 2) : groupKey;
}

function fiberCountForGroup(
  visualCables: VisualCableGroupRef[],
  groupKey: string,
  side: "left" | "right",
): number {
  return visualCables
    .filter(
      (vc) => vc.side === side && parentVisualGroupKey(vc.id) === groupKey,
    )
    .reduce((n, vc) => n + vc.tubes.flatMap((t) => t.fibers).length, 0);
}

/** Prefer highest count, then through↔through, then most fibers involved. */
function scoreDominantPair(
  entry: DominantCablePair,
  visualCables: VisualCableGroupRef[],
  graph: ConnectionGraph,
): [number, number, number] {
  const leftName = cableNameFromGroupKey(entry.leftGroupKey);
  const rightName = cableNameFromGroupKey(entry.rightGroupKey);
  const throughScore =
    (isThroughCable(leftName, graph) ? 1 : 0) +
    (isThroughCable(rightName, graph) ? 1 : 0);
  const fiberTotal =
    fiberCountForGroup(visualCables, entry.leftGroupKey, "left") +
    fiberCountForGroup(visualCables, entry.rightGroupKey, "right");
  return [entry.connectionCount, throughScore, fiberTotal];
}

export function connectionInDominantPair(
  conn: FiberConnection,
  _graph: ConnectionGraph,
  visualCables: VisualCableGroupRef[],
  dominant: DominantCablePair,
): boolean {
  const leftGroup = visualGroupForConnection(visualCables, conn.id, "left");
  const rightGroup = visualGroupForConnection(visualCables, conn.id, "right");
  return (
    leftGroup === dominant.leftGroupKey &&
    rightGroup === dominant.rightGroupKey
  );
}

export function dominantPairFiberSortKey(
  conn: FiberConnection,
  graph: ConnectionGraph,
): number {
  const { left, right } = pairEndpointsForSide(conn.pair, graph);
  return canonicalLayoutEndpoint(left, right, graph).fiberNumber;
}

export function minRowIndexForVisualCable(
  vc: VisualCableGroupRef,
  rowIndex: Map<string, number>,
): number {
  const indices = vc.tubes
    .flatMap((t) => t.fibers)
    .map((f) => rowIndex.get(f.connectionId) ?? Number.MAX_SAFE_INTEGER);
  return indices.length ? Math.min(...indices) : Number.MAX_SAFE_INTEGER;
}
