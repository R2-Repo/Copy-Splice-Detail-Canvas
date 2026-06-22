import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { Edge } from "@xyflow/react";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { inspectBentleyCsv } from "@/features/import/inspectBentleyCsv";
import type { RoutingEngineMode } from "@/features/diagram/routingEngine";

export type RoutingCharacterization = {
  leftRows: number;
  pairs: number;
  parseGap: number;
  uniqueCables: number;
  legCount: number;
  legs: { id: string; side: "left" | "right"; csvColumn: "from" | "to" }[];
  dominant: {
    leftGroupKey: string;
    rightGroupKey: string;
    connectionCount: number;
  };
  routing: {
    connectionId: string;
    laneIndex: number;
    routingMidX: number;
  }[];
};

export function routingSnapshotFromEdges(edges: Edge[]) {
  return edges
    .filter((e) => {
      if (e.type !== "splice") return false;
      if ((e.data as { fullButtSplice?: boolean }).fullButtSplice) return false;
      if (e.id.startsWith("splice-right-") || e.id.startsWith("butt-")) {
        return false;
      }
      return e.id.startsWith("splice-left-") || e.id.startsWith("splice-");
    })
    .map((e) => {
      const d = e.data as { laneIndex: number; routingMidX?: number };
      return {
        connectionId: e.id
          .replace(/^splice-left-/, "")
          .replace(/^splice-/, ""),
        laneIndex: d.laneIndex,
        routingMidX: Math.round(d.routingMidX ?? 0),
      };
    })
    .sort((a, b) => a.connectionId.localeCompare(b.connectionId));
}

export function characterizeReferenceCsv(
  examplesDir: string,
  file: string,
  routingEngine: RoutingEngineMode = "grid",
): RoutingCharacterization {
  const csv = readFileSync(join(examplesDir, file), "utf8");
  const inspection = inspectBentleyCsv(csv);
  const report = parseBentleyCsv(csv);
  const graph = buildConnectionGraph(report);
  const { dominant } = buildVisualCablesForLayout(graph);
  if (!dominant) {
    throw new Error(`expected dominant cable pair for ${file}`);
  }
  const { edges } = buildReactFlowGraph(graph, {
    reportKey: "golden",
    positions: {},
    routingEngine,
  });

  const legs = graph.legs
    .map((l) => ({ id: l.id, side: l.side, csvColumn: l.csvColumn }))
    .sort((a, b) => a.id.localeCompare(b.id));

  return {
    leftRows: inspection.rawRowCounts.left,
    pairs: inspection.parsedPairCount,
    parseGap: inspection.parseGap,
    uniqueCables: report.cableAppearances.length,
    legCount: graph.legs.length,
    legs,
    dominant,
    routing: routingSnapshotFromEdges(edges),
  };
}
