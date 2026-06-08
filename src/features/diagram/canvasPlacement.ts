import { pairEndpointsForSide } from "@/features/diagram/buildConnectionGraph";
import type { DominantCablePair } from "@/features/diagram/dominantCablePair";
import {
  minRowIndexForVisualCable,
  parentVisualGroupKey,
} from "@/features/diagram/dominantCablePair";
import type { VisualCable } from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph } from "@/types/splice";

export type CablePlacement = {
  side: "left" | "right";
  order: number;
};

const MAX_BARYCENTER_PASSES = 8;
const MAX_PERMUTE_CABLES = 8;

function fiberCountForVisualCable(vc: VisualCable): number {
  return vc.tubes.reduce((n, t) => n + t.fibers.length, 0);
}

function connectionCountForCable(graph: ConnectionGraph, cable: string): number {
  let count = 0;
  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    if (
      conn.pair.endpointA.cable === cable ||
      conn.pair.endpointB.cable === cable
    ) {
      count += 1;
    }
  }
  return count;
}

/** Data-driven tie-break after dominant/row ordering. */
function cableSortTieBreak(
  a: VisualCable,
  b: VisualCable,
  graph: ConnectionGraph,
): number {
  const connDiff =
    connectionCountForCable(graph, b.cable) -
    connectionCountForCable(graph, a.cable);
  if (connDiff !== 0) return connDiff;
  return fiberCountForVisualCable(b) - fiberCountForVisualCable(a);
}

function medianRowIndex(
  rowIndex: Map<string, number>,
  connectionIds: string[],
): number {
  const values = connectionIds
    .map((id) => rowIndex.get(id))
    .filter((row): row is number => row !== undefined)
    .sort((a, b) => a - b);
  if (values.length === 0) return Number.MAX_SAFE_INTEGER;
  return values[Math.floor(values.length / 2)]!;
}


function ownRowBarycenter(vc: VisualCable, rowIndex: Map<string, number>): number {
  return medianRowIndex(
    rowIndex,
    vc.tubes.flatMap((t) => t.fibers.map((f) => f.connectionId)),
  );
}

function partnerBarycenter(
  vc: VisualCable,
  graph: ConnectionGraph,
  rowIndex: Map<string, number>,
  visualCables: VisualCable[],
): number {
  const rows: number[] = [];
  const myKey = cableNameKey(vc.cable);

  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const onVc = vc.tubes.some((t) =>
      t.fibers.some((f) => f.connectionId === conn.id),
    );
    if (!onVc) continue;

    const { left, right } = pairEndpointsForSide(conn.pair, graph);
    const leftKey = cableNameKey(left.cable);
    const rightKey = cableNameKey(right.cable);
    const partnerKey = leftKey === myKey ? rightKey : rightKey === myKey ? leftKey : null;
    if (!partnerKey) continue;

    const partnerVcs = visualCables.filter(
      (v) => cableNameKey(v.cable) === partnerKey && v.side !== vc.side,
    );
    if (partnerVcs.length > 0) {
      for (const partnerVc of partnerVcs) {
        rows.push(minRowIndexForVisualCable(partnerVc, rowIndex));
      }
    } else {
      rows.push(rowIndex.get(conn.id) ?? 0);
    }
  }

  if (rows.length === 0) return Number.MAX_SAFE_INTEGER;
  return rows.reduce((sum, row) => sum + row, 0) / rows.length;
}

function sortSideByBarycenter(
  cables: VisualCable[],
  graph: ConnectionGraph,
  rowIndex: Map<string, number>,
  visualCables: VisualCable[],
  side: "left" | "right",
  dominant?: DominantCablePair | null,
): VisualCable[] {
  const ownRanks = new Map<string, number>();
  const partnerRanks = new Map<string, number>();
  for (const vc of cables) {
    ownRanks.set(vc.id, ownRowBarycenter(vc, rowIndex));
    partnerRanks.set(vc.id, partnerBarycenter(vc, graph, rowIndex, visualCables));
  }

  return [...cables].sort(
    (a, b) =>
      dominantGroupRank(a, side, dominant) -
        dominantGroupRank(b, side, dominant) ||
      (ownRanks.get(a.id) ?? 0) - (ownRanks.get(b.id) ?? 0) ||
      (partnerRanks.get(a.id) ?? 0) - (partnerRanks.get(b.id) ?? 0) ||
      cableSortTieBreak(a, b, graph) ||
      a.cable.localeCompare(b.cable) ||
      a.order - b.order,
  );
}

