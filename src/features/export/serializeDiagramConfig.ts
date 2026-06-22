import type { Edge, Node, Viewport } from "@xyflow/react";

import {
  existingIdsFromEdges,
  loadLayoutOverrides,
  mergeLayoutOverrides,
  positionsFromNodes,
} from "@/features/canvas/layoutStorage";
import { exportTitleFromGraph } from "@/features/export/printDiagram";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import {
  DIAGRAM_CONFIG_SCHEMA_VERSION,
  type DiagramConfigFile,
  type DiagramConfigViewport,
} from "./diagramConfigTypes";
import { triggerBrowserDownload } from "./triggerBrowserDownload";

export type SerializeDiagramConfigInput = {
  graph: ConnectionGraph;
  reportKey: string;
  nodes: Node[];
  edges: Edge[];
  collapseFullButtSplices: boolean;
  calloutsVisible: boolean;
  calloutScale?: number;
  calloutAutoZoom?: boolean;
  autoAdjustEnabled: boolean;
  layoutWidth: number;
  legOverrides?: LayoutOverrides["legOverrides"];
  sourceFileName?: string;
  appVersion?: string;
  viewport?: Viewport;
};

export function buildDiagramConfig(
  input: SerializeDiagramConfigInput,
): DiagramConfigFile {
  const stored = loadLayoutOverrides(input.reportKey);
  const merged = mergeLayoutOverrides(input.reportKey, {
    positions: positionsFromNodes(input.nodes),
    existingEdgeIds: existingIdsFromEdges(input.edges),
    collapseFullButtSplices: input.collapseFullButtSplices,
    layoutWidth: input.layoutWidth,
    calloutsVisible: input.calloutsVisible,
    calloutScale: input.calloutScale,
    calloutAutoZoom: input.calloutAutoZoom,
    autoAdjustEnabled: input.autoAdjustEnabled,
    autoLayoutY: stored?.autoLayoutY,
    cableSides: stored?.cableSides,
    callouts: stored?.callouts,
    tubeOverrides: stored?.tubeOverrides,
    fanoutOverrides: stored?.fanoutOverrides,
    legOverrides: input.legOverrides ?? stored?.legOverrides,
    connectionOverrides: stored?.connectionOverrides,
    bundleOverrides: stored?.bundleOverrides,
  });

  const { reportKey: _reportKey, ...layout } = merged;

  const viewport: DiagramConfigViewport | undefined =
    input.viewport !== undefined
      ? {
          x: input.viewport.x,
          y: input.viewport.y,
          zoom: input.viewport.zoom,
        }
      : undefined;

  const title = exportTitleFromGraph(input.graph);

  return {
    schemaVersion: DIAGRAM_CONFIG_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: input.appVersion,
    source: {
      fileName: input.sourceFileName,
      spliceNumber: title,
    },
    report: input.graph.report,
    cableSides: Object.fromEntries(input.graph.cableSides),
    layout,
    ...(viewport !== undefined ? { viewport } : {}),
  };
}

export function diagramConfigToJson(config: DiagramConfigFile): string {
  return JSON.stringify(config, null, 2);
}

export function formatFilenameTimestamp(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function diagramConfigFilename(
  graph: ConnectionGraph,
  exportedAt: Date = new Date(),
): string {
  const title = exportTitleFromGraph(graph);
  const safe =
    title.replace(/[^\w.-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "") ||
    "splice";
  return `${safe}-config-${formatFilenameTimestamp(exportedAt)}.sdc.json`;
}

export function downloadDiagramConfig(
  config: DiagramConfigFile,
  graph: ConnectionGraph,
): void {
  const json = diagramConfigToJson(config);
  const blob = new Blob([json], { type: "application/json" });
  triggerBrowserDownload(
    blob,
    diagramConfigFilename(graph, new Date(config.exportedAt)),
  );
}
