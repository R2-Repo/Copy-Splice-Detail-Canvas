import { describe, expect, it } from "vitest";

import {
  buildGridMap,
  computeRoutingZoneFromAnchors,
  snapPointToGrid,
} from "./gridMap";
import { pointInsideZone, routeInsideZone } from "./routingZone";

describe("gridMap", () => {
  it("builds horizontal routing zone from left/right anchors", () => {
    const map = buildGridMap({
      anchors: [
        { x: 200, y: 100, side: "left" },
        { x: 200, y: 200, side: "left" },
        { x: 1200, y: 150, side: "right" },
      ],
      bounds: { width: 1400, height: 600 },
    });
    expect(map.routingZone.leftX).toBe(200);
    expect(map.routingZone.rightX).toBe(1200);
    expect(map.routingZone.topY).toBe(100);
    expect(map.routingZone.bottomY).toBe(200);
    expect(map.horizontalLines.length).toBeGreaterThan(0);
    expect(map.verticalLines.length).toBeGreaterThan(0);
  });

  it("two-sided zone uses only left/right fiber rows for vertical bounds (SDC-ROUTE-001 Case A)", () => {
    const zone = computeRoutingZoneFromAnchors(
      [
        { x: 200, y: 120, side: "left" },
        { x: 200, y: 480, side: "left" },
        { x: 1100, y: 200, side: "right" },
        { x: 500, y: 40, side: "top" },
      ],
      { width: 1400, height: 600 },
      "horizontal",
    );
    expect(zone.leftX).toBe(200);
    expect(zone.rightX).toBe(1100);
    expect(zone.topY).toBe(120);
    expect(zone.bottomY).toBe(480);
  });

  it("quad zone uses top/bottom handle frontiers for vertical bounds (SDC-ROUTE-001 Case B)", () => {
    const zone = computeRoutingZoneFromAnchors(
      [
        { x: 180, y: 200, side: "left" },
        { x: 180, y: 500, side: "left" },
        { x: 1120, y: 250, side: "right" },
        { x: 400, y: 140, side: "top" },
        { x: 700, y: 160, side: "top" },
        { x: 450, y: 640, side: "bottom" },
        { x: 750, y: 620, side: "bottom" },
      ],
      { width: 1400, height: 800 },
      "quad",
    );
    expect(zone.leftX).toBe(180);
    expect(zone.rightX).toBe(1120);
    expect(zone.topY).toBe(160);
    expect(zone.bottomY).toBe(620);
    expect(zone.height).toBe(460);
  });

  it("snaps points to nearest grid lines", () => {
    const map = buildGridMap({
      anchors: [
        { x: 100, y: 48, side: "left" },
        { x: 900, y: 240, side: "right" },
      ],
      bounds: { width: 1000, height: 400 },
    });
    const snapped = snapPointToGrid(map, { x: 505, y: 73 });
    expect(map.verticalLines).toContain(snapped.x);
    expect(map.horizontalLines).toContain(snapped.y);
  });
});

describe("routingZone validation helpers", () => {
  const zone = {
    x: 200,
    y: 100,
    width: 1000,
    height: 400,
    leftX: 200,
    rightX: 1200,
    topY: 100,
    bottomY: 500,
  };

  it("rejects points outside the routing box", () => {
    expect(pointInsideZone({ x: 150, y: 300 }, zone)).toBe(false);
    expect(pointInsideZone({ x: 700, y: 50 }, zone)).toBe(false);
    expect(pointInsideZone({ x: 700, y: 300 }, zone)).toBe(true);
  });

  it("routeInsideZone fails when any path point leaves the box", () => {
    const ok = routeInsideZone(
      [
        { x: 250, y: 300 },
        { x: 700, y: 300 },
      ],
      zone,
    );
    const bad = routeInsideZone(
      [
        { x: 250, y: 300 },
        { x: 700, y: 80 },
        { x: 700, y: 300 },
      ],
      zone,
    );
    expect(ok.ok).toBe(true);
    expect(bad.ok).toBe(false);
  });
});
