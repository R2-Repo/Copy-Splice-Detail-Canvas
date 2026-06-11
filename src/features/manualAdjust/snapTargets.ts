import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import { snapToNearestTarget } from "@/features/diagram/snapGuides";

const SNAP_TOLERANCE = 8;

export function snapManualDeltaY(
  rawDelta: number,
  targets: number[],
  baseY: number,
): number {
  const snapped = snapToNearestTarget(
    baseY + rawDelta,
    targets,
    SNAP_TOLERANCE,
  );
  return snapped - baseY;
}

export function snapManualY(value: number, targets: number[]): number {
  return snapToNearestTarget(value, targets, SNAP_TOLERANCE);
}

export function collectHandleSnapTargetsYs(
  anchorYs: number[],
  tubeTipYs: number[],
): number[] {
  const pitchTargets = anchorYs.flatMap((y) => [
    y,
    y + FIBER_ROW_PITCH,
    y - FIBER_ROW_PITCH,
  ]);
  return [...new Set([...anchorYs, ...tubeTipYs, ...pitchTargets])].sort(
    (a, b) => a - b,
  );
}

export function collectSegmentSnapTargetsXs(midXs: number[], dotXs: number[]): number[] {
  return [...new Set([...midXs, ...dotXs])].sort((a, b) => a - b);
}
