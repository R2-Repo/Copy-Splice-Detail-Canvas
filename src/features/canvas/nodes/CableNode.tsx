import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, type CSSProperties } from "react";

import { CABLE_LAYOUT } from "@/features/diagram/cableLayoutMetrics";
import { collapsedTubeHandleLocalX } from "@/features/canvas/edges/splicePathGeometry";
import {
  computeCableBreakout,
  fiberFanTailPathD,
  fiberFanTopPathD,
} from "@/features/diagram/cableBreakoutGeometry";
import { useCircuitHighlight } from "@/features/canvas/CircuitHighlightContext";
import {
  colorHex,
  colorName,
  isStripedTube,
  needsFiberContrastOutline,
} from "@/features/diagram/colorCode";
import { ContrastSvgLine } from "@/features/canvas/nodes/ContrastSvgLine";
import { ContrastSvgPath } from "@/features/canvas/nodes/ContrastSvgPath";
import { TubeManualHandles } from "@/features/canvas/nodes/TubeManualHandles";
import { formatCircuitTag } from "@/features/diagram/cableLabels";
import { tubeHandleId } from "@/features/diagram/tubeId";
import type { FiberColorAbbrev, TubeColorCode } from "@/types/splice";

import type { CableNodeData } from "./types";

function tubeStroke(
  tubeColor: TubeColorCode,
  striped: boolean,
): { stroke: string; strokeDasharray?: string } {
  const base = tubeColor.split("-")[0] as FiberColorAbbrev;
  return {
    stroke: colorHex(base),
    strokeDasharray: striped ? "6 4" : undefined,
  };
}

