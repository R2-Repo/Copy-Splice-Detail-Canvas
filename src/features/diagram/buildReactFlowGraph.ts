import type { Edge, Node } from "@xyflow/react";

import {
  computeSideCircuitLabelSpans,
  smfoLabelForCable,
} from "@/features/diagram/cableLabels";
import {
  computeCableBreakout,
  computeDiagramScale,
  computeSideStemAlignment,
} from "@/features/diagram/cableBreakoutGeometry";
import { computeCanvasPlacement } from "@/features/diagram/canvasPlacement";
import {
  applyCableSideOverrides,
  displaySideFromCanvasX,
} from "@/features/diagram/cableDisplaySide";
import { resolveSpliceSourceTarget } from "@/features/diagram/resolveSpliceSourceTarget";
import {
  CABLE_LAYOUT,
  compactVisualCableHeight,
  visualCableHeight,
} from "@/features/diagram/cableLayoutMetrics";
import { colorHex } from "@/features/diagram/colorCode";
import { connectionRowIndexMap, connectionRowOffsets } from "@/features/diagram/connectionRowOrder";
import {
  collapsedPairIdsFromButtSplices,
  collapsedTubeColorsForVisualCable,
  detectFullButtSpliceTubes,
  resolveFullButtSpliceVisuals,
} from "@/features/diagram/fullButtSplice";
import {
  computeDiagramLayout,
  autoLayoutYFromPositions,
  autoPositionsFromLayout,
  nodePositionsForGraph,
  type DiagramLayout,
} from "@/features/diagram/layoutSpliceDiagram";
import {
  computeCableXBounds,
  resolveSameSideNodeCollisions,
} from "@/features/diagram/spliceRowLayout";
import type { CableXBounds } from "@/features/diagram/cableLayoutMetrics";
import { tubeHandleId } from "@/features/diagram/tubeId";
import { applyPersistedTubeOverrides } from "@/features/diagram/applyTubeOverrides";
import {
  applyAllLegOverrides,
  applyHybridFusionDotLocks,
  mergeFanoutOverridesIntoTubes,
} from "@/features/manualAdjust/applyManualAdjust";
import {
  applyTubeRowAlignmentShifts,
  cablePositionsFromNodePositions,
  type TubeKey,
  type TubeRowShiftOptions,
} from "@/features/diagram/tubeRowShift";
import {
  buildSpliceHandleEntries,
  routingLaneDataFromLane,
  sourceTubeDotGroupKey,
  spliceTubeBundleKey,
} from "@/features/canvas/edges/spliceEdgeRouting";
import { routeCenterSplices } from "@/features/diagram/centerRouter";
import { augmentNodesEngineGraph } from "@/features/diagram/buildNodesEngineGraph";
import { useNodesRoutingEngine } from "@/features/diagram/routingEngine";
import {
  buildVisualCablesForLayout,
  endpointOnVisualSide,
  type VisualCable,
} from "@/features/diagram/visualCables";
import { orderedFiberConnections } from "@/features/diagram/buildConnectionGraph";
import { buildQuadReactFlowGraph } from "@/features/diagram/quad/buildQuadReactFlowGraph";
import type {
  ConnectionGraph,
  FiberColorAbbrev,
  LayoutOverrides,
  TubeColorCode,
} from "@/types/splice";

import type { CableNodeData } from "@/features/canvas/nodes/types";

function nodeHeightForVisualCable(
  vc: VisualCable,
  collapsedTubeColors?: string[],
): number {
  const collapsed = new Set(collapsedTubeColors ?? []);
  if (collapsed.size === 0) return visualCableHeight(vc);

  const visibleFibers = vc.tubes
    .filter((t) => !collapsed.has(t.tubeColor))
    .flatMap((t) => t.fibers);
  const collapsedTubeCount = vc.tubes.filter((t) =>
    collapsed.has(t.tubeColor),
  ).length;

  if (visibleFibers.length === 0) {
    return compactVisualCableHeight(Math.max(1, collapsedTubeCount));
  }

  const maxYOffset = Math.max(...visibleFibers.map((f) => f.rowYOffset));
  const collapsedExtra =
    collapsedTubeCount > 0
      ? collapsedTubeCount * CABLE_LAYOUT.fiberRowH
      : 0;
  return (
    CABLE_LAYOUT.headerH +
    CABLE_LAYOUT.tubeLabelH +
    maxYOffset +
    collapsedExtra +
    CABLE_LAYOUT.fiberRowH +
    CABLE_LAYOUT.tubeGap
  );
}

