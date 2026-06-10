import { useCallback, useRef } from "react";

import { useManualLayout } from "@/features/canvas/ManualLayoutContext";
import { snapManualShiftYOnRelease } from "@/features/diagram/snapGuides";
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
  tubeFaceX: _tubeFaceX,
  defaultTubeLength: _defaultTubeLength,
  alignedStemX,
}: Props) {
  const manual = useManualLayout();
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
      const preview = manual?.tubePreview.get(
        tubeKeyFor(visualCableId, tubeColor),
      );
      return {
        visualShiftY:
          preview?.visualShiftY ?? source?.visualShiftY ?? 0,
        stemReachX: preview?.stemReachX ?? source?.stemReachX ?? 0,
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

    const tubeKey = tubeKeyFor(visualCableId, drag.tubeColor);

    if (drag.axis === "y") {
      const delta = event.clientY - drag.startPointer;
      const next = clampFanoutShiftY(drag.startShiftY + delta);
      manual.setTubePreview(tubeKey, { visualShiftY: next });
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
      manual.setTubePreview(tubeKey, { stemReachX: raw });
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

    const tubeKey = tubeKeyFor(visualCableId, drag.tubeColor);
    const state = tubeState(drag.tubeColor);
    const patch: { visualShiftY?: number; stemReachX?: number } = {};

    if (drag.axis === "y") {
      const before = state.visualShiftY;
      let finalShift = clampFanoutShiftY(state.visualShiftY);
      finalShift = snapManualShiftYOnRelease(
        finalShift,
        drag.baseTipY,
        manual.snapTipTargets,
      );
      // #region agent log
      if (Math.abs(finalShift - before) > 0.01) {
        fetch("http://127.0.0.1:7276/ingest/954dc9e2-dc29-44e2-8638-93624e140b86", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Debug-Session-Id": "ab59ca",
          },
          body: JSON.stringify({
            sessionId: "ab59ca",
            location: "TubeManualHandles.tsx:finishDrag",
            message: "fan-out snap on release",
            data: { before, after: finalShift, rowAnchorY: drag.baseTipY },
            timestamp: Date.now(),
            hypothesisId: "S1",
            runId: "snap-fix",
          }),
        }).catch(() => {});
      }
      // #endregion
      patch.visualShiftY =
        Math.abs(finalShift) < 0.5 ? undefined : finalShift;
    } else {
      patch.stemReachX =
        Math.abs(state.stemReachX) < 0.5 ? undefined : state.stemReachX;
    }

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
