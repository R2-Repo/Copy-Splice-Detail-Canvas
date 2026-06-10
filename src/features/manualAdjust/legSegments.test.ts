import { describe, expect, it } from "vitest";

import {
  allowedSegmentAxes,
  applySegmentDelta,
  pathToLegSegments,
  routeTemplateForHandles,
} from "./legSegments";

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

  it("shifts all stacked vertical segments sharing the same lane X", () => {
    const rightPath = "M 611,60 L 707,60 L 731,60 L 731,262 L 731,464 L 994,464";
    const right = pathToLegSegments(rightPath);
    const template = routeTemplateForHandles(584, 60, 994, 60);
    const next = applySegmentDelta(right, 3, "horizontal", 12, template, "right");
    for (const seg of next.filter((s) => s.kind === "v")) {
      expect(seg.kind === "v" && seg.x).toBeCloseTo(743, 0);
    }
  });
});
