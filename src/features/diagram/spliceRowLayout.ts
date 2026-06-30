import { effectiveCableGap } from "@/features/diagram/layoutExpansion";
import type { CableXBounds } from "@/features/diagram/cableLayoutMetrics";
import {
  BREAKOUT,
  computeSheathSize,
} from "@/features/diagram/cableBreakoutGeometry";
import { fixedHandleOutsetFromStem } from "@/features/diagram/cableLabels";
import {
  CABLE_LAYOUT,
  cableXForSide,
  cableNodeLayoutHeight,
  fiberRowOffsetInCable,
  fiberRowYFromOffset,
} from "@/features/diagram/cableLayoutMetrics";
import { connectionRowOffsets, connectionsInRowLayoutOrder } from "@/features/diagram/connectionRowOrder";
import type { CablePlacement } from "@/features/diagram/canvasPlacement";
import {
  parentVisualGroupKey,
} from "@/features/diagram/visualCables";
import { orderedFiberConnections, pairEndpointsForSide } from "@/features/diagram/buildConnectionGraph";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import {
  computeNearStraightShift,
  type AlignConnection,
} from "@/features/diagram/horizontalAlign";
import type { VisualCable } from "@/features/diagram/visualCables";
import type { ConnectionGraph } from "@/types/splice";

/** Align Y for cross-side pairs with at least this many splices (inclusive). */
const HIGH_COUNT_PAIR_THRESHOLD = 2;

export type AlignedDiagramLayout = {
  reportKey: string;
  rowYs: Map<string, number>;
  cablePositions: Map<string, { x: number; y: number; height: number }>;
  layoutWidth: number;
  /** Cables pinned by dominant/high-count pair alignment (not snapped). */
  alignmentLocked: ReadonlySet<string>;
};

export function estimatedCableNodeWidth(
  maxTubeCount = 3,
  scale = 1,
  tubeCounts?: number[],
): number {
  const counts =
    tubeCounts && tubeCounts.length > 0
      ? tubeCounts
      : [Math.max(1, maxTubeCount)];
  const maxStem = Math.max(
    ...counts.map((tubeCount) => {
      const sheath = computeSheathSize(scale, tubeCount);
      const tubeLength =
        (BREAKOUT.tubeLengthBase +
          Math.max(0, tubeCount - 1) * BREAKOUT.tubeLengthPerMultiTube) *
        scale;
      return sheath.width + tubeLength + BREAKOUT.fiberStemGap;
    }),
  );
  return maxStem + fixedHandleOutsetFromStem();
}

export function computeCableXBounds(
  visualCables: VisualCable[],
  _placement: Map<string, CablePlacement>,
  layoutWidth: number = CABLE_LAYOUT.width,
): CableXBounds {
  const margin = CABLE_LAYOUT.leftX;
  const maxTubes = Math.max(1, ...visualCables.map((vc) => vc.tubes.length));
  const nodeWidth = estimatedCableNodeWidth(
    maxTubes,
    1,
    visualCables.map((vc) => vc.tubes.length),
  );
  const width = layoutWidth;
  const leftX = margin;
  const rightX = Math.max(leftX + nodeWidth + 200, width - margin - nodeWidth);
  return { leftX, rightX };
}

function sideOfPlacement(
  vc: VisualCable,
  placement: Map<string, CablePlacement>,
): "left" | "right" {
  return placement.get(vc.id)?.side ?? vc.side;
}

function orderOfPlacement(
  vc: VisualCable,
  placement: Map<string, CablePlacement>,
): number {
  return placement.get(vc.id)?.order ?? vc.order;
}

