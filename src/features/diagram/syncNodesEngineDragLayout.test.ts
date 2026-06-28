import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { syncNodesEngineDragLayout } from "./syncNodesEngineDragLayout";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { candidateToPlacementMap } from "@/features/layoutSearch/layoutCandidate";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";
import { loadSearchCandidateSnapshot } from "@/testHelpers/searchLayoutContext";
import type { SplicePair } from "@/types/splice";
import { readFileSync } from "node:fs";

function syntheticSameSideStackGraph() {
  const pairs: SplicePair[] = [
    {
      id: "pair-1",
      endpointA: {
        device: "DEV-L",
        cable: "CABLE-TOP",
        fiberNumber: 1,
        tubeColor: "BL",
        fiberColor: "BL",
        csvColumn: "from",
      },
      endpointB: {
        device: "DEV-R",
        cable: "CABLE-R",
        fiberNumber: 1,
        tubeColor: "BL",
        fiberColor: "BL",
        csvColumn: "to",
      },
    },
    {
      id: "pair-2",
      endpointA: {
        device: "DEV-L",
        cable: "CABLE-BOTTOM",
        fiberNumber: 1,
        tubeColor: "BL",
        fiberColor: "OR",
        csvColumn: "from",
      },
      endpointB: {
        device: "DEV-R",
        cable: "CABLE-R",
        fiberNumber: 2,
        tubeColor: "BL",
        fiberColor: "OR",
        csvColumn: "to",
      },
    },
  ];

  return buildConnectionGraph({
    header: {},
    pairs,
    cableAppearances: [
      {
        device: "DEV-L",
        cable: "CABLE-TOP",
        left: { from: 1, to: 0 },
        right: { from: 0, to: 0 },
      },
      {
        device: "DEV-L",
        cable: "CABLE-BOTTOM",
        left: { from: 1, to: 0 },
        right: { from: 0, to: 0 },
      },
      {
        device: "DEV-R",
        cable: "CABLE-R",
        left: { from: 0, to: 0 },
        right: { from: 2, to: 0 },
      },
    ],
  });
}

describe("buildReactFlowGraph dragSync", () => {
  it("preserves overlapping same-side Y during live drag (default build re-stacks)", () => {
    const graph = syntheticSameSideStackGraph();
    const base = buildReactFlowGraph(graph);
    const leftCables = base.nodes
      .filter(
        (n) =>
          n.type === "cable" &&
          (n.data as { side: string }).side === "left",
      )
      .sort((a, b) => a.position.y - b.position.y);
    expect(leftCables).toHaveLength(2);

    const top = leftCables[0]!;
    const bottom = leftCables[1]!;
    const betweenY = (top.position.y + bottom.position.y) / 2;
    const positions = {
      [top.id]: { x: top.position.x, y: top.position.y },
      [bottom.id]: { x: bottom.position.x, y: betweenY },
    };

    const stacked = buildReactFlowGraph(graph, {
      reportKey: "test",
      positions,
    });
    const stackedBottom = stacked.nodes.find((n) => n.id === bottom.id)!;
    expect(stackedBottom.position.y).toBeGreaterThan(betweenY + 0.5);

    const dragSynced = buildReactFlowGraph(
      graph,
      {
        reportKey: "test",
        positions,
      },
      undefined,
      { dragSync: true, skipTubeAutoAlign: true },
    );
    const syncedBottom = dragSynced.nodes.find((n) => n.id === bottom.id)!;
    expect(syncedBottom.position.y).toBeCloseTo(betweenY, 0);
  });
});

describe("syncNodesEngineDragLayout", () => {
  it("keeps exact draggedNode.position from React Flow callback", () => {
    const graph = syntheticSameSideStackGraph();
    const base = buildReactFlowGraph(graph);
    const dragged = base.nodes.find((n) => n.type === "cable")!;
    const dragY = dragged.position.y + 37;
    const draggedNode = {
      ...dragged,
      position: { x: dragged.position.x, y: dragY },
    };
    const positions = {
      ...Object.fromEntries(
        base.nodes
          .filter((n) => n.type === "cable")
          .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
      ),
      [dragged.id]: draggedNode.position,
    };

    const { nodes } = syncNodesEngineDragLayout({
      graph,
      overrides: { reportKey: "test", positions },
      layoutWidth: base.layout.layoutWidth,
      positions,
      draggedNode,
    });

    const result = nodes.find((n) => n.id === dragged.id)!;
    expect(result.position.y).toBe(dragY);
  });

  it("preserves optimized horizontal stack order during drag sync", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(
        readFileSync(
          resolveReferenceCsvPath("CSV Splice Detail Example #2.csv"),
          "utf8",
        ),
      ),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    expect(snapshot).toBeDefined();
    const candidate = toLayoutCandidate(snapshot!);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const fixedPlacement = candidateToPlacementMap(candidate, visualCables);

    const base = buildReactFlowGraph(
      graph,
      {
        reportKey: "example-2-drag",
        positions: {},
        optimizedLayoutCandidate: snapshot,
        layoutWidth: candidate.layoutWidth,
        routingEngine: "grid",
      },
      candidate.layoutWidth,
      { fixedPlacement, skipFeasibility: true },
    );
    const leftCables = base.nodes
      .filter(
        (n) =>
          n.type === "cable" &&
          (n.data as { side: string }).side === "left",
      )
      .sort((a, b) => a.position.y - b.position.y);
    expect(leftCables.length).toBeGreaterThan(0);

    const dragged = leftCables[0]!;
    const dragY = dragged.position.y + 24;
    const draggedNode = {
      ...dragged,
      position: { x: dragged.position.x, y: dragY },
    };
    const positions = {
      ...Object.fromEntries(
        base.nodes
          .filter((n) => n.type === "cable")
          .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
      ),
      [dragged.id]: draggedNode.position,
    };

    const { nodes } = syncNodesEngineDragLayout({
      graph,
      overrides: {
        reportKey: "example-2-drag",
        positions,
        optimizedLayoutCandidate: snapshot,
        layoutWidth: candidate.layoutWidth,
        routingEngine: "grid",
      },
      layoutWidth: candidate.layoutWidth,
      positions,
      draggedNode,
    });

    const result = nodes.find((n) => n.id === dragged.id)!;
    expect(result.position.y).toBe(dragY);
    expect((result.data as { side: string }).side).toBe("left");
  });
});
