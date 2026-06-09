import type { CablePlacement } from "@/features/diagram/canvasPlacement";
import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";
import {
  CABLE_LAYOUT,
  minCenterGapForRowSpan,
} from "@/features/diagram/cableLayoutMetrics";
import { connectionRowOffsets, maxConnectionRowOffset } from "@/features/diagram/connectionRowOrder";
import type { DominantCablePair } from "@/features/diagram/dominantCablePair";
import {
  collapsedPairIdsFromButtSplices,
  detectFullButtSpliceTubes,
  resolveFullButtSpliceVisuals,
} from "@/features/diagram/fullButtSplice";
import {
  computeAlignedLayout,
  estimatedCableNodeWidth,
} from "@/features/diagram/spliceRowLayout";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import type { VisualCable } from "@/features/diagram/visualCables";
import { stageInnerWidth } from "@/features/canvas/diagramViewport";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

export const LAYOUT = {
  width: CABLE_LAYOUT.width,
  centerX: CABLE_LAYOUT.width / 2,
  leftCableX: CABLE_LAYOUT.leftX,
  rightCableX: CABLE_LAYOUT.rightX,
  startY: CABLE_LAYOUT.topY,
} as const;

export type DiagramLayout = {
  reportKey: string;
  rowYs: Map<string, number>;
  cablePositions: Map<string, { x: number; y: number; height: number }>;
  layoutWidth: number;
};

export const LAYOUT_STORAGE_PREFIX = "splice-detail-layout:";

export type ImportLayoutWidthOptions = {
  collapse?: boolean;
  stageWidth?: number;
};

function hiddenPairIdsForLayout(
  graph: ConnectionGraph,
  collapse: boolean,
): Set<string> {
  if (!collapse) return new Set();
  const { visualCables } = buildVisualCablesForLayout(graph);
  const detected = detectFullButtSpliceTubes(graph, visualCables);
  const resolved = resolveFullButtSpliceVisuals(visualCables, detected);
  return collapsedPairIdsFromButtSplices(resolved.map((r) => r.tube));
}

/** Active splice lane count — matches edge routing after optional butt collapse. */
export function activeSpliceLaneCount(
  graph: ConnectionGraph,
  collapse = false,
): number {
  const hidden = hiddenPairIdsForLayout(graph, collapse);
  return orderedFiberConnections(graph).filter((c) => !hidden.has(c.id)).length;
}

/** Minimum diagram width from cable columns + center routing (ignores viewport). */
export function minLayoutWidthForGraph(graph: ConnectionGraph): number {
  const laneCount = activeSpliceLaneCount(graph, false);
  const { visualCables, dominant } = buildVisualCablesForLayout(graph);
  const rowOffsets = connectionRowOffsets(graph, visualCables, dominant);
  const maxRowOffset = maxConnectionRowOffset(rowOffsets);
  const maxTubes = Math.max(1, ...visualCables.map((vc) => vc.tubes.length));
  const nodeWidth = estimatedCableNodeWidth(
    maxTubes,
    1,
    visualCables.map((vc) => vc.tubes.length),
  );
  const margin = CABLE_LAYOUT.leftX;
  const minCenterGap = minCenterGapForRowSpan(maxRowOffset, laneCount);
  return 2 * margin + 2 * nodeWidth + minCenterGap;
}

/**
 * Minimum canvas width so cable columns leave enough center gap for splice lanes.
 * Uses global row-offset span so horizontal lane spacing matches vertical tube groups.
 *
 * Width is always sized for the **expanded** graph (collapse=false). Toggling
 * full-butt collapse therefore never changes the diagram width — collapsing
 * fewer connections shouldn't shrink the routing space and force the layout
 * to reflow in a way the user has to fix.
 *
 * When `stageWidth` is provided, layout fills the viewport (never below content
 * minimum). Without a stage, falls back to `CABLE_LAYOUT.width` for tests/offline.
 */
export function importLayoutWidthForGraph(
  graph: ConnectionGraph,
  options?: ImportLayoutWidthOptions,
): number {
  // Intentionally ignore options.collapse for width sizing — see fn doc above.
  const columnSpan = minLayoutWidthForGraph(graph);
  const stageWidth = options?.stageWidth ?? 0;

  if (stageWidth > 0) {
    return Math.max(stageInnerWidth(stageWidth), columnSpan);
  }
  return Math.max(CABLE_LAYOUT.width, columnSpan);
}

/** Layout width for import / column refresh — fills viewport when stage is known. */
export function resolveLayoutWidthForStage(
  graph: ConnectionGraph,
  stageWidth: number,
  savedLayoutWidth?: number,
): number {
  const viewportWidth = importLayoutWidthForGraph(graph, { stageWidth });
  if (savedLayoutWidth !== undefined && savedLayoutWidth > viewportWidth + 1) {
    return savedLayoutWidth;
  }
  return viewportWidth;
}

