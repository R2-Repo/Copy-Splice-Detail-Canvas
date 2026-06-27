import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";
import {
  findDominantCablePair,
  parentVisualGroupKey,
} from "@/features/diagram/dominantCablePair";
import {
  findVisualCableForConnection,
  type VisualCable,
} from "@/features/diagram/visualCables";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type { ConnectionGraph, QuadSide } from "@/types/splice";

import { quadCableBoxSize, quadStemAlignment } from "./quadGeometry";

export type QuadCablePlacement = {
  side: QuadSide;
  position: { x: number; y: number };
  boxWidth: number;
  boxHeight: number;
};

export type QuadLayoutResult = {
  placement: Map<string, QuadCablePlacement>;
  /** Aligned stem X per side (fiber label columns line up). */
  stemAlign: Record<QuadSide, number>;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

const MARGIN = 72;
const GAP = 44;
const MIN_WIDTH = 1200;
const MIN_HEIGHT = 760;

/** Connection-weighted adjacency between visual cables (by id). */
function cableAdjacency(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>();
  const bump = (a: string, b: string) => {
    const row = adj.get(a) ?? new Map<string, number>();
    row.set(b, (row.get(b) ?? 0) + 1);
    adj.set(a, row);
  };
  for (const conn of orderedFiberConnections(graph)) {
    const a = findVisualCableForConnection(visualCables, conn.id, {
      cable: conn.pair.endpointA.cable,
    });
    const b = findVisualCableForConnection(visualCables, conn.id, {
      cable: conn.pair.endpointB.cable,
    });
    if (!a || !b || a.id === b.id) continue;
    bump(a.id, b.id);
    bump(b.id, a.id);
  }
  return adj;
}

function totalWeight(row: Map<string, number> | undefined): number {
  if (!row) return 0;
  let sum = 0;
  for (const w of row.values()) sum += w;
  return sum;
}

/** Sides perpendicular to a given side — the short-L target for a stub. */
const PERPENDICULAR_SIDES: Record<QuadSide, QuadSide[]> = {
  left: ["top", "bottom"],
  right: ["top", "bottom"],
  top: ["left", "right"],
  bottom: ["left", "right"],
};

/** Side that the heaviest already-placed neighbor of `cableId` sits on. */
function dominantNeighborSide(
  cableId: string,
  adj: Map<string, Map<string, number>>,
  assigned: Map<string, QuadSide>,
): QuadSide | null {
  const row = adj.get(cableId);
  if (!row) return null;
  const bySide: Record<QuadSide, number> = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  };
  let resolved = false;
  for (const [neighborId, weight] of row) {
    const side = assigned.get(neighborId);
    if (!side) continue;
    bySide[side] += weight;
    resolved = true;
  }
  if (!resolved) return null;
  let best: QuadSide = "left";
  let bestWeight = -1;
  for (const side of ["top", "right", "bottom", "left"] as QuadSide[]) {
    if (bySide[side] > bestWeight) {
      bestWeight = bySide[side];
      best = side;
    }
  }
  return bestWeight > 0 ? best : null;
}

function pickLeastLoaded(
  candidates: QuadSide[],
  load: Record<QuadSide, number>,
): QuadSide {
  let best = candidates[0]!;
  for (const side of candidates) {
    if (load[side] < load[best]) best = side;
  }
  return best;
}

/**
 * Auto side assignment: anchor the dominant cable pair on left/right, then place
 * each remaining stub on a side *perpendicular* to its heaviest neighbor. This
 * keeps splice legs short L's and — critically — never drops a stub on the same
 * side as the cable it mostly talks to, so a cable whose fibers all go to a top
 * cable is no longer parked on top (which produced a pointless same-side loop).
 * User pins (overrides) always win.
 */
function assignSides(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  pinned: Record<string, QuadSide> | undefined,
): Map<string, QuadSide> {
  const sides = new Map<string, QuadSide>();
  const dominant = findDominantCablePair(graph, visualCables);
  const adj = cableAdjacency(graph, visualCables);

  const leftKey = dominant?.leftGroupKey;
  const rightKey = dominant?.rightGroupKey;

  const load: Record<QuadSide, number> = { left: 0, right: 0, top: 0, bottom: 0 };
  const remaining: VisualCable[] = [];
  for (const vc of visualCables) {
    const pin = pinned?.[vc.id];
    if (pin) {
      sides.set(vc.id, pin);
      load[pin] += 1;
      continue;
    }
    const group = parentVisualGroupKey(vc.id);
    if (leftKey && group === leftKey) {
      sides.set(vc.id, "left");
      load.left += 1;
    } else if (rightKey && group === rightKey) {
      sides.set(vc.id, "right");
      load.right += 1;
    } else remaining.push(vc);
  }

  // No dominant pair (tiny graph): fall back to the cable's CSV side.
  if (!leftKey || !rightKey) {
    for (const vc of remaining) {
      if (!sides.has(vc.id)) sides.set(vc.id, vc.side);
    }
    return sides;
  }

  // Heaviest stubs first: they connect closest to the dominant pair, so they
  // resolve a concrete neighbor side and anchor the lighter stubs after them.
  remaining.sort(
    (a, b) => totalWeight(adj.get(b.id)) - totalWeight(adj.get(a.id)),
  );

  const deferred: VisualCable[] = [];
  for (const vc of remaining) {
    const dom = dominantNeighborSide(vc.id, adj, sides);
    if (!dom) {
      deferred.push(vc);
      continue;
    }
    const side = pickLeastLoaded(PERPENDICULAR_SIDES[dom], load);
    sides.set(vc.id, side);
    load[side] += 1;
  }

  // Stubs that only talk to other stubs: resolve against the now-richer map,
  // else balance across top/bottom.
  for (const vc of deferred) {
    const dom = dominantNeighborSide(vc.id, adj, sides);
    const candidates = dom ? PERPENDICULAR_SIDES[dom] : (["top", "bottom"] as QuadSide[]);
    const side = pickLeastLoaded(candidates, load);
    sides.set(vc.id, side);
    load[side] += 1;
  }

  return sides;
}

