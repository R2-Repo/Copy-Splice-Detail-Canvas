import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { FiberStrandNodeData } from "./types";

export function FiberStrandNode({ data }: NodeProps) {
  const d = data as FiberStrandNodeData;
  const outPos = d.side === "left" ? Position.Right : Position.Left;
  const inPos = d.side === "left" ? Position.Left : Position.Right;

  return (
    <div className={`splice-node fiber-node fiber-node--${d.side}`}>
      <Handle type="target" position={inPos} id="in" />
      <div
        className="fiber-node__strand"
        style={{ backgroundColor: d.color }}
        title={d.label}
      />
      <Handle type="source" position={outPos} id="out" />
    </div>
  );
}
