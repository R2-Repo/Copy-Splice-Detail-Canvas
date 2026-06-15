import { Panel, useStore, useViewport } from "@xyflow/react";
import { useCallback, useMemo, type CSSProperties } from "react";

import { pickLeaderAnchors } from "@/features/canvas/callouts/cableCalloutGeometry";
import { useCalloutScale } from "@/features/canvas/callouts/CalloutScaleContext";
import type { CableCalloutNodeData, CableNodeData } from "@/features/canvas/nodes/types";

type LeaderLine = {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export function CalloutLeaderLayer() {
  const nodes = useStore(useCallback((state) => state.nodes, []));
  const transform = useStore(useCallback((state) => state.transform, []));
  const viewport = useViewport();
  const { effectiveScale } = useCalloutScale();
  const scale = effectiveScale(viewport.zoom);

  const lines = useMemo((): LeaderLine[] => {
    const nodeById = new Map(nodes.map((n) => [n.id, n]));
    const out: LeaderLine[] = [];

    for (const node of nodes) {
      if (node.type !== "cableCallout") continue;
      const data = node.data as CableCalloutNodeData;
      const target = nodeById.get(data.targetCableNodeId);
      if (!target || target.type !== "cable") continue;

      const targetData = target.data as CableNodeData;
      const { from, to } = pickLeaderAnchors(node, target, targetData);
      out.push({
        id: node.id,
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y,
      });
    }

    return out;
  }, [nodes]);

  if (lines.length === 0) return null;

  const [tx, ty, zoom] = transform;

  return (
    <Panel position="top-left" className="callout-leader-panel">
      <svg
        className="callout-leader-layer"
        aria-hidden
        style={{
          transform: `translate(${tx}px, ${ty}px) scale(${zoom})`,
          "--callout-scale": scale,
        } as CSSProperties}
      >
        {lines.map((line) => (
          <line
            key={line.id}
            className="callout-leader-layer__line"
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
          />
        ))}
      </svg>
    </Panel>
  );
}
