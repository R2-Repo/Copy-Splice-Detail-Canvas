import type { Edge, Node, OnNodeDrag } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import {
  accumulateDotShift,
  accumulateLegOverride,
  applyLegOverridesToEdge,
} from "./applyManualAdjust";
import {
  applyButtCenterVerticalDelta,
  buttLegPathsWithinBendBudget,
  isButtEdgeId,
} from "./buttLegAdjust";
import {
  legCommitBlockedMessage,
  validateLegPaths,
  type LegPathValidationCode,
} from "./constraints";
import {
  fiberAnchorCenter,
  handleCoordsForButtEdge,
  handleCoordsForConnection,
  buildHandleCoordsCache,
  type HandleCoordsCache,
} from "./handleCoords";
import {
  allowedSegmentAxes,
  legSegmentsFromPaths,
  pathStartPoint,
  reconnectEditedLegPaths,
  repinLegEnd,
  repinLegStart,
  routeTemplateForHandles,
  segmentsToPath,
  shiftVerticalLaneX,
  type SegmentDragAxis,
} from "./legSegments";
import { syncSplicePointNodes } from "./syncSplicePointNodes";
import {
  addConnectionsToSelection,
  connectionsInMarquee,
  emptySelection,
  setConnectionSelection,
  toggleConnectionSelection,
} from "./selection";
import { bundleConnectionIds } from "./smartSelect";
import type { LegSide, ManualAdjustSelection } from "./types";

type ConnectionLegPathData = {
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
};

type SegmentDragState = {
  connectionIds: string[];
  side: LegSide;
  segmentIndex: number;
  axis: SegmentDragAxis;
  startPointer: number;
  latestPointer: number;
  baseOverrides: NonNullable<LayoutOverrides["legOverrides"]>;
  preDragPaths: Map<string, ConnectionLegPathData>;
  /**
   * Per-connection (side, segmentIndex) to move. For a single leg this holds
   * just the grabbed leg. For a group drag each selected leg resolves its own
   * center segment, so legs with different shapes still move together.
   */
  segmentTargets: Map<string, { side: LegSide; segmentIndex: number }>;
};

type DotDragState = {
  connectionIds: string[];
  startPointerX: number;
  latestPointerX: number;
  baseOverrides: NonNullable<LayoutOverrides["legOverrides"]>;
  preDragPaths: Map<string, ConnectionLegPathData>;
};

export type ManualAdjustEngine = {
  selection: ManualAdjustSelection;
  legSegmentDragActive: boolean;
  onFiberAnchorClick: (
    connectionId: string,
    event: { shiftKey: boolean },
  ) => void;
  onMarqueeComplete: (box: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }) => void;
  /** Clear all selected legs (e.g. Escape or a click on empty canvas). */
  onClearSelection: () => void;
  /**
   * Double-click a leg: select its whole tube bundle without moving it.
   * `additive` (Ctrl/Cmd) unions the bundle into the current selection.
   */
  onSegmentDoubleClick: (connectionId: string, additive: boolean) => void;
  onSegmentPointerDown: (
    connectionId: string,
    side: LegSide,
    segmentIndex: number,
    event: React.PointerEvent,
  ) => void;
  onSegmentPointerMove: (event: React.PointerEvent) => void;
  onSegmentPointerUp: (event: React.PointerEvent) => void;
  onDotPointerDown: (connectionId: string, event: React.PointerEvent) => void;
  onNodeDrag: OnNodeDrag<Node>;
  onNodeDragStop: OnNodeDrag<Node>;
  applyLegOverridesToEdges: (
    edges: Edge[],
    overrides: LayoutOverrides | undefined,
    nodes: Node[],
    graph: ConnectionGraph,
  ) => Edge[];
};