function sumRun(boxes: number[]): number {
  if (boxes.length === 0) return 0;
  return boxes.reduce((s, b) => s + b, 0) + GAP * (boxes.length - 1);
}

/** Sort visual cables on a side by search stack order (cable name keys). */
function sortCablesForSide(
  cables: VisualCable[],
  side: QuadSide,
  stackOrderByCableKey: Partial<Record<QuadSide, string[]>> | undefined,
): VisualCable[] {
  const order = stackOrderByCableKey?.[side];
  if (!order || order.length === 0) return cables;
  const rank = new Map(order.map((key, index) => [key, index]));
  return [...cables].sort((a, b) => {
    const keyA = cableNameKey(a.cable);
    const keyB = cableNameKey(b.cable);
    const rankA = rank.get(keyA) ?? order.length;
    const rankB = rank.get(keyB) ?? order.length;
    return rankA - rankB || keyA.localeCompare(keyB);
  });
}

export function computeQuadPlacement(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  scale: number,
  options?: {
    layoutWidth?: number;
    pinnedSides?: Record<string, QuadSide>;
    savedPositions?: Record<string, { x: number; y: number }>;
    /** Search harness — stack order per side (physical cable name keys). */
    stackOrderByCableKey?: Partial<Record<QuadSide, string[]>>;
  },
): QuadLayoutResult {
  const sideById = assignSides(graph, visualCables, options?.pinnedSides);
  const stemAlign = quadStemAlignment(
    visualCables.map((vc) => ({ tubes: vc.tubes, side: sideById.get(vc.id)! })),
    scale,
  );

  const byside: Record<QuadSide, VisualCable[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };
  const boxOf = new Map<string, { width: number; height: number }>();
  for (const vc of visualCables) {
    const side = sideById.get(vc.id)!;
    const box = quadCableBoxSize(vc, side, scale, stemAlign[side]);
    boxOf.set(vc.id, box);
    byside[side].push(vc);
  }

  const depth = (side: QuadSide) =>
    byside[side].reduce(
      (m, vc) =>
        Math.max(
          m,
          side === "left" || side === "right"
            ? boxOf.get(vc.id)!.width
            : boxOf.get(vc.id)!.height,
        ),
      0,
    );
  const leftDepth = depth("left");
  const rightDepth = depth("right");
  const topDepth = depth("top");
  const bottomDepth = depth("bottom");

  // Run = total length cables occupy along their edge.
  const edgeRun = (side: QuadSide) =>
    sumRun(
      byside[side].map((vc) =>
        side === "left" || side === "right"
          ? boxOf.get(vc.id)!.height
          : boxOf.get(vc.id)!.width,
      ),
    );
  const leftRun = edgeRun("left");
  const rightRun = edgeRun("right");
  const topRun = edgeRun("top");
  const bottomRun = edgeRun("bottom");

  const horizExtras = leftDepth + rightDepth + 2 * MARGIN;
  const vertExtras = topDepth + bottomDepth + 2 * MARGIN;

  const width = Math.max(
    MIN_WIDTH,
    options?.layoutWidth ?? 0,
    Math.max(topRun, bottomRun) + horizExtras,
  );
  const height = Math.max(
    MIN_HEIGHT,
    Math.max(leftRun, rightRun) + vertExtras,
  );
  const centerX = width / 2;
  const centerY = height / 2;

  const placement = new Map<string, QuadCablePlacement>();

  const placeStack = (side: "left" | "right") => {
    const cables = sortCablesForSide(
      byside[side],
      side,
      options?.stackOrderByCableKey,
    );
    let cursor = centerY - edgeRun(side) / 2;
    for (const vc of cables) {
      const box = boxOf.get(vc.id)!;
      const x = side === "left" ? MARGIN : width - MARGIN - box.width;
      placement.set(vc.id, {
        side,
        position: { x, y: cursor },
        boxWidth: box.width,
        boxHeight: box.height,
      });
      cursor += box.height + GAP;
    }
  };

  const placeRow = (side: "top" | "bottom") => {
    const cables = sortCablesForSide(
      byside[side],
      side,
      options?.stackOrderByCableKey,
    );
    let cursor = centerX - edgeRun(side) / 2;
    for (const vc of cables) {
      const box = boxOf.get(vc.id)!;
      const y = side === "top" ? MARGIN : height - MARGIN - box.height;
      placement.set(vc.id, {
        side,
        position: { x: cursor, y },
        boxWidth: box.width,
        boxHeight: box.height,
      });
      cursor += box.width + GAP;
    }
  };

  placeStack("left");
  placeStack("right");
  placeRow("top");
  placeRow("bottom");

  // Honor saved drag positions on top of auto placement.
  if (options?.savedPositions) {
    for (const vc of visualCables) {
      const saved = options.savedPositions[`cable-${vc.id}`];
      const p = placement.get(vc.id);
      if (saved && p) p.position = { x: saved.x, y: saved.y };
    }
  }

  return { placement, stemAlign, width, height, centerX, centerY };
}
