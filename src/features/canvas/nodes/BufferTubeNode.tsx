import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { BufferTubeNodeData } from "./types";

export function BufferTubeNode({ data }: NodeProps) {
  const d = data as BufferTubeNodeData;
  const sourcePos = d.side === "left" ? Position.Right : Position.Left;
  const targetPos = d.side === "left" ? Position.Left : Position.Right;

  return (
    <div
      className={`splice-node buffer-tube-node buffer-tube-node--${d.side}${d.striped ? " buffer-tube-node--striped" : ""}`}
    >
      <Handle type="target" position={targetPos} id="in" />
      <div
        className="buffer-tube-node__line"
        style={{ backgroundColor: d.color }}
        title={d.label}
      />
      <Handle type="source" position={sourcePos} id="out" />
      <span className="buffer-tube-node__label">{d.label}</span>
    </div>
  );
}
