import { describe, expect, it } from "vitest";

import { buildGridMap, snapPointToGrid } from "./gridMap";

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
    expect(map.horizontalLines.length).toBeGreaterThan(0);
    expect(map.verticalLines.length).toBeGreaterThan(0);
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