export function useManualAdjustEngine({
  enabled,
  nodes,
  edges,
  graph,
  legOverrides,
  onLegOverridesCommit,
  onLegCommitBlocked,
  setEdges,
  setNodes,
  getNodes,
  getEdges,
}: {
  enabled: boolean;
  nodes: Node[];
  edges: Edge[];
  graph: ConnectionGraph | null;
  legOverrides?: LayoutOverrides["legOverrides"];
  onLegOverridesCommit: (
    legOverrides: LayoutOverrides["legOverrides"],
  ) => void;
  onLegCommitBlocked?: (message: string) => void;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
  getNodes: () => Node[];
  getEdges: () => Edge[];
}): ManualAdjustEngine {
  const [selection, setSelection] = useState<ManualAdjustSelection>(
    emptySelection(),
  );
  const [legSegmentDragActive, setLegSegmentDragActive] = useState(false);
  const segmentDragRef = useRef<SegmentDragState | null>(null);

  const anchorPositions = useCallback(() => {
    if (!graph) return [];
    const { visualCables } = buildVisualCablesForLayout(graph);
    const byId = new Map(visualCables.map((vc) => [vc.id, vc]));
    return nodes
      .filter((n) => n.type === "fiberAnchor")
      .map((n) => {
        const data = n.data as {
          connectionId: string;
          visualCableId: string;
        };
        const vc = byId.get(data.visualCableId);
        if (!vc) return null;
        const cableNode = nodes.find(
          (c) => c.id === `cable-${data.visualCableId}`,
        );
        if (!cableNode) return null;
        const pos = fiberAnchorCenter(
          data.connectionId,
          data.visualCableId,
          vc,
          cableNode,
        );
        return { connectionId: data.connectionId, x: pos.x, y: pos.y };
      })
      .filter((x): x is { connectionId: string; x: number; y: number } => !!x);
  }, [graph, nodes]);

  const onFiberAnchorClick = useCallback(
    (connectionId: string, event: { shiftKey: boolean }) => {
      if (!enabled) return;
      setSelection((prev) =>
        toggleConnectionSelection(prev, connectionId, event.shiftKey),
      );
    },
    [enabled],
  );

  const onMarqueeComplete = useCallback(
    (box: { x0: number; y0: number; x1: number; y1: number }) => {
      if (!enabled) return;
      const hits = connectionsInMarquee(anchorPositions(), box);
      setSelection(setConnectionSelection(hits));
    },
    [anchorPositions, enabled],
  );

  const onClearSelection = useCallback(() => {
    if (!enabled) return;
    setSelection(emptySelection());
  }, [enabled]);

  // Smart selection: double-click a leg to select its whole tube bundle
  // (same source buffer tube -> same destination cable) without moving it.
  // Ctrl/Cmd+double-click unions the bundle into the existing selection.
  const onSegmentDoubleClick = useCallback(
    (connectionId: string, additive: boolean) => {
      if (!enabled || isButtEdgeId(connectionId)) return;
      const bundle = bundleConnectionIds(getEdges(), connectionId);
      setSelection((prev) =>
        additive
          ? addConnectionsToSelection(prev, bundle)
          : setConnectionSelection(bundle),
      );
    },
    [enabled, getEdges],
  );

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelection(emptySelection());
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  const resolveSegmentAxis = useCallback(
    (
      _event: React.PointerEvent,
      side: LegSide,
      segmentIndex: number,
      connectionId: string,
    ): SegmentDragAxis => {
      if (isButtEdgeId(connectionId)) return "horizontal";
      const leftEdge = edges.find((e) => e.id === `splice-left-${connectionId}`);
      const data = (leftEdge?.data ?? {}) as {
        leftPath?: string;
        rightPath?: string;
      };
      const { left, right } = legSegmentsFromPaths(
        String(data.leftPath ?? ""),
        String(data.rightPath ?? ""),
      );
      const segments = side === "left" ? left : right;
      const seg = segments.find((s) => s.index === segmentIndex);
      if (!seg || seg.kind !== "v") return "horizontal";
      return "horizontal";
    },
    [edges],
  );

  const legDragRafRef = useRef<number | null>(null);
  const segmentMoveListenerRef = useRef<(event: PointerEvent) => void>(() => {});
  const segmentUpListenerRef = useRef<(event: PointerEvent) => void>(() => {});

  const detachSegmentDragListeners = useCallback(() => {
    window.removeEventListener("pointermove", segmentMoveListenerRef.current);
    window.removeEventListener("pointerup", segmentUpListenerRef.current);
    window.removeEventListener("pointercancel", segmentUpListenerRef.current);
  }, []);

  // --- Fusion-dot drag (= leg color-transition point) -----------------------
  const dotDragRef = useRef<DotDragState | null>(null);
  const dotMoveListenerRef = useRef<(event: PointerEvent) => void>(() => {});
  const dotUpListenerRef = useRef<(event: PointerEvent) => void>(() => {});

  const detachDotDragListeners = useCallback(() => {
    window.removeEventListener("pointermove", dotMoveListenerRef.current);
    window.removeEventListener("pointerup", dotUpListenerRef.current);
    window.removeEventListener("pointercancel", dotUpListenerRef.current);
  }, []);

  const onDotPointerMove = useCallback(
    (event: React.PointerEvent | PointerEvent) => {
      const drag = dotDragRef.current;
      if (!drag || !enabled) return;
      drag.latestPointerX = event.clientX;
      if (legDragRafRef.current != null) return;
      legDragRafRef.current = requestAnimationFrame(() => {
        legDragRafRef.current = null;
        const active = dotDragRef.current;
        if (!active) return;
        const deltaX = active.latestPointerX - active.startPointerX;
        if (Math.abs(deltaX) < 0.5) return;
        const currentEdges = getEdges();
        const currentNodes = getNodes();
        const nextEdges = previewDotDrag(currentEdges, active, deltaX);
        if (nextEdges === currentEdges) return;
        const nextNodes = syncSplicePointNodes(
          currentNodes,
          nextEdges,
          active.connectionIds,
        );
        setEdges(nextEdges);
        if (nextNodes !== currentNodes) setNodes(nextNodes);
      });
    },
    [enabled, getEdges, getNodes, setEdges, setNodes],
  );

  const onDotPointerUpNative = useCallback(
    (_event: PointerEvent) => {
      detachDotDragListeners();
      setLegSegmentDragActive(false);
      const drag = dotDragRef.current;
      if (!drag || !enabled) return;
      dotDragRef.current = null;
      const deltaX = drag.latestPointerX - drag.startPointerX;
      if (Math.abs(deltaX) < 0.5) return;

      const currentEdges = getEdges();
      let blockedCode: LegPathValidationCode | null = null;
      for (const connectionId of drag.connectionIds) {
        // Butt squares have no fusion-dot clearance rules — skip leg validation.
        if (isButtEdgeId(connectionId)) continue;
        const paths = legPathDataFromEdges(currentEdges, connectionId);
        if (!paths) continue;
        blockedCode = validateLegPaths(
          paths.leftPath,
          paths.rightPath,
          paths.spliceX,
          paths.spliceY,
        );
        if (blockedCode) break;
      }
      // Warn, don't revert (manual mode is fully manual).
      if (blockedCode) onLegCommitBlocked?.(legCommitBlockedMessage(blockedCode));

      const nextOverrides = { ...drag.baseOverrides };
      for (const connectionId of drag.connectionIds) {
        nextOverrides[connectionId] = accumulateDotShift(
          nextOverrides[connectionId],
          deltaX,
        );
      }
      onLegOverridesCommit(nextOverrides);
    },
    [
      detachDotDragListeners,
      enabled,
      getEdges,
      onLegCommitBlocked,
      onLegOverridesCommit,
    ],
  );

  dotMoveListenerRef.current = (event: PointerEvent) => {
    onDotPointerMove(event);
  };
  dotUpListenerRef.current = onDotPointerUpNative;

  const onDotPointerDown = useCallback(
    (connectionId: string, event: React.PointerEvent) => {
      if (!enabled) return;
      event.stopPropagation();
      event.preventDefault();
      // Ctrl/Cmd+click = additive single-dot selection (toggle), no drag —
      // same as legs (selection is per-connection, shared by legs + dots).
      if (event.ctrlKey || event.metaKey) {
        setSelection((prev) =>
          toggleConnectionSelection(prev, connectionId, true),
        );
        return;
      }
      detachDotDragListeners();
      // Shift+grab = smart bundle: select + drag the bundle's dots together.
      // (A collapsed-tube butt has no fiber bundle, so it stays single.)
      const smartBundle = event.shiftKey && !!graph;
      const ids = smartBundle
        ? bundleConnectionIds(getEdges(), connectionId)
        : selection.connectionIds.has(connectionId)
          ? [...selection.connectionIds]
          : [connectionId];
      if (smartBundle) setSelection(setConnectionSelection(ids));
      const preDragPaths = new Map<string, ConnectionLegPathData>();
      for (const id of ids) {
        const snapshot = legPathDataFromEdges(getEdges(), id);
        if (snapshot) preDragPaths.set(id, snapshot);
      }
      dotDragRef.current = {
        connectionIds: ids,
        startPointerX: event.clientX,
        latestPointerX: event.clientX,
        baseOverrides: { ...(legOverrides ?? {}) },
        preDragPaths,
      };
      setLegSegmentDragActive(true);
      window.addEventListener("pointermove", dotMoveListenerRef.current);
      window.addEventListener("pointerup", dotUpListenerRef.current);
      window.addEventListener("pointercancel", dotUpListenerRef.current);
    },
    [
      detachDotDragListeners,
      enabled,
      getEdges,
      graph,
      legOverrides,
      selection.connectionIds,
    ],
  );

  const onSegmentPointerMove = useCallback(
    (event: React.PointerEvent | PointerEvent) => {
      const drag = segmentDragRef.current;
      if (!drag || !enabled) return;
      drag.latestPointer =
        drag.axis === "horizontal" ? event.clientX : event.clientY;

      if (legDragRafRef.current != null) return;
      legDragRafRef.current = requestAnimationFrame(() => {
        legDragRafRef.current = null;
        const active = segmentDragRef.current;
        if (!active) return;
        const totalDelta = active.latestPointer - active.startPointer;
        if (Math.abs(totalDelta) < 0.5) return;
        const currentEdges = getEdges();
        const currentNodes = getNodes();
        const nextEdges = previewSegmentDrag(
          currentEdges,
          active,
          totalDelta,
          currentNodes,
          graph,
        );
        const edgeChanged = nextEdges !== currentEdges;
        if (!edgeChanged) return;
        const nextNodes = syncSplicePointNodes(
          currentNodes,
          nextEdges,
          active.connectionIds,
        );
        setEdges(nextEdges);
        if (nextNodes !== currentNodes) {
          setNodes(nextNodes);
        }
      });
    },
    [enabled, getNodes, getEdges, graph, setEdges, setNodes],
  );

  const onSegmentPointerUpNative = useCallback(
    (_event: PointerEvent) => {
      detachSegmentDragListeners();
      setLegSegmentDragActive(false);
      const drag = segmentDragRef.current;
      if (!drag || !enabled) return;
      segmentDragRef.current = null;
      const totalDelta = drag.latestPointer - drag.startPointer;
      if (Math.abs(totalDelta) < 0.5) return;

      const currentEdges = getEdges();
      let blockedCode: LegPathValidationCode | null = null;
      for (const connectionId of drag.connectionIds) {
        const paths = legPathDataFromEdges(currentEdges, connectionId);
        if (!paths) continue;
        if (isButtEdgeId(connectionId)) {
          if (
            !buttLegPathsWithinBendBudget(paths.leftPath, paths.rightPath)
          ) {
            blockedCode = "EDGE-004";
            break;
          }
          continue;
        }
        blockedCode = validateLegPaths(
          paths.leftPath,
          paths.rightPath,
          paths.spliceX,
          paths.spliceY,
        );
        if (blockedCode) break;
      }

      if (blockedCode) {
        // Manual mode is fully manual: surface the rule as a warning banner but
        // KEEP the user's drag (no snap-back). They retain full control and can
        // fine-tune freely; the banner just flags the readability rule.
        onLegCommitBlocked?.(legCommitBlockedMessage(blockedCode));
      }

      const nextOverrides = { ...drag.baseOverrides };
      for (const connectionId of drag.connectionIds) {
        const target = drag.segmentTargets.get(connectionId);
        if (!target) continue;
        nextOverrides[connectionId] = accumulateLegOverride(
          nextOverrides[connectionId],
          target.side,
          target.segmentIndex,
          drag.axis,
          totalDelta,
        );
      }
      onLegOverridesCommit(nextOverrides);
    },
    [
      detachSegmentDragListeners,
      enabled,
      getEdges,
      getNodes,
      onLegCommitBlocked,
      onLegOverridesCommit,
      setEdges,
      setNodes,
    ],
  );

  segmentMoveListenerRef.current = (event: PointerEvent) => {
    onSegmentPointerMove(event);
  };
  segmentUpListenerRef.current = onSegmentPointerUpNative;

  useEffect(
    () => () => {
      detachSegmentDragListeners();
      detachDotDragListeners();
      setLegSegmentDragActive(false);
      if (legDragRafRef.current != null) {
        cancelAnimationFrame(legDragRafRef.current);
      }
    },
    [detachSegmentDragListeners, detachDotDragListeners],
  );

  const onSegmentPointerUp = useCallback(
    (event: React.PointerEvent) => {
      onSegmentPointerUpNative(event.nativeEvent);
    },
    [onSegmentPointerUpNative],
  );

  const onSegmentPointerDown = useCallback(
    (
      connectionId: string,
      side: LegSide,
      segmentIndex: number,
      event: React.PointerEvent,
    ) => {
      if (!enabled) return;
      event.stopPropagation();
      event.preventDefault();
      // Ctrl/Cmd+click = additive single-leg selection (toggle), no drag. Lets
      // you build a custom multi-selection one leg at a time on top of an
      // existing selection or bundle. Plain click/drag below is unchanged.
      if ((event.ctrlKey || event.metaKey) && !isButtEdgeId(connectionId)) {
        setSelection((prev) =>
          toggleConnectionSelection(prev, connectionId, true),
        );
        return;
      }
      detachSegmentDragListeners();
      const axis = resolveSegmentAxis(event, side, segmentIndex, connectionId);
      // Shift+grab = smart bundle: expand to every leg sharing this leg's
      // tube bundle (same from/to) and move them together this gesture. The
      // unmodified click path below is unchanged so single-leg drag is intact.
      const smartBundle =
        event.shiftKey && !!graph && !isButtEdgeId(connectionId);
      let ids: string[];
      if (smartBundle) {
        ids = bundleConnectionIds(getEdges(), connectionId);
        setSelection(setConnectionSelection(ids));
      } else {
        ids = selection.connectionIds.has(connectionId)
          ? [...selection.connectionIds]
          : [connectionId];
      }
      const preDragPaths = new Map<string, ConnectionLegPathData>();
      for (const id of ids) {
        const snapshot = legPathDataFromEdges(getEdges(), id);
        if (snapshot) preDragPaths.set(id, snapshot);
      }
      const segmentTargets = new Map<
        string,
        { side: LegSide; segmentIndex: number }
      >();
      segmentTargets.set(connectionId, { side, segmentIndex });
      if (ids.length > 1 && graph && !isButtEdgeId(connectionId)) {
        const currentEdges = getEdges();
        const currentNodes = getNodes();
        const cache = buildHandleCoordsCache(currentNodes, graph);
        for (const id of ids) {
          if (id === connectionId || isButtEdgeId(id)) continue;
          const resolvedIndex = resolveGroupSegmentIndex(
            currentEdges,
            currentNodes,
            graph,
            cache,
            id,
            side,
          );
          if (resolvedIndex != null) {
            segmentTargets.set(id, { side, segmentIndex: resolvedIndex });
          }
        }
      }
      const startPointer = axis === "horizontal" ? event.clientX : event.clientY;
      segmentDragRef.current = {
        connectionIds: ids,
        side,
        segmentIndex,
        axis,
        startPointer,
        latestPointer: startPointer,
        baseOverrides: { ...(legOverrides ?? {}) },
        preDragPaths,
        segmentTargets,
      };
      setLegSegmentDragActive(true);
      window.addEventListener("pointermove", segmentMoveListenerRef.current);
      window.addEventListener("pointerup", segmentUpListenerRef.current);
      window.addEventListener("pointercancel", segmentUpListenerRef.current);
    },
    [
      detachSegmentDragListeners,
      enabled,
      getEdges,
      getNodes,
      graph,
      legOverrides,
      resolveSegmentAxis,
      selection.connectionIds,
    ],
  );

  const onNodeDrag: OnNodeDrag<Node> = useCallback((_, node) => {
    if (!enabled || node.type !== "fiberAnchor") return;
  }, [enabled]);

  const onNodeDragStop: OnNodeDrag<Node> = useCallback((_, node) => {
    if (!enabled || node.type !== "fiberAnchor") return;
  }, [enabled]);

  const applyLegOverridesToEdges = useCallback(
    (
      inputEdges: Edge[],
      overrides: LayoutOverrides | undefined,
      inputNodes: Node[],
      inputGraph: ConnectionGraph,
    ): Edge[] => {
      const legMap = overrides?.legOverrides;
      if (!legMap) return inputEdges;

      return inputEdges.map((edge) => {
        if (isButtEdgeId(edge.id) && legMap[edge.id]) {
          const handles = handleCoordsForButtEdge(
            edge.id,
            inputNodes,
            inputEdges,
            inputGraph,
          );
          const updated = applyLegOverridesToEdge(
            edge,
            legMap[edge.id],
            handles?.source.x ?? 0,
            handles?.source.y ?? 0,
            handles?.target.x ?? 0,
            handles?.target.y ?? 0,
          );
          return updated ?? edge;
        }

        const connId = edge.id.replace(/^splice-(?:left|right)-/, "");
        if (!legMap[connId]) return edge;
        const leftEdge = inputEdges.find((e) => e.id === `splice-left-${connId}`);
        const data = (leftEdge?.data ?? {}) as {
          sourceX?: number;
          sourceY?: number;
          targetX?: number;
          targetY?: number;
        };
        const handles = handleCoordsForConnection(
          connId,
          inputNodes,
          inputGraph,
        );
        const updated = applyLegOverridesToEdge(
          edge,
          legMap[connId],
          handles?.source.x ?? Number(data.sourceX ?? 0),
          handles?.source.y ?? Number(data.sourceY ?? 0),
          handles?.target.x ?? Number(data.targetX ?? 0),
          handles?.target.y ?? Number(data.targetY ?? 0),
        );
        return updated ?? edge;
      });
    },
    [],
  );

  return {
    selection,
    legSegmentDragActive,
    onFiberAnchorClick,
    onMarqueeComplete,
    onClearSelection,
    onSegmentDoubleClick,
    onSegmentPointerDown,
    onSegmentPointerMove,
    onSegmentPointerUp,
    onDotPointerDown,
    onNodeDrag,
    onNodeDragStop,
    applyLegOverridesToEdges,
  };
}

