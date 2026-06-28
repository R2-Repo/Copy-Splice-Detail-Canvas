import type { Edge, Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import { displaySideFromCanvasX } from "@/features/diagram/cableDisplaySide";
import { rerouteConnectionIdsForVisualCableDrag } from "@/features/diagram/connectionIdsForCable";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";
import { onEditLock } from "@/features/layoutHybrid/onEditLock";
import { buildCanvasFromCandidate } from "@/features/layoutSearch/candidateToGraph";
import {
  candidateToCableSidesRecord,
  candidateToQuadCableSidesRecord,
  deriveLayoutMode,
  reconcileStackOrder,
  type LayoutCandidate,
  type LayoutSide,
} from "@/features/layoutSearch/layoutCandidate";
import { toLayoutCandidate } from "@/features/layoutSearch/verifyLayoutCandidate";
import { cableNameKey } from "@/features/import/cableLegIdentity";
import type {
  ConnectionGraph,
  LayoutMode,
  LayoutOverrides,
  QuadSide,
} from "@/types/splice";

import { stripRoutingOverridesForConnections } from "./connectionOverrides";

export type SideDragBounds = {
  centerX: number;
  centerY: number;
};

export function effectiveCableSide(data: CableNodeData): LayoutSide {
  return data.quadSide ?? data.side;
}

/** Nearest canvas edge from drag position (angle from diagram center). */
export function detectSideFromDragPosition(
  x: number,
  y: number,
  bounds: SideDragBounds,
  options?: { allowVertical?: boolean },
): LayoutSide {
  const allowVertical = options?.allowVertical !== false;
  if (!allowVertical) {
    return displaySideFromCanvasX(x, bounds.centerX);
  }
  const relX = x - bounds.centerX;
  const relY = y - bounds.centerY;
  if (Math.abs(relX) > Math.abs(relY)) {
    return relX < 0 ? "left" : "right";
  }
  return relY < 0 ? "top" : "bottom";
}

export function stackCoordForSide(
  side: LayoutSide,
  position: { x: number; y: number },
): number {
  return side === "top" || side === "bottom" ? position.x : position.y;
}

function visualIdForCableKey(
  visualCables: VisualCable[],
  cableKey: string,
): string | undefined {
  return visualCables.find((vc) => cableNameKey(vc.cable) === cableKey)?.id;
}

/** Insert cable into target-side stack sorted by drag coord (Y for L/R, X for T/B). */
export function moveCableInCandidate(
  candidate: LayoutCandidate,
  cableKey: string,
  newSide: LayoutSide,
  stackCoord: number,
  visualCables: VisualCable[],
  positions: Record<string, { x: number; y: number }>,
): LayoutCandidate {
  const stacks: Record<QuadSide, string[]> = {
    left: candidate.stackOrder.left.filter((c) => c !== cableKey),
    right: candidate.stackOrder.right.filter((c) => c !== cableKey),
    top: candidate.stackOrder.top.filter((c) => c !== cableKey),
    bottom: candidate.stackOrder.bottom.filter((c) => c !== cableKey),
  };

  const target = [...stacks[newSide]];
  const ranked = target
    .map((key) => {
      const vcId = visualIdForCableKey(visualCables, key);
      const pos = vcId ? positions[`cable-${vcId}`] : undefined;
      return {
        key,
        coord: pos ? stackCoordForSide(newSide, pos) : Number.POSITIVE_INFINITY,
      };
    })
    .concat([{ key: cableKey, coord: stackCoord }])
    .sort((a, b) => a.coord - b.coord || a.key.localeCompare(b.key))
    .map((row) => row.key);

  stacks[newSide] = ranked;

  const next: LayoutCandidate = {
    ...candidate,
    cableSides: { ...candidate.cableSides, [cableKey]: newSide },
    stackOrder: stacks,
  };
  next.stackOrder = reconcileStackOrder(next);
  return next;
}

export function candidateFromOverrides(
  graph: ConnectionGraph,
  overrides: LayoutOverrides,
): LayoutCandidate | undefined {
  if (overrides.optimizedLayoutCandidate) {
    return toLayoutCandidate(overrides.optimizedLayoutCandidate);
  }
  const { visualCables } = buildVisualCablesForLayout(graph);
  if (visualCables.length === 0) return undefined;

  const cableSides: Record<string, LayoutSide> = {};
  const stacks: Record<QuadSide, string[]> = {
    left: [],
    right: [],
    top: [],
    bottom: [],
  };

  for (const vc of visualCables) {
    const key = cableNameKey(vc.cable);
    const quad = overrides.quadCableSides?.[vc.id];
    const lr = overrides.cableSides?.[vc.id];
    const side: LayoutSide = quad ?? lr ?? vc.side;
    cableSides[key] = side;
    stacks[side].push(key);
  }

  return {
    cableSides,
    stackOrder: stacks,
    layoutWidth: overrides.layoutWidth ?? 1200,
    layoutExpansion: overrides.layoutExpansion ?? {
      centerGapPadding: 0,
      cableGapExtra: 0,
      tubeGroupGapExtra: 0,
    },
  };
}

export function warningsForSideDragLocks(
  overrides: LayoutOverrides,
  visualId: string,
): string[] {
  const warnings: string[] = [];
  const lockedCables = overrides.locks?.cables ?? {};
  const lockedTubes = overrides.locks?.tubeGroups ?? {};
  const gridLocks = overrides.gridLocks;

  if (lockedCables[visualId]) {
    warnings.push("Cable position is locked; unlock before moving to another side.");
  }

  const lockedTubeOnCable = Object.keys(lockedTubes).filter((key) =>
    key.startsWith(`${visualId}|`),
  );
  if (lockedTubeOnCable.length > 0) {
    warnings.push(
      "Locked fan-out groups on this cable may block clean routing after a side move.",
    );
  }

  if (gridLocks?.segments?.length) {
    warnings.push(
      "Locked lane segments may force strand overlap after a side move.",
    );
  }
  if (gridLocks?.dots?.length) {
    warnings.push(
      "Locked fusion dots stay fixed; legs may need extra bends after a side move.",
    );
  }

  return warnings;
}

export type CableSideDragCommitArgs = {
  graph: ConnectionGraph;
  overrides: LayoutOverrides;
  visualId: string;
  nodeId: string;
  position: { x: number; y: number };
  newSide: LayoutSide;
  bounds: SideDragBounds;
  collapseFullButtSplices: boolean;
  autoAdjustEnabled: boolean;
  /** Live preview during drag — skip lock-on-commit. */
  preview?: boolean;
};

export type CableSideDragCommitResult = {
  nodes: Node[];
  edges: Edge[];
  overrides: LayoutOverrides;
  layoutWidth: number;
  layoutMode: LayoutMode;
  sideChanged: boolean;
  warnings: string[];
  candidate: LayoutCandidate;
};

/** Local reroute after cable side change — updates candidate snapshot, no layoutSearch. */
export function applyCableSideDragCommit(
  args: CableSideDragCommitArgs,
): CableSideDragCommitResult | null {
  const baseCandidate = candidateFromOverrides(args.graph, args.overrides);
  if (!baseCandidate) return null;

  const { visualCables } = buildVisualCablesForLayout(args.graph);
  const vc = visualCables.find((c) => c.id === args.visualId);
  if (!vc) return null;

  const cableKey = cableNameKey(vc.cable);
  const prevSide = baseCandidate.cableSides[cableKey] ?? effectiveCableSide({
    side: vc.side,
  } as CableNodeData);
  const sideChanged = prevSide !== args.newSide;
  const warnings = warningsForSideDragLocks(args.overrides, args.visualId);

  if (args.overrides.locks?.cables?.[args.visualId] && sideChanged) {
    return {
      nodes: [],
      edges: [],
      overrides: args.overrides,
      layoutWidth: baseCandidate.layoutWidth,
      layoutMode: deriveLayoutMode(baseCandidate),
      sideChanged: false,
      warnings,
      candidate: baseCandidate,
    };
  }

  const positions = {
    ...args.overrides.positions,
    [args.nodeId]: args.position,
  };

  const stackCoord = stackCoordForSide(args.newSide, args.position);
  const candidate = sideChanged
    ? moveCableInCandidate(
        baseCandidate,
        cableKey,
        args.newSide,
        stackCoord,
        visualCables,
        positions,
      )
    : baseCandidate;

  const flippedConnIds = sideChanged
    ? rerouteConnectionIdsForVisualCableDrag(visualCables, args.visualId)
    : [];
  const strippedRouting = stripRoutingOverridesForConnections(
    args.overrides,
    flippedConnIds,
  );

  const layoutMode = deriveLayoutMode(candidate);
  const mergedOverrides: LayoutOverrides = {
    ...args.overrides,
    layoutWidth: candidate.layoutWidth,
    layoutExpansion: candidate.layoutExpansion,
    layoutMode,
    optimizedLayoutCandidate: candidate,
    cableSides: candidateToCableSidesRecord(candidate, visualCables),
    quadCableSides: candidateToQuadCableSidesRecord(candidate, visualCables),
    positions,
    collapseFullButtSplices: args.collapseFullButtSplices,
    autoAdjustEnabled: args.autoAdjustEnabled,
    legOverrides: sideChanged
      ? strippedRouting.legOverrides
      : args.overrides.legOverrides,
    connectionOverrides: sideChanged
      ? strippedRouting.connectionOverrides
      : args.overrides.connectionOverrides,
    gridLocks: sideChanged ? undefined : args.overrides.gridLocks,
    gridRoutes: sideChanged ? undefined : args.overrides.gridRoutes,
  };

  const buildResult = buildCanvasFromCandidate(
    args.graph,
    candidate,
    mergedOverrides,
    {
      refreshColumnX: sideChanged,
      skipTubeAutoAlign: !args.autoAdjustEnabled,
      dragSync: args.preview === true,
    },
  );

  const nodes = buildResult.nodes.map((node) =>
    node.id === args.nodeId ? { ...node, position: args.position } : node,
  );

  let nextOverrides = mergedOverrides;
  if (!args.preview) {
    nextOverrides = onEditLock(mergedOverrides, "cable", {
      cableId: args.visualId,
      position: args.position,
    });
    nextOverrides = {
      ...nextOverrides,
      positions: { ...nextOverrides.positions, [args.nodeId]: args.position },
      optimizedLayoutCandidate: candidate,
    };
  }

  args.graph.cableSides.set(
    args.visualId,
    args.newSide === "right" ? "right" : "left",
  );

  return {
    nodes,
    edges: buildResult.edges,
    overrides: nextOverrides,
    layoutWidth: candidate.layoutWidth,
    layoutMode,
    sideChanged,
    warnings,
    candidate,
  };
}
