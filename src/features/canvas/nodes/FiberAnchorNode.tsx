import { Handle, Position, type NodeProps } from "@xyflow/react";

import { colorHex } from "@/features/diagram/colorCode";

import type { FiberAnchorNodeData } from "./types";

export function FiberAnchorNode({ data }: NodeProps) {
  const d = data as FiberAnchorNodeData;
  const outPos = d.side === "left" ? Position.Right : Position.Left;
  const inPos = d.side === "left" ? Position.Left : Position.Right;
  const stroke = colorHex(d.fiberColor as import("@/types/splice").FiberColorAbbrev);

  return (
    <div
      className={`splice-node fiber-anchor-node fiber-anchor-node--${d.side}`}
      title={`${d.fiberNumber} ${d.fiberColor}`}
    >
      <Handle type="target" position={inPos} id="in" />
      <div className="fiber-anchor-node__dot" style={{ backgroundColor: stroke }} />
      <Handle type="source" position={outPos} id="out" />
    </div>
  );
}
