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

import { SpliceReportOverlay } from "@/components/SpliceReportOverlay";
import { defaultCalloutPosition } from "@/features/canvas/callouts/cableCalloutGeometry";
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
import {
  ManualLayoutProvider,
  type ManualLayoutGuideLine,
} from "@/features/canvas/ManualLayoutContext";
import { ManualLayoutGuideOverlay } from "@/features/canvas/ManualLayoutGuideOverlay";
import { spliceEdgeTypes } from "@/features/canvas/edgeTypes";
import {
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
  assignSpliceRoutingLanesFromLiveHandles,
  buildSpliceHandleEntries,
  publishDragRoutingSnapshot,
  routingLaneDataFromLane,
  setActiveDragCableNodeId,
} from "@/features/canvas/edges/spliceEdgeRouting";
import { useNodesRoutingEngine } from "@/features/diagram/routingEngine";
import {
  CABLE_LAYOUT,
  resolveCableDragStopX,
  type CableXBounds,
} from "@/features/diagram/cableLayoutMetrics";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { formatSpliceConnectionReport } from "@/features/report/formatSpliceConnectionReport";
import {
  DEFAULT_LAYOUT_EXPANSION,
  runWithLayoutExpansion,
  type LayoutExpansion,
} from "@/features/diagram/layoutExpansion";
import { resolveFeasibleImportLayout } from "@/features/diagram/layoutRules";
import { computeSpliceEdgeLayout } from "@/features/diagram/computeSpliceLayout";
import {
  formatManualLayoutWarningBanner,
  manualLayoutWarningsForEdges,
} from "@/features/diagram/manualLayoutWarnings";
import { ManualAdjustOverlay } from "@/features/manualAdjust/ManualAdjustOverlay";
import { syncSplicePointNodes } from "@/features/manualAdjust/syncSplicePointNodes";
import { useManualAdjustEngine } from "@/features/manualAdjust/useManualAdjustEngine";
import {
  collectGlobalTubeTipSnapTargets,
  spliceEdgeIdsForTubeKey,
} from "@/features/diagram/snapGuides";
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
import {
  AutoIcon,
  CalloutIcon,
  CollapseIcon,
  ExpandIcon,
  EyeIcon,
  EyeOffIcon,
  ManualIcon,
  ReportIcon,
  ResetIcon,
} from "@/components/toolbar/ToolbarIcon";
import {
  ToolbarActionButton,
  ToolbarSegmentedControl,
} from "@/components/toolbar/ToolbarSegmentedControl";
import { CsvImportButton } from "@/features/import/CsvImportButton";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type {
  ConnectionGraph,
  LayoutCalloutRecord,
  LayoutOverrides,
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

function attachStoredCallouts(
  nodes: Node[],
  reportKey: string,
  savedPositions?: Record<string, { x: number; y: number }>,
): Node[] {
  const overrides = loadLayoutOverrides(reportKey);
  const positions = { ...overrides?.positions, ...savedPositions };
  return mergeCalloutNodes(nodes, overrides?.callouts, positions);
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
  const { getNodesBounds, setViewport, getNodes, getEdges } = useReactFlow();
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
  const [collapseFullButtSplices, setCollapseFullButtSplices] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [circuitPanelOpen, setCircuitPanelOpen] = useState(false);
  const [circuitIndex, setCircuitIndex] = useState<CircuitIndex | null>(null);
  const [autoAdjustEnabled, setAutoAdjustEnabled] = useState(true);
  const [manualWarningBanner, setManualWarningBanner] = useState<string | null>(
    null,
  );
  const [activeGuides, setActiveGuides] = useState<ManualLayoutGuideLine[]>(
    [],
  );
  const [tubePreview, setTubePreviewState] = useState<
    Map<TubeOverrideKey, TubeManualOverride>
  >(() => new Map());
  const autoAdjustRef = useRef(true);

  collapseRef.current = collapseFullButtSplices;
  autoAdjustRef.current = autoAdjustEnabled;

  const syncNodesEngineDrag = useCallback(
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

  const refreshDragRouting = useCallback(
    (draggedNode: Node) => {
      if (!autoAdjustRef.current) {
        setNodes((current) =>
          current.map((n) => (n.id === draggedNode.id ? draggedNode : n)),
        );
        return;
      }
      if (useNodesRoutingEngine()) {
        syncNodesEngineDrag(draggedNode);
        return;
      }
      const graph = graphRef.current;
      if (!graph || draggedNode.type !== "cable") return;
      const allNodes = getNodes().map((n) =>
        n.id === draggedNode.id ? draggedNode : n,
      );
      const allEdges = getEdges();
      const { visualCables } = buildVisualCablesForLayout(graph);
      const handleEntries = buildSpliceHandleEntries(
        allNodes,
        allEdges,
        visualCables,
      );
      publishDragRoutingSnapshot(handleEntries, layoutWidthRef.current / 2);
    },
    [getEdges, getNodes, syncNodesEngineDrag, setNodes],
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

  const loadFromCsv = useCallback(
    (text: string, fileName: string) => {
      const report = parseBentleyCsv(text);
      const graph = buildConnectionGraph(report);
      const reportKey = reportStorageKey(graph);
      reportKeyRef.current = reportKey;
      graphRef.current = graph;
      setCircuitIndex(buildCircuitIndex(graph));
      const saved = loadLayoutOverrides(reportKey);
      const { visualCables } = buildVisualCablesForLayout(graph);
      const detected = detectFullButtSpliceTubes(graph, visualCables);
      const collapsed =
        saved?.collapseFullButtSplices ?? detected.length > 0;
      setCollapseFullButtSplices(collapsed);
      setAutoAdjustEnabled(saved?.autoAdjustEnabled !== false);
      setManualWarningBanner(null);
      userExpandedLayoutRef.current = false;

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
        const width =
          stageWidth > 0
            ? stageLayoutWidthForGraph(graph, stageWidth)
            : CABLE_LAYOUT.width;
        applyGraph(graph, reportKey, collapsed, {
          fitView: true,
          fitAtUnitZoom: true,
          layoutWidth: width,
          refreshLayout: true,
          refreshColumnX: true,
          refreshRowLayout: true,
        });
        const title =
          report.header.spliceNumber ?? report.header.name ?? fileName;
        setMeta(
          `${title} — ${report.pairs.length} pair(s), ${graph.connections.length} connection(s)`,
        );
      };
      importWhenStageReady();
    },
    [applyGraph, stageWidthForLayout],
  );

  /** Dev-only: `?fixture=example-2` auto-imports from `public/fixtures/`. */
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const fixture = new URLSearchParams(window.location.search).get("fixture");
    if (!fixture) return;
    let cancelled = false;
    fetch(`${import.meta.env.BASE_URL}fixtures/${fixture}.csv`)
      .then((r) => {
        if (!r.ok) throw new Error(`Fixture not found: ${fixture}`);
        return r.text();
      })
      .then((text) => {
        if (!cancelled) loadFromCsv(text, `${fixture}.csv`);
      })
      .catch((err) => console.warn("[fixture import]", err));
    return () => {
      cancelled = true;
    };
  }, [loadFromCsv]);

  const updateManualWarnings = useCallback(
    (
      graph: ConnectionGraph,
      nextNodes: Node[],
      nextEdges: Edge[],
      touchedEdgeIds: Set<string>,
    ) => {
      if (touchedEdgeIds.size === 0) {
        setManualWarningBanner(null);
        return;
      }
      const { visualCables } = buildVisualCablesForLayout(graph);
      const { handleEntries } = computeSpliceEdgeLayout(
        nextNodes,
        nextEdges,
        visualCables,
        layoutWidthRef.current / 2,
      );
      const warnings = manualLayoutWarningsForEdges(
        handleEntries,
        nextEdges,
        touchedEdgeIds,
        layoutWidthRef.current / 2,
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
      const { nodes: nextNodes, edges: nextEdges, autoLayoutY } =
        buildReactFlowGraph(
          graph,
          {
            reportKey,
            collapseFullButtSplices: collapseRef.current,
            positions,
            existingEdgeIds: existing?.existingEdgeIds,
            cableSides: existing?.cableSides,
            layoutWidth: layoutWidthRef.current,
            autoAdjustEnabled: false,
            tubeOverrides,
            fanoutOverrides,
            legOverrides: existing?.legOverrides,
          },
          layoutWidthRef.current,
          { skipTubeAutoAlign: true },
        );
      const mergedNodes = attachStoredCallouts(nextNodes, reportKey, positions);
      setNodes(mergedNodes);
      setEdges(nextEdges);
      saveLayoutOverrides(
        mergeLayoutOverrides(reportKey, {
          positions: positionsFromNodes(mergedNodes),
          autoLayoutY,
          existingEdgeIds: existingIdsFromEdges(nextEdges),
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
        nextEdges,
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

      setEdges((currentEdges) => {
        setNodes((currentNodes) =>
          syncSplicePointNodes(currentNodes, currentEdges, connectionIds),
        );
        saveLayoutOverrides(
          mergeLayoutOverrides(reportKey, {
            positions: positionsFromNodes(
              getNodes().filter((n) => n.type === "cable"),
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
          getNodes(),
          currentEdges,
          new Set(connectionIds.map((id) => `splice-${id}`)),
        );
        return currentEdges;
      });
    },
    [getNodes, setEdges, setNodes, updateManualWarnings],
  );

  const legOverridesForEngine = useMemo(() => {
    const key = reportKeyRef.current;
    if (!key) return undefined;
    return loadLayoutOverrides(key)?.legOverrides;
  }, [nodes, edges, meta]);

  const manualAdjustEngine = useManualAdjustEngine({
    enabled: !autoAdjustEnabled,
    nodes,
    edges,
    graph: graphRef.current,
    legOverrides: legOverridesForEngine,
    onLegOverridesCommit: handleLegOverridesCommit,
    setEdges,
    setNodes,
  });

  const toggleManualAdjust = useCallback(() => {
    const graph = graphRef.current;
    const reportKey = reportKeyRef.current;
    if (!graph || !reportKey) return;
    const existing = loadLayoutOverrides(reportKey);
    const next = !(existing?.autoAdjustEnabled !== false);
    setAutoAdjustEnabled(next);
    if (next) {
      setManualWarningBanner(null);
      setActiveGuides([]);
    }
    const positions = positionsFromNodes(
      getNodes().filter((n) => n.type === "cable"),
    );
    const { nodes: nextNodes, edges: nextEdges, autoLayoutY } =
      buildReactFlowGraph(
        graph,
        {
          reportKey,
          collapseFullButtSplices: collapseRef.current,
          positions,
          existingEdgeIds: existing?.existingEdgeIds,
          cableSides: existing?.cableSides,
          layoutWidth: layoutWidthRef.current,
          autoAdjustEnabled: next,
          tubeOverrides: existing?.tubeOverrides,
        },
        layoutWidthRef.current,
        next ? undefined : { skipTubeAutoAlign: true },
      );
    const merged = attachStoredCallouts(nextNodes, reportKey, positions);
    setNodes(merged);
    setEdges(nextEdges);
    saveLayoutOverrides(
      mergeLayoutOverrides(reportKey, {
        positions: positionsFromNodes(merged),
        autoLayoutY,
        existingEdgeIds: existingIdsFromEdges(nextEdges),
        collapseFullButtSplices: collapseRef.current,
        layoutWidth: layoutWidthRef.current,
        cableSides: existing?.cableSides,
        callouts: existing?.callouts,
        autoAdjustEnabled: next,
        tubeOverrides: existing?.tubeOverrides,
      }),
    );
  }, [getNodes, setEdges, setNodes]);

  const resetToAutoLayout = useCallback(() => {
    const graph = graphRef.current;
    const reportKey = reportKeyRef.current;
    if (!graph || !reportKey) return;
    setAutoAdjustEnabled(true);
    setManualWarningBanner(null);
    setActiveGuides([]);
    saveLayoutOverrides(
      mergeLayoutOverrides(reportKey, {
        autoAdjustEnabled: true,
        tubeOverrides: {},
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
      if (!autoAdjustRef.current && node.type === "fiberAnchor") {
        manualAdjustEngine.onNodeDrag(_, node, nodes);
        return;
      }
      if (node.type !== "cable") return;
      if (!useNodesRoutingEngine()) {
        setActiveDragCableNodeId(node.id);
      }
      refreshDragRouting(node);
    },
    [manualAdjustEngine, refreshDragRouting],
  );

  const onNodeDragStop: OnNodeDrag<Node> = useCallback(
    (_, node) => {
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
      const prevCenterX = layoutWidth / 2;
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

      if (useNodesRoutingEngine() && graph && reportKeyRef.current) {
        const existing = loadLayoutOverrides(reportKeyRef.current);
        const cableSides = {
          ...(existing?.cableSides ?? {}),
          ...(sideChanged ? { [visualId]: newSide } : {}),
        };
        const manualMode = !autoAdjustRef.current;
        const { nodes: nextNodes, edges: nextEdges, autoLayoutY } =
          buildReactFlowGraph(
            graph,
            {
              reportKey: reportKeyRef.current,
              collapseFullButtSplices: collapseRef.current,
              positions: {
                ...(existing?.positions ?? {}),
                [node.id]: { x: finalX, y: finalY },
              },
              existingEdgeIds: existing?.existingEdgeIds,
              cableSides,
              layoutWidth,
              autoAdjustEnabled: autoAdjustRef.current,
              tubeOverrides: existing?.tubeOverrides,
            },
            layoutWidth,
            manualMode ? { skipTubeAutoAlign: true } : undefined,
          );
        const merged = attachStoredCallouts(nextNodes, reportKeyRef.current, {
          ...(existing?.positions ?? {}),
          [node.id]: { x: finalX, y: finalY },
        });
        setNodes(merged);
        setEdges(nextEdges);
        saveLayoutOverrides(
          mergeLayoutOverrides(reportKeyRef.current, {
            positions: positionsFromNodes(merged),
            autoLayoutY,
            existingEdgeIds: existingIdsFromEdges(nextEdges),
            collapseFullButtSplices: collapseRef.current,
            layoutWidth,
            cableSides,
            callouts: existing?.callouts,
            autoAdjustEnabled: autoAdjustRef.current,
            tubeOverrides: existing?.tubeOverrides,
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
        return;
      }

      setNodes((current) => {
        const nextNodes = current.map((n) =>
          n.id === node.id
            ? {
                ...n,
                position: {
                  x: finalX,
                  y: finalY,
                },
                data: { ...(n.data as CableNodeData), side: newSide },
              }
            : n,
        );
        setEdges((currentEdges) => {
          const { visualCables } = graph
            ? buildVisualCablesForLayout(graph)
            : { visualCables: [] };
          const allHandleEntries = buildSpliceHandleEntries(
            nextNodes,
            currentEdges,
            visualCables,
          );
          const centerX = layoutWidth / 2;
          const centerChanged = Math.abs(centerX - prevCenterX) > 0.5;
          const { lanes: dragRouting, rowOffsets } =
            assignSpliceRoutingLanesFromLiveHandles(
              allHandleEntries,
              centerX,
            );
          const nextEdges = currentEdges.map((edge) => {
            const touchesDragged =
              edge.source === node.id || edge.target === node.id;
            if (!touchesDragged || edge.type !== "splice") {
              if (edge.type === "splice" && centerChanged) {
                return {
                  ...edge,
                  data: {
                    ...(edge.data as Record<string, unknown>),
                    diagramCenterX: centerX,
                  },
                };
              }
              return edge;
            }

            const rowOffset = rowOffsets.get(edge.id);
            const lane = dragRouting.get(edge.id);
            const data = edge.data as Record<string, unknown>;
            return {
              ...edge,
              data: {
                ...data,
                diagramCenterX: centerX,
                ...(rowOffset !== undefined ? { rowOffset } : {}),
                ...(lane ? routingLaneDataFromLane(lane) : {}),
              },
            };
          });
          persistLayout(
            nextNodes,
            nextEdges,
            {
              layoutWidth,
              ...(sideChanged ? { cableSides: { [visualId]: newSide } } : {}),
            },
          );
          setActiveDragCableNodeId(null);
          return nextEdges;
        });
        if (sideChanged) {
          requestAnimationFrame(() => updateNodeInternals(node.id));
        }
        return nextNodes;
      });
    },
    [
      edges,
      manualAdjustEngine,
      nodes,
      persistLayout,
      setNodes,
      updateManualWarnings,
      updateNodeInternals,
    ],
  );

  const onNodeDrag: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      if (!autoAdjustRef.current && node.type === "fiberAnchor") {
        manualAdjustEngine.onNodeDrag(_, node, nodes);
        return;
      }
      if (node.type !== "cable") return;
      refreshDragRouting(node);
      const centerX = layoutWidthRef.current / 2;
      const nextSide = displaySideFromCanvasX(node.position.x, centerX);
      const prevSide = (node.data as CableNodeData).side;
      if (prevSide === nextSide) return;
      setNodes((current) =>
        current.map((n) =>
          n.id === node.id
            ? {
                ...node,
                data: { ...(node.data as CableNodeData), side: nextSide },
              }
            : n,
        ),
      );
    },
    [manualAdjustEngine, refreshDragRouting, setNodes],
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

  const snapTipTargets = useMemo(() => {
    const graph = graphRef.current;
    if (!graph || autoAdjustEnabled) return [];
    const reportKey = reportKeyRef.current;
    const existing = reportKey
      ? loadLayoutOverrides(reportKey)
      : undefined;
    return collectGlobalTubeTipSnapTargets(
      graph,
      positionsFromNodes(nodes.filter((n) => n.type === "cable")),
      existing?.tubeOverrides,
    );
  }, [nodes, autoAdjustEnabled, meta]);

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
      existingIdsFromEdges(edges).map((id) =>
        id.startsWith("splice-") ? id.slice("splice-".length) : id,
      ),
    );
    return formatSpliceConnectionReport(graph, { existingConnectionIds });
  }, [reportOpen, edges]);

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
          width: 200,
          height: 52,
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
    setNodes(nextNodes);
    persistLayout(nextNodes, edges, { callouts });
  }, [edges, nodes, persistLayout, setNodes]);

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setEdges((current) => {
        const next = current.map((e) => {
          if (e.id !== edge.id) return e;
          const existing = Boolean(
            (e.data as { existing?: boolean } | undefined)?.existing,
          );
          return { ...e, data: { ...e.data, existing: !existing } };
        });
        persistLayout(nodes, next);
        return next;
      });
    },
    [nodes, persistLayout, setEdges],
  );

  return (
    <div className="workflow-canvas">
      <div className="workflow-canvas__toolbar">
        <CsvImportButton onImport={loadFromCsv} />
        <ToolbarSegmentedControl
          ariaLabel="Full butt splices"
          disabled={!meta}
          value={collapseFullButtSplices ? "collapsed" : "expanded"}
          onChange={(next) => {
            if ((next === "collapsed") !== collapseFullButtSplices) {
              toggleFullButtCollapse();
            }
          }}
          options={[
            {
              value: "collapsed",
              label: "Collapse full butt splices",
              icon: <CollapseIcon />,
            },
            {
              value: "expanded",
              label: "Expand full butt splices",
              icon: <ExpandIcon />,
            },
          ]}
        />
        <ToolbarActionButton
          label="View connection report"
          icon={<ReportIcon />}
          pressed={reportOpen}
          disabled={!meta}
          onClick={() => setReportOpen(true)}
        />
        <ToolbarActionButton
          label="Add cable callouts"
          icon={<CalloutIcon />}
          disabled={!meta}
          onClick={generateCableCallouts}
        />
        <ToolbarSegmentedControl
          ariaLabel="Track circuits"
          disabled={!meta}
          value={circuitPanelOpen ? "on" : "off"}
          onChange={(next) => setCircuitPanelOpen(next === "on")}
          options={[
            {
              value: "off",
              label: "Hide circuits",
              icon: <EyeOffIcon />,
            },
            {
              value: "on",
              label: "Track circuits",
              icon: <EyeIcon />,
            },
          ]}
        />
        <ToolbarSegmentedControl
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
        {!autoAdjustEnabled && meta ? (
          <ToolbarActionButton
            label="Reset to auto layout"
            icon={<ResetIcon />}
            onClick={resetToAutoLayout}
          />
        ) : null}
        <span className="workflow-canvas__hint">
          {autoAdjustEnabled
            ? "Drag cables to reposition; click edge for protect-in-place"
            : "Manual mode: drag fan-out tips vertically; drag center vertical legs ↔; shift+click handles; box-select on canvas"}
        </span>
        {manualWarningBanner ? (
          <span className="workflow-canvas__manual-warning" role="status">
            {manualWarningBanner}
          </span>
        ) : null}
        {meta ? <span className="workflow-canvas__meta">{meta}</span> : null}
      </div>
      <div className="workflow-canvas__body">
        <CircuitHighlightProvider
          key={reportKeyRef.current ?? "empty"}
          circuitIndex={circuitIndex}
        >
          <div className="workflow-canvas__stage" ref={stageRef}>
            <ManualLayoutGuideOverlay guides={activeGuides} />
            <CalloutPersistContext.Provider
              value={{ onTextChange: handleCalloutTextChange }}
            >
              <ManualLayoutProvider value={manualLayoutContextValue}>
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onNodeDragStart={onNodeDragStart}
                onNodeDrag={onNodeDrag}
                onNodeDragStop={onNodeDragStop}
                onEdgesChange={onEdgesChange}
                onEdgeClick={onEdgeClick}
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
                  nodes={nodes}
                  edges={edges}
                  graph={graphRef.current}
                  selection={manualAdjustEngine.selection}
                  onMarqueeComplete={manualAdjustEngine.onMarqueeComplete}
                  onSegmentPointerDown={manualAdjustEngine.onSegmentPointerDown}
                  onSegmentPointerMove={manualAdjustEngine.onSegmentPointerMove}
                  onSegmentPointerUp={manualAdjustEngine.onSegmentPointerUp}
                />
              </ReactFlow>
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
