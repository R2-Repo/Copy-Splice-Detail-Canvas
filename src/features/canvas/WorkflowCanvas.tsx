import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  useEdgesState,
  useNodesState,
  useUpdateNodeInternals,
  type Edge,
  type Node,
  type OnNodeDrag,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ConnectionInspectorOverlay } from "@/components/ConnectionInspectorOverlay";
import {
  CanvasContextMenu,
  type CanvasContextMenuState,
  type ContextMenuItem,
} from "@/features/canvas/contextMenu/CanvasContextMenu";
import {
  CanvasContextMenuProvider,
  type CanvasContextMenuValue,
  type ContextMenuTarget,
} from "@/features/canvas/contextMenu/CanvasContextMenuContext";
import { HelpGuideOverlay } from "@/components/help/HelpGuideOverlay";
import { SpliceReportOverlay } from "@/components/SpliceReportOverlay";
import { CalloutsToolbarControl } from "@/components/toolbar/CalloutsToolbarControl";
import { CALLOUT_BOX, defaultCalloutPosition } from "@/features/canvas/callouts/cableCalloutGeometry";
import { CalloutLeaderLayer } from "@/features/canvas/callouts/CalloutLeaderLayer";
import { CalloutPersistContext } from "@/features/canvas/callouts/CalloutPersistContext";
import {
  CALLOUT_AUTO_ZOOM_DEFAULT,
  CALLOUT_SCALE_DEFAULT,
  clampCalloutScale,
  effectiveCalloutScale,
} from "@/features/canvas/callouts/calloutScale";
import {
  CalloutScaleProvider,
  type CalloutScaleContextValue,
} from "@/features/canvas/callouts/CalloutScaleContext";
import {
  calloutIdForCable,
  fibersFromCableTubes,
  formatCableCalloutText,
} from "@/features/canvas/callouts/formatCableCalloutText";
import { mergeCalloutNodes } from "@/features/canvas/callouts/mergeCalloutNodes";
import { mergeTitleNode } from "@/features/canvas/titleBox/mergeTitleNode";
import { TitlePersistContext } from "@/features/canvas/titleBox/TitlePersistContext";
import { DIAGRAM_TITLE_NODE_ID } from "@/features/canvas/titleBox/titleBoxLayout";
import {
  buildCircuitIndex,
  type CircuitIndex,
} from "@/features/canvas/circuitIndex";
import { CircuitHighlightProvider } from "@/features/canvas/CircuitHighlightContext";
import { CircuitListPanel } from "@/features/canvas/CircuitListPanel";
import { ExistingToggleProvider } from "@/features/canvas/ExistingToggleContext";
import { useExistingLongPress } from "@/features/canvas/useExistingLongPress";
import {
  ManualLayoutProvider,
  type ManualLayoutGuideLine,
} from "@/features/canvas/ManualLayoutContext";
import { ManualLayoutGuideOverlay } from "@/features/canvas/ManualLayoutGuideOverlay";
import { spliceEdgeTypes } from "@/features/canvas/edgeTypes";
import { updateSpliceRoutingNodeInternals } from "@/features/canvas/updateSpliceRoutingNodeInternals";
import {
  calloutsShouldShow,
  existingIdsFromEdges,
  loadLayoutOverrides,
  mergeLayoutOverrides,
  positionsFromNodes,
  saveLayoutOverrides,
} from "@/features/canvas/layoutStorage";
import type {
  CableCalloutNodeData,
  CableNodeData,
  DiagramTitleNodeData,
} from "@/features/canvas/nodes/types";
import { computeDiagramScale } from "@/features/diagram/cableBreakoutGeometry";
import {
  displaySideFromCanvasX,
  visualCableIdFromNodeId,
} from "@/features/diagram/cableDisplaySide";
import { spliceNodeTypes } from "@/features/canvas/nodeTypes";
import {
  CABLE_LAYOUT,
  resolveCableDragStopStackX,
  resolveCableDragStopX,
  resolveCableDragStopY,
  type CableStackXBounds,
  type CableXBounds,
} from "@/features/diagram/cableLayoutMetrics";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { formatSpliceConnectionReport } from "@/features/report/formatSpliceConnectionReport";
import { buildConnectionInspectorModel } from "@/features/report/connectionInspectorModel";
import {
  DEFAULT_LAYOUT_EXPANSION,
  runWithLayoutExpansion,
  type LayoutExpansion,
} from "@/features/diagram/layoutExpansion";
import { resolveFeasibleImportLayout } from "@/features/diagram/layoutRules";
import {
  formatManualLayoutWarningBanner,
  manualLayoutWarningsForConnections,
  touchedConnectionIdsFromEdgeIds,
} from "@/features/diagram/manualLayoutWarnings";
import {
  DiagramConfigParseError,
  parseDiagramConfig,
} from "@/features/export/parseDiagramConfig";
import { restoreDiagramFromConfig } from "@/features/export/restoreDiagramConfig";
import {
  buildDiagramConfig,
  downloadDiagramConfig,
} from "@/features/export/serializeDiagramConfig";
import { usePrintDiagram } from "@/features/export/usePrintDiagram";
import { MapEmbedButton } from "@/features/maps/MapEmbedButton";
import { ManualAdjustOverlay } from "@/features/manualAdjust/ManualAdjustOverlay";
import { syncSplicePointNodes } from "@/features/manualAdjust/syncSplicePointNodes";
import {
  isCollapsedTubeKey,
  repinButtSpliceEdges,
} from "@/features/manualAdjust/repinButtSpliceEdges";
import { syncManualVisualCable } from "@/features/manualAdjust/syncManualVisualCable";
import { tubeKeyForFiberAnchor } from "@/features/manualAdjust/smartSelect";
import { useManualAdjustEngine } from "@/features/manualAdjust/useManualAdjustEngine";
import {
  applyCableSideDragCommit,
  canUseCandidateSideDrag,
  candidateFromOverrides,
  detectSideFromEdgeProximity,
  effectiveCableSide,
  lockedSidesForSideDrag,
  needsReoptimizeAfterSideDrag,
  prepareSideDragSeedCandidate,
  stackCoordForSide,
} from "@/features/manualAdjust/cableSideDrag";
import { logSideDrag } from "@/features/manualAdjust/debugSideDrag";
import {
  stripRoutingOverridesForConnections,
  syncConnectionOverridesFromLegs,
} from "@/features/manualAdjust/connectionOverrides";
import { clearAllHybridLocks, onEditLock, unlockHybridItem } from "@/features/layoutHybrid";
import { gridSegmentIdsFromLegPaths } from "@/features/layoutHybrid/gridSegmentIdsFromPaths";
import { routingEngineMode, useGridRoutingEngine } from "@/features/diagram/routingEngine";
import { gridRoutesFromEdges } from "@/features/grid/gridDragCache";
import type { GridRoute } from "@/features/grid/gridTypes";
import { allRulesPass, buildSdcRuleContext, runImportRules } from "@/features/rules";
import {
  collectGlobalTubeTipSnapTargets,
  collectGlobalFiberHandleSnapTargets,
  spliceEdgeIdsForTubeKey,
} from "@/features/diagram/snapGuides";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import {
  buildCanvasFromCandidate,
  candidateOverridePatch,
} from "@/features/layoutSearch/candidateToGraph";
import {
  deriveLayoutMode,
  heuristicBaselineCandidate,
  compareCandidates,
  type LayoutCandidate,
} from "@/features/layoutSearch/layoutCandidate";
import { LayoutSearchOverlay } from "@/features/layoutSearch/LayoutSearchOverlay";
import { heuristicImportLayoutEnabled, showLayoutModeToggle } from "@/features/layoutSearch/heuristicImportLayout";
import {
  initialSearchProgress,
  layoutSearchViaWorker,
} from "@/features/layoutSearch/layoutSearchClient";
import { reoptimizeAfterSideDrag } from "@/features/layoutSearch/reoptimizeAfterSideDrag";
import {
  cableKeysFromGraph,
  adaptiveMaxRounds,
  DEFAULT_MAX_ROUNDS,
  seedFromReportKey,
  pickBestPassingFinalist,
  type LayoutSearchProgress,
  type LayoutSearchResult,
} from "@/features/layoutSearch/layoutSearch";
import {
  checkImportPerformanceBudget,
  importPerformanceBudgetEnabled,
  importTimeBudgetMs,
} from "@/features/layoutSearch/importSearchConfig";
import {
  beginImportDiagnostics,
  finishImportDiagnostics,
  getActiveImportDiagnostics,
  mergeSearchDiagnosticsSlice,
  recordFallback,
  recordFastPath,
  recordGraphStats,
  recordPerformanceBudget,
  recordWinner,
  timePhase,
} from "@/features/layoutSearch/importDiagnostics";
import {
  applyRecoverableSelectionDiagnostics,
  buildRecoverablePool,
  pickBestRecoverableCandidate,
  recoverableSelectionBanner,
  toRecoverableCandidate,
} from "@/features/layoutSearch/pickBestRecoverableCandidate";
import { analyzeTopology } from "@/features/layoutSearch/topology/analyzeTopology";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import type { LayoutEvaluationResult } from "@/features/layoutSearch/evaluateCandidate";
import {
  toLayoutCandidate,
  verifyLayoutCandidate,
} from "@/features/layoutSearch/verifyLayoutCandidate";
import { rerouteConnectionIdsForVisualCableDrag } from "@/features/diagram/connectionIdsForCable";
import { syncNodesEngineDragLayout } from "@/features/diagram/syncNodesEngineDragLayout";
import { syncQuadCandidateDragLayout } from "@/features/diagram/quad/syncQuadCandidateDragLayout";
import { detectFullButtSpliceTubes } from "@/features/diagram/fullButtSplice";
import {
  boundsFromFlowNodes,
  viewportForFitPage,
} from "@/features/canvas/diagramViewport";
import {
  activeSpliceLaneCount,
  importLayoutWidthForGraph,
  reportStorageKey,
} from "@/features/diagram/layoutSpliceDiagram";
import { estimatedCableNodeWidth } from "@/features/diagram/spliceRowLayout";
import { nearStraightCableShift } from "@/features/diagram/horizontalAlign";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { tubeKeyFor } from "@/features/diagram/tubeRowShift";
import {
  AutoIcon,
  ExportConfigIcon,
  HelpIcon,
  HorizontalLayoutIcon,
  InspectIcon,
  MapIcon,
  ManualIcon,
  PrintIcon,
  QuadLayoutIcon,
  ReportIcon,
  ResetIcon,
} from "@/components/toolbar/ToolbarIcon";
import {
  ToolbarActionButton,
  ToolbarSegmentedControl,
} from "@/components/toolbar/ToolbarSegmentedControl";
import { ToolbarPillToggle } from "@/components/toolbar/ToolbarPillToggle";
import { CsvImportButton } from "@/features/import/CsvImportButton";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { useDevFixtureAutoLoad } from "@/features/import/useDevFixtureAutoLoad";
import {
  routeImportFile,
  UNSUPPORTED_IMPORT_FILE_MESSAGE,
} from "@/features/import/routeImportFile";
import type {
  ConnectionGraph,
  DiagramTitleBlock,
  LayoutCalloutRecord,
  LayoutMode,
  LayoutOverrides,
  TubeColorCode,
  TubeManualOverride,
  TubeOverrideKey,
} from "@/types/splice";

const emptyNodes: Node[] = [];
const emptyEdges: Edge[] = [];

function isDiagramOverlayNode(node: Node): boolean {
  return node.type === "cableCallout" || node.type === "diagramTitle";
}

function engineNodesFrom(nodes: Node[]): Node[] {
  return nodes.filter((n) => !isDiagramOverlayNode(n));
}

const FIT_VIEW_OPTIONS = {
  paddingRatio: 0.08,
  minZoom: 0.05,
  maxZoom: 4,
} as const;

/** Ignore sub-pixel resize noise from React Flow / scrollbar churn. */
const STAGE_WIDTH_DELTA_PX = 16;

function connectionIdFromEdgeId(edgeId: string): string | null {
  if (edgeId.startsWith("splice-left-")) {
    return edgeId.slice("splice-left-".length);
  }
  if (edgeId.startsWith("splice-right-")) {
    return edgeId.slice("splice-right-".length);
  }
  if (edgeId.startsWith("splice-")) {
    return edgeId.slice("splice-".length);
  }
  return null;
}

function attachDiagramOverlayNodes(
  nodes: Node[],
  graph: ConnectionGraph,
  reportKey: string,
  layoutWidth: number,
  collapse: boolean,
  savedPositions?: Record<string, { x: number; y: number }>,
): Node[] {
  const overrides = loadLayoutOverrides(reportKey);
  let result = nodes.filter(
    (n) => n.type !== "cableCallout" && n.type !== "diagramTitle",
  );
  if (calloutsShouldShow(overrides)) {
    const positions = { ...overrides?.positions, ...savedPositions };
    result = mergeCalloutNodes(result, overrides?.callouts, positions);
  }
  const diagramScale = computeDiagramScale(
    activeSpliceLaneCount(graph, collapse),
  );
  return mergeTitleNode(
    result,
    graph.report.header,
    layoutWidth,
    diagramScale,
    overrides?.titleBlock,
  );
}

function useCandidateSideDrag(
  reportKey: string | null,
  graph: ConnectionGraph | null,
): boolean {
  if (!reportKey || !graph || heuristicImportLayoutEnabled()) return false;
  const existing = loadLayoutOverrides(reportKey);
  if (!existing) return false;
  return canUseCandidateSideDrag(graph, existing);
}

function sideDragBounds(
  layoutWidth: number,
  nodes: Node[],
): {
  centerX: number;
  centerY: number;
  layoutWidth: number;
  minY: number;
  maxY: number;
  minX: number;
  maxX: number;
} {
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  for (const n of nodes) {
    if (n.type !== "cable") continue;
    const h = n.height ?? n.measured?.height ?? 160;
    const w = n.width ?? n.measured?.width ?? 140;
    minY = Math.min(minY, n.position.y);
    maxY = Math.max(maxY, n.position.y + h);
    minX = Math.min(minX, n.position.x);
    maxX = Math.max(maxX, n.position.x + w);
  }
  if (!Number.isFinite(minY)) {
    minY = 0;
    maxY = 400;
    minX = CABLE_LAYOUT.leftX;
    maxX = layoutWidth - CABLE_LAYOUT.leftX;
  }
  const bounds = {
    centerX: layoutWidth / 2,
    centerY: (minY + maxY) / 2,
    layoutWidth,
    minY,
    maxY,
    minX,
    maxX,
  };
  logSideDrag("sideDragBounds", {
    phase: "bounds",
    bounds: {
      layoutWidth: bounds.layoutWidth,
      minY: bounds.minY,
      maxY: bounds.maxY,
      minX: bounds.minX,
      maxX: bounds.maxX,
      centerY: bounds.centerY,
    },
    nodeCount: nodes.filter((n) => n.type === "cable").length,
  });
  return bounds;
}

function boundsForOutwardDrag(
  draggedX: number,
  side: "left" | "right",
  layoutWidth: number,
  bounds: CableXBounds,
  nodeWidth: number,
): { layoutWidth: number; bounds: CableXBounds } {
  const margin = CABLE_LAYOUT.leftX;
  if (side === "right" && draggedX > bounds.rightX + 0.5) {
    const width = Math.max(layoutWidth, draggedX + margin + nodeWidth);
    return {
      layoutWidth: width,
      bounds: {
        leftX: margin,
        rightX: width - margin - nodeWidth,
      },
    };
  }
  if (side === "left" && draggedX < bounds.leftX - 0.5) {
    const width = Math.max(layoutWidth, layoutWidth + (bounds.leftX - draggedX));
    return {
      layoutWidth: width,
      bounds: {
        leftX: draggedX,
        rightX: width - margin - nodeWidth,
      },
    };
  }
  return { layoutWidth, bounds };
}

