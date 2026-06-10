import { useStore } from "@xyflow/react";
import { useCallback, useMemo } from "react";

import {
  cableSheathCenter,
  calloutAnchorPoint,
} from "@/features/canvas/callouts/cableCalloutGeometry";
import type { CableCalloutNodeData, CableNodeData } from "@/features/canvas/nodes/types";

type LeaderSegment = {
  id: string;
  points: string;
};

function leaderPolyline(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const midX = (from.x + to.x) / 2;
  return `${from.x},${from.y} ${midX},${from.y} ${midX},${to.y} ${to.x},${to.y}`;
}

export function CalloutLeaderLayer() {
  const nodes = useStore(useCallback((state) => state.nodes, []));
  const transform = useStore(useCallback((state) => state.transform, []));

  const segments = useMemo((): LeaderSegment[] => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const out: LeaderSegment[] = [];

    for (const node of nodes) {
      if (node.type !== "cableCallout") continue;
      const data = node.data as CableCalloutNodeData;
      const target = nodeById.get(data.targetCableNodeId);
      if (!target || target.type !== "cable") continue;

      const targetData = target.data as CableNodeData;
      const sheath = cableSheathCenter(target, targetData);
      const anchor = calloutAnchorPoint(node, sheath);
      out.push({
        id: node.id,
        points: leaderPolyline(anchor, sheath),
      });
    }

    return out;
  }, [nodes]);

  if (segments.length === 0) return null;

  const [tx, ty, zoom] = transform;

  return (
    <svg
      className="callout-leader-layer"
      aria-hidden
      style={{
        transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
      }}
    >
      {segments.map((seg) => (
        <polyline
          key={seg.id}
          className="callout-leader-layer__line"
          points={seg.points}
          fill="none"
        />
      ))}
    </svg>
  );
}
