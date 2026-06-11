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
    if (segmentCount <= 3) {
      return segment.index === 2 ? ["horizontal"] : [];
    }
    return ["horizontal"];
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
  let cx = start.x;
  let cy = start.y;

  for (const seg of segments) {
    if (seg.kind === "h") {
      if (Math.abs(cy - seg.y) > SPLICE_PATH_EPS) {
        parts.push(`L ${cx},${seg.y}`);
        cy = seg.y;
      }
      if (Math.abs(cx - seg.x1) > SPLICE_PATH_EPS) {
        parts.push(`L ${seg.x1},${seg.y}`);
        cx = seg.x1;
        cy = seg.y;
      }
    } else {
      const yMin = Math.min(seg.y0, seg.y1);
      const yMax = Math.max(seg.y0, seg.y1);
      if (Math.abs(cx - seg.x) > SPLICE_PATH_EPS) {
        parts.push(`L ${seg.x},${cy}`);
        cx = seg.x;
      }
      if (Math.abs(cy - yMin) > SPLICE_PATH_EPS) {
        parts.push(`L ${seg.x},${yMin}`);
        cy = yMin;
      }
      if (Math.abs(cy - yMax) > SPLICE_PATH_EPS) {
        parts.push(`L ${seg.x},${yMax}`);
        cy = yMax;
      }
    }
  }
  return parts.join(" ");
}

export function pathStartPoint(path: string): { x: number; y: number } {
  const points = parseOrthogonalPathPoints(path);
  return points[0] ?? { x: 0, y: 0 };
}

export function pathEndPoint(path: string): { x: number; y: number } {
  const points = parseOrthogonalPathPoints(path);
  return points.at(-1) ?? { x: 0, y: 0 };
}

function interiorHorizontalX(
  segment: Extract<LegSegment, { kind: "h" }>,
  anchorX: number,
): number {
  const d0 = Math.abs(segment.x0 - anchorX);
  const d1 = Math.abs(segment.x1 - anchorX);
  if (d0 > d1) return segment.x0;
  if (d1 > d0) return segment.x1;
  return segment.x0 === anchorX ? segment.x1 : segment.x0;
}

function verticalSpanFromCorner(
  anchorY: number,
  cornerY: number,
): { y0: number; y1: number } {
  return {
    y0: Math.min(anchorY, cornerY),
    y1: Math.max(anchorY, cornerY),
  };
}

export function setPathStart(
  path: string,
  start: { x: number; y: number },
): string {
  const segments = pathToLegSegments(path);
  if (segments.length === 0) return `M ${start.x},${start.y}`;
  const updated = segments.map((segment, index) => {
    if (index !== 0) return segment;
    if (segment.kind === "h") {
      const interiorX = interiorHorizontalX(segment, start.x);
      return { ...segment, y: start.y, x0: start.x, x1: interiorX };
    }
    const next = segments[index + 1];
    const cornerY =
      next?.kind === "h"
        ? next.y
        : segment.y0 <= segment.y1
          ? segment.y1
          : segment.y0;
    const span = verticalSpanFromCorner(start.y, cornerY);
    return { ...segment, x: start.x, y0: span.y0, y1: span.y1 };
  });
  return segmentsToPath(updated, start);
}

export function setPathEnd(
  path: string,
  end: { x: number; y: number },
): string {
  const segments = pathToLegSegments(path);
  if (segments.length === 0) return `M ${end.x},${end.y}`;
  const start = pathStartPoint(path);
  const lastIdx = segments.length - 1;
  const updated = segments.map((segment, index) => {
    if (index !== lastIdx) return segment;
    if (segment.kind === "h") {
      const interiorX = interiorHorizontalX(segment, end.x);
      return {
        ...segment,
        y: end.y,
        x0: interiorX,
        x1: end.x,
      };
    }
    const prev = segments[index - 1];
    const cornerY =
      prev?.kind === "h"
        ? prev.y
        : segment.y0 <= segment.y1
          ? segment.y0
          : segment.y1;
    const span = verticalSpanFromCorner(end.y, cornerY);
    return { ...segment, x: end.x, y0: span.y0, y1: span.y1 };
  });
  return segmentsToPath(updated, start);
}