function applyPlacementToLegs(
  graph: ConnectionGraph,
  visualCables: VisualCable[],
  placement: ReturnType<typeof computeCanvasPlacement>,
): void {
  for (const leg of graph.legs) {
    const instances = visualCables.filter((v) => v.legId === leg.id);
    const p = instances.map((v) => placement.get(v.id)?.side).filter(Boolean);
    if (p.length > 0) {
      leg.side = p[0]!;
    }
  }
}

function collapsedTubeColorsByVcId(
  visualCables: VisualCable[],
  resolvedButtSplices: ReturnType<typeof resolveFullButtSpliceVisuals>,
): Map<string, Set<TubeColorCode>> {
  const map = new Map<string, Set<TubeColorCode>>();
  for (const vc of visualCables) {
    const colors = collapsedTubeColorsForVisualCable(vc, resolvedButtSplices);
    if (colors.length > 0) {
      map.set(vc.id, new Set(colors));
    }
  }
  return map;
}

function buildCableNode(
  vc: VisualCable,
  pos: { x: number; y: number },
  graph: ConnectionGraph,
  options: {
    collapsedTubes?: string[];
    diagramScale: number;
    sideStemAlign: ReturnType<typeof computeSideStemAlignment>;
    manualAdjustEnabled?: boolean;
    locked?: boolean;
    lockedTubes?: string[];
  },
): Node {
  const nodeId = `cable-${vc.id}`;
  const alignedStemX = options.sideStemAlign[vc.side];
  const breakout = computeCableBreakout(
    vc.tubes,
    vc.side,
    CABLE_LAYOUT.fiberRowH,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
    options.diagramScale,
    alignedStemX,
  );
  return {
    id: nodeId,
    type: "cable",
    position: pos,
    width: breakout.viewWidth,
    height: breakout.viewHeight,
    data: {
      smfoLabel: smfoLabelForCable(vc.cable),
      label: vc.cable,
      legId: vc.legId,
      side: vc.side,
      tubes: vc.tubes,
      nodeHeight: nodeHeightForVisualCable(vc, options.collapsedTubes),
      fiberPitch: CABLE_LAYOUT.fiberRowH,
      diagramScale: options.diagramScale,
      alignedStemX,
      spliceNumber: graph.report.header.spliceNumber,
      collapsedTubes: options.collapsedTubes,
      manualAdjustEnabled: options.manualAdjustEnabled,
      locked: options.locked,
      lockedTubes:
        options.lockedTubes && options.lockedTubes.length > 0
          ? options.lockedTubes
          : undefined,
    } satisfies CableNodeData,
    draggable: !options.locked,
  };
}