function WorkflowCanvasInner() {
  const { getNodesBounds, setViewport, getNodes, getEdges, getViewport, fitView } =
    useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const updateNodeInternals = useUpdateNodeInternals();
  const fitViewRequestRef = useRef(0);
  const fitViewHandledRef = useRef(0);
  const [fitViewTick, setFitViewTick] = useState(0);
  const hasInitialFitRef = useRef(false);
  const isInteractingRef = useRef(false);
  const pendingFitAfterInteractionRef = useRef(false);
  /** Set when the user drags a cable column outward beyond the content width. */
  const userExpandedLayoutRef = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState(emptyNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(emptyEdges);
  const reportKeyRef = useRef<string | null>(null);
  const graphRef = useRef<ConnectionGraph | null>(null);
  const layoutWidthRef = useRef<number>(CABLE_LAYOUT.width);
  const layoutExpansionRef = useRef<LayoutExpansion>(DEFAULT_LAYOUT_EXPANSION);
  const xBoundsRef = useRef<CableXBounds>({
    leftX: CABLE_LAYOUT.leftX,
    rightX: CABLE_LAYOUT.rightX,
  });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageWidthRef = useRef(0);
  const collapseRef = useRef(false);
  const calloutsVisibleRef = useRef(false);
  const calloutScaleRef = useRef(CALLOUT_SCALE_DEFAULT);
  const calloutAutoZoomRef = useRef(CALLOUT_AUTO_ZOOM_DEFAULT);
  const layoutModeRef = useRef<LayoutMode>("horizontal");
  const gridRoutesDragRef = useRef<Map<string, GridRoute> | null>(null);
  const applyGraphRef = useRef<
    (
      graph: ConnectionGraph,
      reportKey: string,
      collapse: boolean,
      options?: {
        fitView?: boolean;
        cableSidesPatch?: Record<string, "left" | "right">;
        layoutWidth?: number;
        refreshLayout?: boolean;
        refreshColumnX?: boolean;
        refreshRowLayout?: boolean;
      },
    ) => void
  >(() => {});
  const [meta, setMeta] = useState<string | null>(null);
  const [mapHeader, setMapHeader] = useState<{
    location?: string;
    spliceLabel?: string;
  } | null>(null);
  const [collapseFullButtSplices, setCollapseFullButtSplices] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [circuitPanelOpen, setCircuitPanelOpen] = useState(false);
  const [calloutsVisible, setCalloutsVisible] = useState(false);
  const [calloutScale, setCalloutScaleState] = useState(CALLOUT_SCALE_DEFAULT);
  const [calloutAutoZoom, setCalloutAutoZoomState] = useState(
    CALLOUT_AUTO_ZOOM_DEFAULT,
  );
  const [isPrinting, setIsPrinting] = useState(false);
  const [circuitIndex, setCircuitIndex] = useState<CircuitIndex | null>(null);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(true);
  const [layoutMode, setLayoutModeState] = useState<LayoutMode>("horizontal");
  const [legOverridesState, setLegOverridesState] = useState<
    LayoutOverrides["legOverrides"]
  >();
  const [manualWarningBanner, setManualWarningBanner] = useState<string | null>(
    null,
  );
  const [configErrorBanner, setConfigErrorBanner] = useState<string | null>(
    null,
  );
  const [layoutSearchProgress, setLayoutSearchProgress] =
    useState<LayoutSearchProgress | null>(null);
  const layoutSearchCancelRef = useRef(false);
  const layoutSearchRunRef = useRef(0);
  const [activeGuides, setActiveGuides] = useState<ManualLayoutGuideLine[]>(
    [],
  );
  const [tubePreview, setTubePreviewState] = useState<
    Map<TubeOverrideKey, TubeManualOverride>
  >(() => new Map());
  const tubePreviewRef = useRef(tubePreview);
  tubePreviewRef.current = tubePreview;
  const tubePreviewRepinRafRef = useRef<number | null>(null);
  const autoAdjustRef = useRef(true);
  const manualCableDragRafRef = useRef<number | null>(null);
  const pendingManualCableNodeRef = useRef<Node | null>(null);
  const engineCableDragRafRef = useRef<number | null>(null);
  const pendingEngineCableNodeRef = useRef<Node | null>(null);
  const candidateCableDragRafRef = useRef<number | null>(null);
  const pendingCandidateCableNodeRef = useRef<Node | null>(null);
  /** Frozen at drag start — maxY/minY must not follow the cable being dragged. */
  const sideDragBoundsAtDragStartRef = useRef<ReturnType<
    typeof sideDragBounds
  > | null>(null);
  /** Cable X at drag start — separates stack fine tuning from T/B intent. */
  const sideDragStartXRef = useRef<number | null>(null);
  const quadDragCacheEdgesRef = useRef<Edge[] | null>(null);

  const endCanvasInteraction = useCallback(() => {
    isInteractingRef.current = false;
    if (pendingFitAfterInteractionRef.current) {
      pendingFitAfterInteractionRef.current = false;
      fitViewRequestRef.current += 1;
      setFitViewTick((tick) => tick + 1);
    }
  }, []);

  collapseRef.current = collapseFullButtSplices;
  calloutsVisibleRef.current = calloutsVisible;
  calloutScaleRef.current = calloutScale;
  calloutAutoZoomRef.current = calloutAutoZoom;
  autoAdjustRef.current = autoAdjustEnabled;
  layoutModeRef.current = layoutMode;

  useEffect(() => {
    if (autoAdjustEnabled || tubePreview.size === 0) return;
    const graph = graphRef.current;
    if (!graph) return;

    const nodes = engineNodesFrom(getNodes());
    const collapsedKeys = [...tubePreview.keys()].filter((key) =>
      isCollapsedTubeKey(nodes, key),
    );
    if (collapsedKeys.length === 0) return;

    if (tubePreviewRepinRafRef.current != null) {
      cancelAnimationFrame(tubePreviewRepinRafRef.current);
    }
    tubePreviewRepinRafRef.current = requestAnimationFrame(() => {
      tubePreviewRepinRafRef.current = null;
      const currentEdges = getEdges();
      const { edges: repinned } = repinButtSpliceEdges(
        nodes,
        currentEdges,
        graph,
        { tubeKeys: collapsedKeys, tubePreview },
      );
      if (repinned !== currentEdges) {
        setEdges(repinned);
      }
    });

    return () => {
      if (tubePreviewRepinRafRef.current != null) {
        cancelAnimationFrame(tubePreviewRepinRafRef.current);
        tubePreviewRepinRafRef.current = null;
      }
    };
  }, [autoAdjustEnabled, getEdges, getNodes, setEdges, tubePreview]);

  const applyManualCableDrag = useCallback(
    (draggedNode: Node) => {
      const graph = graphRef.current;
      if (!graph || draggedNode.type !== "cable") return;
      const visualId = visualCableIdFromNodeId(draggedNode.id);
      if (!visualId) return;

      const current = getNodes();
      const callouts = current.filter((n) => n.type === "cableCallout");
      const engine = current.filter((n) => n.type !== "cableCallout");
      const currentEdges = getEdges();
      const cableData = draggedNode.data as CableNodeData;
      const { nodes: synced, edges: syncedEdges } = syncManualVisualCable(
        engine,
        currentEdges,
        graph,
        visualId,
        draggedNode,
      );
      let finalEdges = syncedEdges;
      const collapsedColors = cableData.collapsedTubes ?? [];
      if (!autoAdjustRef.current && collapsedColors.length > 0) {
        const tubeKeys = collapsedColors.map((tubeColor) =>
          tubeKeyFor(visualId, tubeColor as TubeColorCode),
        );
        const repinned = repinButtSpliceEdges(
          synced,
          syncedEdges,
          graph,
          { tubeKeys },
        );
        finalEdges = repinned.edges;
      }
      if (synced !== engine) {
        setNodes([...synced, ...callouts]);
      }
      if (finalEdges !== currentEdges) {
        setEdges(finalEdges);
      }
    },
    [getEdges, getNodes, setEdges, setNodes],
  );

  const syncManualCableDrag = useCallback(
    (draggedNode: Node) => {
      pendingManualCableNodeRef.current = draggedNode;
      if (manualCableDragRafRef.current != null) return;
      manualCableDragRafRef.current = requestAnimationFrame(() => {
        manualCableDragRafRef.current = null;
        const node = pendingManualCableNodeRef.current;
        pendingManualCableNodeRef.current = null;
        if (node) applyManualCableDrag(node);
      });
    },
    [applyManualCableDrag],
  );

  const applyEngineCableDrag = useCallback(
    (draggedNode: Node) => {
      if (!autoAdjustRef.current) return;
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey || draggedNode.type !== "cable") return;

      const existing = loadLayoutOverrides(reportKey);
      const positions = {
        ...(existing?.positions ?? {}),
        ...positionsFromNodes(getNodes().filter((n) => n.type === "cable")),
        [draggedNode.id]: draggedNode.position,
      };

      const { nodes: nextNodes, edges: nextEdges } = syncNodesEngineDragLayout({
        graph,
        overrides: {
          reportKey,
          collapseFullButtSplices: collapseRef.current,
          positions,
          existingEdgeIds: existing?.existingEdgeIds,
          cableSides: existing?.cableSides,
          autoAdjustEnabled: autoAdjustRef.current,
          tubeOverrides: existing?.tubeOverrides,
          fanoutOverrides: existing?.fanoutOverrides,
          legOverrides: existing?.legOverrides,
          locks: existing?.locks,
          routingEngine: existing?.routingEngine,
          gridLocks: existing?.gridLocks,
          gridRoutes: existing?.gridRoutes,
          optimizedLayoutCandidate: existing?.optimizedLayoutCandidate,
          layoutMode: existing?.layoutMode,
          layoutExpansion: existing?.layoutExpansion,
        },
        layoutWidth: layoutWidthRef.current,
        positions,
        draggedNode,
        dragCacheEdges: getEdges(),
        priorGridRoutes: gridRoutesDragRef.current ?? undefined,
        preservedNodes: getNodes().filter((n) => n.type === "cableCallout"),
      });

      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [getEdges, getNodes, setEdges, setNodes],
  );

  const syncNodesEngineDrag = useCallback(
    (draggedNode: Node) => {
      pendingEngineCableNodeRef.current = draggedNode;
      if (engineCableDragRafRef.current != null) return;
      engineCableDragRafRef.current = requestAnimationFrame(() => {
        engineCableDragRafRef.current = null;
        const node = pendingEngineCableNodeRef.current;
        pendingEngineCableNodeRef.current = null;
        if (node) applyEngineCableDrag(node);
      });
    },
    [applyEngineCableDrag],
  );

  const applyCandidateCableDrag = useCallback(
    (draggedNode: Node) => {
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey || draggedNode.type !== "cable") return;

      const existing = loadLayoutOverrides(reportKey);
      if (!existing || !canUseCandidateSideDrag(graph, existing)) return;

      const visualId = visualCableIdFromNodeId(draggedNode.id);
      if (!visualId) return;

      const cableData = draggedNode.data as CableNodeData;
      const currentSide = effectiveCableSide(cableData);
      const dragBounds =
        sideDragBoundsAtDragStartRef.current ??
        sideDragBounds(layoutWidthRef.current, getNodes());
      const newSide = detectSideFromEdgeProximity(
        draggedNode.position.x,
        draggedNode.position.y,
        dragBounds,
        currentSide,
        { dragStartX: sideDragStartXRef.current ?? undefined },
      );

      // Side-flip preview corrupts React Flow drag coords — commit on drag-stop only.
      if (newSide !== currentSide) {
        logSideDrag("applyCandidateCableDrag", {
          phase: "preview-skipped",
          visualId,
          currentSide,
          newSide,
          note: "side flip deferred to drag-stop",
        });
        return;
      }

      const baseCandidate = candidateFromOverrides(graph, existing);
      if (!baseCandidate) return;

      const positions = {
        ...(existing.positions ?? {}),
        ...positionsFromNodes(getNodes().filter((n) => n.type === "cable")),
        [draggedNode.id]: draggedNode.position,
      };
      const callouts = getNodes().filter((n) => n.type === "cableCallout");
      const layoutMode = deriveLayoutMode(baseCandidate);

      if (layoutMode === "horizontal") {
        const { nodes: nextNodes, edges: nextEdges } = syncNodesEngineDragLayout({
          graph,
          overrides: {
            reportKey,
            collapseFullButtSplices: collapseRef.current,
            positions,
            existingEdgeIds: existing.existingEdgeIds,
            cableSides: existing.cableSides,
            autoAdjustEnabled: autoAdjustRef.current,
            tubeOverrides: existing.tubeOverrides,
            fanoutOverrides: existing.fanoutOverrides,
            legOverrides: existing.legOverrides,
            locks: existing.locks,
            routingEngine: existing.routingEngine,
            gridLocks: existing.gridLocks,
            gridRoutes: existing.gridRoutes,
            optimizedLayoutCandidate: existing.optimizedLayoutCandidate,
            layoutMode: existing.layoutMode,
            layoutExpansion: existing.layoutExpansion,
          },
          layoutWidth: layoutWidthRef.current,
          positions,
          draggedNode,
          dragCacheEdges: quadDragCacheEdgesRef.current ?? getEdges(),
          priorGridRoutes: gridRoutesDragRef.current ?? undefined,
          preservedNodes: callouts,
        });
        setNodes(nextNodes);
        setEdges(nextEdges);
        return;
      }

      if (layoutMode === "quad") {
        const { nodes: nextNodes, edges: nextEdges } = syncQuadCandidateDragLayout({
          graph,
          overrides: {
            ...existing,
            reportKey,
            collapseFullButtSplices: collapseRef.current,
            positions,
            autoAdjustEnabled: autoAdjustRef.current,
          },
          positions,
          draggedNode,
          dragCacheEdges: quadDragCacheEdgesRef.current ?? getEdges(),
          preservedNodes: callouts,
        });
        setNodes(nextNodes);
        setEdges(nextEdges);
        return;
      }

      const commit = applyCableSideDragCommit({
        graph,
        overrides: existing,
        visualId,
        nodeId: draggedNode.id,
        position: draggedNode.position,
        newSide,
        bounds: dragBounds,
        collapseFullButtSplices: collapseRef.current,
        autoAdjustEnabled: autoAdjustRef.current,
        preview: true,
      });
      if (!commit) return;

      layoutWidthRef.current = commit.layoutWidth;
      if (commit.layoutMode !== layoutModeRef.current) {
        layoutModeRef.current = commit.layoutMode;
        setLayoutModeState(commit.layoutMode);
      }

      setNodes([...commit.nodes, ...callouts]);
      setEdges(commit.edges);
    },
    [getNodes, getEdges, setEdges, setNodes],
  );

  const syncCandidateCableDrag = useCallback(
    (draggedNode: Node) => {
      pendingCandidateCableNodeRef.current = draggedNode;
      if (candidateCableDragRafRef.current != null) return;
      candidateCableDragRafRef.current = requestAnimationFrame(() => {
        candidateCableDragRafRef.current = null;
        const node = pendingCandidateCableNodeRef.current;
        pendingCandidateCableNodeRef.current = null;
        if (node) applyCandidateCableDrag(node);
      });
    },
    [applyCandidateCableDrag],
  );

  const syncQuadCableDrag = useCallback(
    (draggedNode: Node) => {
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey || draggedNode.type !== "cable") return;

      const existing = loadLayoutOverrides(reportKey);
      const positions = {
        ...(existing?.positions ?? {}),
        ...positionsFromNodes(getNodes().filter((n) => n.type === "cable")),
        [draggedNode.id]: draggedNode.position,
      };
      const visualId = visualCableIdFromNodeId(draggedNode.id);
      const { visualCables } = buildVisualCablesForLayout(graph);
      const rerouteConnectionIds =
        visualId != null
          ? rerouteConnectionIdsForVisualCableDrag(visualCables, visualId)
          : undefined;

      const { nodes: nextNodes, edges: nextEdges } = buildReactFlowGraph(
        graph,
        {
          reportKey,
          layoutMode: "quad",
          collapseFullButtSplices: collapseRef.current,
          positions,
          existingEdgeIds: existing?.existingEdgeIds,
          quadCableSides: existing?.quadCableSides,
          autoAdjustEnabled: autoAdjustRef.current,
        },
        layoutWidthRef.current,
        {
          dragSync: true,
          dragCacheEdges: quadDragCacheEdgesRef.current ?? getEdges(),
          rerouteConnectionIds,
        },
      );
      const callouts = getNodes().filter((n) => n.type === "cableCallout");
      setNodes([...nextNodes, ...callouts]);
      setEdges(nextEdges);
    },
    [getEdges, getNodes, setEdges, setNodes],
  );

  const refreshDragRouting = useCallback(
    (draggedNode: Node) => {
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (
        draggedNode.type === "cable" &&
        graph &&
        reportKey &&
        useCandidateSideDrag(reportKey, graph)
      ) {
        syncCandidateCableDrag(draggedNode);
        return;
      }
      if (layoutModeRef.current === "quad") {
        syncQuadCableDrag(draggedNode);
        return;
      }
      if (!autoAdjustRef.current) {
        syncManualCableDrag(draggedNode);
        return;
      }
      syncNodesEngineDrag(draggedNode);
    },
    [
      syncCandidateCableDrag,
      syncManualCableDrag,
      syncNodesEngineDrag,
      syncQuadCableDrag,
    ],
  );

  const resolveLayoutWidth = useCallback(
    (graph: ConnectionGraph, preserveUserExpansion = true): number => {
      const contentWidth = importLayoutWidthForGraph(graph);
      if (
        preserveUserExpansion &&
        layoutWidthRef.current > contentWidth + 1
      ) {
        return layoutWidthRef.current;
      }
      return contentWidth;
    },
    [],
  );

  useEffect(() => {
    const requestId = fitViewRequestRef.current;
    if (requestId === 0 || requestId === fitViewHandledRef.current) return;
    if (!nodesInitialized) return;

    if (isInteractingRef.current) {
      pendingFitAfterInteractionRef.current = true;
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const currentNodes = getNodes();
    if (currentNodes.length === 0) return;

    const bounds =
      getNodesBounds(currentNodes) ?? boundsFromFlowNodes(currentNodes);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

    fitViewHandledRef.current = requestId;
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const viewport = viewportForFitPage(
      bounds,
      stageWidth,
      stageHeight,
      FIT_VIEW_OPTIONS,
    );

    void setViewport(viewport, { duration: 0 });
  }, [nodesInitialized, getNodes, getNodesBounds, setViewport, fitViewTick]);

  /** Refit viewport after async layout swap once React Flow has measured new nodes. */
  const scheduleFitViewAfterLayout = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        void fitView({ padding: 0.08, duration: 0 });
      });
    });
  }, [fitView]);

  const requestDiagramFitView = useCallback(() => {
    fitViewRequestRef.current += 1;
    setFitViewTick((tick) => tick + 1);
  }, []);

  type ApplyGraphOptions = {
    fitView?: boolean;
    cableSidesPatch?: Record<string, "left" | "right">;
    layoutWidth?: number;
    refreshLayout?: boolean;
    refreshColumnX?: boolean;
    refreshRowLayout?: boolean;
  };

  const persistLayout = useCallback(
    (
      nextNodes: Node[],
      nextEdges: Edge[],
      patch?: Partial<import("@/types/splice").LayoutOverrides>,
    ) => {
      const key = reportKeyRef.current;
      if (!key) return;
      saveLayoutOverrides(
        mergeLayoutOverrides(key, {
          positions: positionsFromNodes(nextNodes),
          existingEdgeIds: existingIdsFromEdges(nextEdges),
          collapseFullButtSplices,
          layoutWidth: layoutWidthRef.current,
          layoutExpansion: patch?.layoutExpansion ?? layoutExpansionRef.current,
          calloutsVisible: calloutsVisibleRef.current,
          calloutScale: calloutScaleRef.current,
          calloutAutoZoom: calloutAutoZoomRef.current,
          ...patch,
        }),
      );
    },
    [collapseFullButtSplices],
  );

  const applyGraph = useCallback(
    (
      graph: ConnectionGraph,
      reportKey: string,
      collapse: boolean,
      options?: ApplyGraphOptions,
    ) => {
      const existing = loadLayoutOverrides(reportKey);
      const overrides = mergeLayoutOverrides(reportKey, {
        collapseFullButtSplices: collapse,
        cableSides: options?.cableSidesPatch,
        autoAdjustEnabled: existing?.autoAdjustEnabled,
        tubeOverrides: existing?.tubeOverrides,
        fanoutOverrides: existing?.fanoutOverrides,
        legOverrides: existing?.legOverrides,
        titleBlock: existing?.titleBlock,
      });
      let layoutWidthArg =
        options?.layoutWidth ??
        existing?.layoutWidth ??
        layoutWidthRef.current ??
        importLayoutWidthForGraph(graph);

      let layoutExpansion: LayoutExpansion =
        existing?.layoutExpansion ?? DEFAULT_LAYOUT_EXPANSION;
      const useHeuristicLayout = heuristicImportLayoutEnabled();
      const storedCandidate = existing?.optimizedLayoutCandidate;
      const useOptimizedCandidate =
        !useHeuristicLayout && storedCandidate !== undefined;
      const shouldResolveFeasibleLayout =
        !useOptimizedCandidate &&
        options?.layoutWidth === undefined &&
        !options?.refreshRowLayout &&
        (options?.refreshLayout === true ||
          existing?.layoutExpansion === undefined);
      if (shouldResolveFeasibleLayout) {
        const resolved = resolveFeasibleImportLayout(graph, {
          layoutWidth: layoutWidthArg,
          collapseFullButtSplices: collapse,
        });
        layoutWidthArg = resolved.layoutWidth;
        layoutExpansion = resolved.expansion;
      } else if (useOptimizedCandidate && storedCandidate) {
        layoutWidthArg = storedCandidate.layoutWidth;
        layoutExpansion = storedCandidate.layoutExpansion;
      }

      layoutWidthRef.current = layoutWidthArg;
      layoutExpansionRef.current = layoutExpansion;

      const savedPositions =
        options?.refreshLayout ?? false ? {} : existing?.positions ?? {};

      const candidateForRender =
        useOptimizedCandidate && storedCandidate
          ? toLayoutCandidate(storedCandidate)
          : undefined;
      if (candidateForRender) {
        const nextLayoutMode = deriveLayoutMode(candidateForRender);
        layoutModeRef.current = nextLayoutMode;
        setLayoutModeState(nextLayoutMode);
      }

      const graphBuildOptions = {
        refreshColumnX: options?.refreshColumnX,
        refreshRowLayout: options?.refreshRowLayout,
        skipFeasibility: true,
        skipTubeAutoAlign: overrides.autoAdjustEnabled === false,
      };

      const { nodes: nextNodes, edges: nextEdges, layout, xBounds, autoLayoutY } =
        runWithLayoutExpansion(layoutExpansion, () => {
          if (candidateForRender) {
            return buildCanvasFromCandidate(
              graph,
              candidateForRender,
              {
                ...overrides,
                reportKey,
                collapseFullButtSplices: collapse,
                positions: savedPositions,
                existingEdgeIds: existing?.existingEdgeIds,
                layoutWidth: layoutWidthArg,
                autoAdjustEnabled: overrides.autoAdjustEnabled,
                tubeOverrides: overrides.tubeOverrides,
                fanoutOverrides: overrides.fanoutOverrides,
                legOverrides: overrides.legOverrides,
                routingEngine: overrides.routingEngine ?? existing?.routingEngine,
                gridRoutes: overrides.gridRoutes ?? existing?.gridRoutes,
                gridLocks: overrides.gridLocks ?? existing?.gridLocks,
                layoutMode: candidateForRender
                  ? deriveLayoutMode(candidateForRender)
                  : overrides.layoutMode ?? existing?.layoutMode,
                optimizedLayoutCandidate: storedCandidate,
              },
              graphBuildOptions,
            );
          }
          return buildReactFlowGraph(
            graph,
            {
              ...overrides,
              reportKey,
              collapseFullButtSplices: collapse,
              positions: savedPositions,
              existingEdgeIds: existing?.existingEdgeIds,
              layoutWidth: layoutWidthArg,
              autoAdjustEnabled: overrides.autoAdjustEnabled,
              tubeOverrides: overrides.tubeOverrides,
              fanoutOverrides: overrides.fanoutOverrides,
              legOverrides: overrides.legOverrides,
              routingEngine: overrides.routingEngine ?? existing?.routingEngine,
              gridRoutes: overrides.gridRoutes ?? existing?.gridRoutes,
              gridLocks: overrides.gridLocks ?? existing?.gridLocks,
              layoutMode: overrides.layoutMode ?? existing?.layoutMode,
            },
            layoutWidthArg,
            graphBuildOptions,
          );
        });
      xBoundsRef.current = xBounds;
      const merged = attachDiagramOverlayNodes(
        nextNodes,
        graph,
        reportKey,
        layoutWidthArg,
        collapse,
        savedPositions,
      );
      setNodes(merged);
      setEdges(nextEdges);
      setLegOverridesState(overrides.legOverrides);

      if (
        options?.refreshColumnX ||
        options?.layoutWidth !== undefined ||
        options?.refreshRowLayout
      ) {
        saveLayoutOverrides(
          mergeLayoutOverrides(reportKey, {
            layoutWidth: layoutWidthArg,
            layoutExpansion,
            positions: positionsFromNodes(merged),
            autoLayoutY,
            existingEdgeIds: existing?.existingEdgeIds,
            collapseFullButtSplices: collapse,
            cableSides: overrides.cableSides,
            callouts: existing?.callouts,
            autoAdjustEnabled: overrides.autoAdjustEnabled,
            tubeOverrides: overrides.tubeOverrides,
            fanoutOverrides: overrides.fanoutOverrides,
            legOverrides: overrides.legOverrides,
            layoutMode: layoutModeRef.current,
            optimizedLayoutCandidate: storedCandidate,
            quadCableSides: existing?.quadCableSides,
          }),
        );
      }
      if (options?.fitView) {
        fitViewRequestRef.current += 1;
        setFitViewTick((tick) => tick + 1);
      }
      requestAnimationFrame(() => {
        updateSpliceRoutingNodeInternals(merged, updateNodeInternals);
      });
      void layout;
    },
    [setNodes, setEdges, updateNodeInternals],
  );

  applyGraphRef.current = applyGraph;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let raf = 0;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      const height = Math.round(entries[0]?.contentRect.height ?? 0);
      if (width <= 0 || height <= 0) return;

      const prevStageWidth = stageWidthRef.current;
      stageWidthRef.current = width;
      if (Math.abs(width - prevStageWidth) < STAGE_WIDTH_DELTA_PX) return;
      if (!graphRef.current) return;
      if (isInteractingRef.current) return;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        fitViewRequestRef.current += 1;
        setFitViewTick((tick) => tick + 1);
      });
    });

    observer.observe(stage);
    stageWidthRef.current = Math.round(stage.clientWidth);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  /** Fit diagram to stage once after first measured nodes (e.g. after import). */
  useEffect(() => {
    if (hasInitialFitRef.current) return;
    if (!nodesInitialized || nodes.length === 0) return;
    const stage = stageRef.current;
    if (!stage || stage.clientWidth <= 0 || stage.clientHeight <= 0) return;

    hasInitialFitRef.current = true;
    fitViewRequestRef.current += 1;
    setFitViewTick((tick) => tick + 1);
  }, [nodesInitialized, nodes.length]);

  const activateDiagram = useCallback(
    (
      graph: ConnectionGraph,
      reportKey: string,
      options: {
        sourceLabel: string;
        savedOverrides?: LayoutOverrides;
        useSavedLayoutWidth?: boolean;
        refreshLayout?: boolean;
        viewport?: { x: number; y: number; zoom: number };
        /** Fresh CSV import — run routing-first layout search. */
        optimizeLayout?: boolean;
        candidateVerificationWarning?: string;
      },
    ) => {
      reportKeyRef.current = reportKey;
      graphRef.current = graph;
      hasInitialFitRef.current = false;
      fitViewRequestRef.current = 0;
      fitViewHandledRef.current = 0;
      setMapHeader({
        location: graph.report.header.location,
        spliceLabel: graph.report.header.spliceNumber ?? graph.report.header.name,
      });
      setCircuitIndex(buildCircuitIndex(graph));
      const saved = options.savedOverrides ?? loadLayoutOverrides(reportKey);
      const { visualCables } = buildVisualCablesForLayout(graph);
      const detected = detectFullButtSpliceTubes(graph, visualCables);
      const collapsed =
        saved?.collapseFullButtSplices ?? detected.length > 0;
      setCollapseFullButtSplices(collapsed);
      setCalloutsVisible(calloutsShouldShow(saved));
      const loadedCalloutScale = saved?.calloutScale ?? CALLOUT_SCALE_DEFAULT;
      const loadedCalloutAutoZoom =
        saved?.calloutAutoZoom ?? CALLOUT_AUTO_ZOOM_DEFAULT;
      setCalloutScaleState(loadedCalloutScale);
      setCalloutAutoZoomState(loadedCalloutAutoZoom);
      calloutScaleRef.current = loadedCalloutScale;
      calloutAutoZoomRef.current = loadedCalloutAutoZoom;
      setAutoAdjustEnabled(saved?.autoAdjustEnabled !== false);
      setLegOverridesState(saved?.legOverrides);
      const savedCandidate = saved?.optimizedLayoutCandidate;
      const initialLayoutMode = savedCandidate
        ? deriveLayoutMode(toLayoutCandidate(savedCandidate))
        : (saved?.layoutMode ?? "horizontal");
      layoutModeRef.current = initialLayoutMode;
      setLayoutModeState(initialLayoutMode);
      setManualWarningBanner(null);
      setConfigErrorBanner(
        options.candidateVerificationWarning ?? null,
      );
      userExpandedLayoutRef.current = Boolean(
        options.useSavedLayoutWidth &&
          saved?.layoutWidth &&
          saved.layoutWidth > CABLE_LAYOUT.width + 1,
      );

      const finishImport = (
        layoutWidth: number,
        refreshLayout: boolean,
      ) => {
        applyGraph(graph, reportKey, collapsed, {
          fitView: options.viewport === undefined,
          layoutWidth,
          refreshLayout,
          refreshColumnX: true,
          refreshRowLayout: true,
        });

        if (options.viewport) {
          void setViewport(options.viewport, { duration: 0 });
        }

        setMeta(
          `${options.sourceLabel} — ${graph.report.pairs.length} pair(s), ${graph.connections.length} connection(s)`,
        );
      };

      const runOptimizedImport = async (layoutWidth: number) => {
        const runId = ++layoutSearchRunRef.current;
        layoutSearchCancelRef.current = false;

        const strandCount = graph.connections.length;
        const cableCount = cableKeysFromGraph(graph).length;
        const topology = analyzeTopology(graph);
        const maxRounds = adaptiveMaxRounds(
          topology.constraints,
          DEFAULT_MAX_ROUNDS,
        );
        const timeBudgetMs = importTimeBudgetMs(strandCount);
        const searchMeta = {
          strandCount,
          cableCount,
          evaluationBudget: maxRounds,
        };

        const importDiag = getActiveImportDiagnostics();

        const applyCandidateLayout = (candidate: LayoutCandidate) => {
          const renderWidth = candidate.layoutWidth;
          const renderCandidate = candidate;

          timePhase(importDiag, "applyWinner", () => {
            saveLayoutOverrides(
              mergeLayoutOverrides(reportKey, {
                ...candidateOverridePatch(graph, renderCandidate, reportKey),
                collapseFullButtSplices: collapsed,
                autoAdjustEnabled: saved?.autoAdjustEnabled !== false,
              }),
            );
            layoutModeRef.current = deriveLayoutMode(renderCandidate);
            setLayoutModeState(deriveLayoutMode(renderCandidate));
            applyGraph(graph, reportKey, collapsed, {
              fitView: true,
              layoutWidth: renderWidth,
              refreshLayout: true,
              refreshColumnX: true,
              refreshRowLayout: true,
            });
          });
          setMeta(
            `${options.sourceLabel} — ${graph.report.pairs.length} pair(s), ${graph.connections.length} connection(s)`,
          );
        };

        const resolveCandidateFromSearch = (
          searchResult: LayoutSearchResult,
          heuristicCandidate: LayoutCandidate,
          heuristicEvaluation: LayoutEvaluationResult,
        ): {
          candidate: LayoutCandidate;
          evaluation: LayoutEvaluationResult;
        } => {
          const pickedFinalist = pickBestPassingFinalist(
            searchResult.finalists ?? [],
          );

          if (pickedFinalist) {
            const candidate = pickedFinalist.candidate;
            const evaluation = timePhase(importDiag, "finalRuleValidation", () =>
              pickedFinalist.evaluation ??
              evaluateLayoutCandidate(graph, candidate),
            );
            if (importDiag && !searchResult.importDiagnosticsSlice?.selected) {
              recordWinner(importDiag, candidate, {
                feasible: evaluation.feasible,
                score: evaluation.score,
                violations: evaluation.violations,
                softScore: evaluation.softScore,
                reason: searchResult.diagnostics?.selectedCandidateReason,
              });
            }
            return { candidate, evaluation };
          }

          const heuristicEntry = toRecoverableCandidate(
            heuristicCandidate,
            heuristicEvaluation,
            "heuristic",
          );

          const pool = buildRecoverablePool(
            searchResult.finalists ?? [],
            heuristicEntry,
            (searchResult.finalists?.length ?? 0) === 0
              ? toRecoverableCandidate(
                  searchResult.best,
                  evaluateLayoutCandidate(graph, searchResult.best),
                  "search-best",
                )
              : undefined,
          );

          const selection = timePhase(importDiag, "fallback", () =>
            pickBestRecoverableCandidate(pool),
          );

          if (!selection) {
            if (importDiag) {
              recordFallback(importDiag, "recoverable pool empty; using heuristic");
            }
            setConfigErrorBanner(
              "Layout optimizer found no candidates; using heuristic layout.",
            );
            return {
              candidate: heuristicCandidate,
              evaluation: heuristicEvaluation,
            };
          }

          const candidate = selection.picked.candidate;
          const evaluation =
            selection.picked.evaluation ??
            evaluateLayoutCandidate(graph, candidate);
          applyRecoverableSelectionDiagnostics(importDiag, selection);
          const banner = recoverableSelectionBanner(selection);
          if (banner) setConfigErrorBanner(banner);
          return { candidate, evaluation };
        };

        const recordOptimizerBudget = (optimizerWallMs: number) => {
          if (!importDiag || !importPerformanceBudgetEnabled()) return;
          const budget = checkImportPerformanceBudget(optimizerWallMs);
          recordPerformanceBudget(importDiag, {
            enabled: true,
            warnThresholdMs: budget.warnThresholdMs,
            failThresholdMs: budget.failThresholdMs,
            optimizerWallMs,
            warn: budget.warn,
            exceeded: budget.exceeded,
          });
          if (budget.exceeded) {
            setConfigErrorBanner(
              `Layout optimizer exceeded ${Math.round(budget.failThresholdMs / 1000)}s budget (${Math.round(optimizerWallMs / 1000)}s).`,
            );
          }
        };

        const runWorkerSearch = async (
          profile: "full" | "background",
          showProgress: boolean,
        ): Promise<LayoutSearchResult> => {
          const workerStart = performance.now();
          const result = await layoutSearchViaWorker(
            graph,
            {
              seed: seedFromReportKey(reportKey),
              maxRounds,
              timeBudgetMs,
              searchProfile: profile,
              onProgress: (progress) => {
                if (!showProgress || layoutSearchRunRef.current !== runId) return;
                setLayoutSearchProgress(progress);
              },
              shouldCancel: () => layoutSearchCancelRef.current,
            },
            searchMeta,
          );
          const optimizerWallMs = Math.round(performance.now() - workerStart);
          if (importDiag) {
            importDiag.notes.push(`Worker search wall: ${optimizerWallMs}ms`);
            if (result.importDiagnosticsSlice) {
              mergeSearchDiagnosticsSlice(
                importDiag,
                result.importDiagnosticsSlice,
              );
            }
          }
          if (profile === "full") {
            recordOptimizerBudget(optimizerWallMs);
          }
          return result;
        };

        setLayoutSearchProgress(
          initialSearchProgress(
            {
              phase: "heuristic_paint",
              ...searchMeta,
            },
            { message: `Routing ${strandCount.toLocaleString()} fibers…` },
          ),
        );

        const heuristic = timePhase(
          importDiag,
          "heuristicCandidate",
          () => heuristicBaselineCandidate(graph, layoutWidth),
        );
        timePhase(importDiag, "heuristicPaint", () => {
          saveLayoutOverrides(
            mergeLayoutOverrides(reportKey, {
              ...candidateOverridePatch(graph, heuristic, reportKey),
              collapseFullButtSplices: collapsed,
              autoAdjustEnabled: saved?.autoAdjustEnabled !== false,
            }),
          );
          layoutModeRef.current = deriveLayoutMode(heuristic);
          setLayoutModeState(deriveLayoutMode(heuristic));
          finishImport(layoutWidth, true);
        });

        const heuristicEval = timePhase(importDiag, "finalRuleValidation", () =>
          evaluateLayoutCandidate(graph, heuristic),
        );

        const useFastPath =
          heuristicEval.feasible && importPerformanceBudgetEnabled();

        if (useFastPath) {
          if (importDiag) {
            recordFastPath(importDiag, {
              used: true,
              heuristicPassed: true,
              backgroundSearch: true,
            });
            recordWinner(importDiag, heuristic, {
              feasible: true,
              score: heuristicEval.score,
              violations: heuristicEval.violations,
              softScore: heuristicEval.softScore,
              reason: "heuristic fast-path — all hard rules pass",
            });
          }
          setLayoutSearchProgress(null);
          scheduleFitViewAfterLayout();

          void (async () => {
            const bgStart = performance.now();
            try {
              const bgResult = await runWorkerSearch("background", false);
              if (layoutSearchRunRef.current !== runId) return;

              const bgDiag = getActiveImportDiagnostics();
              const { candidate, evaluation } = resolveCandidateFromSearch(
                bgResult,
                heuristic,
                heuristicEval,
              );

              const upgraded =
                evaluation.feasible &&
                compareCandidates(
                  { score: evaluation.score, candidate },
                  { score: heuristicEval.score, candidate: heuristic },
                ) < 0;

              if (bgDiag) {
                recordFastPath(bgDiag, {
                  backgroundSearchMs: Math.round(performance.now() - bgStart),
                  upgradedLayout: upgraded,
                });
              }

              if (upgraded) {
                applyCandidateLayout(candidate);
              }
            } catch (err) {
              const bgDiag = getActiveImportDiagnostics();
              if (bgDiag) {
                recordFastPath(bgDiag, {
                  backgroundSearchMs: Math.round(performance.now() - bgStart),
                });
                recordFallback(
                  bgDiag,
                  err instanceof Error ? err.message : String(err),
                );
              }
            } finally {
              finishImportDiagnostics();
            }
          })();
          return;
        }

        setLayoutSearchProgress(
          initialSearchProgress(
            {
              phase: "optimizing",
              ...searchMeta,
            },
            { message: `Routing ${strandCount.toLocaleString()} fibers…` },
          ),
        );

        let searchResult: LayoutSearchResult;
        try {
          searchResult = await runWorkerSearch("full", true);
        } catch (err) {
          if (layoutSearchRunRef.current !== runId) return;
          setLayoutSearchProgress(null);
          const message =
            err instanceof Error ? err.message : String(err);
          const timedOut = message.includes("timed out");
          setConfigErrorBanner(
            timedOut
              ? "Layout search timed out; keeping heuristic layout."
              : `Layout search failed: ${message}`,
          );
          if (importDiag) {
            recordFallback(
              importDiag,
              timedOut ? "worker search timed out" : message,
            );
          }
          finishImportDiagnostics();
          return;
        }

        if (layoutSearchRunRef.current !== runId) return;

        setLayoutSearchProgress(
          initialSearchProgress(
            {
              phase: "finalizing",
              ...searchMeta,
            },
            {
              round: searchResult.evaluations,
              evaluations: searchResult.evaluations,
              bestScore: searchResult.bestScore,
              feasible: searchResult.bestScore < Number.MAX_SAFE_INTEGER,
              elapsedMs: 0,
              message: "Applying best layout…",
            },
          ),
        );

        const { candidate } = resolveCandidateFromSearch(
          searchResult,
          heuristic,
          heuristicEval,
        );

        applyCandidateLayout(candidate);
        setLayoutSearchProgress(null);
        finishImportDiagnostics();
      };

      const importWhenStageReady = (attempt = 0) => {
        const measured = stageRef.current?.clientWidth ?? 0;
        const stageWidth =
          measured > 0 ? measured : stageWidthRef.current;
        if (stageWidth <= 0 && attempt < 120) {
          requestAnimationFrame(() => importWhenStageReady(attempt + 1));
          return;
        }
        if (stageWidth > 0) {
          stageWidthRef.current = stageWidth;
        }
        const layoutWidth =
          options.useSavedLayoutWidth && saved?.layoutWidth
            ? saved.layoutWidth
            : importLayoutWidthForGraph(graph);

        const shouldOptimize =
          options.optimizeLayout === true &&
          !heuristicImportLayoutEnabled() &&
          !(savedCandidate && options.refreshLayout === false);

        if (shouldOptimize) {
          void runOptimizedImport(layoutWidth);
          return;
        }

        if (
          savedCandidate &&
          !heuristicImportLayoutEnabled() &&
          options.refreshLayout !== true
        ) {
          const verify = verifyLayoutCandidate(
            graph,
            toLayoutCandidate(savedCandidate),
          );
          if (!verify.feasible && !options.candidateVerificationWarning) {
            setConfigErrorBanner(
              `Stored layout failed verification: ${verify.failedRules.join("; ")}`,
            );
          }
        }

        finishImport(
          layoutWidth,
          options.refreshLayout ?? false,
        );
      };
      importWhenStageReady();
    },
    [applyGraph, scheduleFitViewAfterLayout, setViewport],
  );

  const loadFromCsv = useCallback(
    (text: string, fileName: string) => {
      const importDiag = beginImportDiagnostics();
      const report = timePhase(importDiag, "parse", () =>
        parseBentleyCsv(text),
      );
      const graph = timePhase(importDiag, "buildGraph", () =>
        buildConnectionGraph(report),
      );
      const reportKey = reportStorageKey(graph);
      if (importDiag) importDiag.reportKey = reportKey;
      const fiberConnectionCount = graph.connections.filter(
        (c) => c.kind === "fiber",
      ).length;
      if (importDiag) {
        recordGraphStats(importDiag, {
          cableCount: cableKeysFromGraph(graph).length,
          connectionCount: graph.connections.length,
          fiberConnectionCount,
        });
      }
      const importCtx = buildSdcRuleContext(graph, { skipReactFlow: true });
      const importResults = timePhase(importDiag, "importRules", () =>
        runImportRules(importCtx),
      );
      if (!allRulesPass(importResults)) {
        const failed = importResults.filter((r) => !r.ok).map((r) => r.detail);
        setConfigErrorBanner(`Import validation: ${failed.join("; ")}`);
      }
      const title =
        report.header.spliceNumber ?? report.header.name ?? fileName;
      activateDiagram(graph, reportKey, {
        sourceLabel: title,
        refreshLayout: true,
        useSavedLayoutWidth: false,
        optimizeLayout: true,
      });
    },
    [activateDiagram],
  );

  useDevFixtureAutoLoad(loadFromCsv);

  const confirmReplaceDiagram = useCallback((): boolean => {
    if (!meta) return true;
    return window.confirm(
      "Replace the current diagram with the imported config?",
    );
  }, [meta]);

  const loadFromConfig = useCallback(
    (text: string) => {
      if (!confirmReplaceDiagram()) return;
      try {
        const config = parseDiagramConfig(text);
        const restored = restoreDiagramFromConfig(config);
        activateDiagram(restored.graph, restored.reportKey, {
          sourceLabel: restored.sourceLabel,
          savedOverrides: restored.overrides,
          useSavedLayoutWidth: true,
          refreshLayout: false,
          viewport: restored.viewport,
          candidateVerificationWarning: restored.candidateVerificationWarning,
        });
      } catch (err) {
        const message =
          err instanceof DiagramConfigParseError
            ? err.message
            : "Invalid config file";
        setConfigErrorBanner(message);
      }
    },
    [activateDiagram, confirmReplaceDiagram],
  );

  const exportDiagramConfig = useCallback(() => {
    const graph = graphRef.current;
    const reportKey = reportKeyRef.current;
    if (!graph || !reportKey) return;
    const config = buildDiagramConfig({
      graph,
      reportKey,
      nodes,
      edges,
      collapseFullButtSplices,
      calloutsVisible,
      calloutScale,
      calloutAutoZoom,
      autoAdjustEnabled,
      layoutWidth: layoutWidthRef.current,
      legOverrides: legOverridesState,
      appVersion: "0.0.1",
      viewport: getViewport(),
    });
    downloadDiagramConfig(config, graph);
    setConfigErrorBanner(null);
  }, [
    nodes,
    edges,
    collapseFullButtSplices,
    calloutsVisible,
    calloutScale,
    calloutAutoZoom,
    autoAdjustEnabled,
    legOverridesState,
    getViewport,
  ]);

  const importDiagramFile = useCallback(
    (text: string, fileName: string, options?: { fromDrop?: boolean }) => {
      const route = routeImportFile(text, fileName);
      if (route === "config") {
        loadFromConfig(text);
        return;
      }
      if (route === "csv") {
        if (options?.fromDrop && !confirmReplaceDiagram()) return;
        loadFromCsv(text, fileName);
        return;
      }
      setConfigErrorBanner(UNSUPPORTED_IMPORT_FILE_MESSAGE);
    },
    [confirmReplaceDiagram, loadFromConfig, loadFromCsv],
  );

  const handleStageDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("Files")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const handleStageDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (!file) return;
      void file.text().then((text) => {
        importDiagramFile(text, file.name, { fromDrop: true });
      });
    },
    [importDiagramFile],
  );

  const updateManualWarnings = useCallback(
    (
      _graph: ConnectionGraph,
      _nextNodes: Node[],
      nextEdges: Edge[],
      touchedEdgeIds: Set<string>,
    ) => {
      if (touchedEdgeIds.size === 0) {
        setManualWarningBanner(null);
        return;
      }
      const connectionIds = touchedConnectionIdsFromEdgeIds(touchedEdgeIds);
      const warnings = manualLayoutWarningsForConnections(
        nextEdges,
        connectionIds,
      );
      setManualWarningBanner(formatManualLayoutWarningBanner(warnings));
    },
    [],
  );

  const handleTubeOverrideCommit = useCallback(
    (tubeKey: TubeOverrideKey, patch: TubeManualOverride) => {
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey) return;

      const existing = loadLayoutOverrides(reportKey);
      const prev = existing?.tubeOverrides?.[tubeKey] ?? {};
      const merged: TubeManualOverride = { ...prev, ...patch };
      if (merged.visualShiftY === undefined && merged.stemReachX === undefined) {
        delete merged.visualShiftY;
        delete merged.stemReachX;
      }
      const tubeOverrides = { ...(existing?.tubeOverrides ?? {}) };
      const fanoutOverrides = { ...(existing?.fanoutOverrides ?? {}) };
      if (
        merged.visualShiftY === undefined &&
        merged.stemReachX === undefined
      ) {
        delete tubeOverrides[tubeKey];
        delete fanoutOverrides[tubeKey];
      } else {
        tubeOverrides[tubeKey] = merged;
        if (merged.visualShiftY !== undefined) {
          fanoutOverrides[tubeKey] = { shiftY: merged.visualShiftY };
        }
      }

      const positions = positionsFromNodes(
        getNodes().filter((n) => n.type === "cable"),
      );
      const vcId = tubeKey.split("|")[0]!;
      const tubeColor = tubeKey.split("|")[1]!;
      const current = getNodes();
      const callouts = current.filter((n) => n.type === "cableCallout");
      const engine = engineNodesFrom(current).map((n) => {
          if (n.id !== `cable-${vcId}`) return n;
          const data = n.data as CableNodeData;
          return {
            ...n,
            data: {
              ...data,
              tubes: data.tubes.map((t) => {
                if (t.tubeColor !== tubeColor) return t;
                const updated = { ...t };
                if (merged.visualShiftY !== undefined) {
                  updated.visualShiftY = merged.visualShiftY;
                } else {
                  delete updated.visualShiftY;
                }
                if (merged.stemReachX !== undefined) {
                  updated.stemReachX = merged.stemReachX;
                } else {
                  delete updated.stemReachX;
                }
                return updated;
              }),
            },
          };
        });
      const { nodes: synced, edges: syncedEdges } = syncManualVisualCable(
        engine,
        getEdges(),
        graph,
        vcId,
      );
      const mergedNodes = attachDiagramOverlayNodes(
        [...synced, ...callouts],
        graph,
        reportKey,
        layoutWidthRef.current,
        collapseRef.current,
        positions,
      );
      let finalEdges = syncedEdges;
      if (isCollapsedTubeKey(mergedNodes, tubeKey)) {
        const repinned = repinButtSpliceEdges(mergedNodes, syncedEdges, graph, {
          tubeKeys: [tubeKey],
        });
        finalEdges = repinned.edges;
      }
      setNodes(mergedNodes);
      setEdges(finalEdges);

      const keepAuto = autoAdjustRef.current;
      const isGrid =
        routingEngineMode(existing) === "grid" || keepAuto;
      const hasTubeEdit =
        merged.visualShiftY !== undefined || merged.stemReachX !== undefined;

      let nextOverrides = mergeLayoutOverrides(reportKey, {
        positions: positionsFromNodes(mergedNodes),
        existingEdgeIds: existingIdsFromEdges(finalEdges),
        collapseFullButtSplices: collapseRef.current,
        layoutWidth: layoutWidthRef.current,
        cableSides: existing?.cableSides,
        callouts: existing?.callouts,
        autoAdjustEnabled: isGrid ? keepAuto : false,
        tubeOverrides,
        fanoutOverrides,
        legOverrides: existing?.legOverrides,
        routingEngine: existing?.routingEngine,
        gridLocks: existing?.gridLocks,
        gridRoutes: existing?.gridRoutes,
        locks: existing?.locks,
      });

      if (isGrid && hasTubeEdit) {
        nextOverrides = onEditLock(nextOverrides, "tubeGroup", { tubeKey });
      }

      saveLayoutOverrides(nextOverrides);
      updateManualWarnings(
        graph,
        mergedNodes,
        finalEdges,
        spliceEdgeIdsForTubeKey(graph, tubeKey),
      );
      requestAnimationFrame(() => {
        updateSpliceRoutingNodeInternals(mergedNodes, updateNodeInternals);
      });
    },
    [getNodes, setEdges, setNodes, updateManualWarnings, updateNodeInternals],
  );

  const handleLegOverridesCommit = useCallback(
    (legOverrides: LayoutOverrides["legOverrides"]) => {
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey) return;

      const existing = loadLayoutOverrides(reportKey);
      const connectionIds = Object.keys(legOverrides ?? {});
      const currentEdges = getEdges();
      const currentNodes = getNodes();
      const keepAuto = autoAdjustRef.current;
      const isGrid =
        routingEngineMode(existing) === "grid" || keepAuto;

      const syncedNodes = syncSplicePointNodes(
        currentNodes,
        currentEdges,
        connectionIds,
      );
      setNodes(syncedNodes);
      setLegOverridesState(legOverrides);

      let nextOverrides = mergeLayoutOverrides(reportKey, {
        positions: positionsFromNodes(
          syncedNodes.filter((n) => n.type === "cable"),
        ),
        existingEdgeIds: existingIdsFromEdges(currentEdges),
        collapseFullButtSplices: collapseRef.current,
        layoutWidth: layoutWidthRef.current,
        cableSides: existing?.cableSides,
        callouts: existing?.callouts,
        autoAdjustEnabled: keepAuto,
        tubeOverrides: existing?.tubeOverrides,
        fanoutOverrides: existing?.fanoutOverrides,
        legOverrides,
        connectionOverrides: syncConnectionOverridesFromLegs(
          legOverrides,
          existing?.connectionOverrides,
        ),
        bundleOverrides: existing?.bundleOverrides,
        routingEngine: existing?.routingEngine,
        gridLocks: existing?.gridLocks,
        gridRoutes: existing?.gridRoutes,
        locks: existing?.locks,
      });

      if (isGrid && connectionIds.length) {
        const segmentIds = gridSegmentIdsFromLegPaths(
          syncedNodes.filter((n) => n.type === "cable"),
          currentEdges,
          connectionIds,
          layoutWidthRef.current,
        );
        if (segmentIds.length) {
          nextOverrides = onEditLock(nextOverrides, "legSegments", {
            segmentIds,
          });
        }
        for (const connectionId of connectionIds) {
          const dotShift = legOverrides?.[connectionId]?.dotShiftX;
          if (dotShift != null && Math.abs(dotShift) > 0.5) {
            nextOverrides = onEditLock(nextOverrides, "fusionDot", {
              dotId: connectionId,
            });
          } else if (existing?.gridLocks?.dots?.includes(connectionId)) {
            nextOverrides = unlockHybridItem(
              nextOverrides,
              "fusionDot",
              connectionId,
            );
          }
        }
      }

      saveLayoutOverrides(nextOverrides);

      updateManualWarnings(
        graph,
        syncedNodes,
        currentEdges,
        new Set(connectionIds.map((id) => `splice-${id}`)),
      );
    },
    [getEdges, getNodes, setNodes, updateManualWarnings],
  );

  const setTubePreview = useCallback(
    (tubeKey: TubeOverrideKey, patch: TubeManualOverride | null) => {
      setTubePreviewState((prev) => {
        const next = new Map(prev);
        if (patch === null) {
          next.delete(tubeKey);
        } else {
          next.set(tubeKey, { ...prev.get(tubeKey), ...patch });
        }
        tubePreviewRef.current = next;
        return next;
      });
    },
    [],
  );

  const repinVisualCablePreview = useCallback(
    (visualCableId: string) => {
      const graph = graphRef.current;
      if (!graph) return;
      const current = getNodes();
      const callouts = current.filter((n) => n.type === "cableCallout");
      const engine = engineNodesFrom(current);
      const cableId = `cable-${visualCableId}`;
      const cableNode = engine.find((n) => n.id === cableId);
      if (!cableNode) return;
      const data = cableNode.data as CableNodeData;
      const preview = tubePreviewRef.current;
      const patchedCable = {
        ...cableNode,
        data: {
          ...data,
          tubes: data.tubes.map((t) => {
            const key = tubeKeyFor(visualCableId, t.tubeColor);
            const live = preview.get(key);
            if (!live) return t;
            return {
              ...t,
              ...(live.visualShiftY !== undefined
                ? { visualShiftY: live.visualShiftY }
                : {}),
              ...(live.stemReachX !== undefined
                ? { stemReachX: live.stemReachX }
                : {}),
            };
          }),
        },
      };
      const { nodes: synced, edges: syncedEdges } = syncManualVisualCable(
        engine.map((n) => (n.id === cableId ? patchedCable : n)),
        getEdges(),
        graph,
        visualCableId,
        patchedCable,
      );
      setNodes([...synced, ...callouts]);
      setEdges(syncedEdges);
    },
    [getEdges, getNodes, setEdges, setNodes],
  );

  const manualAdjustEngine = useManualAdjustEngine({
    enabled:
      !autoAdjustEnabled ||
      routingEngineMode(
        reportKeyRef.current
          ? loadLayoutOverrides(reportKeyRef.current) ?? undefined
          : undefined,
      ) === "grid",
    fiberDragEnabled: !!meta,
    nodes,
    edges,
    graph: graphRef.current,
    legOverrides: legOverridesState,
    onLegOverridesCommit: handleLegOverridesCommit,
    onLegCommitBlocked: setManualWarningBanner,
    setEdges,
    setNodes,
    getNodes,
    getEdges,
    onTubePreview: setTubePreview,
    onTubeOverrideCommit: handleTubeOverrideCommit,
    onVisualCableRepin: repinVisualCablePreview,
    tubePreview,
  });

  // Long-press a leg/butt to toggle it "existing" (works in auto + manual).
  const existingLongPress = useExistingLongPress({
    enabled: !!meta,
    getEdges,
    setEdges,
    persist: (nextEdges) => persistLayout(getNodes(), nextEdges),
  });
  const existingToggleValue = useMemo(
    () => ({
      beginLongPress: existingLongPress.beginLongPress,
      isCharging: (connectionId: string) =>
        existingLongPress.chargingConnectionIds.has(connectionId),
      chargingTier: existingLongPress.chargingTier,
    }),
    [
      existingLongPress.beginLongPress,
      existingLongPress.chargingConnectionIds,
      existingLongPress.chargingTier,
    ],
  );

  const printDiagram = usePrintDiagram(
    nodes,
    graphRef.current,
    stageRef,
  );

  const toggleManualAdjust = useCallback(() => {
    const reportKey = reportKeyRef.current;
    if (!reportKey) return;
    const existing = loadLayoutOverrides(reportKey);
    const next = !(existing?.autoAdjustEnabled !== false);
    setAutoAdjustEnabled(next);
    if (next) {
      setManualWarningBanner(null);
      setActiveGuides([]);
    }
    setNodes((current) =>
      current.map((n) => {
        if (n.type !== "cable") return n;
        return {
          ...n,
          data: {
            ...(n.data as CableNodeData),
            manualAdjustEnabled: !next,
          },
        };
      }),
    );
    // No updateNodeInternals here: cable geometry/handles are identical between
    // auto and manual modes (manual only mounts an absolutely-positioned overlay),
    // so a forced re-measure just causes a visible jitter on toggle.
    saveLayoutOverrides(
      mergeLayoutOverrides(reportKey, {
        autoAdjustEnabled: next,
      }),
    );
  }, [setNodes]);

  const setLayoutMode = useCallback(
    (next: LayoutMode) => {
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey || next === layoutModeRef.current) return;
      layoutModeRef.current = next;
      setLayoutModeState(next);
      saveLayoutOverrides(mergeLayoutOverrides(reportKey, { layoutMode: next }));
      const width = resolveLayoutWidth(graph, false);
      applyGraph(graph, reportKey, collapseRef.current, {
        layoutWidth: width,
        refreshLayout: true,
        refreshColumnX: true,
        refreshRowLayout: true,
        fitView: true,
      });
    },
    [applyGraph, resolveLayoutWidth],
  );

  const resetToAutoLayout = useCallback(() => {
    const graph = graphRef.current;
    const reportKey = reportKeyRef.current;
    if (!graph || !reportKey) return;
    const existing = loadLayoutOverrides(reportKey);
    setAutoAdjustEnabled(true);
    setManualWarningBanner(null);
    setActiveGuides([]);
    setLegOverridesState({});
    saveLayoutOverrides(
      mergeLayoutOverrides(
        reportKey,
        clearAllHybridLocks({
          ...existing,
          reportKey,
          positions: existing?.positions ?? {},
          autoAdjustEnabled: true,
        }),
      ),
    );
    const width = resolveLayoutWidth(graph, false);
    applyGraph(graph, reportKey, collapseRef.current, {
      layoutWidth: width,
      refreshLayout: true,
      refreshColumnX: true,
      refreshRowLayout: true,
      fitView: true,
    });
  }, [applyGraph, resolveLayoutWidth]);

  const toggleFullButtCollapse = useCallback(() => {
    const graph = graphRef.current;
    const reportKey = reportKeyRef.current;
    if (!graph || !reportKey) return;
    setCollapseFullButtSplices((prev) => {
      const next = !prev;
      const width = resolveLayoutWidth(graph);
      applyGraph(graph, reportKey, next, {
        layoutWidth: width,
        refreshColumnX: true,
        refreshRowLayout: true,
      });
      return next;
    });
  }, [applyGraph, resolveLayoutWidth]);

  const onNodeDragStart: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      isInteractingRef.current = true;
      if (node.type === "fiberAnchor") {
        manualAdjustEngine.onFiberAnchorDragStart(
          _ as React.MouseEvent,
          node,
        );
        return;
      }
      if (node.type !== "cable") return;
      quadDragCacheEdgesRef.current = getEdges();
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (graph && reportKey && useCandidateSideDrag(reportKey, graph)) {
        sideDragBoundsAtDragStartRef.current = sideDragBounds(
          layoutWidthRef.current,
          getNodes(),
        );
        sideDragStartXRef.current = node.position.x;
      }
      if (reportKey && useGridRoutingEngine(loadLayoutOverrides(reportKey) ?? undefined)) {
        gridRoutesDragRef.current = gridRoutesFromEdges(
          getEdges(),
          layoutWidthRef.current,
        );
      }
      refreshDragRouting(node);
    },
    [manualAdjustEngine, refreshDragRouting, getEdges, getNodes],
  );

  const onNodeDragStop: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      try {
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (
        useCandidateSideDrag(reportKey, graph) &&
        node.type === "cable"
      ) {
        if (!reportKey || !graph) return;

        if (manualCableDragRafRef.current != null) {
          cancelAnimationFrame(manualCableDragRafRef.current);
          manualCableDragRafRef.current = null;
        }
        pendingManualCableNodeRef.current = null;
        if (engineCableDragRafRef.current != null) {
          cancelAnimationFrame(engineCableDragRafRef.current);
          engineCableDragRafRef.current = null;
        }
        pendingEngineCableNodeRef.current = null;
        if (candidateCableDragRafRef.current != null) {
          cancelAnimationFrame(candidateCableDragRafRef.current);
          candidateCableDragRafRef.current = null;
        }
        pendingCandidateCableNodeRef.current = null;

        const existing = loadLayoutOverrides(reportKey);
        const visualId = visualCableIdFromNodeId(node.id);
        if (!visualId || !existing) return;

        const cableData = node.data as CableNodeData;
        const currentSide = effectiveCableSide(cableData);
        const dragBounds =
          sideDragBoundsAtDragStartRef.current ??
          sideDragBounds(layoutWidthRef.current, nodes);
        const newSide = detectSideFromEdgeProximity(
          node.position.x,
          node.position.y,
          dragBounds,
          currentSide,
          { dragStartX: sideDragStartXRef.current ?? undefined },
        );
        const sideChanged = currentSide !== newSide;
        const manualMode = !autoAdjustRef.current;

        let finalX = node.position.x;
        let finalY = node.position.y;
        let layoutWidth = layoutWidthRef.current;

        if (newSide === "left" || newSide === "right") {
          const maxTubes =
            Math.max(
              1,
              ...buildVisualCablesForLayout(graph).visualCables.map(
                (vc) => vc.tubes.length,
              ),
            );
          const nodeWidth = estimatedCableNodeWidth(maxTubes);
          let bounds = xBoundsRef.current;
          ({ layoutWidth, bounds } = boundsForOutwardDrag(
            node.position.x,
            newSide,
            layoutWidth,
            bounds,
            nodeWidth,
          ));
          xBoundsRef.current = bounds;
          finalX = resolveCableDragStopX(node.position.x, newSide, bounds);

          if (!sideChanged && manualMode) {
            const { visualCables } = buildVisualCablesForLayout(graph);
            const yByVc = new Map<string, number>();
            for (const n of getNodes()) {
              if (n.type !== "cable") continue;
              const vid = visualCableIdFromNodeId(n.id);
              if (vid && vid !== visualId) yByVc.set(vid, n.position.y);
            }
            const snapDelta = nearStraightCableShift(
              visualCables,
              visualId,
              finalY,
              (vid) => yByVc.get(vid),
            );
            if (Math.abs(snapDelta) > 0.5) finalY += snapDelta;
          }
        } else {
          const yBounds = { topY: dragBounds.minY, bottomY: dragBounds.maxY };
          finalY = resolveCableDragStopY(node.position.y, newSide, yBounds);
          const maxTubes =
            Math.max(
              1,
              ...buildVisualCablesForLayout(graph).visualCables.map(
                (vc) => vc.tubes.length,
              ),
            );
          const nodeWidth = estimatedCableNodeWidth(maxTubes);
          const stackBounds: CableStackXBounds = {
            minX: dragBounds.minX,
            maxX: dragBounds.maxX - nodeWidth,
          };
          const autoStackX = node.position.x;
          finalX = resolveCableDragStopStackX(
            node.position.x,
            autoStackX,
            stackBounds,
          );
        }

        if (
          !sideChanged &&
          (currentSide === "left" || currentSide === "right")
        ) {
          const nodeHeight = node.height ?? node.measured?.height ?? 160;
          finalY = Math.min(
            Math.max(finalY, dragBounds.minY),
            dragBounds.maxY - nodeHeight,
          );
        }

        if (
          !sideChanged &&
          (currentSide === "top" || currentSide === "bottom")
        ) {
          const maxTubes =
            Math.max(
              1,
              ...buildVisualCablesForLayout(graph).visualCables.map(
                (vc) => vc.tubes.length,
              ),
            );
          const nodeWidth = estimatedCableNodeWidth(maxTubes);
          finalX = Math.min(
            Math.max(finalX, dragBounds.minX),
            dragBounds.maxX - nodeWidth,
          );
        }

        logSideDrag("onNodeDragStop", {
          phase: "commit",
          visualId,
          nodeId: node.id,
          drag: node.position,
          currentSide,
          newSide,
          sideChanged,
          resolved: { x: finalX, y: finalY },
          layoutMode: layoutModeRef.current,
        });

        if (!sideChanged) {
          const finalPositions = {
            ...(existing?.positions ?? {}),
            [node.id]: { x: finalX, y: finalY },
          };
          const layoutMode = layoutModeRef.current;
          saveLayoutOverrides(
            mergeLayoutOverrides(reportKey, {
              layoutMode,
              positions: finalPositions,
            }),
          );
          layoutWidthRef.current = layoutWidth;
          refreshDragRouting({
            ...node,
            position: { x: finalX, y: finalY },
          });
          return;
        }

        const baseCandidate = candidateFromOverrides(graph, existing);
        const prevLayoutMode = baseCandidate
          ? deriveLayoutMode(baseCandidate)
          : layoutModeRef.current;
        const stackCoord = stackCoordForSide(newSide, { x: finalX, y: finalY });
        const positionsForSeed = {
          ...(existing?.positions ?? {}),
          [node.id]: { x: finalX, y: finalY },
        };
        const seedCandidate = prepareSideDragSeedCandidate(
          graph,
          existing,
          visualId,
          newSide,
          stackCoord,
          positionsForSeed,
        );

        const applySideDragCommit = (
          result: NonNullable<ReturnType<typeof applyCableSideDragCommit>>,
        ) => {
          if (result.warnings.length > 0) {
            setManualWarningBanner(result.warnings.join(" "));
          } else {
            setManualWarningBanner(null);
          }

          layoutWidthRef.current = result.layoutWidth;
          layoutModeRef.current = result.layoutMode;
          setLayoutModeState(result.layoutMode);

          const merged = attachDiagramOverlayNodes(
            result.nodes,
            graph,
            reportKey,
            result.layoutWidth,
            collapseRef.current,
            result.overrides.positions,
          );
          setNodes(merged);
          setEdges(result.edges);
          saveLayoutOverrides(
            mergeLayoutOverrides(reportKey, {
              ...result.overrides,
              positions: positionsFromNodes(merged),
              existingEdgeIds: existingIdsFromEdges(result.edges),
              collapseFullButtSplices: collapseRef.current,
              layoutWidth: result.layoutWidth,
              layoutMode: result.layoutMode,
              cableSides: result.overrides.cableSides,
              quadCableSides: result.overrides.quadCableSides,
              optimizedLayoutCandidate: result.candidate,
              autoAdjustEnabled: autoAdjustRef.current,
              routingEngine: existing.routingEngine,
              tubeOverrides: existing.tubeOverrides,
              fanoutOverrides: existing.fanoutOverrides,
              legOverrides: result.overrides.legOverrides,
              connectionOverrides: result.overrides.connectionOverrides,
              gridLocks: result.overrides.gridLocks,
              gridRoutes: result.overrides.gridRoutes,
              callouts: existing.callouts,
            }),
          );

          if (manualMode) {
            const touched = new Set<string>();
            for (const edge of result.edges) {
              if (
                edge.type === "splice" &&
                (edge.source === node.id ||
                  edge.target === node.id ||
                  edge.id.startsWith("splice-left-") ||
                  edge.id.startsWith("splice-right-"))
              ) {
                if (edge.id.startsWith("splice-left-")) {
                  touched.add(
                    `splice-${edge.id.slice("splice-left-".length)}`,
                  );
                } else if (edge.id.startsWith("splice-right-")) {
                  touched.add(
                    `splice-${edge.id.slice("splice-right-".length)}`,
                  );
                } else {
                  touched.add(edge.id);
                }
              }
            }
            updateManualWarnings(graph, merged, result.edges, touched);
          }

          requestAnimationFrame(() =>
            updateSpliceRoutingNodeInternals(merged, updateNodeInternals),
          );
          if (result.sideChanged) {
            requestDiagramFitView();
          }
          sideDragBoundsAtDragStartRef.current = null;
          sideDragStartXRef.current = null;
          quadDragCacheEdgesRef.current = null;
        };

        if (
          seedCandidate &&
          needsReoptimizeAfterSideDrag(prevLayoutMode, newSide, seedCandidate)
        ) {
          const strandCount = graph.connections.length;
          const cableCount = cableKeysFromGraph(graph).length;
          const runId = ++layoutSearchRunRef.current;
          layoutSearchCancelRef.current = false;
          const lockedSides = lockedSidesForSideDrag(
            graph,
            existing,
            visualId,
            newSide,
            seedCandidate,
          );

          setLayoutSearchProgress(
            initialSearchProgress(
              {
                phase: "optimizing",
                strandCount,
                cableCount,
                evaluationBudget: 512,
              },
              { message: "Adjusting layout…" },
            ),
          );

          void (async () => {
            const winner = await reoptimizeAfterSideDrag(
              graph,
              seedCandidate,
              lockedSides,
              {
                reportKey,
                onProgress: (progress) => {
                  if (layoutSearchRunRef.current !== runId) return;
                  setLayoutSearchProgress({
                    ...progress,
                    message: "Adjusting layout…",
                  });
                },
                shouldCancel: () => layoutSearchCancelRef.current,
              },
            );

            if (layoutSearchRunRef.current !== runId) return;
            setLayoutSearchProgress(null);

            if (!winner) {
              setConfigErrorBanner(
                "Could not reroute cleanly; try re-import.",
              );
            } else {
              setConfigErrorBanner(null);
            }

            const optimized = applyCableSideDragCommit({
              graph,
              overrides: existing,
              visualId,
              nodeId: node.id,
              position: { x: finalX, y: finalY },
              newSide,
              bounds: dragBounds,
              collapseFullButtSplices: collapseRef.current,
              autoAdjustEnabled: autoAdjustRef.current,
              preview: false,
              finalCandidate: winner ?? seedCandidate,
            });
            if (!optimized) {
              sideDragBoundsAtDragStartRef.current = null;
              sideDragStartXRef.current = null;
              return;
            }
            applySideDragCommit(optimized);
          })();
          return;
        }

        const commit = applyCableSideDragCommit({
          graph,
          overrides: existing,
          visualId,
          nodeId: node.id,
          position: { x: finalX, y: finalY },
          newSide,
          bounds: dragBounds,
          collapseFullButtSplices: collapseRef.current,
          autoAdjustEnabled: autoAdjustRef.current,
          preview: false,
        });
        if (!commit) {
          sideDragBoundsAtDragStartRef.current = null;
          sideDragStartXRef.current = null;
          return;
        }

        applySideDragCommit(commit);
        return;
      }
      if (node.type === "fiberAnchor") {
        manualAdjustEngine.onNodeDragStop(_, node, nodes);
        return;
      }
      if (layoutModeRef.current === "quad") {
        if (node.type === "cable") {
          const reportKey = reportKeyRef.current;
          if (reportKey) {
            const existing = loadLayoutOverrides(reportKey);
            saveLayoutOverrides(
              mergeLayoutOverrides(reportKey, {
                layoutMode: "quad",
                positions: {
                  ...(existing?.positions ?? {}),
                  [node.id]: node.position,
                },
              }),
            );
          }
          refreshDragRouting(node);
        }
        return;
      }
      if (node.type === "cableCallout") {
        setNodes((current) => {
          const next = current.map((n) => (n.id === node.id ? node : n));
          persistLayout(next, edges);
          return next;
        });
        return;
      }

      if (node.type !== "cable") {
        persistLayout(nodes, edges);
        return;
      }

      const visualId = visualCableIdFromNodeId(node.id);
      if (!visualId) return;

      if (manualCableDragRafRef.current != null) {
        cancelAnimationFrame(manualCableDragRafRef.current);
        manualCableDragRafRef.current = null;
      }
      pendingManualCableNodeRef.current = null;
      if (engineCableDragRafRef.current != null) {
        cancelAnimationFrame(engineCableDragRafRef.current);
        engineCableDragRafRef.current = null;
      }
      pendingEngineCableNodeRef.current = null;

      const centerX = layoutWidthRef.current / 2;
      const newSide = displaySideFromCanvasX(node.position.x, centerX);
      const prevSide = (node.data as CableNodeData).side;
      const sideChanged = newSide !== prevSide;
      const maxTubes =
        graph != null
          ? Math.max(
              1,
              ...buildVisualCablesForLayout(graph).visualCables.map(
                (vc) => vc.tubes.length,
              ),
            )
          : 3;
      const nodeWidth = estimatedCableNodeWidth(maxTubes);

      let layoutWidth = layoutWidthRef.current;
      let bounds = xBoundsRef.current;
      ({ layoutWidth, bounds } = boundsForOutwardDrag(
        node.position.x,
        newSide,
        layoutWidth,
        bounds,
        nodeWidth,
      ));
      const prevLayoutWidth = layoutWidthRef.current;
      layoutWidthRef.current = layoutWidth;
      xBoundsRef.current = bounds;

      if (graph) {
        const contentWidth = importLayoutWidthForGraph(graph);
        if (layoutWidth > contentWidth + STAGE_WIDTH_DELTA_PX) {
          userExpandedLayoutRef.current = true;
        }
      } else if (layoutWidth > prevLayoutWidth + STAGE_WIDTH_DELTA_PX) {
        userExpandedLayoutRef.current = true;
      }

      const finalX = resolveCableDragStopX(node.position.x, newSide, bounds);
      let finalY = node.position.y;

      if (graph && reportKeyRef.current) {
        const existing = loadLayoutOverrides(reportKeyRef.current);
        const requestedCableSides = {
          ...(existing?.cableSides ?? {}),
          [visualId]: newSide,
        };
        const manualMode = !autoAdjustRef.current;

        // SDC-UX-001-A horizontal leg alignment — on manual release, snap the cable
        // to flatten near-straight legs against the partner cables' live Ys.
        if (manualMode) {
          const { visualCables } = buildVisualCablesForLayout(graph);
          const yByVc = new Map<string, number>();
          for (const n of getNodes()) {
            if (n.type !== "cable") continue;
            const vid = visualCableIdFromNodeId(n.id);
            if (vid && vid !== visualId) yByVc.set(vid, n.position.y);
          }
          const snapDelta = nearStraightCableShift(
            visualCables,
            visualId,
            finalY,
            (vid) => yByVc.get(vid),
          );
          if (Math.abs(snapDelta) > 0.5) finalY += snapDelta;
        }
        const finalPositions = {
          ...(existing?.positions ?? {}),
          [node.id]: { x: finalX, y: finalY },
        };
        const draggedFinal: Node = {
          ...node,
          position: { x: finalX, y: finalY },
          data: sideChanged
            ? { ...(node.data as CableNodeData), side: newSide }
            : node.data,
        };

        let nextNodes: Node[];
        let nextEdges: Edge[];
        let autoLayoutY: Record<string, number> | undefined;

        const flippedConnIds = sideChanged
          ? rerouteConnectionIdsForVisualCableDrag(
              buildVisualCablesForLayout(graph).visualCables,
              visualId,
            )
          : [];
        const strippedRouting = stripRoutingOverridesForConnections(
          existing,
          flippedConnIds,
        );

        if (manualMode && sideChanged) {
          ({ nodes: nextNodes, edges: nextEdges } = buildReactFlowGraph(
            graph,
            {
              reportKey: reportKeyRef.current,
              collapseFullButtSplices: collapseRef.current,
              positions: finalPositions,
              existingEdgeIds: existing?.existingEdgeIds,
              cableSides: requestedCableSides,
              layoutWidth,
              autoAdjustEnabled: false,
              tubeOverrides: existing?.tubeOverrides,
              fanoutOverrides: existing?.fanoutOverrides,
              legOverrides: strippedRouting.legOverrides,
              connectionOverrides: strippedRouting.connectionOverrides,
              locks: existing?.locks,
            },
            layoutWidth,
            { skipTubeAutoAlign: true, refreshColumnX: true },
          ));
          const callouts = getNodes().filter((n) => n.type === "cableCallout");
          nextNodes = [...nextNodes, ...callouts];
        } else if (manualMode) {
          const callouts = getNodes().filter((n) => n.type === "cableCallout");
          const engine = engineNodesFrom(getNodes());
          ({ nodes: nextNodes, edges: nextEdges } = syncManualVisualCable(
            engine,
            getEdges(),
            graph,
            visualId,
            draggedFinal,
          ));
          const collapsedColors =
            (draggedFinal.data as CableNodeData).collapsedTubes ?? [];
          if (collapsedColors.length > 0) {
            const tubeKeys = collapsedColors.map((tubeColor) =>
              tubeKeyFor(visualId, tubeColor as TubeColorCode),
            );
            const repinned = repinButtSpliceEdges(
              nextNodes,
              nextEdges,
              graph,
              { tubeKeys },
            );
            nextEdges = repinned.edges;
          }
          nextNodes = [...nextNodes, ...callouts];
        } else {
          const incrementalGridStop = false;
          const rerouteConnectionIds = incrementalGridStop
            ? rerouteConnectionIdsForVisualCableDrag(
                buildVisualCablesForLayout(graph).visualCables,
                visualId,
              )
            : undefined;
          ({ nodes: nextNodes, edges: nextEdges, autoLayoutY } =
            buildReactFlowGraph(
              graph,
              {
                reportKey: reportKeyRef.current,
                collapseFullButtSplices: collapseRef.current,
                positions: finalPositions,
                existingEdgeIds: existing?.existingEdgeIds,
                cableSides: requestedCableSides,
                layoutWidth,
                autoAdjustEnabled: true,
                tubeOverrides: existing?.tubeOverrides,
                fanoutOverrides: existing?.fanoutOverrides,
                legOverrides: sideChanged
                  ? strippedRouting.legOverrides
                  : existing?.legOverrides,
                connectionOverrides: sideChanged
                  ? strippedRouting.connectionOverrides
                  : existing?.connectionOverrides,
                locks: existing?.locks,
                routingEngine: existing?.routingEngine,
                gridLocks: sideChanged ? undefined : existing?.gridLocks,
                gridRoutes: sideChanged ? undefined : existing?.gridRoutes,
              },
              layoutWidth,
              sideChanged
                ? { refreshColumnX: true }
                : incrementalGridStop
                  ? {
                      rerouteConnectionIds,
                      dragCacheEdges: getEdges(),
                      priorGridRoutes: gridRoutesDragRef.current ?? undefined,
                    }
                  : undefined,
            ));
        }

        const merged = attachDiagramOverlayNodes(
          nextNodes,
          graph,
          reportKeyRef.current,
          layoutWidth,
          collapseRef.current,
          finalPositions,
        );
        const mergedDragged = merged.find((n) => n.id === node.id);
        const resolvedSide =
          (mergedDragged?.data as CableNodeData | undefined)?.side ?? newSide;
        const persistedCableSides = {
          ...(existing?.cableSides ?? {}),
          [visualId]: resolvedSide,
        };
        graph.cableSides.set(visualId, resolvedSide);
        setNodes(merged);
        setEdges(nextEdges);
        const baseOverrides = mergeLayoutOverrides(reportKeyRef.current, {
          positions: positionsFromNodes(merged),
          ...(autoLayoutY ? { autoLayoutY } : {}),
          existingEdgeIds: existingIdsFromEdges(nextEdges),
          collapseFullButtSplices: collapseRef.current,
          layoutWidth,
          cableSides: persistedCableSides,
          callouts: existing?.callouts,
          autoAdjustEnabled: autoAdjustRef.current,
          tubeOverrides: existing?.tubeOverrides,
          fanoutOverrides: existing?.fanoutOverrides,
          legOverrides: sideChanged
            ? strippedRouting.legOverrides
            : existing?.legOverrides,
          connectionOverrides: sideChanged
            ? strippedRouting.connectionOverrides
            : existing?.connectionOverrides,
          routingEngine: existing?.routingEngine,
          gridLocks: sideChanged ? undefined : existing?.gridLocks,
          gridRoutes: sideChanged ? undefined : existing?.gridRoutes,
        });
        saveLayoutOverrides(baseOverrides);
        layoutWidthRef.current = layoutWidth;
        if (manualMode) {
          const touched = new Set<string>();
          for (const edge of nextEdges) {
            if (
              edge.type === "splice" &&
              (edge.source === node.id ||
                edge.target === node.id ||
                edge.id.startsWith("splice-left-") ||
                edge.id.startsWith("splice-right-"))
            ) {
              if (edge.id.startsWith("splice-left-")) {
                touched.add(
                  `splice-${edge.id.slice("splice-left-".length)}`,
                );
              } else if (edge.id.startsWith("splice-right-")) {
                touched.add(
                  `splice-${edge.id.slice("splice-right-".length)}`,
                );
              } else {
                touched.add(edge.id);
              }
            }
          }
          updateManualWarnings(graph, merged, nextEdges, touched);
        }
        if (sideChanged) {
          requestAnimationFrame(() => updateNodeInternals(node.id));
        }
      }
      } finally {
        endCanvasInteraction();
        if (node.type === "cable") {
          gridRoutesDragRef.current = null;
          sideDragBoundsAtDragStartRef.current = null;
          sideDragStartXRef.current = null;
          quadDragCacheEdgesRef.current = null;
        }
      }
    },
    [
      edges,
      endCanvasInteraction,
      getEdges,
      getNodes,
      manualAdjustEngine,
      nodes,
      persistLayout,
      refreshDragRouting,
      setEdges,
      setNodes,
      updateManualWarnings,
      updateNodeInternals,
      requestDiagramFitView,
    ],
  );

  const onNodeDrag: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      if (node.type === "fiberAnchor") {
        manualAdjustEngine.onNodeDrag(_, node, nodes);
        return;
      }
      if (node.type !== "cable") return;

      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (graph && reportKey && useCandidateSideDrag(reportKey, graph)) {
        refreshDragRouting(node);
        return;
      }

      if (layoutModeRef.current === "quad") {
        refreshDragRouting(node);
        return;
      }

      const centerX = layoutWidthRef.current / 2;
      const nextSide = displaySideFromCanvasX(node.position.x, centerX);
      const prevSide = (node.data as CableNodeData).side;
      const dragNode =
        prevSide !== nextSide
          ? {
              ...node,
              data: { ...(node.data as CableNodeData), side: nextSide },
            }
          : node;
      refreshDragRouting(dragNode);
    },
    [manualAdjustEngine, refreshDragRouting, nodes],
  );

  const unlockSelectedAdjustments = useCallback(() => {
    const graph = graphRef.current;
    const reportKey = reportKeyRef.current;
    if (!graph || !reportKey) return;
    const selected = manualAdjustEngine.selection.connectionIds;
    if (selected.size === 0) return;
    const existing = loadLayoutOverrides(reportKey);
    let next = existing ?? {
      reportKey,
      positions: {},
    };
    const tubeOverrides = { ...(next.tubeOverrides ?? {}) };
    const fanoutOverrides = { ...(next.fanoutOverrides ?? {}) };
    const legOverrides = { ...(next.legOverrides ?? {}) };
    for (const connectionId of selected) {
      delete legOverrides[connectionId];
      next = unlockHybridItem(next, "fusionDot", connectionId);
      for (const edge of getEdges()) {
        if (!edge.id.startsWith("splice-left-")) continue;
        if (edge.id.slice("splice-left-".length) !== connectionId) continue;
        const anchor = nodes.find(
          (n) =>
            n.type === "fiberAnchor" &&
            (n.data as { connectionId?: string }).connectionId === connectionId,
        );
        const vcId = (anchor?.data as { visualCableId?: string } | undefined)
          ?.visualCableId;
        if (vcId) {
          const tubeKey = tubeKeyForFiberAnchor(graph, connectionId, vcId);
          if (tubeKey) {
            delete tubeOverrides[tubeKey];
            delete fanoutOverrides[tubeKey];
            next = unlockHybridItem(next, "tubeGroup", tubeKey);
          }
        }
      }
    }
    next = {
      ...next,
      tubeOverrides,
      fanoutOverrides,
      legOverrides,
    };
    saveLayoutOverrides(next);
    setLegOverridesState(legOverrides);
    manualAdjustEngine.onClearSelection();
    applyGraph(graph, reportKey, collapseRef.current, {
      layoutWidth: layoutWidthRef.current,
      refreshLayout: true,
      refreshRowLayout: true,
    });
  }, [
    applyGraph,
    getEdges,
    manualAdjustEngine,
    nodes,
  ]);

  const snapTipTargets = useMemo(() => {
    if (autoAdjustEnabled) return [] as number[];
    const graph = graphRef.current;
    if (!graph) return [] as number[];
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of nodes) {
      if (n.type === "cable") {
        positions[n.id] = { x: n.position.x, y: n.position.y };
      }
    }
    const reportKey = reportKeyRef.current;
    const tubeOverrides = reportKey
      ? loadLayoutOverrides(reportKey)?.tubeOverrides
      : undefined;
    return [
      ...collectGlobalTubeTipSnapTargets(graph, positions, tubeOverrides),
      ...collectGlobalFiberHandleSnapTargets(graph, positions, tubeOverrides),
    ];
  }, [autoAdjustEnabled, nodes]);

  const manualLayoutContextValue = useMemo(
    () => ({
      manualAdjustEnabled: !autoAdjustEnabled,
      onFiberAnchorClick: manualAdjustEngine.onFiberAnchorClick,
      snapTipTargets,
      tubePreview,
      setTubePreview,
      onTubeOverrideCommit: handleTubeOverrideCommit,
      activeGuides,
      setActiveGuides,
    }),
    [
      autoAdjustEnabled,
      manualAdjustEngine.onFiberAnchorClick,
      snapTipTargets,
      tubePreview,
      setTubePreview,
      handleTubeOverrideCommit,
      activeGuides,
    ],
  );

  const reportText = useMemo(() => {
    const graph = graphRef.current;
    if (!graph || !reportOpen) return "";
    const existingConnectionIds = new Set(
      existingIdsFromEdges(edges)
        .map(connectionIdFromEdgeId)
        .filter((id): id is string => id != null),
    );
    return formatSpliceConnectionReport(graph, { existingConnectionIds });
  }, [reportOpen, edges]);

  const inspectorModel = useMemo(() => {
    const graph = graphRef.current;
    if (!graph || !inspectorOpen) return null;
    const existingConnectionIds = new Set(
      existingIdsFromEdges(edges)
        .map(connectionIdFromEdgeId)
        .filter((id): id is string => id != null),
    );
    return buildConnectionInspectorModel(graph, { existingConnectionIds });
  }, [inspectorOpen, edges]);

  const handleTitleFieldChange = useCallback(
    (field: keyof DiagramTitleBlock, value: string) => {
      setNodes((current) => {
        const next = current.map((n) =>
          n.id === DIAGRAM_TITLE_NODE_ID
            ? {
                ...n,
                data: { ...(n.data as DiagramTitleNodeData), [field]: value },
              }
            : n,
        );
        const key = reportKeyRef.current;
        if (key) {
          const existing = loadLayoutOverrides(key);
          const titleBlock: DiagramTitleBlock = {
            ...(existing?.titleBlock ?? {}),
            [field]: value,
          };
          saveLayoutOverrides(
            mergeLayoutOverrides(key, {
              titleBlock,
              positions: positionsFromNodes(next),
              existingEdgeIds: existingIdsFromEdges(getEdges()),
              collapseFullButtSplices: collapseRef.current,
              layoutWidth: layoutWidthRef.current,
              cableSides: existing?.cableSides,
              callouts: existing?.callouts,
            }),
          );
        }
        return next;
      });
    },
    [getEdges, setNodes],
  );

  const handleCalloutTextChange = useCallback(
    (calloutId: string, text: string) => {
      setNodes((current) => {
        const next = current.map((n) =>
          n.id === calloutId
            ? {
                ...n,
                data: { ...(n.data as CableCalloutNodeData), text },
              }
            : n,
        );
        const key = reportKeyRef.current;
        if (key) {
          const existing = loadLayoutOverrides(key);
          const callouts: Record<string, LayoutCalloutRecord> = {
            ...(existing?.callouts ?? {}),
          };
          const record = callouts[calloutId];
          if (record) {
            callouts[calloutId] = { ...record, text };
          }
          saveLayoutOverrides(
            mergeLayoutOverrides(key, {
              positions: positionsFromNodes(next),
              callouts,
              existingEdgeIds: existingIdsFromEdges(getEdges()),
              collapseFullButtSplices: collapseRef.current,
              layoutWidth: layoutWidthRef.current,
              cableSides: existing?.cableSides,
            }),
          );
        }
        return next;
      });
    },
    [getEdges, setNodes],
  );

  const setCalloutUserScale = useCallback((scale: number) => {
    const clamped = clampCalloutScale(scale);
    setCalloutScaleState(clamped);
    calloutScaleRef.current = clamped;
    const key = reportKeyRef.current;
    if (key) {
      saveLayoutOverrides(
        mergeLayoutOverrides(key, {
          calloutScale: clamped,
          calloutAutoZoom: calloutAutoZoomRef.current,
        }),
      );
    }
  }, []);

  const setCalloutAutoZoomCompensate = useCallback((enabled: boolean) => {
    setCalloutAutoZoomState(enabled);
    calloutAutoZoomRef.current = enabled;
    const key = reportKeyRef.current;
    if (key) {
      saveLayoutOverrides(
        mergeLayoutOverrides(key, {
          calloutScale: calloutScaleRef.current,
          calloutAutoZoom: enabled,
        }),
      );
    }
  }, []);

  const calloutScaleContextValue = useMemo<CalloutScaleContextValue>(
    () => ({
      userScale: calloutScale,
      autoZoomCompensate: calloutAutoZoom,
      isPrinting,
      setUserScale: setCalloutUserScale,
      setAutoZoomCompensate: setCalloutAutoZoomCompensate,
      effectiveScale: (zoom: number) =>
        effectiveCalloutScale(calloutScale, zoom, {
          autoZoomCompensate: calloutAutoZoom,
          isPrinting,
        }),
    }),
    [
      calloutScale,
      calloutAutoZoom,
      isPrinting,
      setCalloutUserScale,
      setCalloutAutoZoomCompensate,
    ],
  );

  useEffect(() => {
    const onBeforePrint = () => setIsPrinting(true);
    const onAfterPrint = () => setIsPrinting(false);
    window.addEventListener("beforeprint", onBeforePrint);
    window.addEventListener("afterprint", onAfterPrint);
    return () => {
      window.removeEventListener("beforeprint", onBeforePrint);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, []);

  const generateCableCallouts = useCallback(() => {
    const reportKey = reportKeyRef.current;
    if (!reportKey) return;

    const cableNodes = nodes.filter((n) => n.type === "cable");
    const leftCables = cableNodes.filter(
      (n) => (n.data as CableNodeData).side === "left",
    );
    const rightCables = cableNodes.filter(
      (n) => (n.data as CableNodeData).side === "right",
    );

    const callouts: Record<string, LayoutCalloutRecord> = {};
    const calloutNodes: Node[] = [];

    const addForSide = (sideNodes: Node[]) => {
      sideNodes.forEach((cableNode, index) => {
        const data = cableNode.data as CableNodeData;
        const text = formatCableCalloutText(
          data.label,
          fibersFromCableTubes(data.tubes),
          edges,
        );
        const id = calloutIdForCable(cableNode.id);
        const position = defaultCalloutPosition(cableNode, data, index);
        callouts[id] = { targetCableNodeId: cableNode.id, text };
        calloutNodes.push({
          id,
          type: "cableCallout",
          position,
          width: CALLOUT_BOX.width,
          height: CALLOUT_BOX.minHeight,
          data: { targetCableNodeId: cableNode.id, text },
          draggable: true,
          selectable: true,
        });
      });
    };

    addForSide(leftCables);
    addForSide(rightCables);

    const withoutCallouts = nodes.filter((n) => n.type !== "cableCallout");
    const nextNodes = [...withoutCallouts, ...calloutNodes];
    setCalloutsVisible(true);
    calloutsVisibleRef.current = true;
    setNodes(nextNodes);
    persistLayout(nextNodes, edges, { callouts, calloutsVisible: true });
  }, [edges, nodes, persistLayout, setNodes]);

  const setCableCalloutsVisible = useCallback(
    (visible: boolean) => {
      const reportKey = reportKeyRef.current;
      if (!reportKey || visible === calloutsVisibleRef.current) return;

      setCalloutsVisible(visible);
      calloutsVisibleRef.current = visible;

      if (!visible) {
        const engineNodes = nodes.filter((n) => n.type !== "cableCallout");
        setNodes(engineNodes);
        const existing = loadLayoutOverrides(reportKey);
        saveLayoutOverrides(
          mergeLayoutOverrides(reportKey, {
            calloutsVisible: false,
            positions: {
              ...existing?.positions,
              ...positionsFromNodes(engineNodes),
            },
            existingEdgeIds: existingIdsFromEdges(edges),
            collapseFullButtSplices: collapseRef.current,
            layoutWidth: layoutWidthRef.current,
          }),
        );
        return;
      }

      const existing = loadLayoutOverrides(reportKey);
      const storedCallouts = existing?.callouts;
      const hasStored =
        storedCallouts && Object.keys(storedCallouts).length > 0;

      if (hasStored) {
        const engineNodes = nodes.filter((n) => n.type !== "cableCallout");
        const nextNodes = mergeCalloutNodes(
          engineNodes,
          storedCallouts,
          existing?.positions,
        );
        setNodes(nextNodes);
        saveLayoutOverrides(
          mergeLayoutOverrides(reportKey, {
            calloutsVisible: true,
            positions: {
              ...existing?.positions,
              ...positionsFromNodes(nextNodes),
            },
            existingEdgeIds: existingIdsFromEdges(edges),
            collapseFullButtSplices: collapseRef.current,
            layoutWidth: layoutWidthRef.current,
          }),
        );
        return;
      }

      generateCableCallouts();
    },
    [edges, generateCableCallouts, nodes, setNodes],
  );

  const [contextMenu, setContextMenu] = useState<CanvasContextMenuState | null>(
    null,
  );

  const toggleTubeGroupLock = useCallback(
    (visualCableId: string, tubeColor: string) => {
      const reportKey = reportKeyRef.current;
      if (!reportKey) return;
      const key = tubeKeyFor(visualCableId, tubeColor as TubeColorCode);
      const existing = loadLayoutOverrides(reportKey);
      const tubeGroups = { ...(existing?.locks?.tubeGroups ?? {}) };
      const wasLocked = Boolean(tubeGroups[key]);
      if (wasLocked) delete tubeGroups[key];
      else tubeGroups[key] = true;

      const base = mergeLayoutOverrides(reportKey, {
        positions: positionsFromNodes(
          getNodes().filter((n) => n.type === "cable"),
        ),
        existingEdgeIds: existingIdsFromEdges(getEdges()),
        collapseFullButtSplices: collapseRef.current,
        layoutWidth: layoutWidthRef.current,
        locks: { ...existing?.locks, tubeGroups },
      });
      saveLayoutOverrides(
        wasLocked
          ? unlockHybridItem(base, "tubeGroup", key)
          : onEditLock(base, "tubeGroup", { tubeKey: key }),
      );
      setNodes((current) =>
        current.map((n) => {
          if (n.type !== "cable" || n.id !== `cable-${visualCableId}`) return n;
          const data = n.data as CableNodeData;
          const set = new Set(data.lockedTubes ?? []);
          if (wasLocked) set.delete(tubeColor);
          else set.add(tubeColor);
          return {
            ...n,
            data: {
              ...data,
              lockedTubes: set.size > 0 ? [...set] : undefined,
            },
          };
        }),
      );
    },
    [getEdges, getNodes, setNodes],
  );

  const toggleFusionDotLock = useCallback(
    (connectionId: string) => {
      const reportKey = reportKeyRef.current;
      if (!reportKey) return;
      const existing = loadLayoutOverrides(reportKey);
      const locked =
        existing?.gridLocks?.dots?.includes(connectionId) ?? false;

      const base = mergeLayoutOverrides(reportKey, {
        positions: positionsFromNodes(
          getNodes().filter((n) => n.type === "cable"),
        ),
        existingEdgeIds: existingIdsFromEdges(getEdges()),
        collapseFullButtSplices: collapseRef.current,
        layoutWidth: layoutWidthRef.current,
        legOverrides: existing?.legOverrides,
        gridLocks: existing?.gridLocks,
        routingEngine: existing?.routingEngine,
        gridRoutes: existing?.gridRoutes,
        autoAdjustEnabled: autoAdjustRef.current,
      });

      const next = locked
        ? unlockHybridItem(base, "fusionDot", connectionId)
        : onEditLock(base, "fusionDot", { dotId: connectionId });

      saveLayoutOverrides(next);
      setLegOverridesState(next.legOverrides);
    },
    [getEdges, getNodes],
  );

  const buildContextMenuItems = useCallback(
    (target: ContextMenuTarget): ContextMenuItem[] => {
      const reportKey = reportKeyRef.current;
      const overrides = reportKey ? loadLayoutOverrides(reportKey) : undefined;
      if (target.kind === "fusionDot") {
        const locked =
          overrides?.gridLocks?.dots?.includes(target.connectionId) ?? false;
        return [
          {
            id: "lock-fusion-dot",
            label: locked ? "Unlock fusion dot" : "Lock fusion dot",
            onSelect: () => toggleFusionDotLock(target.connectionId),
          },
        ];
      }
      if (target.kind !== "tubeGroup") return [];
      const key = tubeKeyFor(
        target.visualCableId,
        target.tubeColor as TubeColorCode,
      );
      const locked = Boolean(overrides?.locks?.tubeGroups?.[key]);
      return [
        {
          id: "lock-tube",
          label: locked ? "Unlock fan-out group" : "Lock fan-out group",
          onSelect: () =>
            toggleTubeGroupLock(target.visualCableId, target.tubeColor),
        },
      ];
    },
    [toggleFusionDotLock, toggleTubeGroupLock],
  );

  const openContextMenu = useCallback(
    (target: ContextMenuTarget, clientX: number, clientY: number) => {
      setContextMenu({
        x: clientX,
        y: clientY,
        items: buildContextMenuItems(target),
      });
    },
    [buildContextMenuItems],
  );

  const contextMenuValue = useMemo<CanvasContextMenuValue>(
    () => ({ openMenu: openContextMenu }),
    [openContextMenu],
  );

  const onNodeContextMenu = useCallback(
    (_event: React.MouseEvent, _node: Node) => {
      // Cable body has no lock actions; tube labels open their own menu in CableNode.
    },
    [],
  );

  const gridHybrid = useMemo(() => {
    const reportKey = reportKeyRef.current;
    if (!reportKey) return false;
    return useGridRoutingEngine(loadLayoutOverrides(reportKey) ?? undefined);
  }, [meta, autoAdjustEnabled, legOverridesState]);

  const lockedFusionDots = useMemo(() => {
    const reportKey = reportKeyRef.current;
    if (!reportKey) return new Set<string>();
    return new Set(loadLayoutOverrides(reportKey)?.gridLocks?.dots ?? []);
  }, [meta, legOverridesState, autoAdjustEnabled]);

  return (
    <div className="workflow-canvas">
      <div className="workflow-canvas__toolbar">
        <div className="workflow-canvas__toolbar-left">
          <CsvImportButton onImport={importDiagramFile} active={!!meta} />
          <div className="workflow-canvas__toolbar-toggles">
            <ToolbarPillToggle
              label="Buffer tubes"
              ariaLabel="Collapse full butt splices when on, expand when off"
              disabled={!meta}
              checked={collapseFullButtSplices}
              onChange={(next) => {
                if (next !== collapseFullButtSplices) {
                  toggleFullButtCollapse();
                }
              }}
            />
            <CalloutsToolbarControl
              disabled={!meta}
              checked={calloutsVisible}
              onCheckedChange={(next) => setCableCalloutsVisible(next)}
              userScale={calloutScale}
              onUserScaleChange={setCalloutUserScale}
              autoZoomCompensate={calloutAutoZoom}
              onAutoZoomChange={setCalloutAutoZoomCompensate}
            />
            <ToolbarPillToggle
              label="Circuits"
              ariaLabel="Show circuit panel when on, hide when off"
              disabled={!meta}
              checked={circuitPanelOpen}
              onChange={(next) => setCircuitPanelOpen(next)}
            />
          </div>
          {!gridHybrid ? (
            <ToolbarSegmentedControl
              className="toolbar-segment--large"
              ariaLabel="Adjust mode"
              disabled={!meta}
              value={autoAdjustEnabled ? "auto" : "manual"}
              onChange={(next) => {
                const wantManual = next === "manual";
                if (wantManual !== !autoAdjustEnabled) {
                  toggleManualAdjust();
                }
              }}
              options={[
                {
                  value: "auto",
                  label: "Auto adjust",
                  icon: <AutoIcon />,
                },
                {
                  value: "manual",
                  label: "Manual adjust",
                  icon: <ManualIcon />,
                },
              ]}
            />
          ) : null}
          {meta ? (
            <ToolbarActionButton
              label="Unlock all / reset layout"
              icon={<ResetIcon />}
              onClick={resetToAutoLayout}
            />
          ) : null}
          {meta && manualAdjustEngine.selection.connectionIds.size > 0 ? (
            <ToolbarActionButton
              label="Unlock selection"
              icon={<ResetIcon />}
              onClick={unlockSelectedAdjustments}
            />
          ) : null}
          {meta && showLayoutModeToggle() ? (
            <ToolbarSegmentedControl
              className="toolbar-segment--large"
              ariaLabel="Layout mode"
              disabled={!meta}
              value={layoutMode}
              onChange={(next) => setLayoutMode(next as LayoutMode)}
              options={[
                {
                  value: "horizontal",
                  label: "Left / right layout",
                  icon: <HorizontalLayoutIcon />,
                },
                {
                  value: "quad",
                  label: "4-side layout",
                  icon: <QuadLayoutIcon />,
                },
              ]}
            />
          ) : null}
          {!autoAdjustEnabled && meta && !gridHybrid ? (
            <ToolbarActionButton
              label="Reset to auto layout"
              icon={<ResetIcon />}
              onClick={resetToAutoLayout}
            />
          ) : null}
        </div>
        <div className="workflow-canvas__toolbar-center">
          <span className="workflow-canvas__hint">
            {autoAdjustEnabled
              ? "Drag cables freely; tube/fiber edits lock in place."
              : "Manual: tube tips ↕, stem ↔, fiber anchors ↕, legs ↔; shift+click or marquee for groups"}
          </span>
          {configErrorBanner ? (
            <span className="workflow-canvas__manual-warning" role="alert">
              {configErrorBanner}
            </span>
          ) : null}
          {manualWarningBanner ? (
            <span className="workflow-canvas__manual-warning" role="status">
              {manualWarningBanner}
            </span>
          ) : null}
          {meta ? <span className="workflow-canvas__meta">{meta}</span> : null}
        </div>
        <div className="workflow-canvas__toolbar-export">
          <MapEmbedButton
            disabled={!meta}
            location={mapHeader?.location}
            spliceLabel={mapHeader?.spliceLabel}
            icon={<MapIcon />}
          />
          <ToolbarActionButton
            label="View connection report"
            icon={<ReportIcon />}
            pressed={reportOpen}
            disabled={!meta}
            onClick={() => setReportOpen(true)}
          />
          <ToolbarActionButton
            label="Open connection inspector"
            icon={<InspectIcon />}
            pressed={inspectorOpen}
            disabled={!meta}
            onClick={() => setInspectorOpen(true)}
          />
          <ToolbarActionButton
            label="Export diagram config"
            icon={<ExportConfigIcon />}
            disabled={!meta}
            onClick={exportDiagramConfig}
          />
          <ToolbarActionButton
            label="Print diagram"
            icon={<PrintIcon />}
            disabled={!meta}
            onClick={printDiagram}
          />
          <ToolbarActionButton
            label="Help and guide"
            icon={<HelpIcon />}
            pressed={helpOpen}
            onClick={() => setHelpOpen(true)}
          />
        </div>
      </div>
      <div className="workflow-canvas__body">
        <CircuitHighlightProvider
          key={reportKeyRef.current ?? "empty"}
          circuitIndex={circuitIndex}
        >
          <div
            className="workflow-canvas__stage"
            ref={stageRef}
            onDragOver={handleStageDragOver}
            onDrop={handleStageDrop}
          >
            <ManualLayoutGuideOverlay guides={activeGuides} />
            {layoutSearchProgress ? (
              <LayoutSearchOverlay
                progress={layoutSearchProgress}
                onCancel={() => {
                  layoutSearchCancelRef.current = true;
                }}
              />
            ) : null}
            <CalloutPersistContext.Provider
              value={{ onTextChange: handleCalloutTextChange }}
            >
            <CalloutScaleProvider value={calloutScaleContextValue}>
            <TitlePersistContext.Provider
              value={{ onFieldChange: handleTitleFieldChange }}
            >
              <ManualLayoutProvider value={manualLayoutContextValue}>
              <ExistingToggleProvider value={existingToggleValue}>
              <CanvasContextMenuProvider value={contextMenuValue}>
              <ReactFlow
                className={
                  !autoAdjustEnabled ? "workflow-canvas--manual-adjust" : undefined
                }
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onNodeContextMenu={onNodeContextMenu}
                onEdgesChange={onEdgesChange}
                nodeTypes={spliceNodeTypes}
                edgeTypes={spliceEdgeTypes}
                minZoom={0.05}
                maxZoom={2}
                nodesDraggable
                elementsSelectable
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={16} />
                <Controls />
                <CalloutLeaderLayer />
                <ManualAdjustOverlay
                  enabled={!autoAdjustEnabled}
                  fusionDotsVisible={gridHybrid}
                  lockedFusionDots={lockedFusionDots}
                  onFusionDotContextMenu={(connectionId, clientX, clientY) =>
                    openContextMenu(
                      { kind: "fusionDot", connectionId },
                      clientX,
                      clientY,
                    )
                  }
                  legSegmentDragActive={manualAdjustEngine.legSegmentDragActive}
                  nodes={nodes}
                  edges={edges}
                  graph={graphRef.current}
                  selection={manualAdjustEngine.selection}
                  onMarqueeComplete={manualAdjustEngine.onMarqueeComplete}
                  onClearSelection={manualAdjustEngine.onClearSelection}
                  onSegmentDoubleClick={manualAdjustEngine.onSegmentDoubleClick}
                  onSegmentPointerDown={manualAdjustEngine.onSegmentPointerDown}
                  onSegmentPointerMove={manualAdjustEngine.onSegmentPointerMove}
                  onSegmentPointerUp={manualAdjustEngine.onSegmentPointerUp}
                  onDotPointerDown={manualAdjustEngine.onDotPointerDown}
                  beginLongPress={existingLongPress.beginLongPress}
                />
              </ReactFlow>
              </CanvasContextMenuProvider>
              </ExistingToggleProvider>
              </ManualLayoutProvider>
            </TitlePersistContext.Provider>
            </CalloutScaleProvider>
            </CalloutPersistContext.Provider>
          </div>
          {circuitPanelOpen && meta ? (
            <CircuitListPanel circuitIndex={circuitIndex} />
          ) : null}
        </CircuitHighlightProvider>
      </div>
      <SpliceReportOverlay
        open={reportOpen}
        text={reportText}
        onClose={() => setReportOpen(false)}
      />
      <ConnectionInspectorOverlay
        open={inspectorOpen}
        model={inspectorModel}
        onClose={() => setInspectorOpen(false)}
      />
      <HelpGuideOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
      <CanvasContextMenu
        state={contextMenu}
        onClose={() => setContextMenu(null)}
      />
    </div>
  );
}

export function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <WorkflowCanvasInner />
    </ReactFlowProvider>
  );
}
