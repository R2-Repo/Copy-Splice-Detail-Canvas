import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import {
  fiberSpliceRoutingEdges,
  wireSplitSpliceEdges,
} from "./buildNodesEngineGraph";
import { buildSpliceHandleEntries } from "@/features/canvas/edges/spliceEdgeRouting";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";

describe("wireSplitSpliceEdges", () => {
  it("splits fiber splices into anchor → splicePoint → anchor legs", () => {
    const csv = readFileSync(
      resolveReferenceCsvPath("CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { nodes, edges } = buildReactFlowGraph(graph);

    const fiberConnections = fiberSpliceRoutingEdges(edges);
    expect(fiberConnections.length).toBeGreaterThan(0);

    for (const left of edges.filter((e) => e.id.startsWith("splice-left-"))) {
      const connId = left.id.replace(/^splice-left-/, "");
      expect(left.source).toMatch(/^fiberAnchor-/);
      expect(left.target).toBe(`splicePoint-${connId}`);
      expect((left.data as { splitLeg?: string }).splitLeg).toBe("left");

      const right = edges.find((e) => e.id === `splice-right-${connId}`);
      expect(right).toBeDefined();
      if (!right) continue;
      expect(right.source).toBe(`splicePoint-${connId}`);
      expect(right.target).toMatch(/^fiberAnchor-/);
      expect((right.data as { splitLeg?: string }).splitLeg).toBe("right");
    }

    expect(nodes.some((n) => n.type === "fiberAnchor")).toBe(true);
    expect(nodes.some((n) => n.type === "splicePoint")).toBe(true);
  });

  it("preserves precomputed path data on both legs", () => {
    const csv = readLeftCsv("Left-SP-3254.5.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { edges } = buildReactFlowGraph(graph);

    const left = edges.find((e) => e.id.startsWith("splice-left-"));
    expect(left).toBeDefined();
    const d = left!.data as {
      routingPrecomputed?: boolean;
      leftPath?: string;
      routingMidX?: number;
    };
    expect(d.routingPrecomputed).toBe(true);
    expect(d.leftPath).toBeTruthy();
    expect(d.routingMidX).toBeGreaterThan(0);
  });

  it("collapsed full butt splices omit hidden fiber anchors and butt splice points", () => {
    const csv = readFileSync(
      resolveReferenceCsvPath("CSV Splice Detail Example #3.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const expanded = buildReactFlowGraph(graph, {
      reportKey: "ex3",
      positions: {},
      collapseFullButtSplices: false,
    });
    const collapsed = buildReactFlowGraph(graph, {
      reportKey: "ex3",
      positions: {},
      collapseFullButtSplices: true,
    });

    const expandedAnchors = expanded.nodes.filter(
      (n) => n.type === "fiberAnchor",
    ).length;
    const collapsedAnchors = collapsed.nodes.filter(
      (n) => n.type === "fiberAnchor",
    ).length;
    expect(collapsedAnchors).toBeLessThan(expandedAnchors);

    const activeFiberConnIds = new Set(
      collapsed.edges
        .filter(
          (e) =>
            e.type === "splice" &&
            !e.id.startsWith("butt-") &&
            (e.id.startsWith("splice-left-") ||
              e.id.startsWith("splice-right-") ||
              e.id.startsWith("splice-")),
        )
        .map((e) =>
          e.id
            .replace(/^splice-left-/, "")
            .replace(/^splice-right-/, "")
            .replace(/^splice-/, ""),
        ),
    );
    for (const anchor of collapsed.nodes.filter((n) => n.type === "fiberAnchor")) {
      const connId = (anchor.data as { connectionId: string }).connectionId;
      expect(activeFiberConnIds.has(connId)).toBe(true);
    }

    expect(
      collapsed.nodes.some(
        (n) =>
          n.type === "splicePoint" &&
          (n.data as { fullButtSplice?: boolean }).fullButtSplice === true,
      ),
    ).toBe(false);

    expect(collapsed.edges.some((e) => e.id.startsWith("butt-"))).toBe(true);
    for (const butt of collapsed.edges.filter((e) => e.id.startsWith("butt-"))) {
      expect(
        (butt.data as { routingPrecomputed?: boolean }).routingPrecomputed,
      ).toBe(true);
    }
  });

  it("does not split composite edges missing precomputed paths", () => {
    const composite = [
      {
        id: "splice-conn-1",
        source: "cable-a",
        target: "cable-b",
        type: "splice",
        data: { laneIndex: 0 },
      },
    ];
    const entries = buildSpliceHandleEntries([], composite, []);
    const wired = wireSplitSpliceEdges(composite, entries);
    expect(wired).toHaveLength(1);
    expect(wired[0]!.id).toBe("splice-conn-1");
  });
});
