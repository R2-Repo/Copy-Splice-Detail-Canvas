import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Edge } from "@xyflow/react";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { syncNodesEngineDragLayout } from "./syncNodesEngineDragLayout";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

const legacyExamples = join(
  process.cwd(),
  "docs/reference/examples/old csv examples",
);

function graphFromExample2() {
  const csv = readFileSync(
    join(legacyExamples, "CSV Splice Detail Example #2.csv"),
    "utf8",
  );
  return buildConnectionGraph(parseBentleyCsv(csv));
}

function routingMidXByConnection(edges: Edge[]) {
  const map = new Map<string, number>();
  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    const connId = edge.id.replace(/^splice-(?:left|right)-/, "");
    const midX = (edge.data as { routingMidX?: number }).routingMidX;
    if (midX !== undefined) map.set(connId, Math.round(midX));
  }
  return map;
}

describe("layout determinism", () => {
  it("same graph + overrides yields identical routing midX", () => {
    const graph = graphFromExample2();
    const first = buildReactFlowGraph(graph);
    const second = buildReactFlowGraph(graph);
    expect(routingMidXByConnection(first.edges)).toEqual(
      routingMidXByConnection(second.edges),
    );
  });
});

describe("syncNodesEngineDragLayout lane stability", () => {
  it("dragSync preserves dragged cable Y while refreshing routing", () => {
    const graph = graphFromExample2();
    const base = buildReactFlowGraph(graph);
    const dragged = base.nodes.find(
      (n) => n.type === "cable" && (n.data as { side: string }).side === "left",
    )!;
    const dragY = dragged.position.y + 12;
    const positions = {
      ...Object.fromEntries(
        base.nodes
          .filter((n) => n.type === "cable")
          .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
      ),
      [dragged.id]: { x: dragged.position.x, y: dragY },
    };

    const { nodes, edges: dragEdges } = syncNodesEngineDragLayout({
      graph,
      overrides: { reportKey: "determinism", positions },
      layoutWidth: base.layout.layoutWidth,
      positions,
      draggedNode: { ...dragged, position: positions[dragged.id]! },
    });

    expect(nodes.find((n) => n.id === dragged.id)?.position.y).toBe(dragY);
    expect(routingMidXByConnection(dragEdges).size).toBeGreaterThan(0);
  });
});