function ordersEqual(a: VisualCable[], b: VisualCable[]): boolean {
  return a.length === b.length && a.every((vc, i) => vc.id === b[i]?.id);
}

function convergeSideOrder(
  cables: VisualCable[],
  graph: ConnectionGraph,
  rowIndex: Map<string, number>,
  visualCables: VisualCable[],
  side: "left" | "right",
  dominant?: DominantCablePair | null,
): VisualCable[] {
  let order = sortSideByBarycenter(
    cables,
    graph,
    rowIndex,
    visualCables,
    side,
    dominant,
  );
  for (let pass = 0; pass < MAX_BARYCENTER_PASSES; pass++) {
    const next = sortSideByBarycenter(
      order,
      graph,
      rowIndex,
      visualCables,
      side,
      dominant,
    );
    if (ordersEqual(order, next)) break;
    order = next;
  }
  return order;
}

function countInversions(values: number[]): number {
  let inversions = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      if (values[i]! > values[j]!) inversions += 1;
    }
  }
  return inversions;
}

type StackCrossing = {
  leftRank: number;
  rightRank: number;
  rowIndex: number;
};

function stackCrossingsForOrders(
  leftOrder: VisualCable[],
  rightOrder: VisualCable[],
  graph: ConnectionGraph,
  rowIndex: Map<string, number>,
  visualCables: VisualCable[],
): number {
  const leftRank = new Map(leftOrder.map((vc, i) => [vc.id, i]));
  const rightRank = new Map(rightOrder.map((vc, i) => [vc.id, i]));
  const crossings: StackCrossing[] = [];

  for (const conn of graph.connections) {
    if (conn.kind !== "fiber") continue;
    const leftVc = visualCables.find(
      (v) =>
        v.side === "left" &&
        v.tubes.some((t) => t.fibers.some((f) => f.connectionId === conn.id)),
    );
    const rightVc = visualCables.find(
      (v) =>
        v.side === "right" &&
        v.tubes.some((t) => t.fibers.some((f) => f.connectionId === conn.id)),
    );
    if (!leftVc || !rightVc) continue;
    crossings.push({
      leftRank: leftRank.get(leftVc.id) ?? 0,
      rightRank: rightRank.get(rightVc.id) ?? 0,
      rowIndex: rowIndex.get(conn.id) ?? 0,
    });
  }

  crossings.sort(
    (a, b) => a.leftRank - b.leftRank || a.rowIndex - b.rowIndex,
  );
  return countInversions(crossings.map((c) => c.rightRank));
}

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items];
  const result: T[][] = [];
  for (let i = 0; i < items.length; i++) {
    const head = items[i]!;
    const tail = items.slice(0, i).concat(items.slice(i + 1));
    for (const perm of permutations(tail)) {
      result.push([head, ...perm]);
    }
  }
  return result;
}

function splitDominantFirst(
  cables: VisualCable[],
  side: "left" | "right",
  dominant?: DominantCablePair | null,
): { primary: VisualCable[]; secondary: VisualCable[] } {
  const primary: VisualCable[] = [];
  const secondary: VisualCable[] = [];
  for (const vc of cables) {
    if (dominantGroupRank(vc, side, dominant) === 0) {
      primary.push(vc);
    } else {
      secondary.push(vc);
    }
  }
  return { primary, secondary };
}

