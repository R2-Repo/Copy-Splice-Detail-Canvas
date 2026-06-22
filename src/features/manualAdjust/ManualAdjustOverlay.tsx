import { Panel, useReactFlow, useViewport } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import type { ConnectionGraph } from "@/types/splice";

import { handleCoordsForConnection, buildHandleCoordsCache } from "./handleCoords";
import {
  draggableButtCenterSegments,
  isButtEdgeId,
  isButtSpliceEdge,
} from "./buttLegAdjust";
import {
  allowedSegmentAxes,
  legSegmentsFromPaths,
  routeTemplateForHandles,
  verticalRunBounds,
  type LegSegment,
  type SegmentDragAxis,
} from "./legSegments";
import type { LegSide, ManualAdjustSelection } from "./types";

const SEG_HIT = 14;
const DOT_HIT = 16;
/** Bigger grab target for the collapsed buffer-tube butt square. */
const BUTT_DOT_HIT = 22;
/** Fiber leg stroke width (px, flow units) — see SpliceEdge `tubeStroke`. */
const SEG_STROKE = 2.5;

type Props = {
  enabled: boolean;
  legSegmentDragActive: boolean;
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
  onClearSelection: () => void;
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
  /** Show fusion-dot grab targets without full manual segment overlay (grid hybrid). */
  fusionDotsVisible?: boolean;
  lockedFusionDots?: ReadonlySet<string>;
  onFusionDotContextMenu?: (
    connectionId: string,
    clientX: number,
    clientY: number,
  ) => void;
  beginLongPress: (
    connectionId: string,
    clientX: number,
    clientY: number,
  ) => void;
};

