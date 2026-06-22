import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { inspectBentleyCsv } from "@/features/import/inspectBentleyCsv";

import goldens from "./__goldens__/routingCharacterization.json";

// Goldens refreshed after §4.4 F2-by-construction router (STATE_OFFICE / SPI-215) and
// CableLeg.role-based row layout (minor SP-3254.5 routingMidX shifts where row order unchanged).

const examplesDir = join(process.cwd(), "docs/reference/examples");

type RoutingGolden = {
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

function characterize(file: string) {
  const csv = readFileSync(join(examplesDir, file), "utf8");
  const inspection = inspectBentleyCsv(csv);
  const report = parseBentleyCsv(csv);
  const graph = buildConnectionGraph(report);
  const { dominant } = buildVisualCablesForLayout(graph);
  const { edges } = buildReactFlowGraph(graph, { reportKey: "golden", positions: {}, routingEngine: "nodes" });

  const legs = graph.legs
    .map((l) => ({ id: l.id, side: l.side, csvColumn: l.csvColumn }))
    .sort((a, b) => a.id.localeCompare(b.id));

  const routing = edges
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

  return {
    leftRows: inspection.rawRowCounts.left,
    pairs: inspection.parsedPairCount,
    parseGap: inspection.parseGap,
    uniqueCables: report.cableAppearances.length,
    legCount: graph.legs.length,
    legs,
    dominant,
    routing,
  };
}

describe("routing characterization goldens (B0)", () => {
  for (const [file, expected] of Object.entries(goldens) as [string, RoutingGolden][]) {
    it(`${file} matches routing characterization golden`, () => {
      const actual = characterize(file);
      expect(actual.leftRows).toBe(expected.leftRows);
      expect(actual.pairs).toBe(expected.pairs);
      expect(actual.parseGap).toBe(expected.parseGap);
      expect(actual.uniqueCables).toBe(expected.uniqueCables);
      expect(actual.legCount).toBe(expected.legCount);
      expect(actual.legs).toEqual(expected.legs);
      expect(actual.dominant).toEqual(expected.dominant);
      expect(actual.routing).toEqual(expected.routing);
    });
  }
});