/**
 * Viewport-driven width for live reflow. Preserves user outward drag expansion
 * when the current layout is wider than the viewport would require.
 */
export function layoutWidthForViewport(
  graph: ConnectionGraph,
  stageWidth: number,
  currentLayoutWidth?: number,
  preserveUserExpansion = true,
): number {
  return stageLayoutWidthForGraph(graph, stageWidth, {
    userExpandedLayoutWidth: preserveUserExpansion
      ? currentLayoutWidth
      : undefined,
  });
}

/**
 * Canvas width for the current stage. Uses the content routing minimum (never
 * narrower than center-gap needs). Preserves user outward drag expansion only
 * when explicitly flagged via `userExpandedLayoutWidth`.
 */
export function stageLayoutWidthForGraph(
  graph: ConnectionGraph,
  stageWidth: number,
  options?: { userExpandedLayoutWidth?: number },
): number {
  const viewportWidth = importLayoutWidthForGraph(graph, { stageWidth });
  const userWidth = options?.userExpandedLayoutWidth;
  if (userWidth !== undefined && userWidth > viewportWidth + 1) {
    return userWidth;
  }
  return viewportWidth;
}

export function reportStorageKey(graph: ConnectionGraph): string {
  const name =
    graph.report.header.spliceNumber ??
    graph.report.header.name ??
    "splice";
  return `${LAYOUT_STORAGE_PREFIX}${name}`;
}

export function computeDiagramLayout(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  placement: Map<string, CablePlacement>,
  dominant?: DominantCablePair | null,
  layoutWidth?: number,
  excludeConnectionIds?: ReadonlySet<string>,
): DiagramLayout {
  const aligned = computeAlignedLayout(
    graph,
    visualCables,
    placement,
    dominant,
    layoutWidth,
    excludeConnectionIds,
  );
  return {
    reportKey: reportStorageKey(graph),
    rowYs: aligned.rowYs,
    cablePositions: aligned.cablePositions,
    layoutWidth: aligned.layoutWidth,
  };
}

export type ApplyLayoutOverridesOptions = {
  /** On import: keep saved Y but always use auto column X from layout. */
  refreshColumnX?: boolean;
  /** Recompute Y from auto layout while preserving user drag delta vs last autoLayoutY. */
  refreshRowLayout?: boolean;
};

export function autoPositionsFromLayout(
  layout: DiagramLayout,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [id, pos] of layout.cablePositions) {
    positions[`cable-${id}`] = { x: pos.x, y: pos.y };
  }
  return positions;
}

export function autoLayoutYFromPositions(
  positions: Record<string, { x: number; y: number }>,
): Record<string, number> {
  const autoLayoutY: Record<string, number> = {};
  for (const [id, pos] of Object.entries(positions)) {
    autoLayoutY[id] = pos.y;
  }
  return autoLayoutY;
}

export function applyLayoutOverrides(
  positions: Record<string, { x: number; y: number }>,
  overrides?: LayoutOverrides,
  options?: ApplyLayoutOverridesOptions,
): Record<string, { x: number; y: number }> {
  if (options?.refreshRowLayout) {
    return applyRowLayoutWithDragPreservation(positions, overrides);
  }
  if (!overrides?.positions) return positions;
  if (!options?.refreshColumnX) {
    return { ...positions, ...overrides.positions };
  }

  const merged = { ...positions };
  for (const [id, saved] of Object.entries(overrides.positions)) {
    const auto = positions[id];
    merged[id] = auto ? { x: auto.x, y: saved.y } : saved;
  }
  return merged;
}

/** Apply new auto Y plus preserved user drag delta from the previous auto snapshot. */
export function applyRowLayoutWithDragPreservation(
  autoPositions: Record<string, { x: number; y: number }>,
  overrides?: LayoutOverrides,
): Record<string, { x: number; y: number }> {
  const saved = overrides?.positions ?? {};
  const previousAuto = overrides?.autoLayoutY ?? {};
  const merged = { ...autoPositions };

  for (const [id, auto] of Object.entries(autoPositions)) {
    const savedPos = saved[id];
    const prevAutoY = previousAuto[id];
    if (savedPos !== undefined && prevAutoY !== undefined) {
      merged[id] = { x: auto.x, y: auto.y + (savedPos.y - prevAutoY) };
    } else {
      merged[id] = { x: auto.x, y: auto.y };
    }
  }

  return merged;
}

export function nodePositionsForGraph(
  _graph: ConnectionGraph,
  layout: DiagramLayout,
  overrides?: LayoutOverrides,
  options?: ApplyLayoutOverridesOptions,
): Record<string, { x: number; y: number }> {
  const autoPositions = autoPositionsFromLayout(layout);
  return applyLayoutOverrides(autoPositions, overrides, options);
}
