import type { Edge } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import {
  formatManualLayoutWarningBanner,
  manualLayoutWarningsForConnections,
  touchedConnectionIdsFromEdgeIds,
} from "@/features/diagram/manualLayoutWarnings";

function leftEdge(
  connectionId: string,
  leftPath: string,
  rightPath: string,
  spliceX: number,
  spliceY: number,
): Edge {
  return {
    id: `splice-left-${connectionId}`,
    source: `fiberAnchor-vc::${connectionId}`,
    target: `splicePoint-${connectionId}`,
    type: "splice",
    data: { leftPath, rightPath, spliceX, spliceY },
  };
}

describe("manualLayoutWarningsForConnections", () => {
  it("maps split edge ids to connection ids", () => {
    const ids = touchedConnectionIdsFromEdgeIds(
      new Set(["splice-left-conn1", "splice-right-conn2", "splice-conn3"]),
    );
    expect([...ids].sort()).toEqual(["conn1", "conn2", "conn3"]);
  });

  it("reports no warnings for valid straight paths", () => {
    const leftPath = "M 100,80 L 300,80";
    const rightPath = "M 300,80 L 500,80";
    const edges = [leftEdge("c1", leftPath, rightPath, 300, 80)];
    const warnings = manualLayoutWarningsForConnections(
      edges,
      new Set(["c1"]),
    );
    expect(warnings).toHaveLength(0);
  });

  it("flags SDC-ROUTE-004-A when bend budget exceeded", () => {
    const leftPath = "M 100,50 L 200,50 L 200,120 L 300,120 L 300,80";
    const rightPath = "M 300,80 L 500,80";
    const edges = [leftEdge("c2", leftPath, rightPath, 300, 80)];
    const warnings = manualLayoutWarningsForConnections(
      edges,
      new Set(["c2"]),
    );
    expect(warnings.some((w) => w.code === "SDC-ROUTE-004-A")).toBe(true);
  });

  it("flags SDC-ROUTE-003-C when vertical lanes are within 24px", () => {
    const edges = [
      leftEdge(
        "a",
        "M 100,50 L 200,50 L 200,120",
        "M 200,120 L 400,120 L 400,50 L 500,50",
        200,
        120,
      ),
      leftEdge(
        "b",
        "M 100,80 L 210,80 L 210,140",
        "M 210,140 L 400,140 L 400,80 L 500,80",
        210,
        140,
      ),
    ];
    const warnings = manualLayoutWarningsForConnections(
      edges,
      new Set(["a", "b"]),
    );
    expect(warnings.some((w) => w.code === "SDC-ROUTE-003-C")).toBe(true);
  });

  it("formats banner with DOT codes", () => {
    const banner = formatManualLayoutWarningBanner([
      {
        connectionId: "x",
        code: "SDC-UX-001-D",
        message: "test",
      },
    ]);
    expect(banner).toContain("too close to corner");
    expect(banner).toContain("manual override kept");
  });
});