function previewDotDrag(
  edges: Edge[],
  drag: DotDragState,
  deltaX: number,
): Edge[] {
  if (Math.abs(deltaX) < 0.5) return edges;
  const nextEdges = [...edges];
  let changed = false;
  for (const connectionId of drag.connectionIds) {
    const snapshot = drag.preDragPaths.get(connectionId);
    if (!snapshot) continue;
    const dot = { x: snapshot.spliceX + deltaX, y: snapshot.spliceY };
    const nextLeft = repinLegEnd(snapshot.leftPath, dot);
    const nextRight = repinLegStart(snapshot.rightPath, dot);
    // Collapsed butt (the big square) lives on a single `butt-*` edge that
    // holds both legs; split fiber splices have separate left/right edges.
    const edgeIds = isButtEdgeId(connectionId)
      ? [connectionId]
      : [`splice-left-${connectionId}`, `splice-right-${connectionId}`];
    for (const edgeId of edgeIds) {
      const idx = nextEdges.findIndex((e) => e.id === edgeId);
      if (idx < 0) continue;
      const prev = nextEdges[idx]!;
      const prevData = (prev.data ?? {}) as {
        leftPath?: string;
        rightPath?: string;
        spliceX?: number;
      };
      if (
        prevData.leftPath === nextLeft &&
        prevData.rightPath === nextRight &&
        prevData.spliceX === dot.x
      ) {
        continue;
      }
      changed = true;
      nextEdges[idx] = {
        ...prev,
        data: {
          ...(prev.data as Record<string, unknown>),
          leftPath: nextLeft,
          rightPath: nextRight,
          spliceX: dot.x,
          spliceY: dot.y,
        },
      };
    }
  }
  return changed ? nextEdges : edges;
}

