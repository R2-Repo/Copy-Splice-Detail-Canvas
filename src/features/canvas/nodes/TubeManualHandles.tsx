import { useCallback, useRef, useState } from "react";

import { useManualLayout } from "@/features/canvas/ManualLayoutContext";
import {
  snapStemReachX,
  snapTubeTipShiftY,
} from "@/features/diagram/snapGuides";
import {
  MAX_TUBE_ROW_SHIFT,
  tubeKeyFor,
} from "@/features/diagram/tubeRowShift";
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
  tubeFaceX,
  defaultTubeLength,
  alignedStemX,
}: Props) {
  const manual = useManualLayout();
  const [preview, setPreview] = useState<
    Map<TubeColorCode, { visualShiftY?: number; stemReachX?: number }>
  >(new Map());
  const dragRef = useRef<{
    tubeColor: TubeColorCode;
    axis: "y" | "x";
    startPointer: number;
    startShiftY: number;
    startReachX: number;
    baseTipY: number;
  } | null>(null);

  const tubeState = useCallback(
    (tubeColor: TubeColorCode) => {
      const source = tubes.find((t) => t.tubeColor === tubeColor);
      const p = preview.get(tubeColor);
      return {
        visualShiftY: p?.visualShiftY ?? source?.visualShiftY ?? 0,
        stemReachX: p?.stemReachX ?? source?.stemReachX ?? 0,
        savedShiftY: source?.visualShiftY ?? 0,
        savedReachX: source?.stemReachX ?? 0,
      };
    },
    [preview, tubes],
  );

  if (!manual?.manualAdjustEnabled) return null;

  const onPointerDown = (
    event: React.PointerEvent,
    tubeColor: TubeColorCode,
    axis: "y" | "x",
    baseTipY: number,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    const state = tubeState(tubeColor);
    dragRef.current = {
      tubeColor,
      axis,
      startPointer: axis === "y" ? event.clientY : event.clientX,
      startShiftY: state.visualShiftY,
      startReachX: state.stemReachX,
      baseTipY,
    };
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !manual) return;
    event.stopPropagation();

    if (drag.axis === "y") {
      const delta = event.clientY - drag.startPointer;
      let next = drag.startShiftY + delta;
      next = Math.max(-MAX_TUBE_ROW_SHIFT, Math.min(MAX_TUBE_ROW_SHIFT, next));
      next = snapTubeTipShiftY(
        next,
        drag.baseTipY + next,
        manual.snapTipTargets,
      );
      setPreview((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(drag.tubeColor, {
          ...nextMap.get(drag.tubeColor),
          visualShiftY: next,
        });
        return nextMap;
      });
      manual.setActiveGuides([
        {
          id: `tip-${drag.tubeColor}`,
          orientation: "horizontal",
          value: drag.baseTipY + next,
        },
      ]);
    } else {
      const raw =
        drag.startReachX +
        (side === "left"
          ? event.clientX - drag.startPointer
          : drag.startPointer - event.clientX);
      const next = snapStemReachX(
        raw,
        alignedStemX,
        tubeFaceX,
        defaultTubeLength,
      );
      setPreview((prev) => {
        const nextMap = new Map(prev);
        nextMap.set(drag.tubeColor, {
          ...nextMap.get(drag.tubeColor),
          stemReachX: next,
        });
        return nextMap;
      });
      if (alignedStemX !== undefined) {
        manual.setActiveGuides([
          {
            id: `stem-${drag.tubeColor}`,
            orientation: "vertical",
            value: alignedStemX,
          },
        ]);
      }
    }
  };

  const finishDrag = () => {
    const drag = dragRef.current;
    if (!drag || !manual) return;
    dragRef.current = null;
    manual.setActiveGuides([]);

    const state = tubeState(drag.tubeColor);
    const tubeKey = tubeKeyFor(visualCableId, drag.tubeColor);
    const patch: { visualShiftY?: number; stemReachX?: number } = {};

    if (drag.axis === "y") {
      patch.visualShiftY =
        Math.abs(state.visualShiftY) < 0.5 ? undefined : state.visualShiftY;
    } else {
      patch.stemReachX =
        Math.abs(state.stemReachX) < 0.5 ? undefined : state.stemReachX;
    }

    setPreview((prev) => {
      const nextMap = new Map(prev);
      nextMap.delete(drag.tubeColor);
      return nextMap;
    });

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
        if (collapsedTubes.has(tube.tubeColor)) return null;
        const state = tubeState(tube.tubeColor);
        const baseTipY = tube.end.y - state.savedShiftY;
        const baseEndX =
          tube.end.x -
          (side === "left" ? state.savedReachX : -state.savedReachX);
        const displayEndY = baseTipY + state.visualShiftY;
        const displayEndX =
          baseEndX +
          (side === "left" ? state.stemReachX : -state.stemReachX);

        return (
          <div key={tube.tubeColor}>
            <button
              type="button"
              className="cable-node__tube-tip-drag nodrag nopan"
              style={{
                left: displayEndX - 6,
                top: displayEndY - 6,
              }}
              title="Drag tube tip (vertical)"
              aria-label={`Adjust ${tube.tubeColor} tube tip`}
              onPointerDown={(e) =>
                onPointerDown(e, tube.tubeColor, "y", baseTipY)
              }
            />
          </div>
        );
      })}
    </div>
  );
}
