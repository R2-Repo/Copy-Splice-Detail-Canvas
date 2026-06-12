import type { Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import { computeCableBreakout } from "@/features/diagram/cableBreakoutGeometry";
import { CABLE_LAYOUT } from "@/features/diagram/cableLayoutMetrics";

export const CALLOUT_BOX = {
  width: 240,
  minHeight: 80,
  gap: 20,
  stackOffset: 88,
} as const;

/** Vertical chrome: top/bottom padding (16) + border (6) + measure buffer (4). */
export const CALLOUT_BOX_CHROME_Y = 26;

export type Point = { x: number; y: number };

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

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

export function calloutBoxRect(calloutNode: Node): Rect {
  return {
    x: calloutNode.position.x,
    y: calloutNode.position.y,
    width: calloutNode.width ?? CALLOUT_BOX.width,
    height: calloutNode.height ?? CALLOUT_BOX.minHeight,
  };
}

/** Four corners plus top-center and bottom-center (no left/right midpoints). */
export function calloutAnchorCandidates(box: Rect): Point[] {
  const { x, y, width, height } = box;
  const cx = x + width / 2;
  return [
    { x, y },
    { x: x + width, y },
    { x, y: y + height },
    { x: x + width, y: y + height },
    { x: cx, y },
    { x: cx, y: y + height },
  ];
}

export function cableSheathRect(node: Node, data: CableNodeData): Rect {
  const geo = cableBreakoutForNode(data);
  return {
    x: node.position.x + geo.sheath.x,
    y: node.position.y + geo.sheath.y,
    width: geo.sheath.width,
    height: geo.sheath.height,
  };
}

/** Border anchors only — outside corners plus top/bottom edge centers. */
export function cableSheathAnchorCandidates(
  node: Node,
  data: CableNodeData,
): Point[] {
  const sheath = cableSheathRect(node, data);
  const { x, y, width, height } = sheath;
  const cx = x + width / 2;

  if (data.side === "left") {
    return [
      { x, y },
      { x, y: y + height },
      { x: cx, y },
      { x: cx, y: y + height },
    ];
  }

  return [
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x: cx, y },
    { x: cx, y: y + height },
  ];
}

function calloutAnchorsFacingSheath(box: Rect, sheath: Rect): Point[] {
  const all = calloutAnchorCandidates(box);
  const calloutCx = box.x + box.width / 2;
  const calloutCy = box.y + box.height / 2;
  const sheathCx = sheath.x + sheath.width / 2;
  const sheathCy = sheath.y + sheath.height / 2;
  const calloutRight = box.x + box.width;
  const calloutBottom = box.y + box.height;

  if (calloutRight <= sheath.x + 1) {
    return all.filter((p) => p.x >= box.x + box.width - 0.5);
  }
  if (box.x >= sheath.x + sheath.width - 1) {
    return all.filter((p) => p.x <= box.x + 0.5);
  }
  if (calloutBottom <= sheath.y + 1) {
    return all.filter((p) => p.y >= box.y + box.height - 0.5);
  }
  if (box.y >= sheath.y + sheath.height - 1) {
    return all.filter((p) => p.y <= box.y + 0.5);
  }

  const dx = sheathCx - calloutCx;
  const dy = sheathCy - calloutCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? all.filter((p) => p.x >= box.x + box.width - 0.5)
      : all.filter((p) => p.x <= box.x + 0.5);
  }
  return dy >= 0
    ? all.filter((p) => p.y >= box.y + box.height - 0.5)
    : all.filter((p) => p.y <= box.y + 0.5);
}

function cableAnchorsFacingCallout(
  node: Node,
  data: CableNodeData,
  calloutBox: Rect,
): Point[] {
  const all = cableSheathAnchorCandidates(node, data);
  const sheath = cableSheathRect(node, data);
  const calloutCx = calloutBox.x + calloutBox.width / 2;
  const calloutCy = calloutBox.y + calloutBox.height / 2;
  const sheathCx = sheath.x + sheath.width / 2;
  const sheathCy = sheath.y + sheath.height / 2;
  const calloutRight = calloutBox.x + calloutBox.width;
  const calloutBottom = calloutBox.y + calloutBox.height;

  if (calloutRight <= sheath.x + 1) {
    return all.filter((p) => p.x <= sheath.x + 0.5);
  }
  if (calloutBox.x >= sheath.x + sheath.width - 1) {
    return all.filter((p) => p.x >= sheath.x + sheath.width - 0.5);
  }
  if (calloutBottom <= sheath.y + 1) {
    return all.filter((p) => p.y <= sheath.y + 0.5);
  }
  if (calloutBox.y >= sheath.y + sheath.height - 1) {
    return all.filter((p) => p.y >= sheath.y + sheath.height - 0.5);
  }

  const dx = calloutCx - sheathCx;
  const dy = calloutCy - sheathCy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0
      ? all.filter((p) => p.x >= sheath.x + sheath.width - 0.5)
      : all.filter((p) => p.x <= sheath.x + 0.5);
  }
  return dy >= 0
    ? all.filter((p) => p.y >= sheath.y + sheath.height - 0.5)
    : all.filter((p) => p.y <= sheath.y + 0.5);
}

function pointDistance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function pickLeaderAnchors(
  calloutNode: Node,
  cableNode: Node,
  cableData: CableNodeData,
): { from: Point; to: Point } {
  const box = calloutBoxRect(calloutNode);
  const sheath = cableSheathRect(cableNode, cableData);

  const calloutAnchors = calloutAnchorsFacingSheath(box, sheath);
  const cableAnchors = cableAnchorsFacingCallout(cableNode, cableData, box);

  let bestFrom = calloutAnchors[0] ?? calloutAnchorCandidates(box)[0]!;
  let bestTo = cableAnchors[0] ?? cableSheathAnchorCandidates(cableNode, cableData)[0]!;
  let bestDist = Infinity;

  for (const from of calloutAnchors) {
    for (const to of cableAnchors) {
      const dist = pointDistance(from, to);
      if (dist < bestDist) {
        bestDist = dist;
        bestFrom = from;
        bestTo = to;
      }
    }
  }

  return { from: bestFrom, to: bestTo };
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
    CALLOUT_BOX.minHeight / 2 +
    stackIndex * CALLOUT_BOX.stackOffset;

  if (data.side === "left") {
    return {
      x: cableNode.position.x - CALLOUT_BOX.width - CALLOUT_BOX.gap,
      y,
    };
  }

  return {
    x: cableNode.position.x + cableWidth + CALLOUT_BOX.gap,
    y,
  };
}