/** Push same-side cable nodes apart so rendered boxes never overlap. */
export function resolveSameSideStackCollisions(
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
  cablePositions: Map<string, { x: number; y: number; height: number }>,
  heightFor: (vc: VisualCable) => number = (vc) => cableNodeLayoutHeight(vc),
  minGap = effectiveCableGap(),
  lockedIds?: ReadonlySet<string>,
): void {
  for (const side of ["left", "right"] as const) {
    const cables = visualCables
      .filter((vc) => sideOfPlacement(vc, placement) === side)
      .sort((a, b) => {
        const ay = cablePositions.get(a.id)?.y ?? 0;
        const by = cablePositions.get(b.id)?.y ?? 0;
        return (
          ay - by ||
          orderOfPlacement(a, placement) - orderOfPlacement(b, placement)
        );
      });

    let stackBottom = Number.NEGATIVE_INFINITY;
    for (const vc of cables) {
      const pos = cablePositions.get(vc.id);
      if (!pos) continue;
      const h = heightFor(vc);
      if (lockedIds?.has(vc.id)) {
        stackBottom = pos.y + h + minGap;
        continue;
      }
      const nodeY = Math.max(pos.y, stackBottom);
      cablePositions.set(vc.id, { ...pos, y: nodeY, height: h });
      stackBottom = nodeY + h + minGap;
    }
  }
}

export function resolveSameSideNodeCollisions(
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
  positions: Record<string, { x: number; y: number }>,
  scale = 1,
  /** Visual cable ids that are user-locked: keep their Y fixed; others stack around them. */
  lockedIds?: ReadonlySet<string>,
): void {
  for (const side of ["left", "right"] as const) {
    const cables = visualCables
      .filter((vc) => sideOfPlacement(vc, placement) === side)
      .sort((a, b) => {
        const ay = positions[`cable-${a.id}`]?.y ?? 0;
        const by = positions[`cable-${b.id}`]?.y ?? 0;
        return (
          ay - by ||
          orderOfPlacement(a, placement) - orderOfPlacement(b, placement)
        );
      });

    let stackBottom = Number.NEGATIVE_INFINITY;
    for (const vc of cables) {
      const nodeId = `cable-${vc.id}`;
      const pos = positions[nodeId];
      if (!pos) continue;
      const h = cableNodeLayoutHeight(vc, scale);
      if (lockedIds?.has(vc.id)) {
        // Frozen anchor: never move it; following cables stack below it.
        stackBottom = pos.y + h + effectiveCableGap();
        continue;
      }
      const nodeY = Math.max(pos.y, stackBottom);
      positions[nodeId] = { ...pos, y: nodeY };
      stackBottom = nodeY + h + effectiveCableGap();
    }
  }
}

type CablePairGroup = {
  sideA: { groupKey: string; canvasSide: "left" | "right" };
  sideB: { groupKey: string; canvasSide: "left" | "right" };
  connectionCount: number;
};

function connectionBelongsToPairGroup(
  visualCables: VisualCable[],
  connectionId: string,
  group: CablePairGroup,
  sideOf: (vc: VisualCable) => "left" | "right",
): boolean {
  const groupA = visualGroupForConnectionOnSide(
    visualCables,
    connectionId,
    group.sideA.canvasSide,
    sideOf,
  );
  const groupB = visualGroupForConnectionOnSide(
    visualCables,
    connectionId,
    group.sideB.canvasSide,
    sideOf,
  );
  return (
    groupA === group.sideA.groupKey && groupB === group.sideB.groupKey
  );
}

function findCablePairGroups(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
  minCount = HIGH_COUNT_PAIR_THRESHOLD,
): CablePairGroup[] {
  const sideOf = (vc: VisualCable) => placement.get(vc.id)?.side ?? vc.side;
  const byCable = new Map<string, VisualCable>();
  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    if (!byCable.has(key)) byCable.set(key, vc);
  }

  const counts = new Map<string, CablePairGroup>();
  for (const conn of orderedFiberConnections(graph)) {
    const { left, right } = pairEndpointsForSide(conn.pair, graph);
    const vcLeft = byCable.get(cableNameKey(left.cable));
    const vcRight = byCable.get(cableNameKey(right.cable));
    if (!vcLeft || !vcRight) continue;

    const canvasLeft = sideOf(vcLeft);
    const canvasRight = sideOf(vcRight);
    if (canvasLeft === canvasRight) continue;

    const groupLeft = visualGroupForConnectionOnSide(
      visualCables,
      conn.id,
      canvasLeft,
      sideOf,
    );
    const groupRight = visualGroupForConnectionOnSide(
      visualCables,
      conn.id,
      canvasRight,
      sideOf,
    );
    if (!groupLeft || !groupRight) continue;

    let sideA = { groupKey: groupLeft, canvasSide: canvasLeft };
    let sideB = { groupKey: groupRight, canvasSide: canvasRight };
    if (
      sideA.canvasSide > sideB.canvasSide ||
      (sideA.canvasSide === sideB.canvasSide &&
        sideA.groupKey > sideB.groupKey)
    ) {
      [sideA, sideB] = [sideB, sideA];
    }

    const key = `${sideA.canvasSide}:${sideA.groupKey}\0${sideB.canvasSide}:${sideB.groupKey}`;
    const entry = counts.get(key) ?? {
      sideA,
      sideB,
      connectionCount: 0,
    };
    entry.connectionCount += 1;
    counts.set(key, entry);
  }

  return [...counts.values()]
    .filter((g) => g.connectionCount >= minCount)
    .sort(
      (a, b) =>
        a.connectionCount - b.connectionCount ||
        pairGroupPriority(a) - pairGroupPriority(b),
    );
}

