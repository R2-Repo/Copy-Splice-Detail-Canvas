import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";
import {
  CABLE_LAYOUT,
  FIBER_ROW_PITCH,
  TUBE_GROUP_GAP,
} from "@/features/diagram/cableLayoutMetrics";
import { endpointOnVisualSide, findVisualCableForConnection } from "@/features/diagram/visualCables";
import type { VisualCable, VisualTube } from "@/features/diagram/visualCables";
import type { ConnectionGraph, TubeColorCode } from "@/types/splice";

/** Max tube-tip shift per buffer tube in expanded mode (half pitch). */
export const MAX_TUBE_ROW_SHIFT = FIBER_ROW_PITCH / 2;

/** Max tube-tip shift when the tube is collapsed (full butt splice). */
export const MAX_TUBE_ROW_SHIFT_COLLAPSED = FIBER_ROW_PITCH;

const Y_TOLERANCE = 0.5;

export type TubeKey = `${string}|${TubeColorCode}`;

export type TubeRowShiftOptions = {
  collapsedTubeColorsByVcId?: ReadonlyMap<
    string,
    ReadonlySet<TubeColorCode>
  >;
  /** Tubes with manual overrides — skip auto visualShiftY reset/apply. */
  lockedTubeKeys?: ReadonlySet<TubeKey>;
};

export function tubeKeyFor(vcId: string, tubeColor: TubeColorCode): TubeKey {
  return `${vcId}|${tubeColor}`;
}

/** Handle-row offset for tube center before visualShiftY (matches default tube.end.y). */
export function tubeCenterRowOffset(tube: VisualTube): number {
  const offsets = tube.fibers.map((f) => f.rowYOffset);
  if (offsets.length === 0) return CABLE_LAYOUT.headerH;
  const mid = (Math.min(...offsets) + Math.max(...offsets)) / 2;
  const rowStart = CABLE_LAYOUT.headerH + CABLE_LAYOUT.tubeLabelH;
  return rowStart + mid + FIBER_ROW_PITCH / 2;
}

export function tubeHandleAbsoluteY(
  _vc: VisualCable,
  tube: VisualTube,
  cableY: number,
): number {
  return cableY + tubeCenterRowOffset(tube) + (tube.visualShiftY ?? 0);
}

export function maxShiftForTube(
  vcId: string,
  tubeColor: TubeColorCode,
  options?: TubeRowShiftOptions,
): number {
  const collapsed = options?.collapsedTubeColorsByVcId?.get(vcId);
  if (collapsed?.has(tubeColor)) {
    return MAX_TUBE_ROW_SHIFT_COLLAPSED;
  }
  return MAX_TUBE_ROW_SHIFT;
}

function pairAlignBudget(
  leftKey: TubeKey,
  rightKey: TubeKey,
  options?: TubeRowShiftOptions,
): number {
  const [leftVcId, leftTube] = leftKey.split("|") as [string, TubeColorCode];
  const [rightVcId, rightTube] = rightKey.split("|") as [
    string,
    TubeColorCode,
  ];
  return (
    maxShiftForTube(leftVcId, leftTube, options) +
    maxShiftForTube(rightVcId, rightTube, options)
  );
}

function median(values: number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}

type TubePairGroup = {
  leftKey: TubeKey;
  rightKey: TubeKey;
  connectionIds: string[];
};

function collectTubePairGroups(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
): TubePairGroup[] {
  const groups = new Map<string, TubePairGroup>();

  for (const conn of orderedFiberConnections(graph)) {
    if (conn.kind !== "fiber") continue;
    const leftEp = endpointOnVisualSide(
      conn,
      graph,
      visualCables,
      "left",
    );
    const rightEp = endpointOnVisualSide(
      conn,
      graph,
      visualCables,
      "right",
    );
    if (!leftEp || !rightEp) continue;

    const leftVc = findVisualCableForConnection(visualCables, conn.id, {
      cable: leftEp.endpoint.cable,
      canvasSide: "left",
    });
    const rightVc = findVisualCableForConnection(visualCables, conn.id, {
      cable: rightEp.endpoint.cable,
      canvasSide: "right",
    });
    if (!leftVc || !rightVc) continue;

    const leftKey = tubeKeyFor(leftVc.id, leftEp.endpoint.tubeColor);
    const rightKey = tubeKeyFor(rightVc.id, rightEp.endpoint.tubeColor);
    const groupKey = `${leftKey}::${rightKey}`;
    const existing = groups.get(groupKey);
    if (existing) {
      existing.connectionIds.push(conn.id);
    } else {
      groups.set(groupKey, {
        leftKey,
        rightKey,
        connectionIds: [conn.id],
      });
    }
  }

  return [...groups.values()];
}

