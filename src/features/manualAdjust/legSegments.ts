import {
  parseOrthogonalPathPoints,
  pickSpliceRouteTemplate,
  FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE,
  SPLICE_PATH_EPS,
  type SpliceRouteTemplate,
} from "@/features/canvas/edges/splicePathGeometry";

import {
  clampHorizontalLaneDeltaNearFusionDot,
  clampVerticalLaneDeltaForCornerClearance,
  verticalSegmentSpansSpliceY,
} from "./constraints";

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
  splice?: { x: number; y: number },
): SegmentDragAxis[] {
  // Manual leg adjust: shift center vertical lanes ↔ only (Y via fan-out drag).
  if (segment.kind !== "v") return [];

  const run = segment.y1 - segment.y0;
  const spliceY = splice?.y;
  const atSpliceJunction =
    spliceY !== undefined &&
    (Math.abs(segment.y0 - spliceY) <= SPLICE_PATH_EPS + 1 ||
      Math.abs(segment.y1 - spliceY) <= SPLICE_PATH_EPS + 1);
  if (run < 8 && !atSpliceJunction) return [];

  if (
    splice &&
    verticalSegmentSpansSpliceY(segment, splice.y) &&
    Math.abs(segment.x - splice.x) < FUSION_DOT_MIN_VERTICAL_LANE_CLEARANCE
  ) {
    return [];
  }

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

function pointsToOrthogonalPath(points: Array<{ x: number; y: number }>): string {
  const out: Array<{ x: number; y: number }> = [];
  for (const p of points) {
    const prev = out[out.length - 1];
    if (
      prev &&
      Math.abs(prev.x - p.x) <= SPLICE_PATH_EPS &&
      Math.abs(prev.y - p.y) <= SPLICE_PATH_EPS
    ) {
      continue;
    }
    out.push(p);
  }
  if (out.length === 0) return "";
  return out
    .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
    .join(" ");
}

/**
 * Rigidly move a leg's START to `next`, adjusting ONLY the first corner so the
 * first segment stays orthogonal. Every later point (including the fusion dot)
 * is preserved exactly. Works directly on the point list — no lossy
 * segment round-trip — so it never re-orders verticals and is idempotent
 * (re-pinning to the same point returns an identical path, so it can run every
 * drag frame without the path growing).
 */
export function repinLegStart(
  path: string,
  next: { x: number; y: number },
): string {
  const pts = parseOrthogonalPathPoints(path);
  if (pts.length < 2) return `M ${next.x},${next.y}`;
  const out = pts.map((p) => ({ ...p }));
  const oldX = pts[0]!.x;
  const oldY = pts[0]!.y;
  out[0] = { x: next.x, y: next.y };
  // Slide the ENTIRE leading run that shares the moved end's row/column to the
  // new row/column, so the first turn stays orthogonal. A leading run may be
  // several colinear waypoints (OS-clearance + bundle jog), all on the source
  // row — moving only the first one would leave the next segment diagonal.
  if (Math.abs(oldY - pts[1]!.y) <= SPLICE_PATH_EPS) {
    let runEnd = 1;
    for (; runEnd < pts.length; runEnd++) {
      if (Math.abs(pts[runEnd]!.y - oldY) > SPLICE_PATH_EPS) break;
    }
    runEnd--;
    if (runEnd === pts.length - 1) {
      const end = pts[pts.length - 1]!;
      // Entire path is one horizontal run. Keep the far endpoint anchored by
      // adding one connector corner instead of translating the whole segment.
      return pointsToOrthogonalPath([
        { x: next.x, y: next.y },
        ...pts
          .slice(1, -1)
          .map((p) => ({ x: p.x, y: next.y })),
        { x: end.x, y: next.y },
        { ...end },
      ]);
    }
    for (let i = 1; i <= runEnd; i++) {
      out[i] = { x: pts[i]!.x, y: next.y };
    }
  } else {
    let runEnd = 1;
    for (; runEnd < pts.length; runEnd++) {
      if (Math.abs(pts[runEnd]!.x - oldX) > SPLICE_PATH_EPS) break;
    }
    runEnd--;
    if (runEnd === pts.length - 1) {
      const end = pts[pts.length - 1]!;
      // Entire path is one vertical run. Keep far endpoint fixed.
      return pointsToOrthogonalPath([
        { x: next.x, y: next.y },
        ...pts
          .slice(1, -1)
          .map((p) => ({ x: next.x, y: p.y })),
        { x: next.x, y: end.y },
        { ...end },
      ]);
    }
    for (let i = 1; i <= runEnd; i++) {
      out[i] = { x: next.x, y: pts[i]!.y };
    }
  }
  return pointsToOrthogonalPath(out);
}

/**
 * Remove same-axis U-turn reversals (an out-and-back jog on one line) WITHOUT
 * moving the endpoints. A dragged lane or a re-pinned corner can slide PAST a
 * stale waypoint and leave such a hook (a broken-looking 90°); dropping the
 * middle point restores a single clean bend. Because the first/last points are
 * never touched, a leg can never detach from its handle or fusion dot.
 */
export function removeOrthogonalReversals(path: string): string {
  const pts = parseOrthogonalPathPoints(path);
  if (pts.length < 3) return path;
  const out = pts.map((p) => ({ ...p }));
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
      const verticalReversal =
        sameX && (a.y - b.y) * (b.y - c.y) < -SPLICE_PATH_EPS;
      const horizontalReversal =
        sameY && (a.x - b.x) * (b.x - c.x) < -SPLICE_PATH_EPS;
      if (verticalReversal || horizontalReversal) {
        out.splice(i, 1);
        changed = true;
        break;
      }
    }
  }
  return out
    .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
    .join(" ");
}

