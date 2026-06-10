import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { applyPersistedTubeOverrides } from "@/features/diagram/applyTubeOverrides";
import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import { tubeHandleAbsoluteY } from "@/features/diagram/tubeRowShift";
import type {
  ConnectionGraph,
  TubeManualOverride,
  TubeOverrideKey,
} from "@/types/splice";

const SNAP_TOLERANCE = 8;

/** Round a delta to the nearest layout pitch (default 24px). */
export function snapToPitch(
  delta: number,
  pitch = FIBER_ROW_PITCH,
): number {
  return Math.round(delta / pitch) * pitch;
}

/** Snap `value` to the nearest target within tolerance; otherwise return `value`. */
export function snapToNearestTarget(
  value: number,
  targets: number[],
  tolerance = SNAP_TOLERANCE,
): number {
  let best = value;
  let bestDist = tolerance + 1;
  for (const target of targets) {
    const dist = Math.abs(value - target);
    if (dist <= tolerance && dist < bestDist) {
      best = target;
      bestDist = dist;
    }
  }
  return best;
}

/** Snap stem reach X to zero extension only (manual mode — no auto-reach pull). */
export function snapStemReachX(
  reachX: number,
  _alignedStemX: number | undefined,
  _tubeFaceX: number,
  _defaultTubeLength: number,
  tolerance = SNAP_TOLERANCE,
): number {
  return snapToNearestTarget(reachX, [0], tolerance);
}

/** Collect unique snap targets for tube tip absolute Y. */
export function tubeTipSnapTargets(
  rowYs: number[],
  pairedTipYs: number[],
): number[] {
  const targets = new Set<number>();
  for (const y of rowYs) targets.add(y);
  for (const y of pairedTipYs) targets.add(y);
  return [...targets];
}

/** Snap tube tip delta-Y to pitch and optional layout lines. */
export function snapTubeTipShiftY(
  shiftY: number,
  absoluteTipY: number,
  snapTargets: number[],
  tolerance = SNAP_TOLERANCE,
): number {
  const pitched = snapToPitch(shiftY);
  const snappedAbs = snapToNearestTarget(absoluteTipY, snapTargets, tolerance);
  if (snappedAbs !== absoluteTipY) {
    return pitched + (snappedAbs - absoluteTipY);
  }
  return pitched;
}

/** Manual drag release: snap to 24px pitch grid + peer layout lines (not auto-reach). */
export function snapManualAbsoluteY(
  absoluteY: number,
  layoutLineYs: number[],
  rowAnchorY: number,
  tolerance = SNAP_TOLERANCE,
): number {
  const pitchTargets: number[] = [];
  for (let step = -4; step <= 4; step++) {
    pitchTargets.push(rowAnchorY + step * FIBER_ROW_PITCH);
  }
  const targets = [...new Set([...layoutLineYs, ...pitchTargets])];
  return snapToNearestTarget(absoluteY, targets, tolerance);
}

/** Manual fan-out release: keep shiftY but snap absolute tip to pitch + peers. */
export function snapManualShiftYOnRelease(
  shiftY: number,
  rowAnchorY: number,
  layoutLineYs: number[],
  tolerance = SNAP_TOLERANCE,
): number {
  const absolute = rowAnchorY + shiftY;
  const snapped = snapManualAbsoluteY(
    absolute,
    layoutLineYs,
    rowAnchorY,
    tolerance,
  );
  return snapped - rowAnchorY;
}

/** Manual drag release: snap to layout lines only (no pitch quantize). */
export function snapTubeTipShiftYOnRelease(
  shiftY: number,
  absoluteTipY: number,
  snapTargets: number[],
  tolerance = SNAP_TOLERANCE,
): number {
  const snappedAbs = snapToNearestTarget(absoluteTipY, snapTargets, tolerance);
  if (snappedAbs !== absoluteTipY) {
    return shiftY + (snappedAbs - absoluteTipY);
  }
  return shiftY;
}

/** Absolute canvas Y targets for tube-tip snapping across the diagram. */
export function collectGlobalTubeTipSnapTargets(
  graph: ConnectionGraph,
  positions: Record<string, { x: number; y: number }>,
  tubeOverrides?: Record<TubeOverrideKey, TubeManualOverride>,
): number[] {
  const { visualCables } = buildVisualCablesForLayout(graph);
  applyPersistedTubeOverrides(visualCables, tubeOverrides);
  const targets: number[] = [];
  for (const vc of visualCables) {
    const pos = positions[`cable-${vc.id}`];
    if (!pos) continue;
    for (const tube of vc.tubes) {
      targets.push(tubeHandleAbsoluteY(vc, tube, pos.y));
    }
  }
  return targets;
}

export function spliceEdgeIdsForTubeKey(
  graph: ConnectionGraph,
  tubeKey: TubeOverrideKey,
): Set<string> {
  const [vcId, tubeColor] = tubeKey.split("|") as [string, string];
  const touched = new Set<string>();
  const { visualCables } = buildVisualCablesForLayout(graph);
  const vc = visualCables.find((v) => v.id === vcId);
  if (!vc) return touched;
  const tube = vc.tubes.find((t) => t.tubeColor === tubeColor);
  if (!tube) return touched;
  for (const fiber of tube.fibers) {
    touched.add(`splice-${fiber.connectionId}`);
  }
  return touched;
}
