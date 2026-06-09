import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";
import {
  assignCenterLanes,
  type SpliceHandleEntry,
  type SpliceRoutingLane,
} from "@/features/diagram/spliceCenterLanes";

export type { SpliceHandleEntry, SpliceRoutingLane };
export { handleEntriesToCandidates } from "@/features/diagram/spliceCenterLanes";

/** Isotropic intra-bundle / min lane pitch (plan 4.2, D11). */
export const INTRA_BUNDLE_ISOTROPIC_PITCH = SPLICE_LANE_SEP;

/** Minimum gap between unrelated bundles when packing center columns. */
export const MIN_INTER_BUNDLE_GAP = INTRA_BUNDLE_ISOTROPIC_PITCH;

export type OrthogonalSegment = {
  axis: "h" | "v";
  fixed: number;
  start: number;
  end: number;
};

/** Center lane assignment (plan §4.4). Callers should import from here, not spliceEdgeRouting. */
export function routeCenterSplices(
  entries: SpliceHandleEntry[],
  diagramCenterX: number,
): Map<string, SpliceRoutingLane> {
  return assignCenterLanes(entries, diagramCenterX);
}

/** Decompose an H–V–H splice into axis-aligned segments for oracle checks. */
export function hvSegmentsFromRoute(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  midX: number,
): OrthogonalSegment[] {
  const y1 = sourceY;
  const y2 = targetY;
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  const segments: OrthogonalSegment[] = [
    {
      axis: "h",
      fixed: y1,
      start: Math.min(sourceX, midX),
      end: Math.max(sourceX, midX),
    },
    { axis: "v", fixed: midX, start: minY, end: maxY },
    {
      axis: "h",
      fixed: y2,
      start: Math.min(midX, targetX),
      end: Math.max(midX, targetX),
    },
  ];
  return segments.filter((s) => Math.abs(s.end - s.start) > 0.5);
}

export function parallelSegmentsTooClose(
  a: OrthogonalSegment,
  b: OrthogonalSegment,
  minPitch: number,
): boolean {
  if (a.axis !== b.axis) return false;
  if (Math.abs(a.fixed - b.fixed) >= minPitch - 0.5) return false;
  const overlap =
    Math.min(a.end, b.end) - Math.max(a.start, b.start);
  return overlap > 0.5;
}

/** R3/F2: no coincident parallel lanes closer than pitch. */
export function segmentsViolateLaneSeparation(
  segments: OrthogonalSegment[],
  minPitch: number,
): boolean {
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 1; j < segments.length; j++) {
      if (parallelSegmentsTooClose(segments[i]!, segments[j]!, minPitch)) {
        return true;
      }
    }
  }
  return false;
}

export function centerRoutingExtentX(
  lanes: Iterable<SpliceRoutingLane>,
): { min: number; max: number } | null {
  const xs: number[] = [];
  for (const lane of lanes) {
    xs.push(lane.midX);
    if (lane.jogX !== undefined) xs.push(lane.jogX);
    if (lane.sourceBendX !== undefined) xs.push(lane.sourceBendX);
    if (lane.targetBendX !== undefined) xs.push(lane.targetBendX);
  }
  if (xs.length === 0) return null;
  return { min: Math.min(...xs), max: Math.max(...xs) };
}
