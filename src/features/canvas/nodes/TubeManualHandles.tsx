import { useCallback, useRef } from "react";

import { collapsedTubeHandleLocalX } from "@/features/canvas/edges/splicePathGeometry";
import { useManualLayout } from "@/features/canvas/ManualLayoutContext";
import { clampFanoutShiftY } from "@/features/manualAdjust/constraints";
import { tubeKeyFor } from "@/features/diagram/tubeRowShift";
import type { VisualTube } from "@/features/diagram/visualCables";
import type { TubeColorCode } from "@/types/splice";

type TubeGeom = {
  tubeColor: TubeColorCode;
  end: { x: number; y: number };
  origin: { x: number; y: number };
};

type Props = {
  visualCableId: string;
  side: "left" | "right";
  tubes: VisualTube[];
  tubeGeoms: TubeGeom[];
  collapsedTubes: Set<string>;
  stemX: number;
  tubeFaceX: number;
  defaultTubeLength: number;
  alignedStemX?: number;
};

export function TubeManualHandles({
  visualCableId,
  side,
  tubes,
  tubeGeoms,
  collapsedTubes,
  stemX,
  tubeFaceX: _tubeFaceX,
  defaultTubeLength: _defaultTubeLength,
  alignedStemX: _alignedStemX,
}: Props) {
  const manual = useManualLayout();
  const dragRef = useRef<{
    tubeColor: TubeColorCode;
    startPointerY: number;
    startShiftY: number;
    baseTipY: number;
  } | null>(null);

  const tubeState = useCallback(
    (tubeColor: TubeColorCode) => {
      const source = tubes.find((t) => t.tubeColor === tubeColor);
      const preview = manual?.tubePreview.get(
        tubeKeyFor(visualCableId, tubeColor),
      );
      return {
        visualShiftY: preview?.visualShiftY ?? source?.visualShiftY ?? 0,
        savedShiftY: source?.visualShiftY ?? 0,
        savedReachX: source?.stemReachX ?? 0,
      };
    },
    [manual?.tubePreview, tubes, visualCableId],
  );

  if (!manual?.manualAdjustEnabled) return null;

  const onPointerDown = (
    event: React.PointerEvent,
    tubeColor: TubeColorCode,
    baseTipY: number,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const state = tubeState(tubeColor);
    dragRef.current = {
      tubeColor,
      startPointerY: event.clientY,
      startShiftY: state.visualShiftY,
      baseTipY,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !manual) return;
    event.stopPropagation();

    const tubeKey = tubeKeyFor(visualCableId, drag.tubeColor);
    const prevPreview = manual.tubePreview.get(tubeKey);
    const delta = event.clientY - drag.startPointerY;
    const next = clampFanoutShiftY(drag.startShiftY + delta);
    manual.setTubePreview(tubeKey, { ...prevPreview, visualShiftY: next });
    manual.setActiveGuides([]);
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag || !manual) return;
    dragRef.current = null;
    manual.setActiveGuides([]);

    const tubeKey = tubeKeyFor(visualCableId, drag.tubeColor);
    const state = tubeState(drag.tubeColor);
    const finalShift = clampFanoutShiftY(state.visualShiftY);
    const patch = {
      visualShiftY:
        Math.abs(finalShift) < 0.5 ? undefined : finalShift,
    };

    manual.setTubePreview(tubeKey, null);
    manual.onTubeOverrideCommit(tubeKey, patch);
  };

  return (
    <div
      className="cable-node__manual-handles nodrag nopan"
      onPointerMove={onPointerMove}
      onPointerUp={(e) => {
        e.stopPropagation();
        finishDrag();
      }}
      onPointerCancel={(e) => {
        e.stopPropagation();
        finishDrag();
      }}
    >
      {tubeGeoms.map((tube) => {
        const collapsed = collapsedTubes.has(tube.tubeColor);
        const state = tubeState(tube.tubeColor);
        const baseTipY = tube.end.y - state.savedShiftY;
        const displayEndY = baseTipY + state.visualShiftY;
        const displayEndX = collapsed
          ? collapsedTubeHandleLocalX(side, stemX)
          : tube.end.x -
            (side === "left" ? state.savedReachX : -state.savedReachX);

        return (
          <button
            key={tube.tubeColor}
            type="button"
            className="cable-node__tube-tip-drag nodrag nopan"
            style={{
              left: displayEndX - 6,
              top: displayEndY - 6,
            }}
            title={
              collapsed
                ? "Drag collapsed tube up/down"
                : "Drag tube tip (vertical)"
            }
            aria-label={`Adjust ${tube.tubeColor} tube height`}
            onPointerDown={(e) => onPointerDown(e, tube.tubeColor, baseTipY)}
          />
        );
      })}
    </div>
  );
}
