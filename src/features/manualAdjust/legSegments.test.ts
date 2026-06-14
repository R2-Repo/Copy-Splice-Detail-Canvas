import { describe, expect, it } from "vitest";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";

import {
  allowedSegmentAxes,
  applySegmentDelta,
  connectLegPathsAtSplice,
  finalizeConnectedLegPaths,
  pathEndPoint,
  pathStartPoint,
  pathToLegSegments,
  pinCableLegHandles,
  reconnectEditedLegPaths,
  repinLegEnd,
  repinLegStart,
  routeTemplateForHandles,
  segmentsToPath,
  setPathEnd,
  setPathStart,
  shiftVerticalLaneX,
  simplifyOrthogonalPath,
} from "./legSegments";

/** True if any segment of the path is neither horizontal nor vertical. */
function hasDiagonalSegment(path: string): boolean {
  const pts = parseOrthogonalPathPoints(path);
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    const horizontal = Math.abs(a.y - b.y) <= 0.01;
    const vertical = Math.abs(a.x - b.x) <= 0.01;
    if (!horizontal && !vertical) return true;
  }
  return false;
}

describe("legSegments", () => {
  it("parses orthogonal path into numbered segments", () => {
    const path = "M 100,50 L 200,50 L 200,120 L 80,120";
    const segments = pathToLegSegments(path);
    expect(segments).toHaveLength(3);
    expect(segments[0]).toMatchObject({ kind: "h", index: 1 });
    expect(segments[1]).toMatchObject({ kind: "v", index: 2 });
    expect(segments[2]).toMatchObject({ kind: "h", index: 3 });
  });

  it("resizes same-side vertical segment horizontally", () => {
    const leftPath = "M 100,40 L 180,40 L 180,120 L 100,120";
    const template = routeTemplateForHandles(180, 40, 180, 120);
    const left = pathToLegSegments(leftPath);
    const next = applySegmentDelta(left, 2, "horizontal", 20, template, "left");
    const vertical = next.find((s) => s.kind === "v");
    expect(vertical?.kind === "v" && vertical.x).toBeCloseTo(200, 0);
  });

  it("shifts hv_demarcated vertical lane and connected horizontals together", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120";
    const left = pathToLegSegments(leftPath);
    const template = routeTemplateForHandles(200, 50, 400, 120);
    const next = applySegmentDelta(left, 2, "horizontal", 15, template, "left");
    const vertical = next.find((s) => s.kind === "v");
    const horiz = next.find((s) => s.kind === "h");
    expect(vertical?.kind === "v" && vertical.x).toBeCloseTo(215, 0);
    expect(horiz?.kind === "h" && horiz.x1).toBeCloseTo(215, 0);
  });

  it("does not allow dragging horizontal leg segments", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120";
    const left = pathToLegSegments(leftPath);
    const template = routeTemplateForHandles(200, 50, 400, 120);
    const horiz = left.find((s) => s.kind === "h");
    expect(horiz).toBeTruthy();
    expect(
      allowedSegmentAxes(template, "left", horiz!, left.length),
    ).toEqual([]);
  });

  it("allows dragging right-leg vertical lanes on straight-row splices", () => {
    const rightPath = "M 611,60 L 707,60 L 731,60 L 731,262 L 731,464 L 994,464";
    const right = pathToLegSegments(rightPath);
    const template = routeTemplateForHandles(584, 60, 994, 60);
    expect(template).toBe("straight");
    const verticals = right.filter((s) => s.kind === "v");
    expect(verticals.length).toBeGreaterThan(0);
    for (const seg of verticals) {
      expect(
        allowedSegmentAxes(template, "right", seg, right.length),
      ).toEqual(["horizontal"]);
    }
    expect(
      allowedSegmentAxes(template, "left", { kind: "h", index: 1, y: 60, x0: 396, x1: 584 }, 2),
    ).toEqual([]);
  });

  it("keeps fusion splice junction when left leg end moves", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120";
    const rightPath = "M 200,120 L 400,120 L 400,60 L 500,60";
    const connected = connectLegPathsAtSplice(leftPath, rightPath, "left");
    expect(pathEndPoint(connected.leftPath)).toEqual(pathStartPoint(connected.rightPath));
    expect(connected.spliceX).toBeCloseTo(200, 0);
    expect(connected.spliceY).toBeCloseTo(120, 0);
  });

  it("pinCableLegHandles only rewrites the dragged cable leg end", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120";
    const rightPath = "M 200,120 L 400,120 L 400,60 L 500,60";
    const pinned = pinCableLegHandles(leftPath, rightPath, "left", {
      source: { x: 110, y: 52 },
      target: { x: 500, y: 60 },
    });
    expect(pathStartPoint(pinned.leftPath)).toEqual({ x: 110, y: 52 });
    expect(pathEndPoint(pinned.rightPath)).toEqual({ x: 500, y: 60 });
    expect(pinned.spliceX).toBeCloseTo(pathEndPoint(pinned.leftPath).x, 0);
    expect(pinned.spliceY).toBeCloseTo(pathEndPoint(pinned.leftPath).y, 0);
  });

  it("repinLegStart moves start + first corner but preserves the rest", () => {
    // source -> horizontal -> 90° up to fusion dot
    const path = "M 100,200 L 300,200 L 300,150";
    const repinned = repinLegStart(path, { x: 120, y: 210 });
    // first horizontal moves to the new Y; the vertical corner is preserved
    expect(repinned).toBe("M 120,210 L 300,210 L 300,150");
  });

  it("repinLegStart keeps a full horizontal run orthogonal while anchoring the far endpoint", () => {
    // source-row leg with an OS-clearance / jog waypoint, all on y=200
    const path = "M 100,200 L 160,200 L 400,200";
    // move the start up 50px: the run shifts to y=150, then drops vertically
    // at the far endpoint so the opposite anchor stays pinned.
    expect(repinLegStart(path, { x: 100, y: 150 })).toBe(
      "M 100,150 L 160,150 L 400,150 L 400,200",
    );
  });

  it("repinLegStart is idempotent (no path growth across drag frames)", () => {
    const path = "M 100,200 L 300,200 L 300,150 L 360,150";
    const once = repinLegStart(path, { x: 120, y: 210 });
    const twice = repinLegStart(once, { x: 120, y: 210 });
    expect(twice).toBe(once);
    // never adds points (cause of the freeze regression)
    expect(parseOrthogonalPathPoints(once).length).toBeLessThanOrEqual(
      parseOrthogonalPathPoints(path).length,
    );
  });

  it("shiftVerticalLaneX moves a lane without adding a bend (same-side loop leg)", () => {
    // same-side loop right leg: fusion -> inward -> down -> back OUT to target
    const path = "M 312,100 L 360,100 L 360,200 L 200,200";
    const shifted = shiftVerticalLaneX(path, 2, 20); // segment 2 is the vertical
    // the vertical + its two bends move +20; fusion (312,100) and target
    // (200,200) stay; leftward last segment direction preserved; still 2 bends.
    expect(shifted).toBe("M 312,100 L 380,100 L 380,200 L 200,200");
  });

  it("shiftVerticalLaneX keeps a MULTI-POINT vertical lane orthogonal (no diagonal)", () => {
    // same-side leg whose center vertical is 3 colinear points at x=360
    const path = "M 312,100 L 360,100 L 360,150 L 360,200 L 200,200";
    // drag any segment of that lane (here segment 2)
    const shifted = shiftVerticalLaneX(path, 2, 20);
    // the WHOLE lane must move together — no segment may go diagonal
    expect(hasDiagonalSegment(shifted)).toBe(false);
    expect(shifted).toBe("M 312,100 L 380,100 L 380,150 L 380,200 L 200,200");
    // dragging the other segment of the same lane gives the same result
    expect(shiftVerticalLaneX(path, 3, 20)).toBe(shifted);
  });

  it("shiftVerticalLaneX ignores a non-vertical segment index", () => {
    const path = "M 100,80 L 300,80";
    expect(shiftVerticalLaneX(path, 1, 20)).toBe(path);
  });

  it("repinLegEnd moves end + last corner but preserves the rest", () => {
    // fusion dot -> down -> horizontal to target
    const path = "M 300,150 L 300,250 L 500,250";
    const repinned = repinLegEnd(path, { x: 520, y: 260 });
    expect(repinned).toBe("M 300,150 L 300,260 L 520,260");
  });

  it("repinLegEnd keeps a full horizontal run orthogonal while anchoring the near endpoint", () => {
    const path = "M 300,200 L 360,200 L 500,200";
    expect(repinLegEnd(path, { x: 520, y: 260 })).toBe(
      "M 300,200 L 300,260 L 360,260 L 520,260",
    );
  });

  it("reconnectEditedLegPaths pins fusion dot while legs reconnect", () => {
    const leftPath = "M 100,80 L 220,80 L 220,120";
    const rightPath = "M 220,80 L 500,80";
    const connected = reconnectEditedLegPaths(leftPath, rightPath, "left", {
      preserveSplice: { x: 260, y: 80 },
    });
    expect(connected.spliceX).toBeCloseTo(260, 0);
    expect(connected.spliceY).toBeCloseTo(80, 0);
    expect(pathEndPoint(connected.leftPath)).toEqual({ x: 260, y: 80 });
    expect(pathStartPoint(connected.rightPath)).toEqual({ x: 260, y: 80 });
  });

  it("pins path end to handle when last segment is horizontal toward center", () => {
    const rightPath = "M 504,180 L 584,180 L 680,180 L 680,436";
    const pinned = setPathEnd(rightPath, { x: 396, y: 436 });
    expect(pathEndPoint(pinned)).toEqual({ x: 396, y: 436 });
  });

  it("pins path start to source handle on left leg", () => {
    const leftPath = "M 396,180 L 584,180 L 680,180";
    const pinned = setPathStart(leftPath, { x: 396, y: 180 });
    expect(pathStartPoint(pinned)).toEqual({ x: 396, y: 180 });
  });

  it("allows nested same-side vertical lanes beyond index 2", () => {
    const rightPath = "M 504,180 L 584,180 L 680,180 L 680,300 L 680,436 L 396,436";
    const right = pathToLegSegments(rightPath);
    const template = routeTemplateForHandles(396, 180, 396, 436);
    expect(template).toBe("same_side");
    const lane = right.find((s) => s.kind === "v" && s.index === 4);
    expect(lane).toBeTruthy();
    expect(
      allowedSegmentAxes(template, "right", lane!, right.length),
    ).toEqual(["horizontal"]);
  });

  it("segmentsToPath stays orthogonal when start Y differs from first segment", () => {
    const segments = pathToLegSegments("M 100,50 L 200,50 L 200,120");
    const path = segmentsToPath(segments, { x: 100, y: 52 });
    const points = path.match(/L\s*([-\d.]+),([-\d.]+)/g) ?? [];
    for (const move of points) {
      const [, x, y] = move.match(/L\s*([-\d.]+),([-\d.]+)/) ?? [];
      const prev = path.indexOf(move);
      const before = path.slice(0, prev);
      const lastM = [...before.matchAll(/[ML]\s*([-\d.]+),([-\d.]+)/g)].at(-1);
      if (!lastM || !x || !y) continue;
      const px = Number(lastM[1]);
      const py = Number(lastM[2]);
      const nx = Number(x);
      const ny = Number(y);
      expect(Math.abs(px - nx) <= 0.01 || Math.abs(py - ny) <= 0.01).toBe(true);
    }
  });

  it("allows shifting vertical lane past diagram center", () => {
    const centerX = 960;
    const leftPath = `M 584,180 L 700,180 L ${centerX - 20},180 L ${centerX - 20},436`;
    const left = pathToLegSegments(leftPath);
    const template = routeTemplateForHandles(584, 180, 396, 436);
    const lane = left.find((s) => s.kind === "v");
    expect(lane).toBeTruthy();
    const pastCenter = applySegmentDelta(
      left,
      lane!.index,
      "horizontal",
      80,
      template,
      "left",
    );
    const moved = pastCenter.find((s) => s.kind === "v");
    expect(moved?.kind === "v" && moved.x).toBeGreaterThan(centerX);
  });

  it("simplifyOrthogonalPath removes vertical overshoot loop-back", () => {
    const looped = "M 100,50 L 200,50 L 200,180 L 200,120";
    const fixed = simplifyOrthogonalPath(looped);
    expect(parseOrthogonalPathPoints(fixed)).toEqual([
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 200, y: 120 },
    ]);
  });

  it("setPathEnd vertical stops at horizontal corner without overshoot", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120";
    const pinned = setPathEnd(leftPath, { x: 215, y: 120 });
    expect(pathEndPoint(pinned)).toEqual({ x: 215, y: 120 });
    expect(parseOrthogonalPathPoints(pinned)).toEqual([
      { x: 100, y: 50 },
      { x: 200, y: 50 },
      { x: 215, y: 50 },
      { x: 215, y: 120 },
    ]);
  });

  it("finalizeConnectedLegPaths keeps orthogonal legs after lane shift", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120";
    const rightPath = "M 200,120 L 400,120 L 400,60 L 500,60";
    const left = pathToLegSegments(leftPath);
    const template = routeTemplateForHandles(200, 50, 500, 60);
    const shifted = applySegmentDelta(left, 2, "horizontal", 30, template, "left");
    const nextLeft = segmentsToPath(shifted, { x: 100, y: 50 });
    const result = finalizeConnectedLegPaths(nextLeft, rightPath, "left", {
      source: { x: 100, y: 50 },
      target: { x: 500, y: 60 },
    });
    const pts = parseOrthogonalPathPoints(result.leftPath);
    for (let i = 2; i < pts.length; i++) {
      const a = pts[i - 2]!;
      const b = pts[i - 1]!;
      const c = pts[i]!;
      const sameX =
        Math.abs(a.x - b.x) < 0.5 && Math.abs(b.x - c.x) < 0.5;
      const sameY =
        Math.abs(a.y - b.y) < 0.5 && Math.abs(b.y - c.y) < 0.5;
      if (sameX) {
        expect((a.y - b.y) * (b.y - c.y)).toBeGreaterThanOrEqual(0);
      }
      if (sameY) {
        expect((a.x - b.x) * (b.x - c.x)).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it("shifts all stacked vertical segments sharing the same lane X", () => {
    const rightPath = "M 611,60 L 707,60 L 731,60 L 731,262 L 731,464 L 994,464";
    const right = pathToLegSegments(rightPath);
    const template = routeTemplateForHandles(584, 60, 994, 60);
    const next = applySegmentDelta(right, 3, "horizontal", 12, template, "right");
    for (const seg of next.filter((s) => s.kind === "v")) {
      expect(seg.kind === "v" && seg.x).toBeCloseTo(743, 0);
    }
  });

  it("reconnectEditedLegPaths with preserveSplice does not explode path points across repeated drags", () => {
    const splice = { x: 731, y: 262 };
    let leftPath = "M 584,180 L 700,180 L 731,180 L 731,262";
    let rightPath = "M 731,262 L 731,464 L 994,464";
    const template = routeTemplateForHandles(584, 180, 994, 464);
    const lane = pathToLegSegments(leftPath).find((s) => s.kind === "v");
    expect(lane).toBeTruthy();

    for (let frame = 0; frame < 20; frame++) {
      const left = applySegmentDelta(
        pathToLegSegments(leftPath),
        lane!.index,
        "horizontal",
        2,
        template,
        "left",
        splice,
      );
      leftPath = reconnectEditedLegPaths(
        segmentsToPath(left, { x: 584, y: 180 }),
        rightPath,
        "left",
        { preserveSplice: splice },
      ).leftPath;
    }

    const pointCount = parseOrthogonalPathPoints(leftPath).length;
    expect(pointCount).toBeLessThan(12);
  });
});