function legPathDataFromEdges(
  edges: Edge[],
  connectionId: string,
): ConnectionLegPathData | null {
  if (isButtEdgeId(connectionId)) {
    const buttEdge = edges.find((e) => e.id === connectionId);
    if (!buttEdge) return null;
    const data = (buttEdge.data ?? {}) as {
      leftPath?: string;
      rightPath?: string;
      spliceX?: number;
      spliceY?: number;
    };
    const leftPath = String(data.leftPath ?? "");
    const rightPath = String(data.rightPath ?? "");
    if (!leftPath || !rightPath) return null;
    return {
      leftPath,
      rightPath,
      spliceX: Number(data.spliceX ?? 0),
      spliceY: Number(data.spliceY ?? 0),
    };
  }

  const leftEdge = edges.find((e) => e.id === `splice-left-${connectionId}`);
  if (!leftEdge) return null;
  const data = (leftEdge.data ?? {}) as {
    leftPath?: string;
    rightPath?: string;
    spliceX?: number;
    spliceY?: number;
  };
  const leftPath = String(data.leftPath ?? "");
  const rightPath = String(data.rightPath ?? "");
  if (!leftPath || !rightPath) return null;
  return {
    leftPath,
    rightPath,
    spliceX: Number(data.spliceX ?? 0),
    spliceY: Number(data.spliceY ?? 0),
  };
}

