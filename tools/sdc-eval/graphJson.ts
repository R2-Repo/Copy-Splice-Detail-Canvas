import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type { ConnectionGraph } from "@/types/splice";

export type GraphJson = Omit<ConnectionGraph, "cableSides"> & {
  cableSides: Record<string, "left" | "right">;
};

export function graphToJson(graph: ConnectionGraph): GraphJson {
  return {
    ...graph,
    cableSides: Object.fromEntries(graph.cableSides),
  };
}

export function graphFromJson(json: GraphJson): ConnectionGraph {
  return {
    ...json,
    cableSides: new Map(Object.entries(json.cableSides)),
  };
}

export function loadGraphFromInput(input: {
  graph?: GraphJson;
  csvPath?: string;
  csvText?: string;
}): ConnectionGraph {
  if (input.graph) {
    return graphFromJson(input.graph);
  }
  const csvText =
    input.csvText ??
    (input.csvPath
      ? readFileSync(resolve(input.csvPath), "utf8")
      : undefined);
  if (!csvText) {
    throw new Error("Provide graph, csvPath, or csvText");
  }
  return buildConnectionGraph(parseBentleyCsv(csvText));
}

export function graphSummary(graph: ConnectionGraph) {
  const fiberCount = graph.connections.filter((c) => c.kind === "fiber").length;
  const tubeCount = graph.connections.filter((c) => c.kind === "tube").length;
  const cableNames = new Set<string>();
  for (const leg of graph.legs) {
    cableNames.add(leg.cable);
  }
  return {
    spliceNumber: graph.report.header.spliceNumber ?? null,
    reportName: graph.report.header.name ?? null,
    pairCount: graph.report.pairs.length,
    fiberConnections: fiberCount,
    tubeConnections: tubeCount,
    legCount: graph.legs.length,
    cableCount: cableNames.size,
    cableNames: [...cableNames].sort(),
  };
}
