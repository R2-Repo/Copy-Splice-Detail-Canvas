import type { Edge, Node, OnNodeDrag } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";

import { fiberHandlePosition } from "@/features/canvas/edges/splicePathGeometry";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import type { ConnectionGraph, LayoutOverrides } from "@/types/splice";

import {
  accumulateLegOverride,
  applyLegOverridesToEdge,
} from "./applyManualAdjust";
import {
  applySegmentDelta,
  connectLegPathsAtSplice,
  legSegmentsFromPaths,
  pathStartPoint,
  routeTemplateForHandles,
  segmentsToPath,
  setPathEnd,
  setPathStart,
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

type SegmentDragState = {
  connectionIds: string[];
  side: LegSide;
  segmentIndex: number;
  axis: SegmentDragAxis;
  startPointer: number;
  accumulatedDelta: number;
  baseOverrides: NonNullable<LayoutOverrides["legOverrides"]>;
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
  setEdges,
  setNodes,
}: {
  enabled: boolean;
  nodes: Node[];
  edges: Edge[];
  graph: ConnectionGraph | null;
  legOverrides?: LayoutOverrides["legOverrides"];
  onLegOverridesCommit: (
    legOverrides: LayoutOverrides["legOverrides"],
  ) => void;
  setEdges: React.Dispatch<React.SetStateAction<Edge[]>>;
  setNodes: React.Dispatch<React.SetStateAction<Node[]>>;
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
      const axis = resolveSegmentAxis(event, side, segmentIndex, connectionId);
      const ids = selection.connectionIds.has(connectionId)
        ? [...selection.connectionIds]
        : [connectionId];
      segmentDragRef.current = {
        connectionIds: ids,
        side,
        segmentIndex,
        axis,
        startPointer: axis === "horizontal" ? event.clientX : event.clientY,
        accumulatedDelta: 0,
        baseOverrides: { ...(legOverrides ?? {}) },
      };
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
    },
    [enabled, legOverrides, resolveSegmentAxis, selection.connectionIds],
  );

  const onSegmentPointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = segmentDragRef.current;
      if (!drag || !enabled) return;
      const pointer = drag.axis === "horizontal" ? event.clientX : event.clientY;
      const frameDelta = pointer - drag.startPointer - drag.accumulatedDelta;
      if (Math.abs(frameDelta) < 0.5) return;

      setEdges((current) => {
        const nextEdges = previewSegmentDrag(
          current,
          drag,
          frameDelta,
          nodes,
          graph,
        );
        setNodes((currentNodes) =>
          syncSplicePointNodes(currentNodes, nextEdges, drag.connectionIds),
        );
        return nextEdges;
      });
      drag.accumulatedDelta += frameDelta;
    },
    [enabled, graph, nodes, setEdges, setNodes],
  );

  const onSegmentPointerUp = useCallback(
    (_event: React.PointerEvent) => {
      const drag = segmentDragRef.current;
      if (!drag || !enabled) return;
      segmentDragRef.current = null;
      if (Math.abs(drag.accumulatedDelta) < 0.5) return;

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
    [enabled, onLegOverridesCommit],
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

function previewSegmentDrag(
  edges: Edge[],
  drag: SegmentDragState,
  delta: number,
  nodes: Node[],
  graph: ConnectionGraph | null,
): Edge[] {
  const nextEdges = edges.map((e) => ({ ...e, data: { ...(e.data as object) } }));
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

    if (handles) {
      nextLeft = setPathStart(nextLeft, handles.source);
      nextRight = setPathEnd(nextRight, handles.target);
    }

    const connected = connectLegPathsAtSplice(
      nextLeft,
      nextRight,
      drag.side,
    );

    for (const edgeId of [leftId, rightId]) {
      const idx = nextEdges.findIndex((e) => e.id === edgeId);
      if (idx < 0) continue;
      nextEdges[idx] = {
        ...nextEdges[idx]!,
        data: {
          ...(nextEdges[idx]!.data as Record<string, unknown>),
          leftPath: connected.leftPath,
          rightPath: connected.rightPath,
          spliceX: connected.spliceX,
          spliceY: connected.spliceY,
        },
      };
    }
  }
  return nextEdges;
}