/**
 * Shift a vertical lane horizontally by moving ONLY the two points that bound
 * the vertical segment (1-based `segmentIndex`, matching `pathToLegSegments`).
 * Works on raw points so segment direction is preserved and no extra bend is
 * introduced — the adjacent horizontals just change length, the leg keeps its
 * shape. Used by manual leg drag (the only leg edit is a horizontal lane shift).
 */
export function shiftVerticalLaneX(
  path: string,
  segmentIndex: number,
  deltaX: number,
): string {
  if (Math.abs(deltaX) < SPLICE_PATH_EPS) return path;
  const pts = parseOrthogonalPathPoints(path);
  const a = segmentIndex - 1;
  const b = segmentIndex;
  if (a < 0 || b >= pts.length) return path;
  const laneX = pts[a]!.x;
  // Only a vertical segment (constant x) is a draggable lane.
  if (Math.abs(laneX - pts[b]!.x) > SPLICE_PATH_EPS) return path;
  // A lane can be several colinear points (e.g. fusion → y1 → y2 → target).
  // Expand to the full consecutive run on this lane and move it as one — moving
  // only the dragged segment's two points would leave a colinear neighbour
  // behind and turn that segment diagonal.
  let lo = a;
  while (lo - 1 >= 0 && Math.abs(pts[lo - 1]!.x - laneX) <= SPLICE_PATH_EPS) {
    lo--;
  }
  let hi = b;
  while (
    hi + 1 < pts.length &&
    Math.abs(pts[hi + 1]!.x - laneX) <= SPLICE_PATH_EPS
  ) {
    hi++;
  }
  const lastIdx = pts.length - 1;
  const shiftedX = laneX + deltaX;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < pts.length; i++) {
    if (i < lo || i > hi) {
      out.push({ ...pts[i]! });
      continue;
    }
    if (i === 0) {
      // The leg START (fusion dot / cable handle) is anchored — keep it and add
      // an orthogonal connector to the shifted lane instead of moving the
      // endpoint, which would detach the leg from the splice/handle.
      out.push({ ...pts[i]! });
      out.push({ x: shiftedX, y: pts[i]!.y });
    } else if (i === lastIdx) {
      // The leg END is anchored — connector before it.
      out.push({ x: shiftedX, y: pts[i]!.y });
      out.push({ ...pts[i]! });
    } else {
      out.push({ x: shiftedX, y: pts[i]!.y });
    }
  }
  // Dragging the lane past a stale waypoint on an adjacent horizontal leaves a
  // U-turn hook; drop it so the bend stays a single clean 90°. Endpoints are
  // preserved, so the leg stays joined to its handle and fusion dot.
  return removeOrthogonalReversals(pointsToOrthogonalPath(out));
}

