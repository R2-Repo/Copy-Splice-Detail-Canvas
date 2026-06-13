import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { computeCanvasPlacement } from "./canvasPlacement";
import { connectionRowIndexMap } from "./connectionRowOrder";
import {
  connectionInDominantPair,
  findDominantCablePair,
  parentVisualGroupKey,
} from "./dominantCablePair";
import { fiberRowOffsetInCable } from "./cableLayoutMetrics";
import { computeAlignedLayout } from "./spliceRowLayout";
import { buildVisualCables, buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

describe("findDominantCablePair", () => {
  it("Example #2: picks a 2-strand pair; DROP↔3175 preferred on tie", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const pass1 = buildVisualCables(graph);
    const dominant = findDominantCablePair(graph, pass1)!;

    expect(dominant.connectionCount).toBe(2);
    expect(dominant.leftGroupKey).toMatch(/DROP/i);
    expect(dominant.rightGroupKey).toMatch(/3175|3300 E/i);
  });

  it("groups dominant pair splice rows before other pairs on Example #2", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const { visualCables, dominant } = buildVisualCablesForLayout(graph);
    expect(dominant).not.toBeNull();
    const rowIdx = connectionRowIndexMap(graph, visualCables, dominant);

    const dominantConnRows = graph.connections
      .filter(
        (c) =>
          c.kind === "fiber" &&
          connectionInDominantPair(c, graph, visualCables, dominant!),
      )
      .map((c) => rowIdx.get(c.id)!);
    const otherRows = graph.connections
      .filter(
        (c) =>
          c.kind === "fiber" &&
          !connectionInDominantPair(c, graph, visualCables, dominant!),
      )
      .map((c) => rowIdx.get(c.id)!);

    expect(Math.max(...dominantConnRows)).toBeLessThan(Math.min(...otherRows));
    expect(dominantConnRows).toHaveLength(2);
  });

  it("dominant pair handles share row Y on Example #2", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readReferenceCsv("CSV Splice Detail Example #2.csv")),
    );
    const { visualCables, dominant } = buildVisualCablesForLayout(graph);
    expect(dominant).not.toBeNull();
    const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
    const placement = computeCanvasPlacement(
      graph,
      visualCables,
      dominant,
      rowIndex,
    );
    const layout = computeAlignedLayout(
      graph,
      visualCables,
      placement,
      dominant,
    );

    const left = visualCables.find(
      (v) => parentVisualGroupKey(v.id) === dominant!.leftGroupKey,
    )!;
    const right = visualCables.find(
      (v) => parentVisualGroupKey(v.id) === dominant!.rightGroupKey,
    )!;

    for (const conn of graph.connections.filter((c) => c.kind === "fiber")) {
      const lf = left.tubes
        .flatMap((t) => t.fibers)
        .find((f) => f.connectionId === conn.id);
      const rf = right.tubes
        .flatMap((t) => t.fibers)
        .find((f) => f.connectionId === conn.id);
      if (!lf || !rf) continue;
      const leftY =
        layout.cablePositions.get(left.id)!.y +
        fiberRowOffsetInCable(left, lf.connectionId);
      const rightY =
        layout.cablePositions.get(right.id)!.y +
        fiberRowOffsetInCable(right, rf.connectionId);
      expect(Math.abs(leftY - rightY)).toBeLessThan(2);
    }
  });
});