/** Prefer small/drop cable pairs before bulk 72↔144 alignment (SP-3254.5 CH straight-run). */
function pairGroupPriority(group: CablePairGroup): number {
  const label = `${group.sideA.groupKey} ${group.sideB.groupKey}`;
  if (/6 DROP/i.test(label)) return 0;
  if (/72-SMF/i.test(label)) return 2;
  return 1;
}

function visualGroupForConnectionOnSide(
  visualCables: VisualCable[],
  connectionId: string,
  side: "left" | "right",
  sideOf: (vc: VisualCable) => "left" | "right",
): string | undefined {
  const vc = visualCables.find(
    (v) =>
      sideOf(v) === side &&
      v.tubes.some((t) =>
        t.fibers.some(
          (f) =>
            f.connectionId === connectionId ||
            f.spliceConnectionIds?.includes(connectionId),
        ),
      ),
  );
  return vc ? parentVisualGroupKey(vc.id) : undefined;
}

const PAIR_ALIGN_EPS = 0.5;

/** Count cross-side legs that would be flat after aligning both cables to target Ys. */
function straightLegCountAfterPairAlignment(
  pairConnIds: string[],
  leftVc: VisualCable,
  rightVc: VisualCable,
  targetLeftY: number,
  targetRightY: number,
): number {
  let count = 0;
  for (const connId of pairConnIds) {
    const leftY = targetLeftY + fiberRowOffsetInCable(leftVc, connId);
    const rightY = targetRightY + fiberRowOffsetInCable(rightVc, connId);
    if (Math.abs(leftY - rightY) <= PAIR_ALIGN_EPS) count += 1;
  }
  return count;
}

/**
 * Pick the anchor connection that maximizes straight legs after pair Y alignment,
 * then minimizes the worst remaining handle gap (SDC-LAYOUT-001 straight-run nudge).
 */
function pickBestPairAlignmentAnchor(
  pairConnIds: string[],
  leftVc: VisualCable,
  rightVc: VisualCable,
  rowYs: Map<string, number>,
): string | undefined {
  if (pairConnIds.length === 0) return undefined;

  let bestId = pairConnIds[0]!;
  let bestStraight = -1;
  let bestMaxGap = Number.POSITIVE_INFINITY;
  let bestResidual = Number.POSITIVE_INFINITY;

  for (const connId of pairConnIds) {
    const rowY = rowYs.get(connId);
    if (rowY === undefined) continue;
    const leftOffset = fiberRowOffsetInCable(leftVc, connId);
    const rightOffset = fiberRowOffsetInCable(rightVc, connId);
    const targetLeftY = rowY - leftOffset;
    const targetRightY = rowY - rightOffset;
    const straight = straightLegCountAfterPairAlignment(
      pairConnIds,
      leftVc,
      rightVc,
      targetLeftY,
      targetRightY,
    );
    let residual = 0;
    let maxGap = 0;
    for (const id of pairConnIds) {
      const ly = targetLeftY + fiberRowOffsetInCable(leftVc, id);
      const ry = targetRightY + fiberRowOffsetInCable(rightVc, id);
      const gap = Math.abs(ly - ry);
      maxGap = Math.max(maxGap, gap);
      residual += gap;
    }
    if (
      straight > bestStraight ||
      (straight === bestStraight && maxGap < bestMaxGap) ||
      (straight === bestStraight &&
        maxGap === bestMaxGap &&
        residual < bestResidual)
    ) {
      bestStraight = straight;
      bestMaxGap = maxGap;
      bestResidual = residual;
      bestId = connId;
    }
  }

  return bestId;
}

