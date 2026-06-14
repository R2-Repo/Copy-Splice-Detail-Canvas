import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Edge } from "@xyflow/react";
import { beforeEach, describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import {
  LAYOUT_OVERRIDE_VERSION,
  type ConnectionGraph,
} from "@/types/splice";

import {
  DiagramConfigParseError,
  parseDiagramConfig,
} from "./parseDiagramConfig";
import {
  connectionGraphFromConfig,
  layoutOverridesFromConfig,
} from "./restoreDiagramConfig";
import {
  buildDiagramConfig,
  diagramConfigFilename,
  diagramConfigToJson,
  formatFilenameTimestamp,
} from "./serializeDiagramConfig";

const examplesDir = join(process.cwd(), "docs/reference/examples");

const LEFT_EXAMPLES = [
  "Left-STATE_OFFICE.csv",
  "Left-SPI-215_I-80.csv",
  "Left-SP-3254.5.csv",
] as const;

function graphFromCsvFile(file: string): ConnectionGraph {
  const csv = readFileSync(join(examplesDir, file), "utf8");
  return buildConnectionGraph(parseBentleyCsv(csv));
}

function routingMidXByConnection(edges: Edge[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const edge of edges) {
    if (edge.type !== "splice") continue;
    const connId = edge.id.replace(/^splice-(?:left|right)-/, "");
    const midX = (edge.data as { routingMidX?: number }).routingMidX;
    if (midX !== undefined) map.set(connId, Math.round(midX));
  }
  return map;
}

function cablePositions(nodes: ReturnType<typeof buildReactFlowGraph>["nodes"]) {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const node of nodes) {
    if (node.type === "cable") {
      positions[node.id] = {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      };
    }
  }
  return positions;
}

function buildExportReadyState(graph: ConnectionGraph) {
  const reportKey = reportStorageKey(graph);
  const base = buildReactFlowGraph(graph);
  const positions = Object.fromEntries(
    base.nodes
      .filter((n) => n.type === "cable")
      .map((n) => [n.id, { x: n.position.x, y: n.position.y }]),
  );
  const firstEdge = base.edges.find(
    (e) => e.type === "splice" && e.id.startsWith("splice-left-"),
  );
  const connId = firstEdge?.id.replace(/^splice-left-/, "");
  const layoutOverrides = {
    reportKey,
    layoutVersion: LAYOUT_OVERRIDE_VERSION,
    positions,
    layoutWidth: base.layout.layoutWidth,
    collapseFullButtSplices: false,
    autoAdjustEnabled: true,
    existingEdgeIds: firstEdge ? [firstEdge.id] : [],
    legOverrides: connId
      ? { [connId]: { rightSegments: { 1: { dx: 6 } } } }
      : undefined,
  };
  const built = buildReactFlowGraph(
    graph,
    layoutOverrides,
    layoutOverrides.layoutWidth,
  );
  return { reportKey, layoutOverrides, ...built };
}

describe("diagram config roundtrip", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each(LEFT_EXAMPLES)("roundtrips %s with overrides", (file) => {
    const graph = graphFromCsvFile(file);
    const { reportKey, layoutOverrides, nodes, edges } =
      buildExportReadyState(graph);

    const config = buildDiagramConfig({
      graph,
      reportKey,
      nodes,
      edges,
      collapseFullButtSplices: layoutOverrides.collapseFullButtSplices ?? false,
      calloutsVisible: false,
      autoAdjustEnabled: layoutOverrides.autoAdjustEnabled ?? true,
      layoutWidth: layoutOverrides.layoutWidth,
      legOverrides: layoutOverrides.legOverrides,
    });
    config.layout = {
      ...config.layout,
      positions: layoutOverrides.positions,
      existingEdgeIds: layoutOverrides.existingEdgeIds,
      legOverrides: layoutOverrides.legOverrides,
      layoutWidth: layoutOverrides.layoutWidth,
      layoutVersion: LAYOUT_OVERRIDE_VERSION,
    };

    const parsed = parseDiagramConfig(diagramConfigToJson(config));
    const restoredGraph = connectionGraphFromConfig(parsed);
    const rebuiltOverrides = layoutOverridesFromConfig(
      parsed,
      reportStorageKey(restoredGraph),
    );

    const restored = buildReactFlowGraph(
      restoredGraph,
      rebuiltOverrides,
      rebuiltOverrides.layoutWidth,
    );
    const original = buildReactFlowGraph(
      graph,
      layoutOverrides,
      layoutOverrides.layoutWidth,
    );

    expect(cablePositions(restored.nodes)).toEqual(
      cablePositions(original.nodes),
    );
    expect(routingMidXByConnection(restored.edges)).toEqual(
      routingMidXByConnection(original.edges),
    );
    expect(rebuiltOverrides.legOverrides).toEqual(layoutOverrides.legOverrides);
    expect(rebuiltOverrides.existingEdgeIds).toEqual(
      layoutOverrides.existingEdgeIds,
    );
  });

  it("serializes live node positions from input nodes", () => {
    const graph = graphFromCsvFile("Left-STATE_OFFICE.csv");
    const { nodes, edges, layout } = buildReactFlowGraph(graph);
    const cable = nodes.find((n) => n.type === "cable")!;
    const liveNodes = nodes.map((n) =>
      n.id === cable.id
        ? { ...n, position: { x: cable.position.x + 20, y: cable.position.y + 10 } }
        : n,
    );

    const config = buildDiagramConfig({
      graph,
      reportKey: layout.reportKey,
      nodes: liveNodes,
      edges,
      collapseFullButtSplices: false,
      calloutsVisible: false,
      autoAdjustEnabled: true,
      layoutWidth: layout.layoutWidth,
    });

    expect(config.layout.positions[cable.id]).toEqual({
      x: Math.round(cable.position.x + 20),
      y: Math.round(cable.position.y + 10),
    });
  });
});

describe("diagram config parse errors", () => {
  it("rejects invalid JSON", () => {
    expect(() => parseDiagramConfig("{")).toThrow(DiagramConfigParseError);
  });

  it("rejects missing report", () => {
    expect(() =>
      parseDiagramConfig(JSON.stringify({ schemaVersion: 1 })),
    ).toThrow(DiagramConfigParseError);
  });

  it("rejects unsupported schema version", () => {
    expect(() =>
      parseDiagramConfig(
        JSON.stringify({
          schemaVersion: 99,
          report: { header: {}, pairs: [], cableAppearances: [] },
          cableSides: {},
          layout: { positions: {}, layoutVersion: LAYOUT_OVERRIDE_VERSION },
        }),
      ),
    ).toThrow(/Unsupported config schema version/);
  });

  it("rejects unsupported layout version", () => {
    expect(() =>
      parseDiagramConfig(
        JSON.stringify({
          schemaVersion: 1,
          report: { header: {}, pairs: [], cableAppearances: [] },
          cableSides: {},
          layout: { positions: {}, layoutVersion: 0 },
        }),
      ),
    ).toThrow(/Unsupported layout version/);
  });
});

describe("diagram config filename", () => {
  it("includes filesystem-safe date and time stamp", () => {
    const stamp = formatFilenameTimestamp(new Date("2026-06-13T20:15:30"));
    expect(stamp).toBe("2026-06-13_201530");
  });

  it("embeds stamp in export filename", () => {
    const graph = graphFromCsvFile("Left-SP-3254.5.csv");
    const name = diagramConfigFilename(graph, new Date("2026-06-13T20:15:30"));
    expect(name).toMatch(/-config-2026-06-13_201530\.sdc\.json$/);
  });
});
