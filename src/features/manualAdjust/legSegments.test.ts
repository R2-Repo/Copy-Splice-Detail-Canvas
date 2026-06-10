import { describe, expect, it } from "vitest";

import {
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
});
