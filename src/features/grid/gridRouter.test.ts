import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

import { routeAllOnGrid } from "./gridRouter";
import { validateGridRoutes } from "./reservation";

describe("gridRouter", () => {
  it("routes Left-SP-3254.5 with reserved segments", () => {
    const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv("Left-SP-3254.5.csv")));
    const { nodes, edges } = buildReactFlowGraph(graph);
    const { visualCables } = buildVisualCablesForLayout(graph);

    const result = routeAllOnGrid({
      nodes,
      edges,
      visualCables,
      diagramCenterX: 960,
      layoutWidth: 1920,
    });

    expect(result.routes.size).toBeGreaterThan(0);
    expect(validateGridRoutes(result.grid, result.routes)).toEqual([]);
    const routed = result.edges.filter((e) => e.type === "splice" && !e.id.startsWith("butt-"));
    expect(routed.length).toBeGreaterThan(0);
    for (const edge of routed) {
      const data = edge.data as Record<string, unknown>;
      if (data.routingPrecomputed) {
        expect(data.leftPath).toBeTruthy();
        expect(data.rightPath).toBeTruthy();
      }
    }
  });

  it("grid map has routing zone between cable frontiers", () => {
    const graph = buildConnectionGraph(parseBentleyCsv(readReferenceCsv("Left-SP-3254.5.csv")));
    const { nodes, edges } = buildReactFlowGraph(graph);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const result = routeAllOnGrid({
      nodes,
      edges,
      visualCables,
      diagramCenterX: 960,
      layoutWidth: 1920,
    });
    expect(result.grid.routingZone.width).toBeGreaterThan(0);
    expect(result.grid.segments.size).toBeGreaterThan(0);
  });
});