function optimizeJointStackOrder(
  leftCables: VisualCable[],
  rightCables: VisualCable[],
  graph: ConnectionGraph,
  rowIndex: Map<string, number>,
  visualCables: VisualCable[],
  dominant?: DominantCablePair | null,
): { left: VisualCable[]; right: VisualCable[] } {
  const leftSplit = splitDominantFirst(leftCables, "left", dominant);
  const rightSplit = splitDominantFirst(rightCables, "right", dominant);

  const leftSecondary = leftSplit.secondary;
  const rightSecondary = rightSplit.secondary;
  const canPermuteLeft = leftSecondary.length <= MAX_PERMUTE_CABLES;
  const canPermuteRight = rightSecondary.length <= MAX_PERMUTE_CABLES;

  if (!canPermuteLeft && !canPermuteRight) {
    return {
      left: [...leftSplit.primary, ...leftSecondary],
      right: [...rightSplit.primary, ...rightSecondary],
    };
  }

  const leftCandidates = canPermuteLeft
    ? permutations(leftSecondary)
    : [leftSecondary];
  const rightCandidates = canPermuteRight
    ? permutations(rightSecondary)
    : [rightSecondary];

  let bestLeft = [...leftSplit.primary, ...leftSecondary];
  let bestRight = [...rightSplit.primary, ...rightSecondary];
  let bestScore = stackCrossingsForOrders(
    bestLeft,
    bestRight,
    graph,
    rowIndex,
    visualCables,
  );

  for (const leftPerm of leftCandidates) {
    for (const rightPerm of rightCandidates) {
      const candidateLeft = [...leftSplit.primary, ...leftPerm];
      const candidateRight = [...rightSplit.primary, ...rightPerm];
      const score = stackCrossingsForOrders(
        candidateLeft,
        candidateRight,
        graph,
        rowIndex,
        visualCables,
      );
      if (score < bestScore) {
        bestScore = score;
        bestLeft = candidateLeft;
        bestRight = candidateRight;
      }
    }
  }

  return { left: bestLeft, right: bestRight };
}

export function computeCanvasPlacement(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  dominant?: DominantCablePair | null,
  rowIndex?: Map<string, number>,
): Map<string, CablePlacement> {
  const placement = new Map<string, CablePlacement>();

  for (const vc of visualCables) {
    placement.set(vc.id, { side: vc.side, order: vc.order });
  }

  if (!rowIndex) {
    const bySide = { left: [] as VisualCable[], right: [] as VisualCable[] };
    for (const vc of visualCables) {
      const p = placement.get(vc.id)!;
      bySide[p.side].push(vc);
    }
    for (const side of ["left", "right"] as const) {
      bySide[side]
        .sort(
          (a, b) =>
            dominantGroupRank(a, side, dominant) -
              dominantGroupRank(b, side, dominant) ||
            cableSortTieBreak(a, b, graph) ||
            a.cable.localeCompare(b.cable) ||
            a.order - b.order,
        )
        .forEach((vc, order) => {
          placement.set(vc.id, { side, order });
        });
    }
    return placement;
  }

  let leftOrder = visualCables.filter((vc) => vc.side === "left");
  let rightOrder = visualCables.filter((vc) => vc.side === "right");

  leftOrder = convergeSideOrder(
    leftOrder,
    graph,
    rowIndex,
    visualCables,
    "left",
    dominant,
  );
  rightOrder = convergeSideOrder(
    rightOrder,
    graph,
    rowIndex,
    visualCables,
    "right",
    dominant,
  );

  for (let pass = 0; pass < 2; pass++) {
    leftOrder = convergeSideOrder(
      leftOrder,
      graph,
      rowIndex,
      visualCables,
      "left",
      dominant,
    );
    rightOrder = convergeSideOrder(
      rightOrder,
      graph,
      rowIndex,
      visualCables,
      "right",
      dominant,
    );
  }

  const optimized = optimizeJointStackOrder(
    leftOrder,
    rightOrder,
    graph,
    rowIndex,
    visualCables,
    dominant,
  );
  leftOrder = optimized.left;
  rightOrder = optimized.right;

  leftOrder.forEach((vc, order) => {
    placement.set(vc.id, { side: "left", order });
  });
  rightOrder.forEach((vc, order) => {
    placement.set(vc.id, { side: "right", order });
  });

  return placement;
}

function dominantGroupRank(
  vc: VisualCable,
  side: "left" | "right",
  dominant?: DominantCablePair | null,
): number {
  if (!dominant) return 0;
  const group = parentVisualGroupKey(vc.id);
  const isPrimary =
    side === "left"
      ? group === dominant.leftGroupKey
      : group === dominant.rightGroupKey;
  return isPrimary ? 0 : 1;
}

/** Exported for tests — count strand crossings implied by stack order. */
export function stackOrderCrossingCount(
  leftOrder: VisualCable[],
  rightOrder: VisualCable[],
  graph: ConnectionGraph,
  rowIndex: Map<string, number>,
  visualCables: VisualCable[],
): number {
  return stackCrossingsForOrders(
    leftOrder,
    rightOrder,
    graph,
    rowIndex,
    visualCables,
  );
}