/**
 * For a group drag, find the segment on `side` that the manual overlay would
 * let the user drag horizontally (the leg's center vertical lane). Returns null
 * when this leg has no draggable segment on that side, so it is simply left in
 * place rather than shifting the wrong segment.
 */
function resolveGroupSegmentIndex(
  edges: Edge[],
  nodes: Node[],
  graph: ConnectionGraph,
  cache: HandleCoordsCache,
  connectionId: string,
  side: LegSide,
): number | null {
  const leftEdge = edges.find((e) => e.id === `splice-left-${connectionId}`);
  if (!leftEdge) return null;
  const data = (leftEdge.data ?? {}) as {
    leftPath?: string;
    rightPath?: string;
    spliceX?: number;
    spliceY?: number;
  };
  const leftPath = String(data.leftPath ?? "");
  const rightPath = String(data.rightPath ?? "");
  if (!leftPath || !rightPath) return null;
  const handles = handleCoordsForConnection(connectionId, nodes, graph, cache);
  if (!handles) return null;
  const template = routeTemplateForHandles(
    handles.source.x,
    handles.source.y,
    handles.target.x,
    handles.target.y,
  );
  const { left, right } = legSegmentsFromPaths(leftPath, rightPath);
  const segments = side === "left" ? left : right;
  const spliceX = Number(data.spliceX ?? NaN);
  const spliceY = Number(data.spliceY ?? NaN);
  const splice =
    Number.isFinite(spliceX) && Number.isFinite(spliceY)
      ? { x: spliceX, y: spliceY }
      : undefined;
  for (const seg of segments) {
    if (
      allowedSegmentAxes(template, side, seg, segments.length, splice).includes(
        "horizontal",
      )
    ) {
      return seg.index;
    }
  }
  return null;
}

