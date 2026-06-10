import { Panel, useReactFlow } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import { useCallback, useRef, useState } from "react";

import { legSegmentsFromPaths, segmentMidpoint } from "./legSegments";
import type { ManualAdjustSelection } from "./types";

type Props = {
  enabled: boolean;
  nodes: Node[];
  edges: Edge[];
  selection: ManualAdjustSelection;
  onMarqueeComplete: (box: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
  }) => void;
  onSegmentPointerDown: (
    connectionId: string,
    side: "left" | "right",
    segmentIndex: number,
    event: React.PointerEvent,
  ) => void;
  onSegmentPointerMove: (event: React.PointerEvent) => void;
  onSegmentPointerUp: (event: React.PointerEvent) => void;
};

export function ManualAdjustOverlay({
  enabled,
  nodes,
  edges,
  selection,
  onMarqueeComplete,
  onSegmentPointerDown,
  onSegmentPointerMove,
  onSegmentPointerUp,
}: Props) {
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();
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

  const onPanePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!enabled || event.button !== 0) return;
      if ((event.target as HTMLElement).closest(".manual-adjust-segment")) {
        return;
      }
      const flow = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const box = { x0: flow.x, y0: flow.y, x1: flow.x, y1: flow.y };
      marqueeRef.current = box;
      setMarquee(box);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [enabled, screenToFlowPosition],
  );

  const onPanePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = marqueeRef.current;
      if (!start) return;
      onSegmentPointerMove(event);
      const flow = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const next = { ...start, x1: flow.x, y1: flow.y };
      marqueeRef.current = next;
      setMarquee(next);
    },
    [onSegmentPointerMove, screenToFlowPosition],
  );

  const finishMarquee = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      onSegmentPointerUp(event);
      const box = marqueeRef.current;
      marqueeRef.current = null;
      setMarquee(null);
      if (!box) return;
      if (
        Math.abs(box.x1 - box.x0) > 4 ||
        Math.abs(box.y1 - box.y0) > 4
      ) {
        onMarqueeComplete(box);
      }
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
    },
    [onMarqueeComplete, onSegmentPointerUp],
  );

  if (!enabled) return null;

  const spliceEdges = edges.filter(
    (e) =>
      e.type === "splice" &&
      (e.id.startsWith("splice-left-") || e.id.startsWith("splice-right-")),
  );
  const connIds = new Set<string>();
  for (const edge of spliceEdges) {
    connIds.add(edge.id.replace(/^splice-(?:left|right)-/, ""));
  }

  const segmentHandles: Array<{
    key: string;
    x: number;
    y: number;
    connectionId: string;
    side: "left" | "right";
    segmentIndex: number;
  }> = [];

  for (const connectionId of connIds) {
    const leftEdge = edges.find((e) => e.id === `splice-left-${connectionId}`);
    const leftData = (leftEdge?.data ?? {}) as { leftPath?: string; rightPath?: string };
    const leftPath = String(leftData.leftPath ?? "");
    const rightPath = String(leftData.rightPath ?? "");
    if (!leftPath || !rightPath) continue;

    const { left, right } = legSegmentsFromPaths(leftPath, rightPath);
    for (const seg of left) {
      const mid = segmentMidpoint(seg);
      segmentHandles.push({
        key: `${connectionId}-left-${seg.index}`,
        x: mid.x,
        y: mid.y,
        connectionId,
        side: "left",
        segmentIndex: seg.index,
      });
    }
    for (const seg of right) {
      const mid = segmentMidpoint(seg);
      segmentHandles.push({
        key: `${connectionId}-right-${seg.index}`,
        x: mid.x,
        y: mid.y,
        connectionId,
        side: "right",
        segmentIndex: seg.index,
      });
    }
  }

  const marqueeScreen = marquee
    ? {
        x0: flowToScreenPosition({ x: marquee.x0, y: marquee.y0 }).x,
        y0: flowToScreenPosition({ x: marquee.x0, y: marquee.y0 }).y,
        x1: flowToScreenPosition({ x: marquee.x1, y: marquee.y1 }).x,
        y1: flowToScreenPosition({ x: marquee.x1, y: marquee.y1 }).y,
      }
    : null;

  return (
    <Panel position="top-left" className="manual-adjust-panel">
      <div
        className="manual-adjust-overlay nodrag nopan"
        onPointerDown={onPanePointerDown}
        onPointerMove={onPanePointerMove}
        onPointerUp={finishMarquee}
        onPointerCancel={finishMarquee}
      >
        {segmentHandles.map((handle) => {
          const screen = flowToScreenPosition({ x: handle.x, y: handle.y });
          return (
            <button
              key={handle.key}
              type="button"
              className={`manual-adjust-segment nodrag nopan${
                selection.connectionIds.has(handle.connectionId)
                  ? " manual-adjust-segment--selected"
                  : ""
              }`}
              style={{
                left: screen.x - 5,
                top: screen.y - 5,
              }}
              title={`Adjust leg segment ${handle.segmentIndex}`}
              aria-label={`Adjust ${handle.side} leg segment ${handle.segmentIndex}`}
              onPointerDown={(event) => {
                event.stopPropagation();
                onSegmentPointerDown(
                  handle.connectionId,
                  handle.side,
                  handle.segmentIndex,
                  event,
                );
              }}
            />
          );
        })}
        {nodes
          .filter(
            (n) =>
              n.type === "fiberAnchor" &&
              selection.connectionIds.has(
                (n.data as { connectionId: string }).connectionId,
              ),
          )
          .map((node) => {
            const screen = flowToScreenPosition({
              x: node.position.x + 3,
              y: node.position.y + 3,
            });
            return (
              <div
                key={`sel-${node.id}`}
                className="manual-adjust-selection-ring"
                style={{ left: screen.x - 6, top: screen.y - 6 }}
              />
            );
          })}
        {marqueeScreen ? (
          <div
            className="manual-adjust-marquee"
            style={{
              left: Math.min(marqueeScreen.x0, marqueeScreen.x1),
              top: Math.min(marqueeScreen.y0, marqueeScreen.y1),
              width: Math.abs(marqueeScreen.x1 - marqueeScreen.x0),
              height: Math.abs(marqueeScreen.y1 - marqueeScreen.y0),
            }}
          />
        ) : null}
      </div>
    </Panel>
  );
}
