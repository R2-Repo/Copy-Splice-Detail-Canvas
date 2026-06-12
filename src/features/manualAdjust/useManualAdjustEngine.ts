import type { Edge, Node, OnNodeDrag } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import { fiberHandlePosition } from "@/features/canvas/edges/splicePathGeometry";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import {
  accumulateLegOverride,
  applyLegOverridesToEdge,
} from "./applyManualAdjust";
import {
  legCommitBlockedMessage,
  validateLegPaths,
  type LegPathValidationCode,
} from "./constraints";
import {
  applySegmentDelta,
  legSegmentsFromPaths,
  pathStartPoint,
  reconnectEditedLegPaths,
  routeTemplateForHandles,
  segmentsToPath,
  type SegmentDragAxis,
} from "./legSegments";
import { handleCoordsForConnection } from "./handleCoords";
import { syncSplicePointNodes } from "./syncSplicePointNodes";
import {
  connectionsInMarquee,
  emptySelection,
  setConnectionSelection,
  toggleConnectionSelection,
} from "./selection";
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
  accumulatedDelta: number;
  baseOverrides: NonNullable<LayoutOverrides["legOverrides"]>;
  preDragPaths: Map<string, ConnectionLegPathData>;
};

export type ManualAdjustEngine = {
  selection: ManualAdjustSelection;
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
  onSegmentPointerDown: (
    connectionId: string,
    side: LegSide,
    segmentIndex: number,
    event: React.PointerEvent,
  ) => void;
  onSegmentPointerMove: (event: React.PointerEvent) => void;
  onSegmentPointerUp: (event: React.PointerEvent) => void;
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
        const pos = fiberHandlePosition(
          vc,
          data.connectionId,
          cableNode.position,
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

  const resolveSegmentAxis = useCallback(
    (
      _event: React.PointerEvent,
      side: LegSide,
      segmentIndex: number,
      connectionId: string,
    ): SegmentDragAxis => {
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
  const legDragPendingDeltaRef = useRef(0);
  const segmentMoveListenerRef = useRef<(event: PointerEvent) => void>(() => {});
  const segmentUpListenerRef = useRef<(event: PointerEvent) => void>(() => {});

  const detachSegmentDragListeners = useCallback(() => {
    window.removeEventListener("pointermove", segmentMoveListenerRef.current);
    window.removeEventListener("pointerup", segmentUpListenerRef.current);
    window.removeEventListener("pointercancel", segmentUpListenerRef.current);
  }, []);

  const onSegmentPointerMove = useCallback(
    (event: React.PointerEvent | PointerEvent) => {
      const drag = segmentDragRef.current;
      if (!drag || !enabled) return;
      const pointer = drag.axis === "horizontal" ? event.clientX : event.clientY;
      const frameDelta = pointer - drag.startPointer - drag.accumulatedDelta;
      if (Math.abs(frameDelta) < 0.5) return;
      drag.accumulatedDelta += frameDelta;
      legDragPendingDeltaRef.current += frameDelta;

      if (legDragRafRef.current != null) return;
      legDragRafRef.current = requestAnimationFrame(() => {
        legDragRafRef.current = null;
        const active = segmentDragRef.current;
        const delta = legDragPendingDeltaRef.current;
        legDragPendingDeltaRef.current = 0;
        if (!active || Math.abs(delta) < 0.5) return;
        const currentEdges = getEdges();
        const currentNodes = getNodes();
        const nextEdges = previewSegmentDrag(
          currentEdges,
          active,
          delta,
          currentNodes,
          graph,
        );
        if (nextEdges === currentEdges) return;
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
      const drag = segmentDragRef.current;
      if (!drag || !enabled) return;
      segmentDragRef.current = null;
      if (Math.abs(drag.accumulatedDelta) < 0.5) return;

      const currentEdges = getEdges();
      let blockedCode: LegPathValidationCode | null = null;
      for (const connectionId of drag.connectionIds) {
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

      if (blockedCode) {
        // #region agent log
        fetch('http://127.0.0.1:7692/ingest/76af12d0-a987-40d1-88e0-d22d15ff6bad',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c6eead'},body:JSON.stringify({sessionId:'c6eead',location:'useManualAdjustEngine.ts:commit',message:'segment commit blocked',data:{blockedCode,connectionIds:drag.connectionIds,accumulatedDelta:drag.accumulatedDelta},timestamp:Date.now(),hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        const revertedEdges = applyLegPathSnapshots(
          currentEdges,
          drag.connectionIds,
          drag.preDragPaths,
        );
        const revertedNodes = syncSplicePointNodes(
          getNodes(),
          revertedEdges,
          drag.connectionIds,
        );
        setEdges(revertedEdges);
        if (revertedNodes !== getNodes()) {
          setNodes(revertedNodes);
        }
        onLegCommitBlocked?.(legCommitBlockedMessage(blockedCode));
        return;
      }

      const nextOverrides = { ...drag.baseOverrides };
      for (const connectionId of drag.connectionIds) {
        nextOverrides[connectionId] = accumulateLegOverride(
          nextOverrides[connectionId],
          drag.side,
          drag.segmentIndex,
          drag.axis,
          drag.accumulatedDelta,
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
      if (legDragRafRef.current != null) {
        cancelAnimationFrame(legDragRafRef.current);
      }
    },
    [detachSegmentDragListeners],
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
      detachSegmentDragListeners();
      const axis = resolveSegmentAxis(event, side, segmentIndex, connectionId);
      const ids = selection.connectionIds.has(connectionId)
        ? [...selection.connectionIds]
        : [connectionId];
      const preDragPaths = new Map<string, ConnectionLegPathData>();
      for (const id of ids) {
        const snapshot = legPathDataFromEdges(getEdges(), id);
        if (snapshot) preDragPaths.set(id, snapshot);
      }
      segmentDragRef.current = {
        connectionIds: ids,
        side,
        segmentIndex,
        axis,
        startPointer: axis === "horizontal" ? event.clientX : event.clientY,
        accumulatedDelta: 0,
        baseOverrides: { ...(legOverrides ?? {}) },
        preDragPaths,
      };
      window.addEventListener("pointermove", segmentMoveListenerRef.current);
      window.addEventListener("pointerup", segmentUpListenerRef.current);
      window.addEventListener("pointercancel", segmentUpListenerRef.current);
    },
    [
      detachSegmentDragListeners,
      enabled,
      getEdges,
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
      _inputNodes: Node[],
      _inputGraph: ConnectionGraph,
    ): Edge[] => {
      const legMap = overrides?.legOverrides;
      if (!legMap) return inputEdges;

      return inputEdges.map((edge) => {
        const connId = edge.id.replace(/^splice-(?:left|right)-/, "");
        if (!legMap[connId]) return edge;
        const leftEdge = inputEdges.find((e) => e.id === `splice-left-${connId}`);
        const data = (leftEdge?.data ?? {}) as {
          sourceX?: number;
          sourceY?: number;
          targetX?: number;
          targetY?: number;
        };
        const updated = applyLegOverridesToEdge(
          edge,
          legMap[connId],
          Number(data.sourceX ?? 0),
          Number(data.sourceY ?? 0),
          Number(data.targetX ?? 0),
          Number(data.targetY ?? 0),
        );
        return updated ?? edge;
      });
    },
    [],
  );

  return {
    selection,
    onFiberAnchorClick,
    onMarqueeComplete,
    onSegmentPointerDown,
    onSegmentPointerMove,
    onSegmentPointerUp,
    onNodeDrag,
    onNodeDragStop,
    applyLegOverridesToEdges,
  };
}

function legPathDataFromEdges(
  edges: Edge[],
  connectionId: string,
): ConnectionLegPathData | null {
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

function applyLegPathSnapshots(
  edges: Edge[],
  connectionIds: string[],
  snapshots: Map<string, ConnectionLegPathData>,
): Edge[] {
  return edges.map((edge) => {
    for (const connectionId of connectionIds) {
      const snapshot = snapshots.get(connectionId);
      if (!snapshot) continue;
      if (
        edge.id !== `splice-left-${connectionId}` &&
        edge.id !== `splice-right-${connectionId}`
      ) {
        continue;
      }
      return {
        ...edge,
        data: {
          ...(edge.data as Record<string, unknown>),
          leftPath: snapshot.leftPath,
          rightPath: snapshot.rightPath,
          spliceX: snapshot.spliceX,
          spliceY: snapshot.spliceY,
        },
      };
    }
    return edge;
  });
}

function previewSegmentDrag(
  edges: Edge[],
  drag: SegmentDragState,
  delta: number,
  nodes: Node[],
  graph: ConnectionGraph | null,
): Edge[] {
  const nextEdges = [...edges];
  let changed = false;
  for (const connectionId of drag.connectionIds) {
    const leftId = `splice-left-${connectionId}`;
    const rightId = `splice-right-${connectionId}`;
    const leftEdge = nextEdges.find((e) => e.id === leftId);
    if (!leftEdge) continue;
    const data = (leftEdge.data ?? {}) as {
      leftPath?: string;
      rightPath?: string;
      spliceX?: number;
      spliceY?: number;
    };
    const handles =
      graph != null
        ? handleCoordsForConnection(connectionId, nodes, graph)
        : null;
    const leftPathRaw = String(data.leftPath ?? "");
    const rightPathRaw = String(data.rightPath ?? "");
    const template = routeTemplateForHandles(
      handles?.source.x ?? 0,
      handles?.source.y ?? 0,
      handles?.target.x ?? 0,
      handles?.target.y ?? 0,
    );
    const paths = legSegmentsFromPaths(leftPathRaw, rightPathRaw);
    const segments = drag.side === "left" ? paths.left : paths.right;
    const updatedSegments = applySegmentDelta(
      segments,
      drag.segmentIndex,
      drag.axis,
      delta,
      template,
      drag.side,
      Number.isFinite(Number(data.spliceX)) && Number.isFinite(Number(data.spliceY))
        ? { x: Number(data.spliceX), y: Number(data.spliceY) }
        : undefined,
    );
    const pathStart =
      drag.side === "left"
        ? (handles?.source ?? pathStartPoint(leftPathRaw))
        : pathStartPoint(rightPathRaw);
    let nextLeft =
      drag.side === "left"
        ? segmentsToPath(updatedSegments, pathStart)
        : leftPathRaw;
    let nextRight =
      drag.side === "right"
        ? segmentsToPath(updatedSegments, pathStart)
        : rightPathRaw;

    const connected = reconnectEditedLegPaths(
      nextLeft,
      nextRight,
      drag.side,
      {
        handles: handles ?? undefined,
        preserveSplice:
          Number.isFinite(Number(data.spliceX)) &&
          Number.isFinite(Number(data.spliceY))
            ? { x: Number(data.spliceX), y: Number(data.spliceY) }
            : undefined,
      },
    );

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
