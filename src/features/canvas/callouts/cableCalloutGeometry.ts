import type { Node } from "@xyflow/react";

import { CABLE_LAYOUT } from "@/features/diagram/cableLayoutMetrics";
import { computeCableBreakout } from "@/features/diagram/cableBreakoutGeometry";
import type { CableNodeData } from "@/features/canvas/nodes/types";

export const CALLOUT_BOX = {
  width: 200,
  height: 52,
  gap: 48,
  stackOffset: 72,
} as const;

export function cableBreakoutForNode(
  data: CableNodeData,
): ReturnType<typeof computeCableBreakout> {
  const pitch = data.fiberPitch ?? CABLE_LAYOUT.fiberRowH;
  const scale = data.diagramScale ?? 1;
  return computeCableBreakout(
    data.tubes,
    data.side,
    pitch,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
    scale,
    data.alignedStemX,
  );
}

/** Flow-space center of the cable sheath rectangle. */
export function cableSheathCenter(
  node: Node,
  data: CableNodeData,
): { x: number; y: number } {
  const geo = cableBreakoutForNode(data);
  return {
    x: node.position.x + geo.sheath.x + geo.sheath.width / 2,
    y: node.position.y + geo.sheath.y + geo.sheath.height / 2,
  };
}

export function defaultCalloutPosition(
  cableNode: Node,
  data: CableNodeData,
  stackIndex: number,
): { x: number; y: number } {
  const geo = cableBreakoutForNode(data);
  const sheathCenterY =
    cableNode.position.y + geo.sheath.y + geo.sheath.height / 2;
  const cableWidth = cableNode.width ?? geo.viewWidth;
  const y =
    sheathCenterY -
    CALLOUT_BOX.height / 2 +
    stackIndex * CALLOUT_BOX.stackOffset;

  if (data.side === "left") {
    return {
      x:
        cableNode.position.x -
        CALLOUT_BOX.width -
        CALLOUT_BOX.gap,
      y,
    };
  }

  return {
    x: cableNode.position.x + cableWidth + CALLOUT_BOX.gap,
    y,
  };
}

/** Nearest callout-box edge point toward the cable sheath center. */
export function calloutAnchorPoint(
  calloutNode: Node,
  targetCenter: { x: number; y: number },
): { x: number; y: number } {
  const x = calloutNode.position.x;
  const y = calloutNode.position.y;
  const w = CALLOUT_BOX.width;
  const h = CALLOUT_BOX.height;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const dx = targetCenter.x - cx;
  const dy = targetCenter.y - cy;

  if (Math.abs(dx) >= Math.abs(dy)) {
    return {
      x: dx >= 0 ? x + w : x,
      y: cy + (dy / Math.abs(dx)) * (w / 2),
    };
  }

  return {
    x: cx + (dx / Math.abs(dy)) * (h / 2),
    y: dy >= 0 ? y + h : y,
  };
}
