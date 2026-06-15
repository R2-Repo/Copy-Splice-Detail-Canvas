import { Handle, Position, type NodeProps } from "@xyflow/react";

import type { SplicePointNodeData } from "./types";

export function SplicePointNode({ data }: NodeProps) {
  const d = data as SplicePointNodeData;

  // Handles only anchor the precomputed leg edges; the dot is never user-wired,
  // so disable connection dragging (no stray "connect to another node" line).
  return (
    <div className="splice-node splice-point-node">
      <Handle type="target" position={Position.Left} id="in" isConnectable={false} />
      {d.fullButtSplice ? (
        <div className="splice-point-node__square" />
      ) : (
        <div className="splice-point-node__dot" />
      )}
      <Handle type="source" position={Position.Right} id="out" isConnectable={false} />
    </div>
  );
}
