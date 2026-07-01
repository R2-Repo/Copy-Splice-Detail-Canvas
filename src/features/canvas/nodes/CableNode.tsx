import {
  Handle,
  Position,
  useUpdateNodeInternals,
  type NodeProps,
} from "@xyflow/react";
import { useEffect, useMemo, type CSSProperties } from "react";

import { useManualLayout } from "@/features/canvas/ManualLayoutContext";
import { useCanvasContextMenu } from "@/features/canvas/contextMenu/CanvasContextMenuContext";
import { LockGlyph } from "@/features/canvas/contextMenu/LockGlyph";

import {
  CABLE_LAYOUT,
  FIBER_HANDLE_DOT,
  FIBER_ROW_CODE_MIN_WIDTH,
} from "@/features/diagram/cableLayoutMetrics";
import { collapsedTubeHandleLocalX } from "@/features/canvas/edges/splicePathGeometry";
import {
  computeCableBreakout,
  fiberFanTailPathD,
  fiberFanTopPathD,
} from "@/features/diagram/cableBreakoutGeometry";
import { quadRenderTransform } from "@/features/diagram/quad/quadGeometry";
import { useCircuitHighlight } from "@/features/canvas/CircuitHighlightContext";
import {
  colorHex,
  isStripedTube,
  needsFiberContrastOutline,
} from "@/features/diagram/colorCode";
import { ContrastSvgLine } from "@/features/canvas/nodes/ContrastSvgLine";
import { ContrastSvgPath } from "@/features/canvas/nodes/ContrastSvgPath";
import { TubeManualHandles } from "@/features/canvas/nodes/TubeManualHandles";
import {
  fiberRowLayoutXs,
  formatCircuitTag,
} from "@/features/diagram/cableLabels";
import { tubeHandleId } from "@/features/diagram/tubeId";
import { tubeKeyFor } from "@/features/diagram/tubeRowShift";
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