function clampShift(value: number, max: number): number {
  return Math.max(-max, Math.min(max, value));
}

function resetVisualShifts(
  visualCables: VisualCable[],
  locked?: ReadonlySet<TubeKey>,
): void {
  for (const vc of visualCables) {
    for (const tube of vc.tubes) {
      const key = tubeKeyFor(vc.id, tube.tubeColor);
      if (locked?.has(key)) continue;
      tube.visualShiftY = 0;
    }
  }
}

/** Keep tube tip Y order and minimum gap after visual shifts (bidirectional). */
function resolveTubeShiftSpacing(
  vc: VisualCable,
  shifts: Map<TubeColorCode, number>,
  options?: TubeRowShiftOptions,
): void {
  const maxFor = (tube: VisualTube) =>
    maxShiftForTube(vc.id, tube.tubeColor, options);

  const tubes = [...vc.tubes].sort((a, b) => {
    const ay = tubeCenterRowOffset(a);
    const by = tubeCenterRowOffset(b);
    return ay - by;
  });

  for (let i = 1; i < tubes.length; i++) {
    const prev = tubes[i - 1]!;
    const curr = tubes[i]!;
    const prevShift = shifts.get(prev.tubeColor) ?? 0;
    let currShift = shifts.get(curr.tubeColor) ?? 0;
    const prevTip = tubeCenterRowOffset(prev) + prevShift;
    const currTip = tubeCenterRowOffset(curr) + currShift;
    const minTop = prevTip + TUBE_GROUP_GAP;
    if (currTip + Y_TOLERANCE < minTop) {
      const needed = minTop - currTip;
      currShift = clampShift(currShift + needed, maxFor(curr));
      shifts.set(curr.tubeColor, currShift);
    }
  }

  for (let i = tubes.length - 2; i >= 0; i--) {
    const prev = tubes[i]!;
    const curr = tubes[i + 1]!;
    const prevShift = shifts.get(prev.tubeColor) ?? 0;
    const currShift = shifts.get(curr.tubeColor) ?? 0;
    const prevTip = tubeCenterRowOffset(prev) + prevShift;
    const currTip = tubeCenterRowOffset(curr) + currShift;
    const slack = currTip - (prevTip + TUBE_GROUP_GAP);
    if (slack <= Y_TOLERANCE) continue;

    const prevMax = maxFor(prev);
    const currMax = maxFor(curr);
    const prevUp = Math.min(slack / 2, prevShift + prevMax);
    const currUp = Math.min(slack / 2, currShift + currMax);
    const lift = Math.min(prevUp, currUp);
    if (lift <= Y_TOLERANCE) continue;

    shifts.set(prev.tubeColor, clampShift(prevShift - lift, prevMax));
    shifts.set(curr.tubeColor, clampShift(currShift - lift, currMax));
  }
}

function applyShiftsToVisualCable(
  vc: VisualCable,
  shifts: Map<TubeColorCode, number>,
  locked?: ReadonlySet<TubeKey>,
): void {
  for (const tube of vc.tubes) {
    const key = tubeKeyFor(vc.id, tube.tubeColor);
    if (locked?.has(key)) continue;
    const delta = shifts.get(tube.tubeColor) ?? 0;
    if (Math.abs(delta) <= Y_TOLERANCE) {
      tube.visualShiftY = 0;
    } else {
      tube.visualShiftY = delta;
    }
  }
}

export function cablePositionsFromNodePositions(
  positions: Record<string, { x: number; y: number }>,
  heights?: Map<string, number>,
): Map<string, { x: number; y: number; height: number }> {
  const map = new Map<string, { x: number; y: number; height: number }>();
  for (const [nodeId, pos] of Object.entries(positions)) {
    if (!nodeId.startsWith("cable-")) continue;
    const vcId = nodeId.slice("cable-".length);
    map.set(vcId, {
      x: pos.x,
      y: pos.y,
      height: heights?.get(vcId) ?? 0,
    });
  }
  return map;
}