export function buildReactFlowGraph(
  graph: ConnectionGraph,
  overrides?: LayoutOverrides,
  layoutWidth?: number,
  buildOptions?: {
    refreshColumnX?: boolean;
    refreshRowLayout?: boolean;
    skipFeasibility?: boolean;
    stageWidth?: number;
    /** Skip cross-side tube tip auto-alignment (manual adjust mode). */
    skipTubeAutoAlign?: boolean;
    /** Live cable drag — preserve exact Y, skip stack collision + tube auto-align. */
    dragSync?: boolean;
    /** Grid incremental reroute — connection ids on the dragged cable. */
    rerouteConnectionIds?: string[];
    dragCacheEdges?: Edge[];
    priorGridRoutes?: Map<string, import("@/features/grid/gridTypes").GridRoute>;
    /** Reuse layout-rule visualCables so grid reconcile matches EDGE-011 geometry. */
    sharedVisualCables?: import("@/features/diagram/visualCables").VisualCable[];
    /** Search harness — skip barycenter placement; use candidate stack order. */
    fixedPlacement?: Map<string, import("@/features/diagram/canvasPlacement").CablePlacement>;
    /** Search harness — quad stack order per side (cable name keys). */
    fixedQuadStackOrder?: Partial<Record<import("@/types/splice").QuadSide, string[]>>;
  },
): {
  nodes: Node[];
  edges: Edge[];
  layout: DiagramLayout;
  xBounds: CableXBounds;
  autoLayoutY: Record<string, number>;
  visualCables?: import("@/features/diagram/visualCables").VisualCable[];
  placement?: Map<string, import("@/features/diagram/canvasPlacement").CablePlacement>;
} {
  // Additive 4-side engine — fully isolated; horizontal pipeline below is untouched.
  if (overrides?.layoutMode === "quad") {
    return buildQuadReactFlowGraph(graph, overrides, layoutWidth, buildOptions);
  }

  const collapseFullButtSplices = overrides?.collapseFullButtSplices ?? false;
  const effectiveWidth =
    layoutWidth ?? CABLE_LAYOUT.width;
  const centerX = effectiveWidth / 2;

  const { visualCables, dominant } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
  const placement =
    buildOptions?.fixedPlacement ??
    computeCanvasPlacement(graph, visualCables, dominant, rowIndex);
  applyCableSideOverrides(placement, visualCables, overrides?.cableSides);
  applyPlacementToLegs(graph, visualCables, placement);

  for (const vc of visualCables) {
    const p = placement.get(vc.id);
    if (p) vc.side = p.side;
  }

  const detectedButtSplices = collapseFullButtSplices
    ? detectFullButtSpliceTubes(graph, visualCables)
    : [];
  const resolvedButtSplices = collapseFullButtSplices
    ? resolveFullButtSpliceVisuals(visualCables, detectedButtSplices)
    : [];
  const hiddenPairIds = collapseFullButtSplices
    ? collapsedPairIdsFromButtSplices(resolvedButtSplices.map((r) => r.tube))
    : new Set<string>();

  const activeConnections = orderedFiberConnections(graph).filter(
    (c) => !hiddenPairIds.has(c.id),
  );
  const rowCount = activeConnections.length;
  const diagramScale = computeDiagramScale(rowCount);

  const rowOffsets = connectionRowOffsets(
    graph,
    visualCables,
    dominant,
    hiddenPairIds.size > 0 ? hiddenPairIds : undefined,
  );

  const layout = computeDiagramLayout(
    graph,
    visualCables,
    placement,
    dominant,
    layoutWidth,
    hiddenPairIds.size > 0 ? hiddenPairIds : undefined,
  );
  const autoPositions = autoPositionsFromLayout(layout);
  const autoLayoutY = autoLayoutYFromPositions(autoPositions);
  const positions = nodePositionsForGraph(graph, layout, overrides, {
    refreshColumnX: buildOptions?.refreshColumnX,
    refreshRowLayout: buildOptions?.refreshRowLayout,
  });

  // User-locked whole cables: pin to their saved coordinates (x + y), overriding
  // any refresh pass, so they stay frozen across auto/manual + other moves.
  const lockedCableIds = new Set<string>(
    Object.keys(overrides?.locks?.cables ?? {}),
  );
  for (const vcId of lockedCableIds) {
    const saved =
      overrides?.positions?.[`cable-${vcId}`] ?? overrides?.positions?.[vcId];
    if (saved) positions[`cable-${vcId}`] = { x: saved.x, y: saved.y };
  }

  const autoAdjustOn = overrides?.autoAdjustEnabled !== false;

  if (buildOptions?.dragSync !== true && autoAdjustOn) {
    resolveSameSideNodeCollisions(
      visualCables,
      placement,
      positions,
      diagramScale,
      lockedCableIds,
    );
  }

  // Fan-out Y: tubeOverrides.visualShiftY first, then fanoutOverrides.shiftY wins on conflict.
  const lockedTubeKeys = applyPersistedTubeOverrides(
    visualCables,
    overrides?.tubeOverrides,
  );
  // User-locked fan-out groups also skip auto tube-row alignment (frozen shape).
  const userLockedTubeKeys = Object.keys(
    overrides?.locks?.tubeGroups ?? {},
  ) as TubeKey[];
  for (const key of userLockedTubeKeys) lockedTubeKeys.add(key);
  mergeFanoutOverridesIntoTubes(visualCables, overrides);

  const tubeShiftOptions: TubeRowShiftOptions = {
    ...(collapseFullButtSplices && resolvedButtSplices.length > 0
      ? {
          collapsedTubeColorsByVcId: collapsedTubeColorsByVcId(
            visualCables,
            resolvedButtSplices,
          ),
        }
      : {}),
    lockedTubeKeys,
  };

  if (
    autoAdjustOn &&
    buildOptions?.skipTubeAutoAlign !== true &&
    buildOptions?.dragSync !== true
  ) {
    applyTubeRowAlignmentShifts(
      graph,
      visualCables,
      layout.rowYs,
      cablePositionsFromNodePositions(positions),
      tubeShiftOptions,
    );
  }

  for (const vc of visualCables) {
    const pos = positions[`cable-${vc.id}`];
    if (!pos) continue;
    const displaySide = displaySideFromCanvasX(pos.x, centerX);
    vc.side = displaySide;
    const p = placement.get(vc.id);
    if (p) {
      placement.set(vc.id, { ...p, side: displaySide });
    }
  }

  const sideStemAlign = computeSideStemAlignment(
    visualCables.map((vc) => ({ tubes: vc.tubes, side: vc.side })),
    CABLE_LAYOUT.fiberRowH,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
    diagramScale,
  );

  const sideCircuitSpan = computeSideCircuitLabelSpans(
    visualCables,
    (vc) => vc.side,
  );

  const nodeBuildOptions = {
    diagramScale,
    sideStemAlign,
    manualAdjustEnabled: !autoAdjustOn,
  };

  const lockedTubesByVc = new Map<string, string[]>();
  for (const key of userLockedTubeKeys) {
    const sep = key.indexOf("|");
    if (sep < 0) continue;
    const vcId = key.slice(0, sep);
    const tubeColor = key.slice(sep + 1);
    const list = lockedTubesByVc.get(vcId) ?? [];
    list.push(tubeColor);
    lockedTubesByVc.set(vcId, list);
  }

  const nodes: Node[] = visualCables.map((vc) => {
    const nodeId = `cable-${vc.id}`;
    const pos = positions[nodeId] ?? { x: 0, y: 0 };
    const collapsedTubes = collapseFullButtSplices
      ? collapsedTubeColorsForVisualCable(vc, resolvedButtSplices)
      : undefined;
    return buildCableNode(vc, pos, graph, {
      ...nodeBuildOptions,
      collapsedTubes,
      locked: lockedCableIds.has(vc.id),
      lockedTubes: lockedTubesByVc.get(vc.id),
    });
  });

  const edges: Edge[] = [];
  const laneCount = activeConnections.length;

  for (const conn of orderedFiberConnections(graph)) {
    if (hiddenPairIds.has(conn.id)) continue;

    const csvLeft = endpointOnVisualSide(conn, graph, visualCables, "left");
    const csvRight = endpointOnVisualSide(conn, graph, visualCables, "right");
    if (!csvLeft || !csvRight) continue;

    const { source, target } = resolveSpliceSourceTarget(
      csvLeft,
      csvRight,
      positions,
    );

    const laneIndex = rowIndex.get(conn.id) ?? 0;
    edges.push({
      id: `splice-${conn.id}`,
      source: `cable-${source.visualCableId}`,
      target: `cable-${target.visualCableId}`,
      sourceHandle: `${source.handleId}-out`,
      targetHandle: `${target.handleId}-in`,
      type: "splice",
      data: {
        sourceColor: colorHex(source.endpoint.fiberColor),
        targetColor: colorHex(target.endpoint.fiberColor),
        existing:
          overrides?.existingEdgeIds?.includes(`splice-${conn.id}`) ||
          // Back-compat: older saves stored a single split-leg id.
          overrides?.existingEdgeIds?.includes(`splice-left-${conn.id}`) ||
          overrides?.existingEdgeIds?.includes(`splice-right-${conn.id}`),
        circuitName: conn.pair.circuitName,
        laneIndex,
        laneCount,
        rowOffset: rowOffsets.get(conn.id) ?? 0,
        sideCircuitSpan,
        diagramCenterX: centerX,
        tubeBundleKey: spliceTubeBundleKey(
          source.visualCableId,
          source.endpoint.tubeColor,
          target.visualCableId,
        ),
        sourceTubeDotGroupKey: sourceTubeDotGroupKey(
          source.visualCableId,
          source.endpoint.tubeColor,
        ),
      },
    });
  }

  for (const {
    tube,
    leftVc,
    rightVc,
    leftEndpoint,
    rightEndpoint,
  } of resolvedButtSplices) {
    const leftHandle = tubeHandleId(leftEndpoint.legId, leftEndpoint.tubeColor);
    const rightHandle = tubeHandleId(
      rightEndpoint.legId,
      rightEndpoint.tubeColor,
    );
    const leftBase = leftEndpoint.tubeColor.split("-")[0] as FiberColorAbbrev;
    const rightBase = rightEndpoint.tubeColor.split("-")[0] as FiberColorAbbrev;
    const laneIndex = Math.min(
      ...tube.pairIds.map((id) => rowIndex.get(id) ?? 0),
    );
    const rowOffset = Math.min(
      ...tube.pairIds.map((id) => rowOffsets.get(id) ?? 0),
    );

    edges.push({
      id: `butt-${tube.id}`,
      source: `cable-${leftVc.id}`,
      target: `cable-${rightVc.id}`,
      sourceHandle: `${leftHandle}-out`,
      targetHandle: `${rightHandle}-in`,
      type: "splice",
      data: {
        fullButtSplice: true,
        existing: overrides?.existingEdgeIds?.includes(`butt-${tube.id}`),
        pairIds: tube.pairIds,
        sourceColor: colorHex(leftBase),
        targetColor: colorHex(rightBase),
        laneIndex,
        laneCount,
        rowOffset,
        sideCircuitSpan,
        diagramCenterX: centerX,
      },
    });
  }

  const xBounds = computeCableXBounds(
    visualCables,
    placement,
    effectiveWidth,
  );

  if (useNodesRoutingEngine(overrides)) {
    const routingVisualCables =
      buildOptions?.sharedVisualCables ?? visualCables;
    const augmented = augmentNodesEngineGraph(
      nodes,
      edges,
      routingVisualCables,
      centerX,
      {
        overrides,
        layoutWidth: effectiveWidth,
        rerouteConnectionIds: buildOptions?.rerouteConnectionIds,
        dragCacheEdges: buildOptions?.dragCacheEdges,
        priorGridRoutes: buildOptions?.priorGridRoutes,
        useLiveHandleLanes: buildOptions?.dragSync === true,
        layoutEndpointSync: {
          graph,
          visualCables: routingVisualCables,
          nodes,
        },
      },
    );
    return {
      nodes: augmented.nodes,
      edges: applyHybridFusionDotLocks(
        applyAllLegOverrides(augmented.edges, overrides, augmented.nodes, graph),
        overrides,
        augmented.nodes,
        graph,
      ),
      layout,
      xBounds,
      autoLayoutY,
      visualCables,
      placement,
    };
  }

  const importHandleEntries = buildSpliceHandleEntries(nodes, edges, visualCables);
  const importRouting = routeCenterSplices(importHandleEntries, centerX);
  const routedEdges = edges.map((edge) => {
    const lane = importRouting.get(edge.id);
    if (!lane) return edge;
    return {
      ...edge,
      data: {
        ...(edge.data as Record<string, unknown>),
        ...routingLaneDataFromLane(lane),
      },
    };
  });

  return { nodes, edges: routedEdges, layout, xBounds, autoLayoutY, visualCables, placement };
}
