import type { TubeOverrideKey } from "@/types/splice";

export type ManualAdjustZone =
  | "fanout-labels"
  | "handle"
  | "leg-segment"
  | "fusion-dot";

export type LegSide = "left" | "right";

export type SegmentDragAxis = "horizontal" | "vertical";

export type LegSegmentOverride = { dx?: number; dy?: number };

export type ConnectionLegOverrides = {
  leftSegments?: Record<number, LegSegmentOverride>;
  rightSegments?: Record<number, LegSegmentOverride>;
  /** Manual horizontal slide of the fusion dot (= leg color transition) along its leg. */
  dotShiftX?: number;
};

export type FanoutOverride = { shiftY: number };

export type ManualAdjustSelection = {
  connectionIds: Set<string>;
  segmentKeys: Set<string>;
};

export type SegmentDragKey = `${string}::${LegSide}::${number}`;

export function segmentDragKey(
  connectionId: string,
  side: LegSide,
  segmentIndex: number,
): SegmentDragKey {
  return `${connectionId}::${side}::${segmentIndex}`;
}

export function fanoutOverrideKey(
  visualCableId: string,
  tubeColor: string,
): TubeOverrideKey {
  return `${visualCableId}|${tubeColor}`;
}
