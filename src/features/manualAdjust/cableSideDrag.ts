import type { Edge, Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import { displaySideFromCanvasX } from "@/features/diagram/cableDisplaySide";
import { rerouteConnectionIdsForVisualCableDrag } from "@/features/diagram/connectionIdsForCable";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";
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
import { logSideDrag } from "./debugSideDrag";

export type SideDragBounds = {
  centerX: number;
  centerY: number;
};

/** Canvas edge envelope for proximity-based side commit (Phase 6 quad). */
export type SideDragEdgeBounds = SideDragBounds & {
  layoutWidth: number;
  minY: number;
  maxY: number;
};

/** Drag-stop gate — cable must be within this distance of a canvas edge to change sides. */
export const SIDE_DRAG_EDGE_THRESHOLD_PX = 80;

/** Extra vertical reach for top/bottom commits (easier target than L/R flip). */
export const SIDE_DRAG_VERTICAL_EDGE_THRESHOLD_PX = 110;

/** Horizontal nudge from drag-start X that still counts as side-stack fine tuning. */
export const SIDE_DRAG_FINE_TUNE_SLACK_PX = 180;

/**
 * Outer edge of each L/R column — side cables fine-tune inside this band without
 * top/bottom flips, regardless of vertical travel.
 */
export function sideDragSideColumnOuterXPx(
  layoutWidth: number,
  override?: number,
): number {
  return override ?? Math.max(220, Math.round(layoutWidth * 0.38));
}

/**
 * True when an L/R cable may commit to top/bottom. Requires leaving the side
 * column AND moving toward diagram center beyond fine-tune slack from drag start.
 */
export function allowTopBottomFromSideDrag(
  x: number,
  layoutWidth: number,
  currentSide: LayoutSide,
  dragStartX?: number,
  options?: { sideColumnOuterXPx?: number; fineTuneSlackPx?: number },
): boolean {
  if (currentSide !== "left" && currentSide !== "right") return true;

  const outerX = sideDragSideColumnOuterXPx(layoutWidth, options?.sideColumnOuterXPx);
  const slack = options?.fineTuneSlackPx ?? SIDE_DRAG_FINE_TUNE_SLACK_PX;

  if (currentSide === "left") {
    if (x <= outerX) return false;
    if (dragStartX !== undefined && x <= dragStartX + slack) return false;
    return true;
  }

  if (x >= layoutWidth - outerX) return false;
  if (dragStartX !== undefined && x >= dragStartX - slack) return false;
  return true;
}

export function effectiveCableSide(data: CableNodeData): LayoutSide {
  return data.quadSide ?? data.side;
}

/** Nearest side when within thresholdPx of a canvas edge; otherwise keeps currentSide. */
export function detectSideFromEdgeProximity(
  x: number,
  y: number,
  bounds: SideDragEdgeBounds,
  currentSide: LayoutSide,
  options?: {
    allowVertical?: boolean;
    thresholdPx?: number;
    verticalThresholdPx?: number;
    sideColumnOuterXPx?: number;
    fineTuneSlackPx?: number;
    /** Cable X when the drag started — enables fine-tune vs intentional T/B. */
    dragStartX?: number;
  },
): LayoutSide {
  const threshold = options?.thresholdPx ?? SIDE_DRAG_EDGE_THRESHOLD_PX;
  const verticalThreshold =
    options?.verticalThresholdPx ?? SIDE_DRAG_VERTICAL_EDGE_THRESHOLD_PX;
  const allowVertical = options?.allowVertical !== false;
  const canCommitTopBottom = allowTopBottomFromSideDrag(
    x,
    bounds.layoutWidth,
    currentSide,
    options?.dragStartX,
    {
      sideColumnOuterXPx: options?.sideColumnOuterXPx,
      fineTuneSlackPx: options?.fineTuneSlackPx,
    },
  );

  type EdgeCandidate = { side: LayoutSide; dist: number; threshold: number };
  const candidates: EdgeCandidate[] = [
    { side: "left", dist: x, threshold },
    { side: "right", dist: bounds.layoutWidth - x, threshold },
  ];
  if (allowVertical && canCommitTopBottom) {
    candidates.push({
      side: "top",
      dist: Math.max(0, y - bounds.minY),
      threshold: verticalThreshold,
    });
    candidates.push({
      side: "bottom",
      dist: Math.max(0, bounds.maxY - y),
      threshold: verticalThreshold,
    });
  }

  // Ignore the current side — a cable already on left stays ~24px from the left
  // edge, which would otherwise always beat top/bottom when dragging vertically.
  const eligible = candidates.filter((c) => c.side !== currentSide);
  if (eligible.length === 0) return currentSide;

  const nearest = eligible.reduce((best, c) =>
    c.dist < best.dist ? c : best,
  );
  const nextSide =
    nearest.dist <= nearest.threshold ? nearest.side : currentSide;

  logSideDrag("detectSideFromEdgeProximity", {
    phase: "detect",
    drag: { x, y },
    currentSide,
    newSide: nextSide,
    sideChanged: nextSide !== currentSide,
    bounds: {
      layoutWidth: bounds.layoutWidth,
      minY: bounds.minY,
      maxY: bounds.maxY,
      threshold,
      verticalThreshold,
      nearestDist: nearest.dist,
    },
    canCommitTopBottom,
    dragStartX: options?.dragStartX,
    note:
      nextSide !== currentSide
        ? `nearest=${nearest.side} dist=${nearest.dist.toFixed(0)}`
        : `within threshold keep ${currentSide}`,
  });

  return nextSide;
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

/** After a side flip, keep stack-axis drag coord; take cross-axis from auto placement. */
export function resolveSideDragCablePosition(
  newSide: LayoutSide,
  sideChanged: boolean,
  dragPosition: { x: number; y: number },
  builtPosition: { x: number; y: number },
): { x: number; y: number } {
  if (!sideChanged) return dragPosition;
  if (newSide === "top" || newSide === "bottom") {
    return { x: dragPosition.x, y: builtPosition.y };
  }
  return { x: builtPosition.x, y: dragPosition.y };
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

/** True when post-import cable drag can use the unified 4-side candidate commit path. */
export function canUseCandidateSideDrag(
  graph: ConnectionGraph,
  overrides: LayoutOverrides,
): boolean {
  return candidateFromOverrides(graph, overrides) !== undefined;
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
  const lockedTubes = overrides.locks?.tubeGroups ?? {};
  const gridLocks = overrides.gridLocks;

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

/** True when side drag should run constrained layout re-search (T/B or quad involved). */
export function needsReoptimizeAfterSideDrag(
  prevLayoutMode: LayoutMode,
  newSide: LayoutSide,
  candidate: LayoutCandidate,
): boolean {
  if (newSide === "top" || newSide === "bottom") return true;
  if (prevLayoutMode === "quad") return true;
  if (deriveLayoutMode(candidate) === "quad") return true;
  return false;
}

/** Pin every cable to its current side during re-optimize; only the dragged cable may change. */
export function lockedSidesForSideDrag(
  graph: ConnectionGraph,
  overrides: LayoutOverrides,
  visualId: string,
  newSide: LayoutSide,
  seedCandidate?: LayoutCandidate,
): Record<string, LayoutSide> {
  if (seedCandidate) {
    return { ...seedCandidate.cableSides };
  }

  const baseCandidate = candidateFromOverrides(graph, overrides);
  if (baseCandidate) {
    const locked = { ...baseCandidate.cableSides };
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vc = visualCables.find((c) => c.id === visualId);
    if (vc) {
      locked[cableNameKey(vc.cable)] = newSide;
    }
    return locked;
  }

  const { visualCables } = buildVisualCablesForLayout(graph);
  const vc = visualCables.find((c) => c.id === visualId);
  if (!vc) return {};

  return { [cableNameKey(vc.cable)]: newSide };
}

/** Build seed candidate after moveCableInCandidate for re-optimize input. */
export function prepareSideDragSeedCandidate(
  graph: ConnectionGraph,
  overrides: LayoutOverrides,
  visualId: string,
  newSide: LayoutSide,
  stackCoord: number,
  positions: Record<string, { x: number; y: number }>,
): LayoutCandidate | null {
  const baseCandidate = candidateFromOverrides(graph, overrides);
  if (!baseCandidate) return null;

  const { visualCables } = buildVisualCablesForLayout(graph);
  const vc = visualCables.find((c) => c.id === visualId);
  if (!vc) return null;

  return moveCableInCandidate(
    baseCandidate,
    cableNameKey(vc.cable),
    newSide,
    stackCoord,
    visualCables,
    positions,
  );
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
  /** When set (e.g. after re-optimize), skip moveCableInCandidate. */
  finalCandidate?: LayoutCandidate;
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

  const stackCoord = stackCoordForSide(args.newSide, args.position);
  let positionsForBuild = { ...args.overrides.positions };
  if (sideChanged) {
    delete positionsForBuild[args.nodeId];
  } else {
    positionsForBuild[args.nodeId] = args.position;
  }

  const candidate =
    args.finalCandidate ??
    (sideChanged
      ? moveCableInCandidate(
          baseCandidate,
          cableKey,
          args.newSide,
          stackCoord,
          visualCables,
          positionsForBuild,
        )
      : baseCandidate);

  const layoutMode = deriveLayoutMode(candidate);
  // Stale L/R drag coords fight quad auto-placement and strand attachment.
  if (sideChanged && layoutMode === "quad") {
    for (const other of visualCables) {
      const otherId = `cable-${other.id}`;
      if (otherId !== args.nodeId) {
        delete positionsForBuild[otherId];
      }
    }
  }

  const flippedConnIds = sideChanged
    ? rerouteConnectionIdsForVisualCableDrag(visualCables, args.visualId)
    : [];
  const strippedRouting = stripRoutingOverridesForConnections(
    args.overrides,
    flippedConnIds,
  );

  const mergedOverrides: LayoutOverrides = {
    ...args.overrides,
    layoutWidth: candidate.layoutWidth,
    layoutExpansion: candidate.layoutExpansion,
    layoutMode,
    optimizedLayoutCandidate: candidate,
    cableSides: candidateToCableSidesRecord(candidate, visualCables),
    ...(layoutMode === "quad"
      ? {
          quadCableSides: candidateToQuadCableSidesRecord(
            candidate,
            visualCables,
          ),
        }
      : { quadCableSides: undefined }),
    positions: positionsForBuild,
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

  const builtDragged = buildResult.nodes.find((node) => node.id === args.nodeId);
  const resolvedPosition = builtDragged
    ? resolveSideDragCablePosition(
        args.newSide,
        sideChanged,
        args.position,
        builtDragged.position,
      )
    : args.position;

  const nodes = buildResult.nodes.map((node) =>
    node.id === args.nodeId ? { ...node, position: resolvedPosition } : node,
  );

  const persistedPositions = {
    ...positionsForBuild,
    ...(sideChanged || !args.preview ? { [args.nodeId]: resolvedPosition } : {}),
  };

  let nextOverrides = { ...mergedOverrides, positions: persistedPositions };
  if (!args.preview) {
    nextOverrides = {
      ...nextOverrides,
      positions: { ...nextOverrides.positions, [args.nodeId]: resolvedPosition },
      optimizedLayoutCandidate: candidate,
    };
  }

  args.graph.cableSides.set(
    args.visualId,
    args.newSide === "right" ? "right" : "left",
  );

  logSideDrag("applyCableSideDragCommit", {
    phase: args.preview ? "preview" : "commit",
    visualId: args.visualId,
    nodeId: args.nodeId,
    drag: args.position,
    currentSide: prevSide,
    newSide: args.newSide,
    sideChanged,
    layoutMode,
    resolved: resolvedPosition,
    nodeCount: nodes.length,
    note: args.preview ? "preview" : sideChanged ? "side-flip" : "same-side",
  });

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