/** Remove duplicate points and same-axis U-turn loop-backs (overshoot + return). */
export function simplifyOrthogonalPath(path: string): string {
  const raw = parseOrthogonalPathPoints(path);
  if (raw.length < 2) return path;

  const deduped: Array<{ x: number; y: number }> = [raw[0]!];
  for (let i = 1; i < raw.length; i++) {
    const p = raw[i]!;
    const prev = deduped[deduped.length - 1]!;
    if (
      Math.abs(p.x - prev.x) <= SPLICE_PATH_EPS &&
      Math.abs(p.y - prev.y) <= SPLICE_PATH_EPS
    ) {
      continue;
    }
    deduped.push(p);
  }
  if (deduped.length < 2) return path;

  const out = [...deduped];
  let changed = true;
  while (changed && out.length > 2) {
    changed = false;
    for (let i = 1; i < out.length - 1; i++) {
      const a = out[i - 1]!;
      const b = out[i]!;
      const c = out[i + 1]!;
      const sameX =
        Math.abs(a.x - b.x) <= SPLICE_PATH_EPS &&
        Math.abs(b.x - c.x) <= SPLICE_PATH_EPS;
      const sameY =
        Math.abs(a.y - b.y) <= SPLICE_PATH_EPS &&
        Math.abs(b.y - c.y) <= SPLICE_PATH_EPS;
      const verticalLoop =
        sameX && (a.y - b.y) * (b.y - c.y) < -SPLICE_PATH_EPS;
      const horizontalLoop =
        sameY && (a.x - b.x) * (b.x - c.x) < -SPLICE_PATH_EPS;
      if (verticalLoop || horizontalLoop) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }

  return out
    .map((p, idx) => (idx === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
    .join(" ");
}

export function finalizeConnectedLegPaths(
  leftPath: string,
  rightPath: string,
  editedSide: LegSide,
  handles?: {
    source: { x: number; y: number };
    target: { x: number; y: number };
  },
): {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
} {
  let left = leftPath;
  let right = rightPath;
  if (handles) {
    left = setPathStart(left, handles.source);
    right = setPathEnd(right, handles.target);
  }

  let connected = connectLegPathsAtSplice(left, right, editedSide);
  left = simplifyOrthogonalPath(connected.leftPath);
  right = simplifyOrthogonalPath(connected.rightPath);
  connected = connectLegPathsAtSplice(left, right, editedSide);

  if (handles) {
    if (editedSide === "left") {
      left = setPathStart(connected.leftPath, handles.source);
      right = setPathEnd(connected.rightPath, handles.target);
    } else {
      right = setPathEnd(connected.rightPath, handles.target);
      left = setPathStart(connected.leftPath, handles.source);
    }
    connected = connectLegPathsAtSplice(left, right, editedSide);
    left = simplifyOrthogonalPath(connected.leftPath);
    right = simplifyOrthogonalPath(connected.rightPath);
    connected = connectLegPathsAtSplice(left, right, editedSide);
  }

  return connected;
}

/** Keep fusion splice dot on the horizontal junction between left and right legs. */
export function connectLegPathsAtSplice(
  leftPath: string,
  rightPath: string,
  editedSide: LegSide,
): {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
} {
  if (editedSide === "left") {
    const junction = pathEndPoint(leftPath);
    const nextRight = setPathStart(rightPath, junction);
    return {
      leftPath,
      rightPath: nextRight,
      spliceX: junction.x,
      spliceY: junction.y,
    };
  }
  const junction = pathStartPoint(rightPath);
  const nextLeft = setPathEnd(leftPath, junction);
  return {
    leftPath: nextLeft,
    rightPath,
    spliceX: junction.x,
    spliceY: junction.y,
  };
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
    if (template === "same_side" && segments.length <= 3) {
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
