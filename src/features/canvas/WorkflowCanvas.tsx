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
import { useCallback, useEffect, useRef, useState } from "react";

import { spliceEdgeTypes } from "@/features/canvas/edgeTypes";
import {
  existingIdsFromEdges,
  loadLayoutOverrides,
  mergeLayoutOverrides,
  positionsFromNodes,
  saveLayoutOverrides,
} from "@/features/canvas/layoutStorage";
import type { CableNodeData } from "@/features/canvas/nodes/types";
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
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { detectFullButtSpliceTubes } from "@/features/diagram/fullButtSplice";
import {
  boundsFromFlowNodes,
  viewportForFitWidth,
} from "@/features/canvas/diagramViewport";
import {
  importLayoutWidthForGraph,
  layoutWidthForViewport,
  reportStorageKey,
} from "@/features/diagram/layoutSpliceDiagram";
import { estimatedCableNodeWidth } from "@/features/diagram/spliceRowLayout";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { CsvImportButton } from "@/features/import/CsvImportButton";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type { ConnectionGraph } from "@/types/splice";

const emptyNodes: Node[] = [];
const emptyEdges: Edge[] = [];

const FIT_WIDTH_OPTIONS = {
  paddingRatio: 0.08,
  maxZoom: 1,
  minZoom: 0.05,
} as const;

