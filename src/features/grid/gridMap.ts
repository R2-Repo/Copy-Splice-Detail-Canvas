import {
  FIBER_ROW_PITCH,
  SPLICE_LANE_SEP,
} from "@/features/diagram/cableLayoutMetrics";
import { computeQuadFrontiers } from "@/features/diagram/quad/quadChannels";

import type {
  GridAnchorRef,
  GridMap,
  GridPoint,
  GridSegment,
  RoutingZoneBounds,
} from "./gridTypes";

export const DEFAULT_BEND_CLEARANCE = 60;

function segmentId(
  axis: "horizontal" | "vertical",
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): string {
  return `${axis}:${x1},${y1}:${x2},${y2}`;
}

function lineRange(lo: number, hi: number, step: number): number[] {
  const lines: number[] = [];
  const start = Math.ceil(lo / step) * step;
  for (let v = start; v <= hi; v += step) lines.push(v);
  return lines;
}

export function computeRoutingZoneFromAnchors(
  anchors: GridAnchorRef[],
  bounds: { width: number; height: number },
  layoutMode: "horizontal" | "quad" = "horizontal",
  fallbackMargin = 80,
): RoutingZoneBounds {
  if (layoutMode === "quad") {
    const f = computeQuadFrontiers(anchors, bounds, fallbackMargin);
    return {
      x: f.leftX,
      y: f.topY,
      width: Math.max(0, f.rightX - f.leftX),
      height: Math.max(0, f.bottomY - f.topY),
      leftX: f.leftX,
      rightX: f.rightX,
      topY: f.topY,
      bottomY: f.bottomY,
    };
  }

  let leftX = Number.NEGATIVE_INFINITY;
  let rightX = Number.POSITIVE_INFINITY;
  let topY = Number.POSITIVE_INFINITY;
  let bottomY = Number.NEGATIVE_INFINITY;

  for (const a of anchors) {
    if (a.side === "left") leftX = Math.max(leftX, a.x);
    else if (a.side === "right") rightX = Math.min(rightX, a.x);
    topY = Math.min(topY, a.y);
    bottomY = Math.max(bottomY, a.y);
  }

  const lx = Number.isFinite(leftX) ? leftX : fallbackMargin;
  const rx = Number.isFinite(rightX) ? rightX : bounds.width - fallbackMargin;
  const ty = Number.isFinite(topY) ? topY : fallbackMargin;
  const by = Number.isFinite(bottomY) ? bottomY : bounds.height - fallbackMargin;

  let leftBound = lx;
  let rightBound = rx;
  if (rightBound - leftBound <= 0 && anchors.length > 0) {
    const xs = anchors.map((a) => a.x);
    leftBound = Math.min(...xs);
    rightBound = Math.max(...xs);
  }
  if (rightBound - leftBound <= 0) {
    const cx = bounds.width / 2;
    leftBound = cx - fallbackMargin * 2;
    rightBound = cx + fallbackMargin * 2;
  }

  return {
    x: leftBound,
    y: ty,
    width: Math.max(0, rightBound - leftBound),
    height: Math.max(0, by - ty),
    leftX: leftBound,
    rightX: rightBound,
    topY: ty,
    bottomY: by,
  };
}

function buildSegments(
  zone: RoutingZoneBounds,
  hLines: number[],
  vLines: number[],
): Map<string, GridSegment> {
  const segments = new Map<string, GridSegment>();

  for (const y of hLines) {
    const id = segmentId("horizontal", zone.leftX, y, zone.rightX, y);
    segments.set(id, {
      id,
      axis: "horizontal",
      x1: zone.leftX,
      y1: y,
      x2: zone.rightX,
      y2: y,
      status: "available",
      zone: "center",
    });
  }

  for (const x of vLines) {
    const id = segmentId("vertical", x, zone.topY, x, zone.bottomY);
    segments.set(id, {
      id,
      axis: "vertical",
      x1: x,
      y1: zone.topY,
      x2: x,
      y2: zone.bottomY,
      status: "available",
      zone: "center",
    });
  }

  return segments;
}

export type BuildGridMapOptions = {
  anchors: GridAnchorRef[];
  bounds: { width: number; height: number };
  layoutMode?: "horizontal" | "quad";
  lockedSegmentIds?: string[];
  blockedRects?: Array<{ x: number; y: number; w: number; h: number }>;
  /** Ensure these X coordinates have vertical grid lines (lane midX from router). */
  extraVerticalXs?: number[];
  extraHorizontalYs?: number[];
};

export function buildGridMap(options: BuildGridMapOptions): GridMap {
  const layoutMode = options.layoutMode ?? "horizontal";
  const zone = computeRoutingZoneFromAnchors(
    options.anchors,
    options.bounds,
    layoutMode,
  );

  const hLineSet = new Set(lineRange(zone.topY, zone.bottomY, FIBER_ROW_PITCH));
  for (const y of options.extraHorizontalYs ?? []) {
    hLineSet.add(Math.round(y / FIBER_ROW_PITCH) * FIBER_ROW_PITCH);
  }
  const hLines = [...hLineSet].sort((a, b) => a - b);
  const vLineSet = new Set(lineRange(zone.leftX, zone.rightX, SPLICE_LANE_SEP));
  for (const x of options.extraVerticalXs ?? []) {
    vLineSet.add(Math.round(x / SPLICE_LANE_SEP) * SPLICE_LANE_SEP);
  }
  const vLines = [...vLineSet].sort((a, b) => a - b);
  const segments = buildSegments(zone, hLines, vLines);

  for (const segId of options.lockedSegmentIds ?? []) {
    const seg = segments.get(segId);
    if (seg) seg.status = "manual-locked";
  }

  for (const rect of options.blockedRects ?? []) {
    for (const seg of segments.values()) {
      const midX = (seg.x1 + seg.x2) / 2;
      const midY = (seg.y1 + seg.y2) / 2;
      if (
        midX >= rect.x &&
        midX <= rect.x + rect.w &&
        midY >= rect.y &&
        midY <= rect.y + rect.h
      ) {
        if (seg.status === "available") seg.status = "blocked";
      }
    }
  }

  return {
    pitch: FIBER_ROW_PITCH,
    laneSep: SPLICE_LANE_SEP,
    routingZone: zone,
    horizontalLines: hLines,
    verticalLines: vLines,
    segments,
    layoutMode,
  };
}

export function nearestGridLine(
  value: number,
  lines: number[],
  pitch: number,
): number {
  if (!lines.length) return Math.round(value / pitch) * pitch;
  let best = lines[0]!;
  let bestDist = Math.abs(value - best);
  for (const line of lines) {
    const d = Math.abs(value - line);
    if (d < bestDist) {
      best = line;
      bestDist = d;
    }
  }
  return best;
}

export function snapPointToGrid(map: GridMap, point: GridPoint): GridPoint {
  return {
    x: nearestGridLine(point.x, map.verticalLines, map.laneSep),
    y: nearestGridLine(point.y, map.horizontalLines, map.pitch),
  };
}
