import { describe, expect, it } from "vitest";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";
import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import type { LayoutOverrides } from "@/types/splice";

import { handleCoordsForConnection } from "./handleCoords";
import { syncManualVisualCable } from "./syncManualVisualCable";

describe("syncManualVisualCable respects live node side", () => {
  it("keeps moved cable anchor nodes on the rendered handle side when graph side is stale", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
    );
    const { nodes, edges } = buildReactFlowGraph(graph);

    const cable = nodes.find(
      (n) =>
        n.type === "cable" &&
        String(n.id).includes("144-SMF I-15 DIST: MP 258.96 - 4800 S"),
    );
    expect(cable).toBeDefined();
    if (!cable) return;

    const visualId = visualCableIdFromNodeId(cable.id);
    expect(visualId).toBeTruthy();
    if (!visualId) return;

    // Simulate stale persisted side map disagreeing with the rendered node side.
    graph.cableSides.set(visualId, "right");

    const dragged = {
      ...cable,
      position: { x: cable.position.x + 20, y: cable.position.y + 10 },
    };
    const result = syncManualVisualCable(
      nodes,
      edges,
      graph,
      visualId,
      dragged,
    );

    const near = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.abs(a.x - b.x) <= 1 && Math.abs(a.y - b.y) <= 1;

    const problems: string[] = [];
    for (const connectionId of result.touchedConnections) {
      const leftEdge = result.edges.find((e) => e.id === `splice-left-${connectionId}`);
      const rightEdge = result.edges.find((e) => e.id === `splice-right-${connectionId}`);
      const handles = handleCoordsForConnection(connectionId, result.nodes, graph);
      if (!leftEdge || !rightEdge || !handles) continue;

      const movedAnchorId = `fiberAnchor-${visualId}::${connectionId}`;
      const movedAnchorNode = result.nodes.find((n) => n.id === movedAnchorId);
      if (!movedAnchorNode) continue;
      const movedAnchorCenter = {
        x: movedAnchorNode.position.x + 3,
        y: movedAnchorNode.position.y + 3,
      };

      let expected = handles.source;
      if (
        String(rightEdge.target) === movedAnchorId ||
        String(leftEdge.source) !== movedAnchorId
      ) {
        expected = handles.target;
      }

      if (!near(movedAnchorCenter, expected)) {
        problems.push(
          `${connectionId} anchor=${JSON.stringify(movedAnchorCenter)} expected=${JSON.stringify(expected)}`,
        );
      }
    }

    expect(problems).toEqual([]);
  });

  it("de-stacks moved-leg vertical runs after large cable drag", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readLeftCsv("Left-SP-3254.5.csv")),
    );
    graph.cableSides.set("144-SMF I-15 DIST: 4800 S - MP 259.46", "right");
    graph.cableSides.set("144-SMF I-15 DIST: MP 258.96 - 4800 S", "right");
    graph.cableSides.set("6 DROP (TSC): I-15 NB & 1600 S", "right");
    graph.cableSides.set("72-SMF 4800 S DIST: MAIN ST - I-15", "left");
    const overrides: LayoutOverrides = {
      reportKey: "sync-manual-vertical-destack",
      layoutVersion: 14,
      positions: {
        "cable-144-SMF I-15 DIST: 4800 S - MP 259.46": {
          x: 1383.461314740743,
          y: -256.14569324997404,
        },
        "cable-144-SMF I-15 DIST: MP 258.96 - 4800 S": {
          x: 1383.461314740743,
          y: 572.983112965952,
        },
        "cable-6 DROP (TSC): I-15 NB & 1600 S": {
          x: 1383.461314740743,
          y: 573.4085110995268,
        },
        "cable-72-SMF 4800 S DIST: MAIN ST - I-15": { x: 24, y: -26 },
      },
      autoAdjustEnabled: false,
      layoutWidth: 1773.6613147407431,
      existingEdgeIds: [],
      tubeOverrides: {},
      fanoutOverrides: {},
      legOverrides: {},
      collapseFullButtSplices: false,
    };
    const { nodes, edges } = buildReactFlowGraph(
      graph,
      overrides,
      overrides.layoutWidth,
    );
    const cable = nodes.find(
      (n) =>
        n.type === "cable" &&
        String(n.id).includes("144-SMF I-15 DIST: MP 258.96 - 4800 S"),
    );
    expect(cable).toBeDefined();
    if (!cable) return;

    const visualId = visualCableIdFromNodeId(cable.id);
    expect(visualId).toBeTruthy();
    if (!visualId) return;

    const moved = {
      ...cable,
      position: { x: cable.position.x, y: cable.position.y + 200 },
    };
    const result = syncManualVisualCable(nodes, edges, graph, visualId, moved);

    const movedRuns: Array<{ connId: string; x: number; y0: number; y1: number }> = [];
    const touched = new Set(result.touchedConnections);
    for (const edge of result.edges) {
      if (!edge.id.startsWith("splice-left-")) continue;
      const connId = edge.id.replace(/^splice-left-/, "");
      if (!touched.has(connId)) continue;
      const handles = handleCoordsForConnection(connId, result.nodes, graph);
      if (!handles) continue;
      const movedSide =
        handles.sourceVisualCableId === visualId ? "left" : "right";
      const data = edge.data as { leftPath?: string; rightPath?: string };
      const path = String(
        movedSide === "left" ? data.leftPath ?? "" : data.rightPath ?? "",
      );
      const pts = parseOrthogonalPathPoints(path);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1]!;
        const b = pts[i]!;
        if (Math.abs(a.x - b.x) > 0.5) continue;
        const y0 = Math.min(a.y, b.y);
        const y1 = Math.max(a.y, b.y);
        if (y1 - y0 <= 0.5) continue;
        movedRuns.push({ connId, x: a.x, y0, y1 });
      }
    }

    const overlapProblems: string[] = [];
    const spacingProblems: string[] = [];
    for (let i = 0; i < movedRuns.length; i++) {
      for (let j = i + 1; j < movedRuns.length; j++) {
        const a = movedRuns[i]!;
        const b = movedRuns[j]!;
        if (a.connId === b.connId) continue;
        const lo = Math.max(a.y0, b.y0);
        const hi = Math.min(a.y1, b.y1);
        if (hi - lo <= 0.5) continue;
        const dx = Math.abs(a.x - b.x);
        if (dx <= 0.5) {
          overlapProblems.push(
            `${a.connId} vs ${b.connId} x=${a.x.toFixed(1)} y=[${lo.toFixed(1)},${hi.toFixed(1)}]`,
          );
          continue;
        }
        if (dx < FIBER_ROW_PITCH - 1) {
          spacingProblems.push(
            `${a.connId} vs ${b.connId} dx=${dx.toFixed(1)} y=[${lo.toFixed(1)},${hi.toFixed(1)}]`,
          );
        }
      }
    }

    expect(overlapProblems).toEqual([]);
    expect(spacingProblems).toEqual([]);
  });
});

