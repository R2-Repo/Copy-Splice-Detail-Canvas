import { describe, expect, it } from "vitest";

import { SPLICE_LANE_SEP } from "@/features/diagram/cableLayoutMetrics";

import { LaneAllocator, type QuadFrontiers } from "./quadChannels";
import { createQuadRouter, type QuadEndpoint } from "./quadRouter";

/** Count vertices in an orthogonal SVG path ("M ... L ... L ..."). */
function pointCount(path: string): number {
  return (path.match(/[ML]/g) ?? []).length;
}

const FRONTIERS: QuadFrontiers = {
  leftX: 100,
  rightX: 900,
  topY: 100,
  bottomY: 700,
};
const CENTER = { x: 500, y: 400 };

const left = (y: number, x = 120): QuadEndpoint => ({ x, y, side: "left" });
const right = (y: number, x = 880): QuadEndpoint => ({ x, y, side: "right" });
const top = (x: number, y = 120): QuadEndpoint => ({ x, y, side: "top" });

describe("LaneAllocator", () => {
  it("returns the desired slot first, then nearest free neighbors", () => {
    const lanes = new LaneAllocator(0, 100, 10);
    const a = lanes.alloc(50);
    const b = lanes.alloc(50);
    const c = lanes.alloc(50);
    expect(a).toBe(50);
    expect(new Set([a, b, c]).size).toBe(3);
    for (const v of [b, c]) expect(Math.abs(v - 50)).toBeGreaterThanOrEqual(10);
  });

  it("clamps to the band and snaps to the grid", () => {
    const lanes = new LaneAllocator(0, 100, 10);
    expect(lanes.alloc(-50)).toBe(0);
    expect(lanes.alloc(999)).toBe(100);
  });
});

describe("createQuadRouter", () => {
  it("routes perpendicular pairs as a single L (0 interior bends)", () => {
    const router = createQuadRouter(FRONTIERS, CENTER);
    const routed = router.route(left(200), top(400));
    // Corner at (target.x, source.y).
    expect(routed.spliceX).toBe(400);
    expect(routed.spliceY).toBe(200);
    expect(pointCount(routed.leftPath)).toBe(2);
    expect(pointCount(routed.rightPath)).toBe(2);
  });

  it("routes aligned opposite pairs as a straight line", () => {
    const router = createQuadRouter(FRONTIERS, CENTER);
    const routed = router.route(left(300), right(300));
    expect(routed.spliceY).toBe(300);
    expect(pointCount(routed.leftPath)).toBe(2);
    expect(pointCount(routed.rightPath)).toBe(2);
  });

  it("routes offset opposite pairs with a single jog (1 interior bend)", () => {
    const router = createQuadRouter(FRONTIERS, CENTER);
    const routed = router.route(left(300), right(360));
    // Left leg straight on the source row; right leg jogs once.
    expect(pointCount(routed.leftPath)).toBe(2);
    expect(pointCount(routed.rightPath)).toBe(3);
  });

  it("spreads overlapping jogs onto distinct lanes", () => {
    const router = createQuadRouter(FRONTIERS, CENTER);
    const a = router.route(left(300), right(360));
    const b = router.route(left(320), right(380));
    expect(a.spliceX).not.toBe(b.spliceX);
    expect(Math.abs(a.spliceX - b.spliceX)).toBeGreaterThanOrEqual(
      SPLICE_LANE_SEP,
    );
  });

  it("loops same-side pairs just inside the cables, not across center", () => {
    const router = createQuadRouter(FRONTIERS, CENTER);
    const routed = router.route(left(200), left(260));
    // Dot sits to the right of the left handles (inward), well left of center.
    expect(routed.spliceX).toBeGreaterThan(120);
    expect(routed.spliceX).toBeLessThan(CENTER.x);
  });
});