function applyCablePairAlignment(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
  rowYs: Map<string, number>,
  cablePositions: Map<string, { x: number; y: number; height: number }>,
  groups: CablePairGroup[],
): Set<string> {
  const locked = new Set<string>();
  const sideOf = (vc: VisualCable) => placement.get(vc.id)?.side ?? vc.side;

  for (const group of groups) {
    const vcA = visualCables.filter(
      (v) =>
        parentVisualGroupKey(v.id) === group.sideA.groupKey &&
        sideOf(v) === group.sideA.canvasSide,
    );
    const vcB = visualCables.filter(
      (v) =>
        parentVisualGroupKey(v.id) === group.sideB.groupKey &&
        sideOf(v) === group.sideB.canvasSide,
    );
    if (vcA.length !== 1 || vcB.length !== 1) continue;

    const cableA = vcA[0]!;
    const cableB = vcB[0]!;
    if (locked.has(cableA.id) || locked.has(cableB.id)) continue;

    const pairConnIds = orderedFiberConnections(graph)
      .filter((conn) =>
        connectionBelongsToPairGroup(visualCables, conn.id, group, sideOf),
      )
      .map((conn) => conn.id);
    if (pairConnIds.length === 0) continue;

    const anchorConnId = pickBestPairAlignmentAnchor(
      pairConnIds,
      cableA,
      cableB,
      rowYs,
    );
    if (!anchorConnId) continue;
    const rowY = rowYs.get(anchorConnId);
    if (rowY === undefined) continue;

    const posA = cablePositions.get(cableA.id);
    const posB = cablePositions.get(cableB.id);
    if (!posA || !posB) continue;

    const offsetA = fiberRowOffsetInCable(cableA, anchorConnId);
    const offsetB = fiberRowOffsetInCable(cableB, anchorConnId);
    const targetAY = rowY - offsetA;
    const targetBY = rowY - offsetB;

    cablePositions.set(cableA.id, { ...posA, y: targetAY });
    cablePositions.set(cableB.id, { ...posB, y: targetBY });
    locked.add(cableA.id);
    locked.add(cableB.id);
  }

  return locked;
}

/** Build per-cable cross-side leg records (own/partner handle offsets). */
function alignConnsByCable(
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
): Map<string, AlignConnection[]> {
  const byConn = new Map<string, { left?: VisualCable; right?: VisualCable }>();
  for (const vc of visualCables) {
    const side = placement.get(vc.id)?.side ?? vc.side;
    for (const tube of vc.tubes) {
      for (const fiber of tube.fibers) {
        const entry = byConn.get(fiber.connectionId) ?? {};
        if (side === "left") entry.left = vc;
        else entry.right = vc;
        byConn.set(fiber.connectionId, entry);
      }
    }
  }

  const connsByCable = new Map<string, AlignConnection[]>();
  const push = (cableId: string, conn: AlignConnection) => {
    const list = connsByCable.get(cableId) ?? [];
    list.push(conn);
    connsByCable.set(cableId, list);
  };
  for (const [connId, ends] of byConn) {
    if (!ends.left || !ends.right) continue;
    const leftOffset = fiberRowOffsetInCable(ends.left, connId);
    const rightOffset = fiberRowOffsetInCable(ends.right, connId);
    push(ends.left.id, {
      ownOffset: leftOffset,
      partnerCableId: ends.right.id,
      partnerOffset: rightOffset,
    });
    push(ends.right.id, {
      ownOffset: rightOffset,
      partnerCableId: ends.left.id,
      partnerOffset: leftOffset,
    });
  }
  return connsByCable;
}

/**
 * Vertical slack a cable may shift without breaking same-side stack gaps
 * (SDC-LAYOUT-001-B / SDC-LAYOUT-001-C). Returns the inclusive [min, max] shift relative to the
 * cable's current Y.
 */
