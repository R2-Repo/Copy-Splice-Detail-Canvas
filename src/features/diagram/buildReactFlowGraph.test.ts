import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { fiberSpliceRoutingEdges } from "./buildNodesEngineGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";

function readContractCsv(name: string): string {
  return readFileSync(resolveReferenceCsvPath(name), "utf8");
}

describe("buildReactFlowGraph", () => {
  it("Example #1 (ring cut): 1 drop left, two 144 cables right", () => {
    const csv = readContractCsv("CSV Splice Detail Example #1.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { nodes, edges } = buildReactFlowGraph(graph);

    const cables = nodes.filter((n) => n.type === "cable");
    expect(cables).toHaveLength(3);

    const left = cables.filter(
      (n) => (n.data as { side: string }).side === "left",
    );
    const right = cables.filter(
      (n) => (n.data as { side: string }).side === "right",
    );
    expect(left).toHaveLength(1);
    expect(right).toHaveLength(2);
    expect(fiberSpliceRoutingEdges(edges)).toHaveLength(4);
    expect(edges.filter((e) => e.type === "splice")).toHaveLength(8);

    const drop = left[0]!.data as { tubes: { fibers: unknown[] }[] };
    expect(drop.tubes[0]!.fibers).toHaveLength(4);

    const laneData = fiberSpliceRoutingEdges(edges).map(
      (e) => e.data as { laneIndex: number },
    );
    expect(new Set(laneData.map((d) => d.laneIndex)).size).toBe(4);

    const first = fiberSpliceRoutingEdges(edges)[0]!.data as {
      sourceColor: string;
      targetColor: string;
    };
    expect(first.sourceColor).toBeTruthy();
    expect(first.targetColor).toBeTruthy();
    expect(first.sourceColor).not.toBe(first.targetColor);
  });

  it("Example #2: four cable nodes, six splice edges", () => {
    const csv = readContractCsv("CSV Splice Detail Example #2.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { nodes, edges } = buildReactFlowGraph(graph);

    expect(nodes.filter((n) => n.type === "cable")).toHaveLength(4);
    expect(fiberSpliceRoutingEdges(edges)).toHaveLength(6);
    expect(edges.filter((e) => e.type === "splice")).toHaveLength(12);
  });

  it("display side follows saved position when cableSides override disagrees", () => {
    const csv = readContractCsv("CSV Splice Detail Example #2.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const base = buildReactFlowGraph(graph);
    const rightCable = base.nodes.find(
      (n) =>
        n.type === "cable" &&
        (n.data as { side: string }).side === "right",
    )!;
    const visualId = rightCable.id.replace(/^cable-/, "");

    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {
        [rightCable.id]: {
          x: rightCable.position.x,
          y: rightCable.position.y,
        },
      },
      cableSides: { [visualId]: "left" },
    });
    const restored = nodes.find((n) => n.id === rightCable.id)!;
    expect((restored.data as { side: string }).side).toBe("right");
  });

  it("applies cableSides override to mirror dragged cables on reload", () => {
    const csv = readContractCsv("CSV Splice Detail Example #2.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const base = buildReactFlowGraph(graph);
    const leftDrop = base.nodes.find(
      (n) =>
        n.type === "cable" &&
        (n.data as { side: string }).side === "left" &&
        (n.data as { label: string }).label.includes("DROP"),
    )!;
    const visualId = leftDrop.id.replace(/^cable-/, "");

    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      cableSides: { [visualId]: "right" },
    });
    const mirrored = nodes.find((n) => n.id === leftDrop.id)!;
    expect((mirrored.data as { side: string }).side).toBe("right");
  });

  it("Example #3: slim cables, anchors, 28 connections × 2 leg edges", () => {
    const csv = readContractCsv("CSV Splice Detail Example #3.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { nodes, edges } = buildReactFlowGraph(graph);

    expect(nodes.some((n) => n.type === "cable")).toBe(true);
    expect(nodes.some((n) => n.type === "fiberAnchor")).toBe(true);
    expect(nodes.some((n) => n.type === "splicePoint")).toBe(true);
    expect(fiberSpliceRoutingEdges(edges)).toHaveLength(28);
    const spliceEdges = edges.filter((e) => e.type === "splice");
    expect(spliceEdges).toHaveLength(56);
    expect(
      spliceEdges.every(
        (e) =>
          (e.data as { routingPrecomputed?: boolean }).routingPrecomputed ===
          true,
      ),
    ).toBe(true);
  });

  it("Example #2: wide layout keeps strands fanning toward center", () => {
    const csv = readContractCsv("CSV Splice Detail Example #2.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const wideWidth = 2200;
    const { nodes } = buildReactFlowGraph(graph, undefined, wideWidth);

    for (const node of nodes) {
      if (node.type !== "cable") continue;
      const side = (node.data as { side: string }).side;
      const centerX = wideWidth / 2;
      if (side === "left") {
        expect(node.position.x).toBeLessThan(centerX);
      } else {
        expect(node.position.x).toBeGreaterThan(centerX);
      }
    }
  });

  it("locked fan-out group surfaces on the cable node data", () => {
    const csv = readContractCsv("CSV Splice Detail Example #2.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const base = buildReactFlowGraph(graph);
    const cable = base.nodes.find(
      (n) =>
        n.type === "cable" &&
        ((n.data as { tubes: { tubeColor: string }[] }).tubes.length ?? 0) > 0,
    )!;
    const visualId = cable.id.replace(/^cable-/, "");
    const tubeColor = (cable.data as { tubes: { tubeColor: string }[] }).tubes[0]!
      .tubeColor;

    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      locks: { tubeGroups: { [`${visualId}|${tubeColor}`]: true as const } },
    });
    const locked = nodes.find((n) => n.id === cable.id)!;
    expect((locked.data as { lockedTubes?: string[] }).lockedTubes).toContain(
      tubeColor,
    );
  });

  it("Example #2: collapse is a no-op without 12-fiber full tubes", () => {
    const csv = readContractCsv("CSV Splice Detail Example #2.csv");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const expanded = buildReactFlowGraph(graph);
    const collapsed = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions: {},
      collapseFullButtSplices: true,
    });

    expect(fiberSpliceRoutingEdges(expanded.edges)).toHaveLength(6);
    expect(fiberSpliceRoutingEdges(collapsed.edges)).toHaveLength(6);
    expect(
      collapsed.edges.some(
        (e) => (e.data as { fullButtSplice?: boolean }).fullButtSplice,
      ),
    ).toBe(false);
    expect(
      collapsed.nodes.some(
        (n) =>
          ((n.data as { collapsedTubes?: string[] }).collapsedTubes?.length ??
            0) > 0,
      ),
    ).toBe(false);
  });
});
