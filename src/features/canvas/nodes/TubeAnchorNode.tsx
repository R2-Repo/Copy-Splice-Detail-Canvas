import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { useEffect } from "react";

import type { TubeAnchorNodeData } from "./types";

/** Buffer-tube breakout anchor — registered for future manual layout (D5). */
export function TubeAnchorNode({ id, data }: NodeProps) {
  const d = data as TubeAnchorNodeData;
  const updateNodeInternals = useUpdateNodeInternals();
  const sourcePos = d.side === "left" ? Position.Right : Position.Left;
  const targetPos = d.side === "left" ? Position.Left : Position.Right;

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, d.side, updateNodeInternals]);

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