function previewSegmentDrag(
  edges: Edge[],
  drag: SegmentDragState,
  totalDelta: number,
  nodes: Node[],
  graph: ConnectionGraph | null,
): Edge[] {
  if (Math.abs(totalDelta) < 0.5) return edges;
  const handleCache = graph != null ? buildHandleCoordsCache(nodes, graph) : undefined;
  const nextEdges = [...edges];
  let changed = false;
  for (const connectionId of drag.connectionIds) {
    const snapshot = drag.preDragPaths.get(connectionId);
    if (!snapshot) continue;
    const target = drag.segmentTargets.get(connectionId);
    if (!target) continue;
    const { side, segmentIndex } = target;

    if (isButtEdgeId(connectionId)) {
      const edgeIdx = nextEdges.findIndex((e) => e.id === connectionId);
      if (edgeIdx < 0) continue;
      const handles =
        graph != null
          ? handleCoordsForButtEdge(
              connectionId,
              nodes,
              nextEdges,
              graph,
              handleCache,
            )
          : null;
      const paths = legSegmentsFromPaths(snapshot.leftPath, snapshot.rightPath);
      const segments = side === "left" ? paths.left : paths.right;
      const updatedSegments =
        drag.axis === "horizontal"
          ? applyButtCenterVerticalDelta(segments, segmentIndex, totalDelta)
          : segments;
      const pathStart =
        side === "left"
          ? (handles?.source ?? pathStartPoint(snapshot.leftPath))
          : pathStartPoint(snapshot.rightPath);
      const nextLeft =
        side === "left"
          ? segmentsToPath(updatedSegments, pathStart)
          : snapshot.leftPath;
      const nextRight =
        side === "right"
          ? segmentsToPath(updatedSegments, pathStart)
          : snapshot.rightPath;
      const connected = reconnectEditedLegPaths(nextLeft, nextRight, side, {
        handles: handles ?? undefined,
      });
      const prev = nextEdges[edgeIdx]!;
      const prevData = (prev.data ?? {}) as {
        leftPath?: string;
        rightPath?: string;
        spliceX?: number;
        spliceY?: number;
      };
      if (
        prevData.leftPath === connected.leftPath &&
        prevData.rightPath === connected.rightPath &&
        prevData.spliceX === connected.spliceX &&
        prevData.spliceY === connected.spliceY
      ) {
        continue;
      }
      changed = true;
      nextEdges[edgeIdx] = {
        ...prev,
        data: {
          ...(prev.data as Record<string, unknown>),
          leftPath: connected.leftPath,
          rightPath: connected.rightPath,
          spliceX: connected.spliceX,
          spliceY: connected.spliceY,
          routingMidX: connected.spliceX,
          routingPrecomputed: true,
        },
      };
      continue;
    }

    const leftId = `splice-left-${connectionId}`;
    const rightId = `splice-right-${connectionId}`;
    const leftEdge = nextEdges.find((e) => e.id === leftId);
    if (!leftEdge) continue;
    // A leg drag is always a horizontal lane shift: move only the dragged
    // vertical segment's two bend points. The leg endpoints (fiber handle +
    // fusion dot) and the other leg stay put — so the splice is preserved, no
    // reconnect is needed, and no extra bend is introduced.
    const draggedPath = side === "left" ? snapshot.leftPath : snapshot.rightPath;
    const shifted = shiftVerticalLaneX(draggedPath, segmentIndex, totalDelta);
    const connected = {
      leftPath: side === "left" ? shifted : snapshot.leftPath,
      rightPath: side === "right" ? shifted : snapshot.rightPath,
      spliceX: snapshot.spliceX,
      spliceY: snapshot.spliceY,
    };
    for (const edgeId of [leftId, rightId]) {
      const idx = nextEdges.findIndex((e) => e.id === edgeId);
      if (idx < 0) continue;
      const prev = nextEdges[idx]!;
      const prevData = (prev.data ?? {}) as {
        leftPath?: string;
        rightPath?: string;
        spliceX?: number;
        spliceY?: number;
      };
      if (
        prevData.leftPath === connected.leftPath &&
        prevData.rightPath === connected.rightPath &&
        prevData.spliceX === connected.spliceX &&
        prevData.spliceY === connected.spliceY
      ) {
        continue;
      }
      changed = true;
      nextEdges[idx] = {
        ...prev,
        data: {
          ...(prev.data as Record<string, unknown>),
          leftPath: connected.leftPath,
          rightPath: connected.rightPath,
          spliceX: connected.spliceX,
          spliceY: connected.spliceY,
        },
      };
    }
  }
  if (!changed) return edges;
  return nextEdges;
}
