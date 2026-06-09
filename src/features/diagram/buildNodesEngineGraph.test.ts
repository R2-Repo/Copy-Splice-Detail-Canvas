import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import {
  fiberSpliceRoutingEdges,
  wireSplitSpliceEdges,
} from "./buildNodesEngineGraph";
import { buildSpliceHandleEntries } from "@/features/canvas/edges/spliceEdgeRouting";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const examplesDir = join(process.cwd(), "docs/reference/examples");

describe("wireSplitSpliceEdges", () => {
  it("splits fiber splices into anchor → splicePoint → anchor legs", () => {
    const csv = readFileSync(
      join(examplesDir, "CSV Splice Detail Example #2.csv"),
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
    const csv = readFileSync(
      join(examplesDir, "Left-SP-3254.5.csv"),
      "utf8",
    );
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
