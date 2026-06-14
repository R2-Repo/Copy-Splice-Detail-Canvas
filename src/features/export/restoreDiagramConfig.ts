import { saveLayoutOverrides } from "@/features/canvas/layoutStorage";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { FIBER_ROW_PITCH } from "@/features/diagram/cableLayoutMetrics";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import {
  LAYOUT_OVERRIDE_VERSION,
  type ConnectionGraph,
  type LayoutOverrides,
} from "@/types/splice";

import type { DiagramConfigFile } from "./diagramConfigTypes";

const IMPORT_CABLE_OVERLAP_EPS = 1;

function normalizeImportedCablePositions(
  positions: Record<string, { x: number; y: number }>,
): Record<string, { x: number; y: number }> {
  const cableEntries = Object.entries(positions)
    .filter(([id]) => id.startsWith("cable-"))
    .map(([id, pos]) => ({
      id,
      x: pos.x,
      y: pos.y,
    }));
  if (cableEntries.length < 2) return positions;

  const sorted = [...cableEntries].sort(
    (a, b) => a.x - b.x || a.y - b.y || a.id.localeCompare(b.id),
  );
  const placed: Array<{ x: number; y: number }> = [];
  let nextPositions: Record<string, { x: number; y: number }> | undefined;

  for (const entry of sorted) {
    let y = entry.y;
    while (
      placed.some(
        (p) =>
          Math.abs(p.x - entry.x) <= IMPORT_CABLE_OVERLAP_EPS &&
          Math.abs(p.y - y) <= IMPORT_CABLE_OVERLAP_EPS,
      )
    ) {
      y += FIBER_ROW_PITCH;
    }
    placed.push({ x: entry.x, y });
    if (Math.abs(y - entry.y) > IMPORT_CABLE_OVERLAP_EPS) {
      nextPositions ??= { ...positions };
      nextPositions[entry.id] = { x: entry.x, y };
    }
  }

  return nextPositions ?? positions;
}

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
  // Quad placement spreads cables around the perimeter and owns de-overlap; the
  // horizontal two-column nudge would only fight it, so skip it in quad mode.
  const positions =
    config.layout.layoutMode === "quad"
      ? config.layout.positions
      : normalizeImportedCablePositions(config.layout.positions);
  return {
    ...config.layout,
    positions,
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
