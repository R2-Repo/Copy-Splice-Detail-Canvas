import { saveLayoutOverrides } from "@/features/canvas/layoutStorage";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import {
  LAYOUT_OVERRIDE_VERSION,
  type ConnectionGraph,
  type LayoutOverrides,
} from "@/types/splice";

import type { DiagramConfigFile } from "./diagramConfigTypes";

export function connectionGraphFromConfig(
  config: DiagramConfigFile,
): ConnectionGraph {
  const graph = buildConnectionGraph(config.report);
  for (const [cableName, side] of Object.entries(config.cableSides)) {
    graph.cableSides.set(cableName, side);
  }
  return graph;
}

export function layoutOverridesFromConfig(
  config: DiagramConfigFile,
  reportKey: string,
): LayoutOverrides {
  return {
    ...config.layout,
    reportKey,
    layoutVersion: config.layout.layoutVersion ?? LAYOUT_OVERRIDE_VERSION,
  };
}

export type RestoredDiagram = {
  graph: ConnectionGraph;
  reportKey: string;
  overrides: LayoutOverrides;
  viewport?: DiagramConfigFile["viewport"];
  sourceLabel: string;
};

export function restoreDiagramFromConfig(
  config: DiagramConfigFile,
): RestoredDiagram {
  const graph = connectionGraphFromConfig(config);
  const reportKey = reportStorageKey(graph);
  const overrides = layoutOverridesFromConfig(config, reportKey);
  saveLayoutOverrides(overrides);

  const sourceLabel =
    config.source?.spliceNumber ??
    graph.report.header.spliceNumber ??
    graph.report.header.name ??
    "Imported diagram";

  return {
    graph,
    reportKey,
    overrides,
    viewport: config.viewport,
    sourceLabel,
  };
}
