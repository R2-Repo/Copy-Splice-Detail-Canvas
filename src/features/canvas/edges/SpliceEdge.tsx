import { BaseEdge, type EdgeProps } from "@xyflow/react";

import {
  buildButtSplicePath,
  buildSplicePath,
  defaultSideCircuitLabelSpan,
  routingLaneFromData,
  useRoutingLaneIndex,
} from "@/features/canvas/edges/spliceEdgeRouting";
import { formattedCircuitTagWidth } from "@/features/diagram/cableLabels";
import type { SideCircuitLabelSpan } from "@/features/diagram/cableLabels";
import {
  FIBER_CONTRAST_OUTLINE,
  needsFiberContrastOutlineHex,
} from "@/features/diagram/colorCode";

type SpliceEdgeData = {
  /** @deprecated use sourceColor */
  color?: string;
  sourceColor?: string;
  targetColor?: string;
  existing?: boolean;
  fullButtSplice?: boolean;
  laneIndex?: number;
  laneCount?: number;
  laneOverride?: number;
  /** Global row offset (px) for proportional center lane spacing. */
  rowOffset?: number;
  /** Longest OS label span per side — splice jog starts after this. */
  sideCircuitSpan?: SideCircuitLabelSpan;
  /** Same source tube + target cable — fibers share one center lane. */
  tubeBundleKey?: string;
  circuitName?: string;
  diagramCenterX?: number;
  routingMidX?: number;
  routingJogX?: number;
  routingSourceHorizY?: number;
  routingTargetHorizY?: number;
  routingSourceBendX?: number;
  routingTargetBendX?: number;
  routingPrecomputed?: boolean;
  leftPath?: string;
  rightPath?: string;
  spliceX?: number;
  spliceY?: number;
  /** Nodes engine: one leg per edge (fusion dot lives on splicePoint node). */
  splitLeg?: "left" | "right";
};

function SpliceLeg({
  id,
  path,
  stroke,
  strokeWidth,
  strokeDasharray,
  opacity,
}: {
  id: string;
  path: string;
  stroke: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
}) {
  const edgeStyle = {
    strokeWidth,
    strokeDasharray,
    opacity,
  };
  const contrast = needsFiberContrastOutlineHex(stroke);

  return (
    <>
      {contrast ? (
        <BaseEdge
          id={`${id}-outline`}
          path={path}
          style={{
            ...edgeStyle,
            stroke: FIBER_CONTRAST_OUTLINE,
            strokeWidth: strokeWidth + 2,
          }}
        />
      ) : null}
      <BaseEdge id={id} path={path} style={{ ...edgeStyle, stroke }} />
    </>
  );
}

function spliceEdgeStrokes(d: SpliceEdgeData) {
  const fallback = d.color ?? "#e2e8f0";
  const sourceStroke = d.existing ? "#94a3b8" : (d.sourceColor ?? fallback);
  const targetStroke = d.existing ? "#94a3b8" : (d.targetColor ?? fallback);
  const dash = d.existing ? "8 5" : undefined;
  const tubeStroke = d.fullButtSplice ? 8 : d.existing ? 1.5 : 2.5;
  const edgeOpacity = d.existing ? 0.85 : 1;
  return { sourceStroke, targetStroke, dash, tubeStroke, edgeOpacity };
}

