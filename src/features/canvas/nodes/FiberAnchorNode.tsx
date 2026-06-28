import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useEffect } from "react";

import { useCircuitHighlight } from "@/features/canvas/CircuitHighlightContext";
import { useManualLayout } from "@/features/canvas/ManualLayoutContext";
import { colorHex } from "@/features/diagram/colorCode";

import type { FiberAnchorNodeData } from "./types";

/** Inward (out) / outward (in) handle sides; quad top/bottom route vertically. */
function anchorHandlePositions(d: FiberAnchorNodeData): {
  outPos: Position;
  inPos: Position;
} {
  switch (d.quadSide) {
    case "top":
      return { outPos: Position.Bottom, inPos: Position.Top };
    case "bottom":
      return { outPos: Position.Top, inPos: Position.Bottom };
    case "right":
      return { outPos: Position.Left, inPos: Position.Right };
    default:
      return d.side === "left"
        ? { outPos: Position.Right, inPos: Position.Left }
        : { outPos: Position.Left, inPos: Position.Right };
  }
}

export function FiberAnchorNode({ id, data }: NodeProps) {
  const d = data as FiberAnchorNodeData;
  const manual = useManualLayout();
  const { isConnectionHighlighted } = useCircuitHighlight();
  const updateNodeInternals = useUpdateNodeInternals();
  const { outPos, inPos } = anchorHandlePositions(d);
  const stroke = colorHex(d.fiberColor as import("@/types/splice").FiberColorAbbrev);
  const highlighted = isConnectionHighlighted(d.connectionId);

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, d.side, d.quadSide, updateNodeInternals]);

  return (
    <div
      className={`splice-node fiber-anchor-node fiber-anchor-node--${d.side}${highlighted ? " fiber-anchor-node--highlighted" : ""}`}
      title={`${d.fiberNumber} ${d.fiberColor}`}
      onClick={(event) => {
        event.stopPropagation();
        manual?.onFiberAnchorClick?.(d.connectionId, {
          shiftKey: event.shiftKey,
        });
      }}
    >
      <Handle type="target" position={inPos} id="in" />
      <div className="fiber-anchor-node__dot" style={{ backgroundColor: stroke }} />
      <Handle type="source" position={outPos} id="out" />
    </div>
  );
}
