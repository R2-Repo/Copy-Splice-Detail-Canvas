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
  const idx = segment.index;

  if (template === "straight") {
    return idx === 1 && segment.kind === "h" ? ["horizontal"] : [];
  }

  if (template === "same_side") {
    if (segment.kind === "v" && idx === 2) return ["horizontal"];
    if (segment.kind === "h" && (idx === 1 || idx === segmentCount)) {
      return ["vertical"];
    }
    return [];
  }

  // hv_demarcated
  if (side === "left") {
    if (segment.kind === "h" && idx === 1) return ["horizontal", "vertical"];
    if (segment.kind === "v") return ["horizontal"];
    return [];
  }

  if (segment.kind === "h" && idx === 1) return ["horizontal", "vertical"];
  if (segment.kind === "v" && idx === 2 && segmentCount >= 3) {
    return ["horizontal"];
  }
  if (segment.kind === "h" && idx === segmentCount) return ["vertical"];
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

  if (axis === "vertical" && seg.kind === "h") {
    return resizeNeighborVertical(segments, segmentIndex, delta);
  }

  if (template === "same_side" && axis === "horizontal" && seg.kind === "v") {
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

  return segments.map((s) => {
    if (s.index !== segmentIndex) return s;
    if (axis === "horizontal" && s.kind === "h") {
      return segmentIndex === segments.length
        ? { ...s, x0: s.x0 + delta, x1: s.x1 + delta }
        : { ...s, x1: s.x1 + delta };
    }
    if (axis === "horizontal" && s.kind === "v") {
      return { ...s, x: s.x + delta };
    }
    if (axis === "vertical" && s.kind === "v") {
      return { ...s, y1: s.y1 + delta };
    }
    return s;
  });
}