/** Rigid counterpart of {@link repinLegStart} for the leg END (last point). */
export function repinLegEnd(
  path: string,
  next: { x: number; y: number },
): string {
  const pts = parseOrthogonalPathPoints(path);
  if (pts.length < 2) return `M ${next.x},${next.y}`;
  const out = pts.map((p) => ({ ...p }));
  const n = out.length - 1;
  const oldX = pts[n]!.x;
  const oldY = pts[n]!.y;
  out[n] = { x: next.x, y: next.y };
  if (Math.abs(oldY - pts[n - 1]!.y) <= SPLICE_PATH_EPS) {
    let runStart = n - 1;
    while (
      runStart - 1 >= 0 &&
      Math.abs(pts[runStart - 1]!.y - oldY) <= SPLICE_PATH_EPS
    ) {
      runStart--;
    }
    if (runStart === 0) {
      const start = pts[0]!;
      // Entire path is one horizontal run. Keep near endpoint anchored by
      // inserting one connector corner.
      return pointsToOrthogonalPath([
        { ...start },
        { x: start.x, y: next.y },
        ...pts
          .slice(1, -1)
          .map((p) => ({ x: p.x, y: next.y })),
        { x: next.x, y: next.y },
      ]);
    }
    for (let i = n - 1; i >= runStart; i--) {
      out[i] = { x: pts[i]!.x, y: next.y };
    }
  } else {
    let runStart = n - 1;
    while (
      runStart - 1 >= 0 &&
      Math.abs(pts[runStart - 1]!.x - oldX) <= SPLICE_PATH_EPS
    ) {
      runStart--;
    }
    if (runStart === 0) {
      const start = pts[0]!;
      // Entire path is one vertical run. Keep near endpoint fixed.
      return pointsToOrthogonalPath([
        { ...start },
        { x: next.x, y: start.y },
        ...pts
          .slice(1, -1)
          .map((p) => ({ x: next.x, y: p.y })),
        { x: next.x, y: next.y },
      ]);
    }
    for (let i = n - 1; i >= runStart; i--) {
      out[i] = { x: next.x, y: pts[i]!.y };
    }
  }
  return pointsToOrthogonalPath(out);
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

/**
 * Manual cable drag: pin only the moved cable's leg end and reconnect at the splice.
 * Avoids simplify / dual-handle rewriting used by segment-drag finalize.
 */
export function pinCableLegHandles(
  leftPath: string,
  rightPath: string,
  editedSide: LegSide,
  handles: {
    source: { x: number; y: number };
    target: { x: number; y: number };
  },
): {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
} {
  if (editedSide === "left") {
    const nextLeft = setPathStart(leftPath, handles.source);
    const junction = pathEndPoint(nextLeft);
    const nextRight = setPathStart(rightPath, junction);
    return {
      leftPath: nextLeft,
      rightPath: nextRight,
      spliceX: junction.x,
      spliceY: junction.y,
    };
  }
  const nextRight = setPathEnd(rightPath, handles.target);
  const junction = pathStartPoint(nextRight);
  const nextLeft = setPathEnd(leftPath, junction);
  return {
    leftPath: nextLeft,
    rightPath: nextRight,
    spliceX: junction.x,
    spliceY: junction.y,
  };
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

/** Segment-drag reconnect: pin only the edited cable side; anchor fusion dot in place. */
export function reconnectEditedLegPaths(
  leftPath: string,
  rightPath: string,
  editedSide: LegSide,
  options?: {
    handles?: {
      source: { x: number; y: number };
      target: { x: number; y: number };
    };
    /** DOT-001/DOT-004: keep fusion dot fixed while vertical lanes shift. */
    preserveSplice?: { x: number; y: number };
  },
): {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
} {
  let left = leftPath;
  let right = rightPath;
  const handles = options?.handles;
  if (handles) {
    if (editedSide === "left") {
      left = setPathStart(left, handles.source);
    } else {
      right = setPathEnd(right, handles.target);
    }
  }

  if (options?.preserveSplice) {
    const anchor = options.preserveSplice;
    left = simplifyOrthogonalPath(setPathEnd(left, anchor));
    right = simplifyOrthogonalPath(setPathStart(right, anchor));
    return {
      leftPath: left,
      rightPath: right,
      spliceX: anchor.x,
      spliceY: anchor.y,
    };
  }

  return connectLegPathsAtSplice(left, right, editedSide);
}

export function shiftVerticalLane(
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
  splice?: { x: number; y: number },
): LegSegment[] {
  const seg = segments.find((s) => s.index === segmentIndex);
  if (!seg) return segments;

  const axes = allowedSegmentAxes(template, side, seg, segments.length, splice);
  if (!axes.includes(axis)) return segments;

  if (axis === "horizontal" && seg.kind === "v") {
    if (splice) {
      delta = clampHorizontalLaneDeltaNearFusionDot(seg, delta, splice.x, splice.y);
      delta = clampVerticalLaneDeltaForCornerClearance(
        seg,
        delta,
        splice.x,
        splice.y,
      );
      if (Math.abs(delta) < 0.5) return segments;
    }
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