function sameSideShiftSlack(
  vc: VisualCable,
  placement: Map<string, CablePlacement>,
  cablePositions: Map<string, { x: number; y: number; height: number }>,
  minGap = effectiveCableGap(),
): { min: number; max: number } {
  const pos = cablePositions.get(vc.id);
  if (!pos) return { min: 0, max: 0 };
  const side = placement.get(vc.id)?.side ?? vc.side;

  let above: { y: number; height: number } | undefined;
  let below: { y: number; height: number } | undefined;

  // Nearest same-side neighbor above/below by current Y.
  for (const [otherId, otherPos] of cablePositions) {
    if (otherId === vc.id) continue;
    const matchVc = sideById.get(otherId);
    if (!matchVc) continue;
    if ((placement.get(matchVc.id)?.side ?? matchVc.side) !== side) continue;
    if (otherPos.y + otherPos.height <= pos.y) {
      if (!above || otherPos.y + otherPos.height > above.y + above.height) {
        above = otherPos;
      }
    } else if (otherPos.y >= pos.y + pos.height) {
      if (!below || otherPos.y < below.y) {
        below = otherPos;
      }
    }
  }

  const min = above
    ? above.y + above.height + minGap - pos.y
    : Number.NEGATIVE_INFINITY;
  const max = below
    ? below.y - pos.height - minGap - pos.y
    : Number.POSITIVE_INFINITY;
  return { min, max };
}

/** Same-side neighbor lookup, refreshed at the start of each alignment pass. */
let sideById = new Map<string, VisualCable>();

/**
 * One appliable near-straight shift for a cable: the snap delta clamped to the
 * cable's same-side slack. Returns 0 when no improving in-slack shift exists.
 */
function appliableNearStraightShift(
  vc: VisualCable,
  connsByCable: Map<string, AlignConnection[]>,
  placement: Map<string, CablePlacement>,
  cablePositions: Map<string, { x: number; y: number; height: number }>,
): number {
  const pos = cablePositions.get(vc.id);
  const conns = connsByCable.get(vc.id);
  if (!pos || !conns) return 0;
  const delta = computeNearStraightShift(
    pos.y,
    conns,
    (id) => cablePositions.get(id)?.y,
  );
  if (Math.abs(delta) <= 0.5) return 0;
  const slack = sameSideShiftSlack(vc, placement, cablePositions);
  // Only apply the exact snap delta; a clamped delta would not land flat.
  if (delta < slack.min - 0.5 || delta > slack.max + 0.5) return 0;
  return delta;
}

/**
 * Horizontal leg alignment (SDC-UX-001-A) — snap near-straight legs flat.
 *
 * After cable-pair alignment, nudge each remaining (unlocked) cable's Y by a
 * small amount (≤ tolerance) so legs that are only a few px off become a single
 * flat horizontal line. Whole-cable shift preserves 24px in-tube pitch and
 * tube/fiber order; locked dominant / high-count pairs are never moved; shifts
 * that would break same-side stack gaps are skipped. Iterates to a fixpoint.
 */
function snapNearStraightCables(
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
  cablePositions: Map<string, { x: number; y: number; height: number }>,
  locked: ReadonlySet<string>,
): void {
  sideById = new Map(visualCables.map((vc) => [vc.id, vc]));
  const connsByCable = alignConnsByCable(visualCables, placement);
  const ordered = [...visualCables]
    .filter((vc) => !locked.has(vc.id))
    .sort((a, b) => a.id.localeCompare(b.id));

  const maxIterations = visualCables.length + 2;
  for (let iter = 0; iter < maxIterations; iter++) {
    let moved = false;
    for (const vc of ordered) {
      const delta = appliableNearStraightShift(
        vc,
        connsByCable,
        placement,
        cablePositions,
      );
      if (Math.abs(delta) > 0.5) {
        const pos = cablePositions.get(vc.id)!;
        cablePositions.set(vc.id, { ...pos, y: pos.y + delta });
        moved = true;
      }
    }
    if (!moved) break;
  }
}

/**
 * Max residual near-straight shift across unlocked cables — 0 at the alignment
 * fixpoint. Used by SDC-UX-001-A to verify the layout snapped all flattenable legs.
 */
