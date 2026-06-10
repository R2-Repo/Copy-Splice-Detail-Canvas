import { Handle, Position, type NodeProps } from "@xyflow/react";

import { useCircuitHighlight } from "@/features/canvas/CircuitHighlightContext";
import { useManualLayout } from "@/features/canvas/ManualLayoutContext";
import { colorHex } from "@/features/diagram/colorCode";

import type { FiberAnchorNodeData } from "./types";

export function FiberAnchorNode({ data }: NodeProps) {
  const d = data as FiberAnchorNodeData;
  const manual = useManualLayout();
  const { isConnectionHighlighted } = useCircuitHighlight();
  const outPos = d.side === "left" ? Position.Right : Position.Left;
  const inPos = d.side === "left" ? Position.Left : Position.Right;
  const stroke = colorHex(d.fiberColor as import("@/types/splice").FiberColorAbbrev);
  const highlighted = isConnectionHighlighted(d.connectionId);

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
