import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";
import {
  findDominantCablePair,
  parentVisualGroupKey,
} from "@/features/diagram/dominantCablePair";
import {
  findVisualCableForConnection,
  type VisualCable,
} from "@/features/diagram/visualCables";
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

/**
 * Auto side assignment (v1): anchor the dominant cable pair on left/right, then
 * spread remaining cables across top/bottom to keep their splice legs short L's
 * instead of long center crossings. User pins (overrides) win.
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

  const remaining: VisualCable[] = [];
  for (const vc of visualCables) {
    const pin = pinned?.[vc.id];
    if (pin) {
      sides.set(vc.id, pin);
      continue;
    }
    const group = parentVisualGroupKey(vc.id);
    if (leftKey && group === leftKey) sides.set(vc.id, "left");
    else if (rightKey && group === rightKey) sides.set(vc.id, "right");
    else remaining.push(vc);
  }

  // No dominant pair (tiny graph): fall back to the cable's CSV side.
  if (!leftKey || !rightKey) {
    for (const vc of remaining) {
      if (!sides.has(vc.id)) sides.set(vc.id, vc.side);
    }
    return sides;
  }

  // Heaviest stubs first, alternating top/bottom for balance.
  remaining.sort((a, b) => totalWeight(adj.get(b.id)) - totalWeight(adj.get(a.id)));
  remaining.forEach((vc, i) => {
    sides.set(vc.id, i % 2 === 0 ? "top" : "bottom");
  });
  return sides;
}

function sumRun(boxes: number[]): number {
  if (boxes.length === 0) return 0;
  return boxes.reduce((s, b) => s + b, 0) + GAP * (boxes.length - 1);
}

export function computeQuadPlacement(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  scale: number,
  options?: {
    layoutWidth?: number;
    pinnedSides?: Record<string, QuadSide>;
    savedPositions?: Record<string, { x: number; y: number }>;
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
    const cables = byside[side];
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
    const cables = byside[side];
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
