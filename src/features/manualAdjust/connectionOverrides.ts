import type { LayoutOverrides, ConnectionOverride } from "@/types/splice";
import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import type { LegSide, SegmentDragAxis } from "./types";

/** Sum segment-index legOverrides into stable routing parameters. */
export function bridgeLegOverridesToConnectionOverrides(
  legOverrides?: LayoutOverrides["legOverrides"],
): Record<string, ConnectionOverride> | undefined {
  if (!legOverrides) return undefined;
  const result: Record<string, ConnectionOverride> = {};
  for (const [connectionId, entry] of Object.entries(legOverrides)) {
    let laneOffsetX = 0;
    let spliceRowOffsetY = 0;
    for (const segs of [entry.leftSegments, entry.rightSegments]) {
      if (!segs) continue;
      for (const patch of Object.values(segs)) {
        laneOffsetX += patch.dx ?? 0;
        spliceRowOffsetY += patch.dy ?? 0;
      }
    }
    if (laneOffsetX !== 0 || spliceRowOffsetY !== 0) {
      result[connectionId] = { laneOffsetX, spliceRowOffsetY };
    }
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

export function resolveConnectionOverrides(
  overrides?: Pick<
    LayoutOverrides,
    "connectionOverrides" | "legOverrides"
  >,
): Record<string, ConnectionOverride> | undefined {
  if (overrides?.connectionOverrides) {
    return overrides.connectionOverrides;
  }
  return bridgeLegOverridesToConnectionOverrides(overrides?.legOverrides);
}

export function connectionIdFromSpliceEdgeId(edgeId: string): string {
  return edgeId
    .replace(/^splice-left-/, "")
    .replace(/^splice-right-/, "")
    .replace(/^splice-/, "");
}

export function applyConnectionOverridesToLanes(
  lanes: Map<string, SpliceRoutingLane>,
  overrides?: Record<string, ConnectionOverride>,
): Map<string, SpliceRoutingLane> {
  if (!overrides || Object.keys(overrides).length === 0) return lanes;
  const result = new Map(lanes);
  for (const [edgeId, lane] of lanes) {
    const connId = connectionIdFromSpliceEdgeId(edgeId);
    const patch = overrides[connId];
    if (!patch) continue;
    const laneOffsetX = patch.laneOffsetX ?? 0;
    const rowOffsetY = patch.spliceRowOffsetY ?? 0;
    if (laneOffsetX === 0 && rowOffsetY === 0 && patch.dotOffsetX === undefined) {
      continue;
    }
    result.set(edgeId, {
      ...lane,
      midX: lane.midX + laneOffsetX + (patch.dotOffsetX ?? 0),
      sourceHorizY:
        lane.sourceHorizY !== undefined
          ? lane.sourceHorizY + rowOffsetY
          : undefined,
      targetHorizY:
        lane.targetHorizY !== undefined
          ? lane.targetHorizY + rowOffsetY
          : undefined,
    });
  }
  return result;
}

export function accumulateConnectionOverride(
  existing: ConnectionOverride | undefined,
  _side: LegSide,
  segmentIndex: number,
  axis: SegmentDragAxis,
  delta: number,
): ConnectionOverride {
  const next = { ...existing };
  if (axis === "horizontal") {
    if (segmentIndex <= 1) {
      next.laneOffsetX = (next.laneOffsetX ?? 0) + delta;
    } else {
      next.dotOffsetX = (next.dotOffsetX ?? 0) + delta;
    }
    return next;
  }
  next.spliceRowOffsetY = (next.spliceRowOffsetY ?? 0) + delta;
  return next;
}
