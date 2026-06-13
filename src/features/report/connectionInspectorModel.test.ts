import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { resolveReferenceCsvPath } from "@/testHelpers/layoutContractCsvPaths";

import { buildConnectionInspectorModel } from "./connectionInspectorModel";

function graphFromReferenceCsv(file: string) {
  const csv = readFileSync(resolveReferenceCsvPath(file), "utf8");
  return buildConnectionGraph(parseBentleyCsv(csv));
}

describe("buildConnectionInspectorModel", () => {
  it("builds connection and strand indexes from the layout graph", () => {
    const graph = graphFromReferenceCsv("CSV Splice Detail Example #2.csv");
    const model = buildConnectionInspectorModel(graph);

    expect(model.connections).toHaveLength(graph.connections.length);
    expect(model.cableNamesBySide.left.length).toBeGreaterThan(0);
    expect(model.cableNamesBySide.right.length).toBeGreaterThan(0);

    const first = model.connections[0];
    expect(first).toBeDefined();
    if (!first) return;

    const leftStrand = model.strandByKey.get(first.leftStrandKey);
    const rightStrand = model.strandByKey.get(first.rightStrandKey);
    expect(leftStrand?.connectionIds).toContain(first.connectionId);
    expect(rightStrand?.connectionIds).toContain(first.connectionId);
    expect(model.connectionIdsByStrandKey.get(first.leftStrandKey)).toContain(
      first.connectionId,
    );
  });

  it("carries through existing protect-in-place flags", () => {
    const graph = graphFromReferenceCsv("CSV Splice Detail Example #2.csv");
    const firstId = graph.connections[0]?.id;
    expect(firstId).toBeTruthy();
    if (!firstId) return;

    const model = buildConnectionInspectorModel(graph, {
      existingConnectionIds: new Set([firstId]),
    });
    expect(model.connectionById.get(firstId)?.existing).toBe(true);
  });

  it("keeps strand buckets consistent with side maps", () => {
    const graph = graphFromReferenceCsv("CSV Splice Detail Example #2.csv");
    const model = buildConnectionInspectorModel(graph);

    (["left", "right"] as const).forEach((side) => {
      for (const cable of model.cableNamesBySide[side]) {
        const strandKeys = model.strandKeysByCableSide[side].get(cable) ?? [];
        strandKeys.forEach((key) => {
          const strand = model.strandByKey.get(key);
          expect(strand?.side).toBe(side);
          expect(strand?.cable).toBe(cable);
        });
      }
    });
  });
});
