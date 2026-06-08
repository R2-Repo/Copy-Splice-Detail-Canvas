import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { SplicePointNodeData } from "./types";

export function SplicePointNode({ data }: NodeProps) {
  const d = data as SplicePointNodeData;

  return (
    <div className="splice-node splice-point-node">
      <Handle type="target" position={Position.Left} id="in" />
      {d.fullButtSplice ? (
        <div className="splice-point-node__square" />
      ) : (
        <div className="splice-point-node__dot" />
      )}
      <Handle type="source" position={Position.Right} id="out" />
    </div>
  );
}