type DraggableSegment = {
  key: string;
  connectionId: string;
  side: LegSide;
  segmentIndex: number;
  segment: LegSegment;
  axes: SegmentDragAxis[];
  cursor: string;
  /** Collapsed butt splice center vertical — same hit styling, different aria label. */
  buttSegment?: boolean;
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

/**
 * Thin highlight that traces the actual vertical leg run. Decoupled from the
 * wide invisible hit button so the highlight sits ON the drawn line: width
 * scales with zoom (so it matches the rendered stroke) and height equals the
 * full colinear run, not a fixed-size box.
 */
function segmentHighlightStyle(
  seg: LegSegment,
  toPanel: (flowX: number, flowY: number) => { x: number; y: number },
  zoom: number,
): React.CSSProperties | null {
  if (seg.kind !== "v") return null;
  const p0 = toPanel(seg.x, seg.y0);
  const p1 = toPanel(seg.x, seg.y1);
  const top = Math.min(p0.y, p1.y);
  const height = Math.abs(p1.y - p0.y);
  const width = Math.max(3, SEG_STROKE * zoom + 4);
  return {
    left: p0.x - width / 2,
    top,
    width,
    height,
  };
}

export function ManualAdjustOverlay({
  enabled,
  legSegmentDragActive,
  nodes,
  edges,
  graph,
  selection,
  onMarqueeComplete,
  onClearSelection,
  onSegmentDoubleClick,
  onSegmentPointerDown,
  onSegmentPointerMove: _onSegmentPointerMove,
  onSegmentPointerUp: _onSegmentPointerUp,
  onDotPointerDown,
  fusionDotsVisible = false,
  lockedFusionDots,
  onFusionDotContextMenu,
  beginLongPress,
}: Props) {
  const showDots = enabled || fusionDotsVisible;
  // Plain left-press (no selection modifier) can also start an existing-toggle
  // long-press; a move turns it into a drag (long-press auto-cancels).
  const maybeBeginLongPress = (connectionId: string, event: React.PointerEvent) => {
    if (event.button !== 0 || event.ctrlKey || event.shiftKey || event.metaKey) {
      return;
    }
    beginLongPress(connectionId, event.clientX, event.clientY);
  };
  const { screenToFlowPosition, flowToScreenPosition } = useReactFlow();
  const viewport = useViewport();
  const cachedSegmentsRef = useRef<DraggableSegment[]>([]);
  const cachedDotsRef = useRef<
    Array<{ connectionId: string; x: number; y: number; butt: boolean }>
  >([]);
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
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelOriginRef = useRef({ left: 0, top: 0 });

  useLayoutEffect(() => {
    const rect = overlayRef.current?.getBoundingClientRect();
    if (rect) {
      panelOriginRef.current = { left: rect.left, top: rect.top };
    }
  });

  const flowToPanelLocal = useCallback(
    (flowX: number, flowY: number) => {
      const screen = flowToScreenPosition({ x: flowX, y: flowY });
      const origin = panelOriginRef.current;
      return {
        x: screen.x - origin.left,
        y: screen.y - origin.top,
      };
    },
    [flowToScreenPosition, viewport.x, viewport.y, viewport.zoom],
  );

  const draggableSegments = useMemo(() => {
    if (!enabled || !graph) return [];
    if (legSegmentDragActive && cachedSegmentsRef.current.length > 0) {
      return cachedSegmentsRef.current;
    }

    const handleCache = buildHandleCoordsCache(nodes, graph);
    const spliceEdges = edges.filter(
      (e) =>
        e.type === "splice" &&
        (e.id.startsWith("splice-left-") || e.id.startsWith("splice-right-")),
    );
    const connIds = new Set<string>();
    for (const edge of spliceEdges) {
      connIds.add(edge.id.replace(/^splice-(?:left|right)-/, ""));
    }

    const items: DraggableSegment[] = [];
    for (const connectionId of connIds) {
      const leftEdge = edges.find((e) => e.id === `splice-left-${connectionId}`);
      const leftData = (leftEdge?.data ?? {}) as {
        leftPath?: string;
        rightPath?: string;
        spliceX?: number;
        spliceY?: number;
      };
      const leftPath = String(leftData.leftPath ?? "");
      const rightPath = String(leftData.rightPath ?? "");
      if (!leftPath || !rightPath) continue;

      const handles = handleCoordsForConnection(connectionId, nodes, graph, handleCache);
      if (!handles) continue;
      const template = routeTemplateForHandles(
        handles.source.x,
        handles.source.y,
        handles.target.x,
        handles.target.y,
      );
      const { left, right } = legSegmentsFromPaths(leftPath, rightPath);
      const spliceX = Number(leftData.spliceX ?? NaN);
      const spliceY = Number(leftData.spliceY ?? NaN);
      const splice =
        Number.isFinite(spliceX) && Number.isFinite(spliceY)
          ? { x: spliceX, y: spliceY }
          : undefined;

      for (const side of ["left", "right"] as const) {
        const segments = side === "left" ? left : right;
        const sidePath = side === "left" ? leftPath : rightPath;
        for (const seg of segments) {
          const axes = allowedSegmentAxes(
            template,
            side,
            seg,
            segments.length,
            splice,
          );
          if (axes.length === 0) continue;
          // Hit zone + highlight should cover the whole colinear vertical run
          // (the exact span the drag moves), not just one parsed point pair.
          const run =
            seg.kind === "v" ? verticalRunBounds(sidePath, seg.index) : null;
          const displaySegment: LegSegment = run
            ? { kind: "v", index: seg.index, x: run.x, y0: run.y0, y1: run.y1 }
            : seg;
          items.push({
            key: `${connectionId}-${side}-${seg.index}`,
            connectionId,
            side,
            segmentIndex: seg.index,
            segment: displaySegment,
            axes,
            cursor: cursorForAxes(seg, axes),
          });
        }
      }
    }

    for (const edge of edges) {
      if (!isButtSpliceEdge(edge)) continue;
      for (const buttSeg of draggableButtCenterSegments(edge)) {
        items.push({
          key: `${buttSeg.edgeId}-${buttSeg.side}-${buttSeg.segment.index}`,
          connectionId: buttSeg.edgeId,
          side: buttSeg.side,
          segmentIndex: buttSeg.segmentIndex,
          segment: buttSeg.segment,
          axes: ["horizontal"],
          cursor: "ew-resize",
          buttSegment: true,
        });
      }
    }

    cachedSegmentsRef.current = items;
    return items;
  }, [enabled, graph, edges, nodes, legSegmentDragActive]);

  const fusionDots = useMemo(() => {
    if (!showDots) return [];
    if (legSegmentDragActive && cachedDotsRef.current.length > 0) {
      return cachedDotsRef.current;
    }
    const dots: Array<{
      connectionId: string;
      x: number;
      y: number;
      butt: boolean;
    }> = [];
    for (const edge of edges) {
      if (edge.type !== "splice") continue;
      const butt = isButtEdgeId(edge.id);
      // Split fiber splices expose their dot on the left-leg edge; collapsed
      // buffer-tube butts are a single `butt-*` edge carrying the big square.
      if (!butt && !edge.id.startsWith("splice-left-")) continue;
      const data = (edge.data ?? {}) as {
        spliceX?: number;
        spliceY?: number;
        fullButtSplice?: boolean;
      };
      if (!butt && data.fullButtSplice) continue;
      const x = Number(data.spliceX ?? NaN);
      const y = Number(data.spliceY ?? NaN);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      dots.push({
        connectionId: butt ? edge.id : edge.id.slice("splice-left-".length),
        x,
        y,
        butt,
      });
    }
    cachedDotsRef.current = dots;
    return dots;
  }, [showDots, edges, legSegmentDragActive]);

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
      } else {
        // A plain click on empty canvas clears the current selection so smart
        // bundle selection is not sticky.
        onClearSelection();
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
    onClearSelection,
    screenToFlowPosition,
  ]);

  if (!enabled && !showDots) return null;

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
        {enabled
          ? draggableSegments
              .filter(
                (item) =>
                  hoveredKey === item.key ||
                  selection.connectionIds.has(item.connectionId),
              )
              .map((item) => {
                const style = segmentHighlightStyle(
                  item.segment,
                  flowToPanelLocal,
                  viewport.zoom,
                );
                if (!style) return null;
                const selected = selection.connectionIds.has(item.connectionId);
                return (
                  <div
                    key={`hl-${item.key}`}
                    className={`manual-adjust-segment-highlight${
                      selected ? " manual-adjust-segment-highlight--selected" : ""
                    }`}
                    style={style}
                  />
                );
              })
          : null}
        {enabled
          ? draggableSegments.map((item) => (
          <button
            key={item.key}
            type="button"
            className="manual-adjust-segment nodrag nopan"
            style={segmentHitStyle(item.segment, flowToPanelLocal, item.cursor)}
            title={
              item.buttSegment
                ? `Drag collapsed tube center leg (${item.axes.join(", ")})`
                : `Drag leg segment ${item.segmentIndex} (${item.axes.join(", ")})`
            }
            aria-label={
              item.buttSegment
                ? `Adjust collapsed buffer tube center segment ${item.segmentIndex}`
                : `Adjust ${item.side} leg segment ${item.segmentIndex}`
            }
            onPointerEnter={() => setHoveredKey(item.key)}
            onPointerLeave={() =>
              setHoveredKey((current) => (current === item.key ? null : current))
            }
            onPointerDown={(event) => {
              event.stopPropagation();
              maybeBeginLongPress(item.connectionId, event);
              onSegmentPointerDown(
                item.connectionId,
                item.side,
                item.segmentIndex,
                event,
              );
            }}
            onDoubleClick={(event) => {
              event.stopPropagation();
              if (!item.buttSegment) {
                onSegmentDoubleClick(
                  item.connectionId,
                  event.ctrlKey || event.metaKey,
                );
              }
            }}
          />
        ))
          : null}
        {enabled
          ? nodes
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
              })
          : null}
        {fusionDots.map((dot) => {
          const panel = flowToPanelLocal(dot.x, dot.y);
          const selected = selection.connectionIds.has(dot.connectionId);
          const locked = lockedFusionDots?.has(dot.connectionId) ?? false;
          return (
            <button
              key={`dot-${dot.connectionId}`}
              type="button"
              className={`manual-adjust-dot nodrag nopan${
                dot.butt ? " manual-adjust-dot--square" : ""
              }${selected ? " manual-adjust-dot--selected" : ""}${
                locked ? " manual-adjust-dot--locked" : ""
              }`}
              style={{
                left: panel.x - (dot.butt ? BUTT_DOT_HIT : DOT_HIT) / 2,
                top: panel.y - (dot.butt ? BUTT_DOT_HIT : DOT_HIT) / 2,
                width: dot.butt ? BUTT_DOT_HIT : DOT_HIT,
                height: dot.butt ? BUTT_DOT_HIT : DOT_HIT,
              }}
              title={
                dot.butt
                  ? "Drag collapsed buffer-tube splice (horizontal)"
                  : locked
                    ? "Fusion dot locked — right-click to unlock"
                    : "Drag fusion splice dot (color transition); right-click to lock"
              }
              aria-label={
                dot.butt
                  ? `Move collapsed buffer tube splice for ${dot.connectionId}`
                  : `Move fusion splice dot for ${dot.connectionId}`
              }
              onPointerDown={(event) => {
                event.stopPropagation();
                maybeBeginLongPress(dot.connectionId, event);
                onDotPointerDown(dot.connectionId, event);
              }}
              onDoubleClick={(event) => {
                event.stopPropagation();
                onSegmentDoubleClick(
                  dot.connectionId,
                  event.ctrlKey || event.metaKey,
                );
              }}
              onContextMenu={(event) => {
                if (dot.butt || !onFusionDotContextMenu) return;
                event.preventDefault();
                event.stopPropagation();
                onFusionDotContextMenu(
                  dot.connectionId,
                  event.clientX,
                  event.clientY,
                );
              }}
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
