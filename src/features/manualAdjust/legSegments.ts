import {
  parseOrthogonalPathPoints,
  pickSpliceRouteTemplate,
  SPLICE_PATH_EPS,
  type SpliceRouteTemplate,
} from "@/features/canvas/edges/splicePathGeometry";

import type { LegSide } from "./types";

export type SegmentDragAxis = "horizontal" | "vertical";

export type LegSegment =
  | { kind: "h"; index: number; y: number; x0: number; x1: number }
  | { kind: "v"; index: number; x: number; y0: number; y1: number };

export function pathToLegSegments(path: string): LegSegment[] {
  const points = parseOrthogonalPathPoints(path);
  if (points.length < 2) return [];

  const raw: Array<
    | { kind: "h"; y: number; x0: number; x1: number }
    | { kind: "v"; x: number; y0: number; y1: number }
  > = [];

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (Math.abs(a.y - b.y) <= SPLICE_PATH_EPS) {
      raw.push({
        kind: "h",
        y: a.y,
        x0: Math.min(a.x, b.x),
        x1: Math.max(a.x, b.x),
      });
    } else if (Math.abs(a.x - b.x) <= SPLICE_PATH_EPS) {
      raw.push({
        kind: "v",
        x: a.x,
        y0: Math.min(a.y, b.y),
        y1: Math.max(a.y, b.y),
      });
    }
  }

  return raw.map((segment, index) => ({ ...segment, index: index + 1 }));
}

export function legSegmentsFromPaths(
  leftPath: string,
  rightPath: string,
): { left: LegSegment[]; right: LegSegment[] } {
  return {
    left: pathToLegSegments(leftPath),
    right: pathToLegSegments(rightPath),
  };
}

export function segmentMidpoint(segment: LegSegment): { x: number; y: number } {
  if (segment.kind === "h") {
    return { x: (segment.x0 + segment.x1) / 2, y: segment.y };
  }
  return { x: segment.x, y: (segment.y0 + segment.y1) / 2 };
}

export function routeTemplateForHandles(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): SpliceRouteTemplate {
  return pickSpliceRouteTemplate(sourceX, sourceY, targetX, targetY);
}

export function allowedSegmentAxes(
  template: SpliceRouteTemplate,
  side: LegSide,
  segment: LegSegment,
  segmentCount: number,
): SegmentDragAxis[] {
  // Manual leg adjust: shift center vertical lanes ↔ only (Y via fan-out drag).
  if (segment.kind !== "v") return [];

  const run = segment.y1 - segment.y0;
  if (run < 8) return [];

  if (template === "same_side") {
    return segment.index === 2 ? ["horizontal"] : [];
  }

  // hv_demarcated — vertical run on a 90° bend toward/from center
  if (template === "hv_demarcated") {
    if (side === "left") return ["horizontal"];
    return ["horizontal"];
  }

  // Same-row splices still get stacked vertical lanes on the right leg (routingMidX / jogX).
  if (template === "straight") {
    return side === "right" ? ["horizontal"] : [];
  }

  if (segment.index === 2) return ["horizontal"];
  if (segmentCount === 2 && segment.index === 1) return ["horizontal"];
  return [];
}

export function segmentsToPath(
  segments: LegSegment[],
  start: { x: number; y: number },
): string {
  if (segments.length === 0) return `M ${start.x},${start.y}`;
  const parts = [`M ${start.x},${start.y}`];
  for (const seg of segments) {
    if (seg.kind === "h") {
      parts.push(`L ${seg.x1},${seg.y}`);
    } else {
      parts.push(`L ${seg.x},${seg.y1}`);
    }
  }
  return parts.join(" ");
}

function shiftVerticalLane(
  segments: LegSegment[],
  verticalIndex: number,
  delta: number,
): LegSegment[] {
  const vert = segments.find((s) => s.index === verticalIndex);
  if (!vert || vert.kind !== "v") return segments;
  const laneX = vert.x;

  return segments.map((s) => {
    if (s.kind === "v" && Math.abs(s.x - laneX) <= SPLICE_PATH_EPS + 1) {
      return { ...s, x: s.x + delta };
    }
    if (s.kind === "h") {
      const touchesTop =
        Math.abs(s.y - vert.y0) <= SPLICE_PATH_EPS + 1 &&
        Math.abs(s.x1 - laneX) <= SPLICE_PATH_EPS + 1;
      const touchesBottom =
        Math.abs(s.y - vert.y1) <= SPLICE_PATH_EPS + 1 &&
        Math.abs(s.x0 - laneX) <= SPLICE_PATH_EPS + 1;
      if (touchesTop) {
        return { ...s, x1: s.x1 + delta };
      }
      if (touchesBottom) {
        return { ...s, x0: s.x0 + delta };
      }
      if (Math.abs(s.x0 - laneX) <= SPLICE_PATH_EPS + 1) {
        return { ...s, x0: s.x0 + delta };
      }
      if (Math.abs(s.x1 - laneX) <= SPLICE_PATH_EPS + 1) {
        return { ...s, x1: s.x1 + delta };
      }
    }
    return s;
  });
}

function resizeNeighborVertical(
  segments: LegSegment[],
  horizontalIndex: number,
  deltaY: number,
): LegSegment[] {
  const horiz = segments.find((s) => s.index === horizontalIndex);
  if (!horiz || horiz.kind !== "h") return segments;
  const vert = segments.find(
    (s) => s.kind === "v" && Math.abs(s.x - horiz.x1) <= SPLICE_PATH_EPS + 1,
  );
  if (!vert || vert.kind !== "v") return segments;

  return segments.map((s) => {
    if (s.index === horizontalIndex && s.kind === "h") {
      return { ...s, y: s.y + deltaY };
    }
    if (s.index === vert.index && s.kind === "v") {
      return deltaY > 0
        ? { ...s, y0: s.y0 + deltaY }
        : { ...s, y1: s.y1 + deltaY };
    }
    return s;
  });
}

export function applySegmentDelta(
  segments: LegSegment[],
  segmentIndex: number,
  axis: SegmentDragAxis,
  delta: number,
  template: SpliceRouteTemplate,
  side: LegSide,
): LegSegment[] {
  const seg = segments.find((s) => s.index === segmentIndex);
  if (!seg) return segments;

  const axes = allowedSegmentAxes(template, side, seg, segments.length);
  if (!axes.includes(axis)) return segments;

  if (axis === "horizontal" && seg.kind === "v") {
    if (template === "same_side") {
      return segments.map((s) => {
        if (s.kind === "h" && s.index === 1) {
          return { ...s, x1: s.x1 + delta };
        }
        if (s.kind === "h" && s.index === segments.length) {
          return { ...s, x0: s.x0 + delta };
        }
        if (s.index === segmentIndex && s.kind === "v") {
          return { ...s, x: s.x + delta };
        }
        return s;
      });
    }
    return shiftVerticalLane(segments, segmentIndex, delta);
  }

  if (axis === "vertical" && seg.kind === "h") {
    return resizeNeighborVertical(segments, segmentIndex, delta);
  }

  return segments.map((s) => {
    if (s.index !== segmentIndex) return s;
    if (axis === "vertical" && s.kind === "v") {
      return { ...s, y1: s.y1 + delta };
    }
    return s;
  });
}
