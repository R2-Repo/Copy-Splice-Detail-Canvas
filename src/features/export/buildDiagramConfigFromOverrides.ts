import type { Edge, Node } from "@xyflow/react";

import {
  existingIdsFromEdges,
  positionsFromNodes,
} from "@/features/canvas/layoutStorage";
import { exportTitleFromGraph } from "@/features/export/printDiagram";
import {
  LAYOUT_OVERRIDE_VERSION,
  type ConnectionGraph,
  type LayoutOverrides,
} from "@/types/splice";

import {
  DIAGRAM_CONFIG_SCHEMA_VERSION,
  type DiagramConfigFile,
  type DiagramConfigLayout,
} from "./diagramConfigTypes";

/** Headless export — no localStorage; layout comes from painted candidate state. */
export function buildDiagramConfigFromOverrides(input: {
  graph: ConnectionGraph;
  nodes: Node[];
  edges: Edge[];
  layoutOverrides: LayoutOverrides;
  sourceFileName?: string;
  appVersion?: string;
}): DiagramConfigFile {
  const { reportKey: _reportKey, ...layoutBase } = input.layoutOverrides;
  const layout: DiagramConfigLayout = {
    ...layoutBase,
    layoutVersion: layoutBase.layoutVersion ?? LAYOUT_OVERRIDE_VERSION,
    positions: positionsFromNodes(input.nodes),
    existingEdgeIds: existingIdsFromEdges(input.edges),
  };

  const title = exportTitleFromGraph(input.graph);

  return {
    schemaVersion: DIAGRAM_CONFIG_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: input.appVersion ?? "0.0.1",
    source: {
      fileName: input.sourceFileName,
      spliceNumber: title,
    },
    report: input.graph.report,
    cableSides: Object.fromEntries(input.graph.cableSides),
    layout,
  };
}
