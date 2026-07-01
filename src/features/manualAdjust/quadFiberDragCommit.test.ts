import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import type { CableNodeData, FiberAnchorNodeData } from "@/features/canvas/nodes/types";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";
import { loadSearchCandidateSnapshot } from "@/testHelpers/searchLayoutContext";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";
import type { TubeColorCode } from "@/types/splice";

import { applyCableSideDragCommit } from "./cableSideDrag";
import { syncManualVisualCable } from "./syncManualVisualCable";
import {
  quadFiberAnchorNodePosition,
  quadFanShiftDeltaFromDrag,
} from "@/features/diagram/quad/quadManualAdjust";

function readContractCsv(name: string): string {
  return readFileSync(resolveReferenceCsvPath(name), "utf8");
}

function tubeKeyFor(visualCableId: string, tubeColor: TubeColorCode): string {
  return `${visualCableId}|${tubeColor}`;
}

describe("quad fiber drag commit", () => {
  it.each(["top", "bottom"] as const)(
    "syncManualVisualCable repins anchors after tube shift on %s cable",
    (newSide) => {
      const graph = buildConnectionGraph(
        parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
      );
      const snapshot = loadSearchCandidateSnapshot("example-2");
      const candidate = toLayoutCandidate(snapshot!);
      const cableKey = Object.keys(candidate.cableSides).find(
        (k) => candidate.cableSides[k] === "left",
      )!;
      const { visualCables } = buildVisualCablesForLayout(graph);
      const vc = visualCables.find((c) => c.cable === cableKey)!;

      const commit = applyCableSideDragCommit({
        graph,
        overrides: {
          reportKey: `quad-fiber-${newSide}`,
          positions: {},
          optimizedLayoutCandidate: snapshot,
        },
        visualId: vc.id,
        nodeId: `cable-${vc.id}`,
        position: { x: 400, y: newSide === "top" ? 40 : 680 },
        newSide,
        bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
        collapseFullButtSplices: false,
        autoAdjustEnabled: true,
      });
      expect(commit).not.toBeNull();
      expect(commit!.layoutMode).toBe("quad");

      const cableNode = commit!.nodes.find((n) => n.id === `cable-${vc.id}`)!;
      const anchor = commit!.nodes.find(
        (n) =>
          n.type === "fiberAnchor" &&
          n.id.startsWith(`fiberAnchor-${vc.id}::`),
      );
      expect(anchor).toBeDefined();
      if (!anchor) return;

      const anchorData = anchor.data as FiberAnchorNodeData;
      const shiftDelta = 24;
      const dragDeltaX = newSide === "top" ? -shiftDelta : shiftDelta;
      const patchedCable = {
        ...cableNode,
        data: {
          ...(cableNode.data as CableNodeData),
          tubes: (cableNode.data as CableNodeData).tubes.map((t) =>
            t.tubeColor === anchorData.tubeColor
              ? { ...t, visualShiftY: shiftDelta }
              : t,
          ),
        },
      };

      const result = syncManualVisualCable(
        commit!.nodes.map((n) => (n.id === cableNode.id ? patchedCable : n)),
        commit!.edges,
        graph,
        vc.id,
        patchedCable,
      );

      const movedAnchor = result.nodes.find((n) => n.id === anchor.id)!;
      const expected = quadFiberAnchorNodePosition(
        anchorData.connectionId,
        vc,
        patchedCable,
        6,
      );
      expect(movedAnchor.position.x).toBeCloseTo(expected.x, 0);
      expect(movedAnchor.position.y).toBeCloseTo(expected.y, 0);

      const baseline = quadFiberAnchorNodePosition(
        anchorData.connectionId,
        vc,
        cableNode,
        6,
      );
      expect(movedAnchor.position.x - baseline.x).toBeCloseTo(dragDeltaX, 0);
      expect(result.touchedConnections.length).toBeGreaterThan(0);
    },
  );

  it("quad fan shift delta matches repinned anchor movement on top", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readContractCsv("CSV Splice Detail Example #2.csv")),
    );
    const snapshot = loadSearchCandidateSnapshot("example-2");
    const candidate = toLayoutCandidate(snapshot!);
    const cableKey = Object.keys(candidate.cableSides).find(
      (k) => candidate.cableSides[k] === "left",
    )!;
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.cable === cableKey)!;

    const commit = applyCableSideDragCommit({
      graph,
      overrides: {
        reportKey: "quad-fiber-delta",
        positions: {},
        optimizedLayoutCandidate: snapshot,
      },
      visualId: vc.id,
      nodeId: `cable-${vc.id}`,
      position: { x: 400, y: 40 },
      newSide: "top",
      bounds: { centerX: candidate.layoutWidth / 2, centerY: 400 },
      collapseFullButtSplices: false,
      autoAdjustEnabled: true,
    });
    expect(commit).not.toBeNull();

    const anchor = commit!.nodes.find(
      (n) =>
        n.type === "fiberAnchor" &&
        n.id.startsWith(`fiberAnchor-${vc.id}::`),
    )!;
    const start = { ...anchor.position };
    const dragEnd = { x: start.x - 24, y: start.y };
    const shift = quadFanShiftDeltaFromDrag("top", start, dragEnd);
    expect(shift).toBe(24);

    const tubeKey = tubeKeyFor(
      vc.id,
      (anchor.data as FiberAnchorNodeData).tubeColor as TubeColorCode,
    );
    expect(tubeKey).toContain("|");
  });
});