export function CableNode({ id, data, positionAbsoluteY }: NodeProps) {
  const d = data as CableNodeData;
  // Quad mode: vertical (top/bottom) cables render the canonical left breakout
  // rotated 90° (see quadRenderTransform); all inner geometry uses renderSide.
  const renderSide = d.orientation === "vertical" ? "left" : d.side;
  const manual = useManualLayout();
  const ctxMenu = useCanvasContextMenu();
  const { isFiberHighlighted } = useCircuitHighlight();
  const handlePos = renderSide === "left" ? Position.Right : Position.Left;
  const pitch = d.fiberPitch ?? CABLE_LAYOUT.fiberRowH;
  const scale = d.diagramScale ?? 1;
  const updateNodeInternals = useUpdateNodeInternals();
  const collapsedTubes = new Set(d.collapsedTubes ?? []);
  const visualCableId = id.replace(/^cable-/, "");
  const lockedTubeSet = new Set(d.lockedTubes ?? []);

  const openTubeMenu = (e: React.MouseEvent, tubeColor: string) => {
    e.preventDefault();
    e.stopPropagation();
    ctxMenu.openMenu(
      { kind: "tubeGroup", visualCableId, tubeColor },
      e.clientX,
      e.clientY,
    );
  };

  const tubesForRender = useMemo(() => {
    const preview = manual?.tubePreview;
    if (!preview?.size) return d.tubes;
    return d.tubes.map((tube) => {
      const key = tubeKeyFor(visualCableId, tube.tubeColor);
      const patch = preview.get(key);
      if (patch?.visualShiftY === undefined && patch?.stemReachX === undefined) {
        return tube;
      }
      return {
        ...tube,
        ...(patch?.visualShiftY !== undefined
          ? { visualShiftY: patch.visualShiftY }
          : {}),
        ...(patch?.stemReachX !== undefined
          ? { stemReachX: patch.stemReachX }
          : {}),
      };
    });
  }, [d.tubes, manual?.tubePreview, visualCableId]);

  const geo = computeCableBreakout(
    tubesForRender,
    renderSide,
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
    renderSide,
    tubesForRender,
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

  const allFibers = tubesForRender
    .flatMap((tube) => tube.fibers.map((fiber) => ({ tube, fiber })))
    .sort(
      (a, b) =>
        a.fiber.fiberNumber - b.fiber.fiberNumber ||
        a.fiber.rowYOffset - b.fiber.rowYOffset,
    );

  const isTubeCollapsed = (tubeColor: TubeColorCode): boolean =>
    collapsedTubes.has(tubeColor);

  const defaultTubeLength =
    geo.tubes[0] != null
      ? Math.abs(geo.tubes[0].end.x - geo.tubes[0].origin.x)
      : 52;
  const tubeFaceX = renderSide === "left" ? geo.sheath.width : geo.viewWidth - geo.sheath.width;
  const stemAbsolute =
    renderSide === "left" ? geo.stemX : geo.viewWidth - geo.stemX;

  const localX = (x: number, width = 0): number =>
    renderSide === "left" ? x : geo.viewWidth - x - width;

  const content = (
    <div
      className={`splice-node cable-node cable-node--composite cable-node--${renderSide}${d.manualAdjustEnabled ? " cable-node--manual-adjust" : ""}`}
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
          const collapsedHandleY = tube.end.y;
          const lineStart = tube.origin;
          const lineEnd = collapsed
            ? {
                x: collapsedTubeHandleLocalX(renderSide, geo.stemX),
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
            <g
              key={tube.tubeColor}
              onContextMenu={(e) => openTubeMenu(e, tube.tubeColor)}
              style={{ pointerEvents: "auto" }}
            >
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
        const tubeLocked = lockedTubeSet.has(tube.tubeColor);
        return (
          <span
            key={`label-${tube.tubeColor}`}
            className={`cable-node__tube-label${tubeLocked ? " cable-node__tube-label--locked" : ""}`}
            style={{
              left: tube.labelPos.x,
              top: tube.labelPos.y,
              transform:
                tube.labelPos.placement === "below"
                  ? "translate(-50%, 0)"
                  : "translate(-50%, -100%)",
            }}
            onContextMenu={(e) => openTubeMenu(e, tube.tubeColor)}
          >
            {tube.tubeColor}
            {tubeLocked ? (
              <span className="cable-node__tube-lock" aria-label="Fan-out group locked">
                <LockGlyph size={10} />
              </span>
            ) : null}
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
          const layout = fiberRowLayoutXs(stemAbsolute, fiber.circuitName);
          const tagWidth = Math.max(0, layout.labelEndX - layout.labelStartX);
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
                left: 0,
                width: geo.viewWidth,
              }}
            >
              {circuit ? (
                <span
                  className="cable-node__circuit"
                  style={{
                    left: localX(
                      layout.labelEndX - tagWidth,
                      tagWidth,
                    ),
                    width: tagWidth > 0 ? tagWidth : undefined,
                  }}
                >
                  {circuit}
                </span>
              ) : null}
              <span
                className="cable-node__fiber-code"
                style={{
                  left: localX(layout.codeLeftX, FIBER_ROW_CODE_MIN_WIDTH),
                  width: FIBER_ROW_CODE_MIN_WIDTH,
                }}
              >
                {fiber.fiberColor}
              </span>
              {!d.slim ? (
                <div
                  className="cable-node__handle-slot"
                  style={{
                    left: localX(
                      layout.handleX - FIBER_HANDLE_DOT / 2,
                      FIBER_HANDLE_DOT,
                    ),
                    width: FIBER_HANDLE_DOT,
                  }}
                >
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
                </div>
              ) : null}
            </div>
          );
        })}

        {geo.tubes.map((tube) => {
          if (!isTubeCollapsed(tube.tubeColor)) return null;
          const handleBase = tubeHandleId(d.legId, tube.tubeColor);
          const collapsedHandleY = tube.end.y;
          const collapsedLayout = fiberRowLayoutXs(stemAbsolute);
          return (
            <div
              key={handleBase}
              className="cable-node__fiber-row cable-node__fiber-row--tube"
              style={{
                top: collapsedHandleY,
                left: 0,
                width: geo.viewWidth,
              }}
            >
              <div
                className="cable-node__handle-slot"
                style={{
                  left: localX(
                    collapsedLayout.handleX - FIBER_HANDLE_DOT / 2,
                    FIBER_HANDLE_DOT,
                  ),
                  width: FIBER_HANDLE_DOT,
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
            </div>
          );
        })}
      </div>

      {d.manualAdjustEnabled ? (
        <TubeManualHandles
          visualCableId={visualCableId}
          side={renderSide}
          tubes={tubesForRender}
          tubeGeoms={geo.tubes}
          collapsedTubes={collapsedTubes}
          lockedTubes={lockedTubeSet}
          stemX={geo.stemX}
          tubeFaceX={tubeFaceX}
          defaultTubeLength={defaultTubeLength}
          alignedStemX={d.alignedStemX}
          nodeAbsoluteY={positionAbsoluteY}
          onTubeContextMenu={openTubeMenu}
        />
      ) : null}
    </div>
  );

  if (
    d.orientation === "vertical" &&
    (d.quadSide === "top" || d.quadSide === "bottom")
  ) {
    const t = quadRenderTransform(d.quadSide, geo.viewWidth, geo.viewHeight);
    if (t) {
      return (
        <div
          className={`cable-node-quad-wrap cable-node-quad-wrap--${d.quadSide}`}
          style={{
            position: "relative",
            width: t.boxWidth,
            height: t.boxHeight,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: geo.viewWidth,
              height: geo.viewHeight,
              transformOrigin: "0 0",
              transform: t.transform,
            }}
          >
            {content}
          </div>
        </div>
      );
    }
  }

  return content;
}