export function CableNode({ id, data }: NodeProps) {
  const d = data as CableNodeData;
  const { isFiberHighlighted } = useCircuitHighlight();
  const handlePos = d.side === "left" ? Position.Right : Position.Left;
  const pitch = d.fiberPitch ?? CABLE_LAYOUT.fiberRowH;
  const scale = d.diagramScale ?? 1;
  const updateNodeInternals = useUpdateNodeInternals();
  const collapsedTubes = new Set(d.collapsedTubes ?? []);

  const geo = computeCableBreakout(
    d.tubes,
    d.side,
    pitch,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
    scale,
    d.alignedStemX,
  );

  useEffect(() => {
    updateNodeInternals(id);
  }, [
    id,
    d.side,
    d.tubes,
    d.collapsedTubes,
    geo.viewWidth,
    geo.viewHeight,
    updateNodeInternals,
  ]);

  const fiberByHandle = new Map(
    geo.tubes.flatMap((t) =>
      t.fibers.map((f) => [f.handleId, f] as const),
    ),
  );

  const allFibers = d.tubes
    .flatMap((tube) => tube.fibers.map((fiber) => ({ tube, fiber })))
    .sort(
      (a, b) =>
        a.fiber.fiberNumber - b.fiber.fiberNumber ||
        a.fiber.rowYOffset - b.fiber.rowYOffset,
    );

  const isTubeCollapsed = (tubeColor: TubeColorCode): boolean =>
    collapsedTubes.has(tubeColor);

  const visualCableId = id.replace(/^cable-/, "");
  const defaultTubeLength =
    geo.tubes[0] != null
      ? Math.abs(geo.tubes[0].end.x - geo.tubes[0].origin.x)
      : 52;
  const tubeFaceX = d.side === "left" ? geo.sheath.width : geo.viewWidth - geo.sheath.width;

  return (
    <div
      className={`splice-node cable-node cable-node--composite cable-node--${d.side}${d.manualAdjustEnabled ? " cable-node--manual-adjust" : ""}`}
      style={
        {
          minHeight: d.nodeHeight,
          "--fiber-pitch": `${pitch}px`,
          "--fiber-strand": `${CABLE_LAYOUT.fiberStrandH}px`,
          width: geo.viewWidth,
          height: geo.viewHeight,
        } as CSSProperties
      }
    >
      <div
        className="cable-node__sheath"
        style={{
          left: geo.sheath.x,
          top: geo.sheath.y,
          width: geo.sheath.width,
          height: geo.sheath.height,
        }}
      >
        <div className="cable-node__titles">
          {d.smfoLabel ? (
            <span className="cable-node__smfo">{d.smfoLabel}</span>
          ) : null}
          <span className="cable-node__label">{d.label}</span>
        </div>
      </div>

      <svg
        className="cable-node__breakout-svg"
        width={geo.viewWidth}
        height={geo.viewHeight}
        aria-hidden
      >
        {geo.tubes.map((tube) => {
          const collapsed = isTubeCollapsed(tube.tubeColor);
          const striped = isStripedTube(tube.tubeColor);
          const stroke = tubeStroke(tube.tubeColor, striped);
          const tubeBase = tube.tubeColor.split("-")[0] as FiberColorAbbrev;
          const sourceTube = d.tubes.find((t) => t.tubeColor === tube.tubeColor);
          const collapsedHandleY =
            tube.end.y + (sourceTube?.visualShiftY ?? 0);
          const lineStart = tube.origin;
          const lineEnd = collapsed
            ? {
                x: collapsedTubeHandleLocalX(d.side, geo.stemX),
                y: collapsedHandleY,
              }
            : tube.end;
          const tubeHighlighted =
            collapsed &&
            (sourceTube?.fibers.some((fiber) =>
              isFiberHighlighted(
                fiber.connectionId,
                fiber.spliceConnectionIds,
              ),
            ) ??
              false);
          const renderFanLayer = (
            layer: "tail" | "top",
            keySuffix: string,
          ) =>
            !collapsed
              ? tube.fibers.map((fiberGeom) => {
                  const sourceFiber = sourceTube?.fibers.find(
                    (f) => f.handleId === fiberGeom.handleId,
                  );
                  const fiberHighlighted = sourceFiber
                    ? isFiberHighlighted(
                        sourceFiber.connectionId,
                        sourceFiber.spliceConnectionIds,
                      )
                    : false;
                  const d =
                    layer === "tail"
                      ? fiberFanTailPathD(fiberGeom)
                      : fiberFanTopPathD(fiberGeom);
                  return (
                    <ContrastSvgPath
                      key={`${fiberGeom.handleId}-${keySuffix}`}
                      d={d}
                      stroke={colorHex(fiberGeom.fiberColor)}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      contrastOutline={needsFiberContrastOutline(
                        fiberGeom.fiberColor,
                      )}
                      className={
                        fiberHighlighted
                          ? "circuit-highlight-target"
                          : undefined
                      }
                    />
                  );
                })
              : null;

          return (
            <g key={tube.tubeColor}>
              {renderFanLayer("tail", "under")}
              <ContrastSvgLine
                x1={lineStart.x}
                y1={lineStart.y}
                x2={lineEnd.x}
                y2={lineEnd.y}
                stroke={stroke.stroke}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={stroke.strokeDasharray}
                contrastOutline={needsFiberContrastOutline(tubeBase)}
                className={
                  tubeHighlighted ? "circuit-highlight-target circuit-highlight-target--tube" : undefined
                }
              />
              {renderFanLayer("top", "over")}
            </g>
          );
        })}
      </svg>

      {geo.tubes.map((tube) => {
        if (isTubeCollapsed(tube.tubeColor)) return null;
        return (
          <span
            key={`label-${tube.tubeColor}`}
            className="cable-node__tube-label"
            style={{
              left: tube.labelPos.x,
              top: tube.labelPos.y,
              transform:
                tube.labelPos.placement === "below"
                  ? "translate(-50%, 0)"
                  : "translate(-50%, -100%)",
            }}
          >
            {tube.tubeColor}
          </span>
        );
      })}

      <div className="cable-node__fiber-rows">
        {allFibers.map(({ tube, fiber }) => {
          if (isTubeCollapsed(tube.tubeColor)) return null;

          const fg = fiberByHandle.get(fiber.handleId);
          const rowY = fg?.rowY ?? 0;
          const circuit = formatCircuitTag(
            fiber.circuitName,
            fiber.fiberColor,
          );
          const fiberHighlighted = isFiberHighlighted(
            fiber.connectionId,
            fiber.spliceConnectionIds,
          );
          return (
            <div
              key={fiber.handleId}
              className={`cable-node__fiber-row${fiberHighlighted ? " cable-node__fiber-row--highlighted" : ""}`}
              style={{
                top: rowY,
                left: d.side === "left" ? geo.stemX : undefined,
                right:
                  d.side === "right" ? geo.viewWidth - geo.stemX : undefined,
              }}
            >
              {!d.slim ? (
                <>
                  <Handle
                    type="source"
                    position={handlePos}
                    id={`${fiber.handleId}-out`}
                    className="cable-node__handle"
                  />
                  <Handle
                    type="target"
                    position={handlePos}
                    id={`${fiber.handleId}-in`}
                    className="cable-node__handle"
                  />
                </>
              ) : null}
              <span
                className="cable-node__fiber-swatch"
                style={{
                  backgroundColor: colorHex(fiber.fiberColor),
                }}
                title={colorName(fiber.fiberColor)}
              />
              <span className="cable-node__fiber-code">
                {fiber.fiberColor}
              </span>
              {circuit ? (
                <span className="cable-node__circuit">{circuit}</span>
              ) : null}
            </div>
          );
        })}

        {geo.tubes.map((tube) => {
          if (!isTubeCollapsed(tube.tubeColor)) return null;
          const handleBase = tubeHandleId(d.legId, tube.tubeColor);
          const sourceTube = d.tubes.find((t) => t.tubeColor === tube.tubeColor);
          const collapsedHandleY =
            tube.end.y + (sourceTube?.visualShiftY ?? 0);
          return (
            <div
              key={handleBase}
              className="cable-node__fiber-row cable-node__fiber-row--tube"
              style={{
                top: collapsedHandleY,
                left: d.side === "left" ? geo.stemX : undefined,
                right:
                  d.side === "right" ? geo.viewWidth - geo.stemX : undefined,
              }}
            >
              <Handle
                type="source"
                position={handlePos}
                id={`${handleBase}-out`}
                className="cable-node__handle"
              />
              <Handle
                type="target"
                position={handlePos}
                id={`${handleBase}-in`}
                className="cable-node__handle"
              />
            </div>
          );
        })}
      </div>

      {d.manualAdjustEnabled ? (
        <TubeManualHandles
          visualCableId={visualCableId}
          side={d.side}
          tubes={d.tubes}
          tubeGeoms={geo.tubes}
          collapsedTubes={collapsedTubes}
          tubeFaceX={tubeFaceX}
          defaultTubeLength={defaultTubeLength}
        />
      ) : null}
    </div>
  );
}