function SpliceEdgeBody({
  id,
  d,
  leftPath,
  rightPath,
  spliceX,
  spliceY,
}: {
  id: string;
  d: SpliceEdgeData;
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
}) {
  const { sourceStroke, targetStroke, dash, tubeStroke, edgeOpacity } =
    spliceEdgeStrokes(d);
  const splitLeg = d.splitLeg;
  const showLeft = splitLeg !== "right";
  const showRight = splitLeg !== "left";
  const showFusionDot = splitLeg === undefined;

  return (
    <>
      {showLeft ? (
        <SpliceLeg
          id={`${id}-left`}
          path={leftPath}
          stroke={sourceStroke}
          strokeWidth={tubeStroke}
          strokeDasharray={dash}
          opacity={edgeOpacity}
        />
      ) : null}
      {showRight ? (
        <SpliceLeg
          id={`${id}-right`}
          path={rightPath}
          stroke={targetStroke}
          strokeWidth={tubeStroke}
          strokeDasharray={dash}
          opacity={edgeOpacity}
        />
      ) : null}
      {!d.existing && showFusionDot ? (
        d.fullButtSplice ? (
          <rect
            x={spliceX - 8}
            y={spliceY - 8}
            width={16}
            height={16}
            fill="#000"
            className="splice-edge__square"
          />
        ) : (
          <circle
            cx={spliceX}
            cy={spliceY}
            r={4}
            fill="#000"
            className="splice-edge__dot"
          />
        )
      ) : null}
    </>
  );
}

/** Nodes engine: paths frozen at layout time — no drag registry or render-time routing. */
function PrecomputedSpliceEdge({
  id,
  data,
}: {
  id: string;
  data: SpliceEdgeData;
}) {
  return (
    <SpliceEdgeBody
      id={id}
      d={data}
      leftPath={data.leftPath!}
      rightPath={data.rightPath!}
      spliceX={data.spliceX!}
      spliceY={data.spliceY!}
    />
  );
}

/** Legacy engine: resolve lanes from stored data, drag snapshot, or live registry. */
function LiveSpliceEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
}: EdgeProps & { data: SpliceEdgeData }) {
  const d = data;
  const fallbackLane = d.laneOverride ?? d.laneIndex ?? 0;
  const laneCount = Math.max(1, d.laneCount ?? 1);
  const useDynamicLanes = laneCount > 1;
  const storedLane = routingLaneFromData(d);
  const sourceTagWidth = formattedCircuitTagWidth(d.circuitName);
  const targetTagWidth = sourceTagWidth;

  const liveRouting = useRoutingLaneIndex(
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    fallbackLane,
    useDynamicLanes,
    laneCount,
    d.rowOffset,
    d.sideCircuitSpan ?? defaultSideCircuitLabelSpan(),
    d.tubeBundleKey,
    storedLane,
    sourceTagWidth,
    targetTagWidth,
    d.diagramCenterX,
    d.fullButtSplice === true,
  );

  const sideSpans = d.sideCircuitSpan ?? defaultSideCircuitLabelSpan();
  const { leftPath, rightPath, spliceX, spliceY } = d.fullButtSplice
    ? buildButtSplicePath(
        sourceX,
        sourceY,
        targetX,
        targetY,
        liveRouting.midX,
        sideSpans,
        d.diagramCenterX,
        fallbackLane,
        laneCount,
      )
    : buildSplicePath(
        sourceX,
        sourceY,
        targetX,
        targetY,
        liveRouting.midX,
        liveRouting.jogX,
        {
          sourceHorizY: liveRouting.sourceHorizY,
          targetHorizY: liveRouting.targetHorizY,
          sourceBendX: liveRouting.sourceBendX,
          targetBendX: liveRouting.targetBendX,
        },
        sideSpans,
        d.diagramCenterX,
        sourceTagWidth,
        targetTagWidth,
      );

  return (
    <SpliceEdgeBody
      id={id}
      d={d}
      leftPath={leftPath}
      rightPath={rightPath}
      spliceX={spliceX}
      spliceY={spliceY}
    />
  );
}

function isPrecomputedSpliceData(d: SpliceEdgeData): boolean {
  return (
    d.routingPrecomputed === true &&
    d.leftPath !== undefined &&
    d.rightPath !== undefined &&
    d.spliceX !== undefined &&
    d.spliceY !== undefined
  );
}

export function SpliceEdge(props: EdgeProps) {
  const d = (props.data ?? {}) as SpliceEdgeData;
  if (isPrecomputedSpliceData(d)) {
    return <PrecomputedSpliceEdge id={props.id} data={d} />;
  }
  return <LiveSpliceEdge {...props} data={d} />;
}