export function maxNearStraightResidual(
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
  cablePositions: Map<string, { x: number; y: number; height: number }>,
  locked: ReadonlySet<string>,
): number {
  sideById = new Map(visualCables.map((vc) => [vc.id, vc]));
  const connsByCable = alignConnsByCable(visualCables, placement);
  let residual = 0;
  for (const vc of visualCables) {
    if (locked.has(vc.id)) continue;
    const delta = appliableNearStraightShift(
      vc,
      connsByCable,
      placement,
      cablePositions,
    );
    residual = Math.max(residual, Math.abs(delta));
  }
  return residual;
}

export function computeAlignedLayout(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
  layoutWidth?: number,
  excludeConnectionIds?: ReadonlySet<string>,
): AlignedDiagramLayout {
  const rowYs = new Map<string, number>();
  const cablePositions = new Map<
    string,
    { x: number; y: number; height: number }
  >();

  const sorted = connectionsInRowLayoutOrder(
    graph,
    visualCables,
    excludeConnectionIds,
  );
  const rowOffsets = connectionRowOffsets(
    graph,
    visualCables,
    excludeConnectionIds,
  );

  for (const conn of sorted) {
    rowYs.set(
      conn.id,
      fiberRowYFromOffset(rowOffsets.get(conn.id) ?? 0),
    );
  }

  const sideOf = (vc: VisualCable) =>
    placement.get(vc.id)?.side ?? vc.side;
  const orderOf = (vc: VisualCable) =>
    placement.get(vc.id)?.order ?? vc.order;

  const leftCables = visualCables
    .filter((vc) => sideOf(vc) === "left")
    .sort((a, b) => orderOf(a) - orderOf(b));
  const rightCables = visualCables
    .filter((vc) => sideOf(vc) === "right")
    .sort((a, b) => orderOf(a) - orderOf(b));

  const effectiveWidth = layoutWidth ?? CABLE_LAYOUT.width;
  const xBounds = computeCableXBounds(
    visualCables,
    placement,
    effectiveWidth,
  );

  const alignedNodeY = (vc: VisualCable): number => {
    let nodeY: number | undefined;
    for (const tube of vc.tubes) {
      for (const fiber of tube.fibers) {
        const targetY = rowYs.get(fiber.connectionId);
        if (targetY === undefined) continue;
        const offset = fiberRowOffsetInCable(vc, fiber.connectionId);
        const candidate = targetY - offset;
        nodeY =
          nodeY === undefined ? candidate : Math.min(nodeY, candidate);
      }
    }
    return nodeY ?? CABLE_LAYOUT.topY;
  };

  /** Stack same-side cables by placement order so wide nodes do not overlap. */
  const placeSide = (cables: VisualCable[], side: "left" | "right") => {
    let stackBottom = Number.NEGATIVE_INFINITY;
    for (const vc of cables) {
      const nodeY = Math.max(alignedNodeY(vc), stackBottom);
      const h = cableNodeLayoutHeight(vc);
      const x = cableXForSide(side, vc.tubes.length, xBounds);
      cablePositions.set(vc.id, { x, y: nodeY, height: h });
      stackBottom = nodeY + h + effectiveCableGap();
    }
  };

  placeSide(leftCables, "left");
  placeSide(rightCables, "right");

  resolveSameSideStackCollisions(
    visualCables,
    placement,
    cablePositions,
  );

  const cablePairGroups = findCablePairGroups(graph, visualCables, placement);
  let locked: ReadonlySet<string> = new Set<string>();
  if (cablePairGroups.length > 0) {
    locked = applyCablePairAlignment(
      graph,
      visualCables,
      placement,
      rowYs,
      cablePositions,
      cablePairGroups,
    );
    resolveSameSideStackCollisions(
      visualCables,
      placement,
      cablePositions,
      (vc) => cableNodeLayoutHeight(vc),
      effectiveCableGap(),
      locked,
    );
  }

  // SDC-UX-001-A horizontal leg alignment — snap near-straight legs to a flat line.
  snapNearStraightCables(visualCables, placement, cablePositions, locked);
  resolveSameSideStackCollisions(
    visualCables,
    placement,
    cablePositions,
    (vc) => cableNodeLayoutHeight(vc),
    effectiveCableGap(),
    locked,
  );

  return {
    reportKey: "",
    rowYs,
    cablePositions,
    layoutWidth: effectiveWidth,
    alignmentLocked: locked,
  };
}