export function crossSideTubePairsAligned(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  cablePositions: Map<string, { x: number; y: number; height: number }>,
  options?: TubeRowShiftOptions & { tolerance?: number },
): boolean {
  const tolerance = options?.tolerance ?? Y_TOLERANCE;
  const vcById = new Map(visualCables.map((vc) => [vc.id, vc]));

  for (const group of collectTubePairGroups(graph, visualCables)) {
    const [leftVcId, leftTubeColor] = group.leftKey.split("|") as [
      string,
      TubeColorCode,
    ];
    const [rightVcId, rightTubeColor] = group.rightKey.split("|") as [
      string,
      TubeColorCode,
    ];
    const leftVc = vcById.get(leftVcId);
    const rightVc = vcById.get(rightVcId);
    const leftPos = cablePositions.get(leftVcId);
    const rightPos = cablePositions.get(rightVcId);
    if (!leftVc || !rightVc || !leftPos || !rightPos) continue;

    const leftTube = leftVc.tubes.find((t) => t.tubeColor === leftTubeColor);
    const rightTube = rightVc.tubes.find((t) => t.tubeColor === rightTubeColor);
    if (!leftTube || !rightTube) continue;

    const leftY = tubeHandleAbsoluteY(leftVc, leftTube, leftPos.y);
    const rightY = tubeHandleAbsoluteY(rightVc, rightTube, rightPos.y);
    const preGap = Math.abs(
      leftPos.y +
        tubeCenterRowOffset(leftTube) -
        (rightPos.y + tubeCenterRowOffset(rightTube)),
    );
    const budget = pairAlignBudget(group.leftKey, group.rightKey, options);
    if (preGap > budget + Y_TOLERANCE) continue;
    if (Math.abs(leftY - rightY) > tolerance) return false;
  }

  return true;
}

/**
 * Shift individual buffer tube tips within each cable so cross-side tube pairs
 * share a straight row Y. Fiber handles stay fixed.
 */
export function applyTubeRowAlignmentShifts(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  _rowYs: Map<string, number>,
  cablePositions: Map<string, { x: number; y: number; height: number }>,
  options?: TubeRowShiftOptions,
): void {
  const locked = options?.lockedTubeKeys;
  resetVisualShifts(visualCables, locked);

  const ideals = new Map<TubeKey, number[]>();
  const vcById = new Map(visualCables.map((vc) => [vc.id, vc]));

  for (const group of collectTubePairGroups(graph, visualCables)) {
    const [leftVcId, leftTube] = group.leftKey.split("|") as [
      string,
      TubeColorCode,
    ];
    const [rightVcId, rightTube] = group.rightKey.split("|") as [
      string,
      TubeColorCode,
    ];
    const leftVc = vcById.get(leftVcId);
    const rightVc = vcById.get(rightVcId);
    const leftPos = cablePositions.get(leftVcId);
    const rightPos = cablePositions.get(rightVcId);
    if (!leftVc || !rightVc || !leftPos || !rightPos) continue;

    const leftTubeGeom = leftVc.tubes.find((t) => t.tubeColor === leftTube);
    const rightTubeGeom = rightVc.tubes.find((t) => t.tubeColor === rightTube);
    if (!leftTubeGeom || !rightTubeGeom) continue;

    const leftBase = leftPos.y + tubeCenterRowOffset(leftTubeGeom);
    const rightBase = rightPos.y + tubeCenterRowOffset(rightTubeGeom);
    const preGap = Math.abs(leftBase - rightBase);
    const budget = pairAlignBudget(group.leftKey, group.rightKey, options);
    if (preGap > budget + Y_TOLERANCE) continue;

    const targetRowY = (leftBase + rightBase) / 2;
    const leftIdeal = targetRowY - leftBase;
    const rightIdeal = targetRowY - rightBase;

    const leftIdeals = ideals.get(group.leftKey) ?? [];
    leftIdeals.push(leftIdeal);
    ideals.set(group.leftKey, leftIdeals);

    const rightIdeals = ideals.get(group.rightKey) ?? [];
    rightIdeals.push(rightIdeal);
    ideals.set(group.rightKey, rightIdeals);
  }

  const tubeShifts = new Map<TubeKey, number>();
  for (const [key, values] of ideals) {
    const target = median(values);
    if (target === undefined) continue;
    const [vcId, tubeColor] = key.split("|") as [string, TubeColorCode];
    tubeShifts.set(
      key,
      clampShift(target, maxShiftForTube(vcId, tubeColor, options)),
    );
  }

  for (const vc of visualCables) {
    const perCable = new Map<TubeColorCode, number>();
    for (const tube of vc.tubes) {
      const key = tubeKeyFor(vc.id, tube.tubeColor);
      perCable.set(tube.tubeColor, tubeShifts.get(key) ?? 0);
    }
    resolveTubeShiftSpacing(vc, perCable, options);
    applyShiftsToVisualCable(vc, perCable, locked);
  }
}
