import { Panel, useReactFlow, useViewport } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ConnectionGraph } from "@/types/splice";

import { handleCoordsForConnection } from "./handleCoords";
import {
  allowedSegmentAxes,
  legSegmentsFromPaths,
  routeTemplateForHandles,
  type LegSegment,
  type SegmentDragAxis,
} from "./legSegments";
import type { LegSide, ManualAdjustSelection } from "./types";

const SEG_HIT = 14;

type Props = {
  enabled: boolean;
  nodes: Node[];
  edges: Edge[];
  graph: ConnectionGraph | null;
  selection: ManualAdjustSelection;
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
};

type DraggableSegment = {
  key: string;
  connectionId: string;
  side: LegSide;
  segmentIndex: number;
  segment: LegSegment;
  axes: SegmentDragAxis[];
  cursor: string;
};

function cursorForAxes(segment: LegSegment, axes: SegmentDragAxis[]): string {
  if (segment.kind === "v" && axes.includes("horizontal")) {
    return "ew-resize";
  }
  return "default";
}

function segmentHitStyle(
  seg: LegSegment,
  toPanel: (flowX: number, flowY: number) => { x: number; y: number },
  cursor: string,
): React.CSSProperties {
  if (seg.kind === "h") {
    const p0 = toPanel(seg.x0, seg.y);
    const p1 = toPanel(seg.x1, seg.y);
    const width = Math.max(Math.abs(p1.x - p0.x), SEG_HIT);
    const centerX = (p0.x + p1.x) / 2;
    return {
      left: centerX - width / 2,
      top: p0.y - SEG_HIT / 2,
      width,
      height: SEG_HIT,
      cursor,
    };
  }

  const p0 = toPanel(seg.x, seg.y0);
  const p1 = toPanel(seg.x, seg.y1);
  const height = Math.max(Math.abs(p1.y - p0.y), SEG_HIT);
  const centerY = (p0.y + p1.y) / 2;
  return {
    left: p0.x - SEG_HIT / 2,
    top: centerY - height / 2,
    width: SEG_HIT,
    height,
    cursor,
  };
}