/** Ignore sub-pixel resize noise from React Flow / scrollbar churn. */
const STAGE_WIDTH_DELTA_PX = 16;

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

  collapseRef.current = collapseFullButtSplices;

  const rebuildNodesEngineLayout = useCallback(
    (draggedNode: Node, patch?: Record<string, { x: number; y: number }>) => {
      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey || draggedNode.type !== "cable") return;

      const existing = loadLayoutOverrides(reportKey);
      const positions = {
        ...(existing?.positions ?? {}),
        ...positionsFromNodes(getNodes().filter((n) => n.type === "cable")),
        ...patch,
      };

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
          },
          layoutWidthRef.current,
        );

      setNodes(nextNodes);
      setEdges(nextEdges);
      saveLayoutOverrides(
        mergeLayoutOverrides(reportKey, {
          positions: positionsFromNodes(
            nextNodes.filter((n) => n.type === "cable"),
          ),
          autoLayoutY,
          existingEdgeIds: existingIdsFromEdges(nextEdges),
          collapseFullButtSplices: collapseRef.current,
          layoutWidth: layoutWidthRef.current,
          cableSides: existing?.cableSides,
        }),
      );
    },
    [getNodes, setEdges, setNodes],
  );

  const refreshDragRouting = useCallback(
    (draggedNode: Node) => {
      if (useNodesRoutingEngine()) {
        rebuildNodesEngineLayout(draggedNode, {
          [draggedNode.id]: draggedNode.position,
        });
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
    [getEdges, getNodes, rebuildNodesEngineLayout],
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
    const viewport = viewportForFitWidth(
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
      });
      const layoutWidthArg =
        options?.layoutWidth ??
        existing?.layoutWidth ??
        layoutWidthRef.current;
      layoutWidthRef.current = layoutWidthArg;

      const savedPositions =
        options?.refreshLayout ?? false ? {} : existing?.positions ?? {};

      const { nodes: nextNodes, edges: nextEdges, layout, xBounds, autoLayoutY } =
        buildReactFlowGraph(
          graph,
          {
            ...overrides,
            reportKey,
            collapseFullButtSplices: collapse,
            positions: savedPositions,
            existingEdgeIds: existing?.existingEdgeIds,
            layoutWidth: layoutWidthArg,
          },
          layoutWidthArg,
          {
            refreshColumnX: options?.refreshColumnX,
            refreshRowLayout: options?.refreshRowLayout,
          },
        );
      xBoundsRef.current = xBounds;
      setNodes(nextNodes);
      setEdges(nextEdges);

      if (
        options?.refreshColumnX ||
        options?.layoutWidth !== undefined ||
        options?.refreshRowLayout
      ) {
        saveLayoutOverrides(
          mergeLayoutOverrides(reportKey, {
            layoutWidth: layoutWidthArg,
            positions: positionsFromNodes(nextNodes),
            autoLayoutY,
            existingEdgeIds: existing?.existingEdgeIds,
            collapseFullButtSplices: collapse,
            cableSides: overrides.cableSides,
          }),
        );
      }
      if (options?.fitView) {
        fitViewRequestRef.current += 1;
      }
      requestAnimationFrame(() => {
        for (const node of nextNodes) {
          if (node.type === "cable") updateNodeInternals(node.id);
        }
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
      if (width <= 0) return;

      const prevStageWidth = stageWidthRef.current;
      stageWidthRef.current = width;
      if (Math.abs(width - prevStageWidth) < STAGE_WIDTH_DELTA_PX) return;

      const graph = graphRef.current;
      const reportKey = reportKeyRef.current;
      if (!graph || !reportKey) return;

      const nextWidth = layoutWidthForViewport(
        graph,
        width,
        layoutWidthRef.current,
      );
      if (Math.abs(nextWidth - layoutWidthRef.current) < 1) return;

      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        applyGraphRef.current(graph, reportKey, collapseRef.current, {
          layoutWidth: nextWidth,
          refreshColumnX: true,
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

  const loadFromCsv = useCallback(
    (text: string, fileName: string) => {
      const report = parseBentleyCsv(text);
      const graph = buildConnectionGraph(report);
      const reportKey = reportStorageKey(graph);
      reportKeyRef.current = reportKey;
      graphRef.current = graph;
      const saved = loadLayoutOverrides(reportKey);
      const { visualCables } = buildVisualCablesForLayout(graph);
      const detected = detectFullButtSpliceTubes(graph, visualCables);
      const collapsed =
        saved?.collapseFullButtSplices ?? detected.length > 0;
      setCollapseFullButtSplices(collapsed);
      stageWidthRef.current = stageWidthForLayout();
      const width = importLayoutWidthForGraph(graph, {
        stageWidth: stageWidthRef.current,
      });
      applyGraph(graph, reportKey, collapsed, {
        fitView: true,
        layoutWidth: width,
        refreshColumnX: true,
      });
      const title =
        report.header.spliceNumber ?? report.header.name ?? fileName;
      setMeta(
        `${title} — ${report.pairs.length} pair(s), ${graph.connections.length} connection(s)`,
      );
    },
    [applyGraph, resolveLayoutWidth, stageWidthForLayout],
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
      if (node.type !== "cable") return;
      if (!useNodesRoutingEngine()) {
        setActiveDragCableNodeId(node.id);
      }
      refreshDragRouting(node);
    },
    [refreshDragRouting],
  );

  const onNodeDragStop: OnNodeDrag<Node> = useCallback(
    (_, node) => {
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
      layoutWidthRef.current = layoutWidth;
      xBoundsRef.current = bounds;

      const finalX = resolveCableDragStopX(node.position.x, newSide, bounds);
      const finalY = node.position.y;

      if (useNodesRoutingEngine() && graph && reportKeyRef.current) {
        const existing = loadLayoutOverrides(reportKeyRef.current);
        const cableSides = {
          ...(existing?.cableSides ?? {}),
          ...(sideChanged ? { [visualId]: newSide } : {}),
        };
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
            },
            layoutWidth,
          );
        setNodes(nextNodes);
        setEdges(nextEdges);
        saveLayoutOverrides(
          mergeLayoutOverrides(reportKeyRef.current, {
            positions: positionsFromNodes(
              nextNodes.filter((n) => n.type === "cable"),
            ),
            autoLayoutY,
            existingEdgeIds: existingIdsFromEdges(nextEdges),
            collapseFullButtSplices: collapseRef.current,
            layoutWidth,
            cableSides,
          }),
        );
        layoutWidthRef.current = layoutWidth;
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
    [edges, nodes, persistLayout, setNodes, updateNodeInternals],
  );

  const onNodeDrag: OnNodeDrag<Node> = useCallback(
    (_, node) => {
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
    [refreshDragRouting, setNodes],
  );

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
        {meta ? (
          <button
            type="button"
            className="csv-import__button csv-import__button--secondary"
            onClick={toggleFullButtCollapse}
          >
            {collapseFullButtSplices
              ? "Expand full butt splices"
              : "Collapse full butt splices"}
          </button>
        ) : null}
        <span className="workflow-canvas__hint">
          Drag to reposition; only the moved cable's strands re-route; click edge
          for protect-in-place
        </span>
        {meta ? <span className="workflow-canvas__meta">{meta}</span> : null}
      </div>
      <div className="workflow-canvas__body">
        <div className="workflow-canvas__stage" ref={stageRef}>
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
          </ReactFlow>
        </div>
      </div>
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
