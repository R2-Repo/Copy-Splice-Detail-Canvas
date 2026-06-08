import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { TubeAnchorNodeData } from "./types";

/** Buffer-tube breakout anchor — registered for future manual layout (D5). */
export function TubeAnchorNode({ data }: NodeProps) {
  const d = data as TubeAnchorNodeData;
  const sourcePos = d.side === "left" ? Position.Right : Position.Left;
  const targetPos = d.side === "left" ? Position.Left : Position.Right;

  return (
    <div
      className={`splice-node tube-anchor-node tube-anchor-node--${d.side}${d.striped ? " tube-anchor-node--striped" : ""}`}
    >
      <Handle type="target" position={targetPos} id="in" />
      <div
        className="tube-anchor-node__line"
        style={{ backgroundColor: d.color }}
        title={d.label}
      />
      <Handle type="source" position={sourcePos} id="out" />
    </div>
  );
}