export function ManualAdjustOverlay({
  enabled,
  nodes,
  edges,
  graph,
  selection,
  onMarqueeComplete,
  onSegmentPointerDown,
  onSegmentPointerMove,
  onSegmentPointerUp,
}: Props) {
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();
  const viewport = useViewport();
  const [marquee, setMarquee] = useState<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const marqueeRef = useRef<{
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const flowToPanelLocal = useCallback(
    (flowX: number, flowY: number) => {
      const screen = flowToScreenPosition({ x: flowX, y: flowY });
      const origin = overlayRef.current?.getBoundingClientRect();
      return {
        x: screen.x - (origin?.left ?? 0),
        y: screen.y - (origin?.top ?? 0),
      };
    },
    [flowToScreenPosition, viewport.x, viewport.y, viewport.zoom],
  );

  const spliceEdges = edges.filter(
    (e) =>
      e.type === "splice" &&
      (e.id.startsWith("splice-left-") || e.id.startsWith("splice-right-")),
  );
  const connIds = new Set<string>();
  for (const edge of spliceEdges) {
    connIds.add(edge.id.replace(/^splice-(?:left|right)-/, ""));
  }

  const draggableSegments: DraggableSegment[] = [];

  for (const connectionId of connIds) {
    if (!graph) continue;
    const leftEdge = edges.find((e) => e.id === `splice-left-${connectionId}`);
    const leftData = (leftEdge?.data ?? {}) as {
      leftPath?: string;
      rightPath?: string;
      sourceX?: number;
      sourceY?: number;
      targetX?: number;
      targetY?: number;
    };
    const leftPath = String(leftData.leftPath ?? "");
    const rightPath = String(leftData.rightPath ?? "");
    if (!leftPath || !rightPath) continue;

    const handles = handleCoordsForConnection(connectionId, nodes, graph);
    if (!handles) continue;
    const template = routeTemplateForHandles(
      handles.source.x,
      handles.source.y,
      handles.target.x,
      handles.target.y,
    );
    const { left, right } = legSegmentsFromPaths(leftPath, rightPath);

    for (const side of ["left", "right"] as const) {
      const segments = side === "left" ? left : right;
      for (const seg of segments) {
        const axes = allowedSegmentAxes(template, side, seg, segments.length);
        if (axes.length === 0) continue;
        draggableSegments.push({
          key: `${connectionId}-${side}-${seg.index}`,
          connectionId,
          side,
          segmentIndex: seg.index,
          segment: seg,
          axes,
          cursor: cursorForAxes(seg, axes),
        });
      }
    }
  }

  useEffect(() => {
    if (!enabled) return;

    const pane = overlayRef.current
      ?.closest(".react-flow")
      ?.querySelector(".react-flow__pane") as HTMLElement | null;
    if (!pane) return;

    const finishMarquee = (_event: PointerEvent) => {
      const box = marqueeRef.current;
      marqueeRef.current = null;
      setMarquee(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finishMarquee);
      window.removeEventListener("pointercancel", finishMarquee);
      if (!box) return;
      if (Math.abs(box.x1 - box.x0) > 4 || Math.abs(box.y1 - box.y0) > 4) {
        onMarqueeComplete(box);
      }
    };

    const onMove = (event: PointerEvent) => {
      const start = marqueeRef.current;
      if (!start) return;
      const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const next = { ...start, x1: flow.x, y1: flow.y };
      marqueeRef.current = next;
      setMarquee(next);
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as HTMLElement;
      if (
        target.closest(
          ".manual-adjust-segment, .cable-node__tube-tip-drag, .react-flow__node, .react-flow__controls",
        )
      ) {
        return;
      }
      if (target !== pane && !target.classList.contains("react-flow__pane")) {
        return;
      }

      const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const box = { x0: flow.x, y0: flow.y, x1: flow.x, y1: flow.y };
      marqueeRef.current = box;
      setMarquee(box);
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", finishMarquee);
      window.addEventListener("pointercancel", finishMarquee);
    };

    pane.addEventListener("pointerdown", onDown);
    return () => {
      pane.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", finishMarquee);
      window.removeEventListener("pointercancel", finishMarquee);
    };
  }, [
    enabled,
    onMarqueeComplete,
    screenToFlowPosition,
  ]);

  if (!enabled) return null;

  const marqueePanel = marquee
    ? {
        x0: flowToPanelLocal(marquee.x0, marquee.y0).x,
        y0: flowToPanelLocal(marquee.x0, marquee.y0).y,
        x1: flowToPanelLocal(marquee.x1, marquee.y1).x,
        y1: flowToPanelLocal(marquee.x1, marquee.y1).y,
      }
    : null;

  return (
    <Panel position="top-left" className="manual-adjust-panel">
      <div ref={overlayRef} className="manual-adjust-overlay nodrag nopan">
        {draggableSegments.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`manual-adjust-segment nodrag nopan${
              selection.connectionIds.has(item.connectionId)
                ? " manual-adjust-segment--selected"
                : ""
            }`}
            style={segmentHitStyle(item.segment, flowToPanelLocal, item.cursor)}
            title={`Drag leg segment ${item.segmentIndex} (${item.axes.join(", ")})`}
            aria-label={`Adjust ${item.side} leg segment ${item.segmentIndex}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              onSegmentPointerDown(
                item.connectionId,
                item.side,
                item.segmentIndex,
                event,
              );
            }}
            onPointerMove={(event) => {
              if ((event.buttons & 1) === 0) return;
              event.stopPropagation();
              onSegmentPointerMove(event);
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              onSegmentPointerUp(event);
              try {
                event.currentTarget.releasePointerCapture(event.pointerId);
              } catch {
                // ignore
              }
            }}
            onPointerCancel={(event) => {
              event.stopPropagation();
              onSegmentPointerUp(event);
              try {
                event.currentTarget.releasePointerCapture(event.pointerId);
              } catch {
                // ignore
              }
            }}
          />
        ))}
        {nodes
          .filter(
            (n) =>
              n.type === "fiberAnchor" &&
              selection.connectionIds.has(
                (n.data as { connectionId: string }).connectionId,
              ),
          )
          .map((node) => {
            const panel = flowToPanelLocal(node.position.x + 3, node.position.y + 3);
            return (
              <div
                key={`sel-${node.id}`}
                className="manual-adjust-selection-ring"
                style={{ left: panel.x - 6, top: panel.y - 6 }}
              />
            );
          })}
        {marqueePanel ? (
          <div
            className="manual-adjust-marquee"
            style={{
              left: Math.min(marqueePanel.x0, marqueePanel.x1),
              top: Math.min(marqueePanel.y0, marqueePanel.y1),
              width: Math.abs(marqueePanel.x1 - marqueePanel.x0),
              height: Math.abs(marqueePanel.y1 - marqueePanel.y0),
            }}
          />
        ) : null}
      </div>
    </Panel>
  );
}
