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
import { HelpGuideOverlay } from "@/components/help/HelpGuideOverlay";
import { SpliceReportOverlay } from "@/components/SpliceReportOverlay";
import { CALLOUT_BOX, defaultCalloutPosition } from "@/features/canvas/callouts/cableCalloutGeometry";
import { CalloutLeaderLayer } from "@/features/canvas/callouts/CalloutLeaderLayer";
import { CalloutPersistContext } from "@/features/canvas/callouts/CalloutPersistContext";
import {
  calloutIdForCable,
  fibersFromCableTubes,
  formatCableCalloutText,
} from "@/features/canvas/callouts/formatCableCalloutText";
import { mergeCalloutNodes } from "@/features/canvas/callouts/mergeCalloutNodes";
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
import {
  calloutsShouldShow,
  existingIdsFromEdges,
  loadLayoutOverrides,
  mergeLayoutOverrides,
  positionsFromNodes,
  saveLayoutOverrides,
} from "@/features/canvas/layoutStorage";
import type { CableCalloutNodeData, CableNodeData } from "@/features/canvas/nodes/types";
import {
  displaySideFromCanvasX,
  visualCableIdFromNodeId,
} from "@/features/diagram/cableDisplaySide";
import { spliceNodeTypes } from "@/features/canvas/nodeTypes";
import {
  CABLE_LAYOUT,
  resolveCableDragStopX,
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
import { DiagramConfigImportButton } from "@/features/export/DiagramConfigImportButton";
import {
  DiagramConfigParseError,
  looksLikeDiagramConfigText,
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
import { useManualAdjustEngine } from "@/features/manualAdjust/useManualAdjustEngine";
import { spliceEdgeIdsForTubeKey } from "@/features/diagram/snapGuides";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { syncNodesEngineDragLayout } from "@/features/diagram/syncNodesEngineDragLayout";
import { detectFullButtSpliceTubes } from "@/features/diagram/fullButtSplice";
import {
  boundsFromFlowNodes,
  viewportAtUnitZoomFocused,
  viewportForFitWidth,
} from "@/features/canvas/diagramViewport";
import {
  importLayoutWidthForGraph,
  reportStorageKey,
  resolveLayoutWidthForStage,
  stageLayoutWidthForGraph,
} from "@/features/diagram/layoutSpliceDiagram";
import { estimatedCableNodeWidth } from "@/features/diagram/spliceRowLayout";
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
  PrintPdfIcon,
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
import type {
  ConnectionGraph,
  LayoutCalloutRecord,
  LayoutMode,
  LayoutOverrides,
  TubeColorCode,
  TubeManualOverride,
  TubeOverrideKey,
} from "@/types/splice";

const emptyNodes: Node[] = [];
const emptyEdges: Edge[] = [];

const FIT_WIDTH_OPTIONS = {
  paddingRatio: 0.08,
  maxZoom: 1,
  minZoom: 0.05,
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

function attachStoredCallouts(
  nodes: Node[],
  reportKey: string,
  savedPositions?: Record<string, { x: number; y: number }>,
): Node[] {
  const overrides = loadLayoutOverrides(reportKey);
  const withoutCallouts = nodes.filter((n) => n.type !== "cableCallout");
  if (!calloutsShouldShow(overrides)) {
    return withoutCallouts;
  }
  const positions = { ...overrides?.positions, ...savedPositions };
  return mergeCalloutNodes(withoutCallouts, overrides?.callouts, positions);
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
  const { getNodesBounds, setViewport, getNodes, getEdges, getViewport } =
    useReactFlow();
  const nodesInitialized = useNodesInitialized();
  const updateNodeInternals = useUpdateNodeInternals();
  const fitViewRequestRef = useRef(0);
  const fitViewHandledRef = useRef(0);
  const fitViewUnitZoomRef = useRef(false);
  /** Set when the user drags a cable column outward beyond the viewport fill. */
  const userExpandedLayoutRef = useRef(false);
  const [nodes, setNodes, onNodesChange] = useNodesState(emptyNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(emptyEdges);
  const reportKeyRef = useRef<string | null>(null);
  const graphRef = useRef<ConnectionGraph | null>(null);
  const layoutWidthRef = useRef<number>(CABLE_LAYOUT.width);
  const xBoundsRef = useRef<CableXBounds>({
    leftX: CABLE_LAYOUT.leftX,
    rightX: CABLE_LAYOUT.rightX,
  });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const stageWidthRef = useRef(0);
  const collapseRef = useRef(false);
  const calloutsVisibleRef = useRef(false);
  const layoutModeRef = useRef<LayoutMode>("horizontal");
  const applyGraphRef = useRef<
    (
      graph: ConnectionGraph,
      reportKey: string,
      collapse: boolean,
      options?: {
        fitView?: boolean;
        fitAtUnitZoom?: boolean;
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
  const [activeGuides, setActiveGuides] = useState<ManualLayoutGuideLine[]>(
    [],
  );
  const [tubePreview, setTubePreviewState] = useState<
    Map<TubeOverrideKey, TubeManualOverride>
  >(() => new Map());
  const tubePreviewRepinRafRef = useRef<number | null>(null);
  const autoAdjustRef = useRef(true);
  const manualCableDragRafRef = useRef<number | null>(null);
  const pendingManualCableNodeRef = useRef<Node | null>(null);

  collapseRef.current = collapseFullButtSplices;
  calloutsVisibleRef.current = calloutsVisible;
  autoAdjustRef.current = autoAdjustEnabled;
  layoutModeRef.current = layoutMode;

  useEffect(() => {
    if (autoAdjustEnabled || tubePreview.size === 0) return;
    const graph = graphRef.current;
    if (!graph) return;

    const nodes = getNodes().filter((n) => n.type !== "cableCallout");
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

  const syncNodesEngineDrag = useCallback(
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
        },
        layoutWidth: layoutWidthRef.current,
        positions,
        draggedNode,
        preservedNodes: getNodes().filter((n) => n.type === "cableCallout"),
      });

      setNodes(nextNodes);
      setEdges(nextEdges);
    },
    [getNodes, setEdges, setNodes],
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
        { dragSync: true },
      );
      const callouts = getNodes().filter((n) => n.type === "cableCallout");
      setNodes([...nextNodes, ...callouts]);
      setEdges(nextEdges);
    },
    [getNodes, setEdges, setNodes],
  );

  const refreshDragRouting = useCallback(
    (draggedNode: Node) => {
      // Additive quad guard — early-return before any binary L/R drag handling.
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
    [syncManualCableDrag, syncNodesEngineDrag, syncQuadCableDrag],
  );

  const stageWidthForLayout = useCallback((): number => {
    return stageRef.current?.clientWidth ?? stageWidthRef.current ?? 0;
  }, []);

  const resolveLayoutWidth = useCallback(
    (graph: ConnectionGraph, preserveUserExpansion = true): number => {
      const stageWidth = stageWidthForLayout();
      if (stageWidth <= 0) {
        return importLayoutWidthForGraph(graph);
      }
      const viewportWidth = importLayoutWidthForGraph(graph, { stageWidth });
      if (
        preserveUserExpansion &&
        layoutWidthRef.current > viewportWidth + 1
      ) {
        return layoutWidthRef.current;
      }
      return viewportWidth;
    },
    [stageWidthForLayout],
  );

  useEffect(() => {
    const requestId = fitViewRequestRef.current;
    if (requestId === 0 || requestId === fitViewHandledRef.current) return;
    if (!nodesInitialized || nodes.length === 0) return;

    const stage = stageRef.current;
    if (!stage) return;

    const bounds =
      getNodesBounds(nodes) ?? boundsFromFlowNodes(nodes);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;

    fitViewHandledRef.current = requestId;
    const stageWidth = stage.clientWidth;
    const stageHeight = stage.clientHeight;
    const unitZoom = fitViewUnitZoomRef.current;
    const viewport = unitZoom
      ? viewportAtUnitZoomFocused(
          bounds,
          stageWidth,
          stageHeight,
          layoutWidthRef.current / 2,
        )
      : viewportForFitWidth(
          bounds,
          stageWidth,
          stageHeight,
          FIT_WIDTH_OPTIONS,
        );

    void setViewport(viewport, { duration: 200 });
  }, [nodesInitialized, nodes, getNodesBounds, setViewport]);

  type ApplyGraphOptions = {
    fitView?: boolean;
    cableSidesPatch?: Record<string, "left" | "right">;
    layoutWidth?: number;
    refreshLayout?: boolean;
    refreshColumnX?: boolean;
    refreshRowLayout?: boolean;
    /** Size layout to stage inner width and show at zoom 1 (import default). */
    fitAtUnitZoom?: boolean;
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
          calloutsVisible: calloutsVisibleRef.current,
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
      });
      const stageWidth = stageWidthForLayout();
      const viewportLayoutWidth =
        stageWidth > 0
          ? options?.fitAtUnitZoom
            ? stageLayoutWidthForGraph(graph, stageWidth, {
                userExpandedLayoutWidth: userExpandedLayoutRef.current
                  ? layoutWidthRef.current
                  : undefined,
              })
            : resolveLayoutWidthForStage(
                graph,
                stageWidth,
                existing?.layoutWidth,
              )
          : undefined;
      let layoutWidthArg =
        options?.layoutWidth ??
        (options?.refreshColumnX && viewportLayoutWidth !== undefined
          ? viewportLayoutWidth
          : undefined) ??
        existing?.layoutWidth ??
        layoutWidthRef.current;

      let layoutExpansion: LayoutExpansion = DEFAULT_LAYOUT_EXPANSION;
      if (
        options?.fitAtUnitZoom &&
        options?.layoutWidth === undefined &&
        !options?.refreshRowLayout
      ) {
        const resolved = resolveFeasibleImportLayout(graph, {
          stageWidth: stageWidth > 0 ? stageWidth : undefined,
          layoutWidth:
            viewportLayoutWidth ??
            (stageWidth > 0
              ? importLayoutWidthForGraph(graph, { stageWidth })
              : undefined),
          collapseFullButtSplices: collapse,
        });
        layoutWidthArg = resolved.layoutWidth;
        layoutExpansion = resolved.expansion;
      }

      layoutWidthRef.current = layoutWidthArg;

      const savedPositions =
        options?.refreshLayout ?? false ? {} : existing?.positions ?? {};

      const { nodes: nextNodes, edges: nextEdges, layout, xBounds, autoLayoutY } =
        runWithLayoutExpansion(layoutExpansion, () =>
          buildReactFlowGraph(
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
            },
            layoutWidthArg,
            {
              refreshColumnX: options?.refreshColumnX,
              refreshRowLayout: options?.refreshRowLayout,
              skipFeasibility: true,
              skipTubeAutoAlign: overrides.autoAdjustEnabled === false,
            },
          ),
        );
      xBoundsRef.current = xBounds;
      const merged = attachStoredCallouts(nextNodes, reportKey, savedPositions);
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
          }),
        );
      }
      if (options?.fitView) {
        fitViewUnitZoomRef.current = options.fitAtUnitZoom === true;
        fitViewRequestRef.current += 1;
      }
      requestAnimationFrame(() => {
        for (const node of nextNodes) {
          if (node.type === "cable") updateNodeInternals(node.id);
        }
      });
      void layout;
    },
    [setNodes, setEdges, updateNodeInternals, stageWidthForLayout],
  );

  applyGraphRef.current = applyGraph;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;

    let raf = 0;
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      if (width <= 0) return;

      const prevStageWidth = stageWidthRef.current;
      stageWidthRef.current = width;
      if (Math.abs(width - prevStageWidth) < STAGE_WIDTH_DELTA_PX) return;

      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey) return;
      if (!autoAdjustRef.current) return;

      const nextWidth = stageLayoutWidthForGraph(graph, width, {
        userExpandedLayoutWidth: userExpandedLayoutRef.current
          ? layoutWidthRef.current
          : undefined,
      });
      if (Math.abs(nextWidth - layoutWidthRef.current) < 1) return;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        applyGraphRef.current(graph, reportKey, collapseRef.current, {
          layoutWidth: nextWidth,
          refreshColumnX: true,
          fitView: true,
          fitAtUnitZoom: true,
        });
      });
    });

    observer.observe(stage);
    stageWidthRef.current = Math.round(stage.clientWidth);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, []);

  /** Correct layout when import ran before the stage had width, or stale saved width. */
  useEffect(() => {
    if (!nodesInitialized) return;
    const graph = graphRef.current;
    const reportKey = reportKeyRef.current;
    if (!graph || !reportKey) return;

    const stageWidth = stageRef.current?.clientWidth ?? stageWidthRef.current;
    if (stageWidth <= 0) return;

    const target = stageLayoutWidthForGraph(graph, stageWidth, {
      userExpandedLayoutWidth: userExpandedLayoutRef.current
        ? layoutWidthRef.current
        : undefined,
    });
    if (Math.abs(target - layoutWidthRef.current) < STAGE_WIDTH_DELTA_PX) return;
    if (!autoAdjustRef.current) return;

    applyGraphRef.current(graph, reportKey, collapseRef.current, {
      layoutWidth: target,
      refreshColumnX: true,
      refreshRowLayout: true,
      fitView: true,
      fitAtUnitZoom: true,
    });
  }, [nodesInitialized]);

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
      },
    ) => {
      reportKeyRef.current = reportKey;
      graphRef.current = graph;
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
      setAutoAdjustEnabled(saved?.autoAdjustEnabled !== false);
      setLegOverridesState(saved?.legOverrides);
      const initialLayoutMode = saved?.layoutMode ?? "horizontal";
      layoutModeRef.current = initialLayoutMode;
      setLayoutModeState(initialLayoutMode);
      setManualWarningBanner(null);
      setConfigErrorBanner(null);
      userExpandedLayoutRef.current = Boolean(
        options.useSavedLayoutWidth &&
          saved?.layoutWidth &&
          saved.layoutWidth > CABLE_LAYOUT.width + 1,
      );

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
        const stageDefaultWidth =
          stageWidth > 0
            ? stageLayoutWidthForGraph(graph, stageWidth)
            : CABLE_LAYOUT.width;
        const layoutWidth =
          options.useSavedLayoutWidth && saved?.layoutWidth
            ? saved.layoutWidth
            : stageDefaultWidth;

        applyGraph(graph, reportKey, collapsed, {
          fitView: options.viewport === undefined,
          fitAtUnitZoom: options.viewport === undefined,
          layoutWidth,
          refreshLayout: options.refreshLayout ?? false,
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
      importWhenStageReady();
    },
    [applyGraph, setViewport],
  );

  const loadFromCsv = useCallback(
    (text: string, fileName: string) => {
      const report = parseBentleyCsv(text);
      const graph = buildConnectionGraph(report);
      const reportKey = reportStorageKey(graph);
      const title =
        report.header.spliceNumber ?? report.header.name ?? fileName;
      activateDiagram(graph, reportKey, {
        sourceLabel: title,
        refreshLayout: true,
        useSavedLayoutWidth: false,
      });
    },
    [activateDiagram],
  );

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
    autoAdjustEnabled,
    legOverridesState,
    getViewport,
  ]);

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
        if (looksLikeDiagramConfigText(text)) {
          loadFromConfig(text);
          return;
        }
        if (file.name.toLowerCase().endsWith(".csv")) {
          if (!confirmReplaceDiagram()) return;
          loadFromCsv(text, file.name);
        }
      });
    },
    [confirmReplaceDiagram, loadFromConfig, loadFromCsv],
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
      const engine = current
        .filter((n) => n.type !== "cableCallout")
        .map((n) => {
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
      const mergedNodes = attachStoredCallouts(
        [...synced, ...callouts],
        reportKey,
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
      saveLayoutOverrides(
        mergeLayoutOverrides(reportKey, {
          positions: positionsFromNodes(mergedNodes),
          existingEdgeIds: existingIdsFromEdges(finalEdges),
          collapseFullButtSplices: collapseRef.current,
          layoutWidth: layoutWidthRef.current,
          cableSides: existing?.cableSides,
          callouts: existing?.callouts,
          autoAdjustEnabled: false,
          tubeOverrides,
          fanoutOverrides,
          legOverrides: existing?.legOverrides,
        }),
      );
      updateManualWarnings(
        graph,
        mergedNodes,
        finalEdges,
        spliceEdgeIdsForTubeKey(graph, tubeKey),
      );
      requestAnimationFrame(() => {
        for (const node of mergedNodes) {
          if (node.type === "cable") updateNodeInternals(node.id);
        }
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

      // Segment-drag preview already committed the edge paths; here we only
      // re-pin splice-point nodes, persist, and refresh warnings. Read live
      // state via getEdges/getNodes instead of nesting setState in an updater.
      const currentEdges = getEdges();
      const syncedNodes = syncSplicePointNodes(
        getNodes(),
        currentEdges,
        connectionIds,
      );
      setNodes(syncedNodes);
      setLegOverridesState(legOverrides);
      saveLayoutOverrides(
        mergeLayoutOverrides(reportKey, {
          positions: positionsFromNodes(
            syncedNodes.filter((n) => n.type === "cable"),
          ),
          existingEdgeIds: existingIdsFromEdges(currentEdges),
          collapseFullButtSplices: collapseRef.current,
          layoutWidth: layoutWidthRef.current,
          cableSides: existing?.cableSides,
          callouts: existing?.callouts,
          autoAdjustEnabled: false,
          tubeOverrides: existing?.tubeOverrides,
          fanoutOverrides: existing?.fanoutOverrides,
          legOverrides,
        }),
      );
      updateManualWarnings(
        graph,
        syncedNodes,
        currentEdges,
        new Set(connectionIds.map((id) => `splice-${id}`)),
      );
    },
    [getEdges, getNodes, setNodes, updateManualWarnings],
  );

  const manualAdjustEngine = useManualAdjustEngine({
    enabled: !autoAdjustEnabled,
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

  const printDiagram = usePrintDiagram(nodes, graphRef.current, stageRef);

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
        fitAtUnitZoom: true,
      });
    },
    [applyGraph, resolveLayoutWidth],
  );

  const resetToAutoLayout = useCallback(() => {
    const graph = graphRef.current;
    const reportKey = reportKeyRef.current;
    if (!graph || !reportKey) return;
    setAutoAdjustEnabled(true);
    setManualWarningBanner(null);
    setActiveGuides([]);
    setLegOverridesState({});
    saveLayoutOverrides(
      mergeLayoutOverrides(reportKey, {
        autoAdjustEnabled: true,
        tubeOverrides: {},
        fanoutOverrides: {},
        legOverrides: {},
      }),
    );
    const width = resolveLayoutWidth(graph, false);
    applyGraph(graph, reportKey, collapseRef.current, {
      layoutWidth: width,
      refreshLayout: true,
      refreshColumnX: true,
      refreshRowLayout: true,
      fitView: true,
      fitAtUnitZoom: true,
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
      if (layoutModeRef.current === "quad") {
        if (node.type === "cable") refreshDragRouting(node);
        return;
      }
      if (!autoAdjustRef.current && node.type === "fiberAnchor") {
        manualAdjustEngine.onNodeDrag(_, node, nodes);
        return;
      }
      if (node.type !== "cable") return;
      refreshDragRouting(node);
    },
    [manualAdjustEngine, refreshDragRouting, nodes],
  );

  const onNodeDragStop: OnNodeDrag<Node> = useCallback(
    (_, node) => {
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
        } else {
          persistLayout(nodes, edges);
        }
        return;
      }
      if (!autoAdjustRef.current && node.type === "fiberAnchor") {
        manualAdjustEngine.onNodeDragStop(_, node, nodes);
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

      const centerX = layoutWidthRef.current / 2;
      const newSide = displaySideFromCanvasX(node.position.x, centerX);
      const prevSide = (node.data as CableNodeData).side;
      const sideChanged = newSide !== prevSide;
      const graph = graphRef.current;
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

      const stageWidth = stageRef.current?.clientWidth ?? stageWidthRef.current;
      if (graph && stageWidth > 0) {
        const viewportFill = importLayoutWidthForGraph(graph, { stageWidth });
        if (layoutWidth > viewportFill + STAGE_WIDTH_DELTA_PX) {
          userExpandedLayoutRef.current = true;
        }
      } else if (layoutWidth > prevLayoutWidth + STAGE_WIDTH_DELTA_PX) {
        userExpandedLayoutRef.current = true;
      }

      const finalX = resolveCableDragStopX(node.position.x, newSide, bounds);
      const finalY = node.position.y;

      if (graph && reportKeyRef.current) {
        const existing = loadLayoutOverrides(reportKeyRef.current);
        const requestedCableSides = {
          ...(existing?.cableSides ?? {}),
          [visualId]: newSide,
        };
        const manualMode = !autoAdjustRef.current;
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
              legOverrides: existing?.legOverrides,
            },
            layoutWidth,
            { skipTubeAutoAlign: true },
          ));
          const callouts = getNodes().filter((n) => n.type === "cableCallout");
          nextNodes = [...nextNodes, ...callouts];
        } else if (manualMode) {
          const callouts = getNodes().filter((n) => n.type === "cableCallout");
          const engine = getNodes().filter((n) => n.type !== "cableCallout");
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
                legOverrides: existing?.legOverrides,
              },
              layoutWidth,
            ));
        }

        const merged = attachStoredCallouts(
          nextNodes,
          reportKeyRef.current,
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
        saveLayoutOverrides(
          mergeLayoutOverrides(reportKeyRef.current, {
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
            legOverrides: existing?.legOverrides,
          }),
        );
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
    },
    [
      edges,
      manualAdjustEngine,
      nodes,
      persistLayout,
      refreshDragRouting,
      setNodes,
      updateManualWarnings,
      updateNodeInternals,
    ],
  );

  const onNodeDrag: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      if (layoutModeRef.current === "quad") {
        if (node.type === "cable") refreshDragRouting(node);
        return;
      }
      if (!autoAdjustRef.current && node.type === "fiberAnchor") {
        manualAdjustEngine.onNodeDrag(_, node, nodes);
        return;
      }
      if (node.type !== "cable") return;
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

  const setTubePreview = useCallback(
    (tubeKey: TubeOverrideKey, patch: TubeManualOverride | null) => {
      setTubePreviewState((prev) => {
        const next = new Map(prev);
        if (patch === null) {
          next.delete(tubeKey);
        } else {
          next.set(tubeKey, patch);
        }
        return next;
      });
    },
    [],
  );

  const snapTipTargets = useMemo(() => [], []);

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

  return (
    <div className="workflow-canvas">
      <div className="workflow-canvas__toolbar">
        <div className="workflow-canvas__toolbar-left">
          <CsvImportButton onImport={loadFromCsv} active={!!meta} />
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
            <ToolbarPillToggle
              label="Callouts"
              ariaLabel="Show cable callouts when on, hide when off"
              disabled={!meta}
              checked={calloutsVisible}
              onChange={(next) => setCableCalloutsVisible(next)}
            />
            <ToolbarPillToggle
              label="Circuits"
              ariaLabel="Show circuit panel when on, hide when off"
              disabled={!meta}
              checked={circuitPanelOpen}
              onChange={(next) => setCircuitPanelOpen(next)}
            />
          </div>
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
          {!autoAdjustEnabled && meta ? (
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
              ? "Drag cables to reposition; click edge for protect-in-place"
              : "Manual mode: tube tips ↕; collapsed tube center legs ↔ like fiber legs; shift+click handles; box-select"}
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
          <DiagramConfigImportButton onImport={loadFromConfig} />
          <ToolbarActionButton
            label="Print to PDF"
            icon={<PrintPdfIcon />}
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
            <CalloutPersistContext.Provider
              value={{ onTextChange: handleCalloutTextChange }}
            >
              <ManualLayoutProvider value={manualLayoutContextValue}>
              <ExistingToggleProvider value={existingToggleValue}>
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
              </ExistingToggleProvider>
              </ManualLayoutProvider>
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
