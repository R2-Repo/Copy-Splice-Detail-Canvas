import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { CableNodeData } from "@/features/canvas/nodes/types";

import {
  CALLOUT_BOX,
  cableSheathAnchorCandidates,
  cableSheathRect,
  calloutAnchorCandidates,
  calloutBoxRect,
  pickLeaderAnchors,
  type Point,
  type Rect,
} from "./cableCalloutGeometry";

function cableNode(
  id: string,
  side: "left" | "right",
  position: { x: number; y: number },
): Node<CableNodeData> {
  return {
    id,
    type: "cable",
    position,
    data: {
      label: "Test cable",
      legId: "leg-1",
      side,
      tubes: [{ tubeColor: "BL", fibers: [] }],
      nodeHeight: 200,
      fiberPitch: 24,
    },
  };
}

function calloutNode(
  id: string,
  position: { x: number; y: number },
  height?: number,
): Node {
  return {
    id,
    type: "cableCallout",
    position,
    width: CALLOUT_BOX.width,
    height: height ?? CALLOUT_BOX.minHeight,
    data: { targetCableNodeId: "cable-1", text: "Callout" },
  };
}

function sheathCenter(node: Node, data: CableNodeData): Point {
  const sheath = cableSheathRect(node, data);
  return {
    x: sheath.x + sheath.width / 2,
    y: sheath.y + sheath.height / 2,
  };
}

describe("calloutAnchorCandidates", () => {
  it("returns six discrete border points", () => {
    const box: Rect = { x: 100, y: 200, width: 240, height: 80 };
    const anchors = calloutAnchorCandidates(box);

    expect(anchors).toHaveLength(6);
    expect(anchors).toEqual([
      { x: 100, y: 200 },
      { x: 340, y: 200 },
      { x: 100, y: 280 },
      { x: 340, y: 280 },
      { x: 220, y: 200 },
      { x: 220, y: 280 },
    ]);
  });
});

describe("calloutBoxRect", () => {
  it("uses node height when provided", () => {
    const node = calloutNode("c1", { x: 10, y: 20 }, 96);
    expect(calloutBoxRect(node)).toEqual({
      x: 10,
      y: 20,
      width: CALLOUT_BOX.width,
      height: 96,
    });
  });

  it("falls back to minHeight", () => {
    const node = calloutNode("c1", { x: 0, y: 0 });
    expect(calloutBoxRect(node).height).toBe(CALLOUT_BOX.minHeight);
  });
});

describe("cableSheathAnchorCandidates", () => {
  it("returns four border points for a left cable", () => {
    const node = cableNode("cable-1", "left", { x: 400, y: 100 });
    const data = node.data as CableNodeData;
    const sheath = cableSheathRect(node, data);
    const anchors = cableSheathAnchorCandidates(node, data);

    expect(anchors).toHaveLength(4);
    expect(anchors).toEqual([
      { x: sheath.x, y: sheath.y },
      { x: sheath.x, y: sheath.y + sheath.height },
      { x: sheath.x + sheath.width / 2, y: sheath.y },
      { x: sheath.x + sheath.width / 2, y: sheath.y + sheath.height },
    ]);
  });

  it("returns four border points for a right cable on the outside face", () => {
    const node = cableNode("cable-1", "right", { x: 800, y: 100 });
    const data = node.data as CableNodeData;
    const sheath = cableSheathRect(node, data);
    const anchors = cableSheathAnchorCandidates(node, data);

    expect(anchors).toHaveLength(4);
    expect(anchors[0]).toEqual({ x: sheath.x + sheath.width, y: sheath.y });
    expect(anchors[1]).toEqual({
      x: sheath.x + sheath.width,
      y: sheath.y + sheath.height,
    });
  });

  it("never includes the sheath centroid", () => {
    const node = cableNode("cable-1", "left", { x: 400, y: 100 });
    const data = node.data as CableNodeData;
    const center = sheathCenter(node, data);
    const anchors = cableSheathAnchorCandidates(node, data);

    expect(anchors.some((p) => p.x === center.x && p.y === center.y)).toBe(
      false,
    );
  });
});

describe("pickLeaderAnchors", () => {
  it("returns a straight line between two anchor points", () => {
    const cable = cableNode("cable-1", "left", { x: 500, y: 200 });
    const callout = calloutNode("callout-1", { x: 200, y: 200 });
    const { from, to } = pickLeaderAnchors(
      callout,
      cable,
      cable.data as CableNodeData,
    );

    expect(from).not.toEqual(to);
    expect(typeof from.x).toBe("number");
    expect(typeof to.x).toBe("number");
  });

  it("anchors left-side callout to the outer cable face", () => {
    const cable = cableNode("cable-1", "left", { x: 500, y: 200 });
    const data = cable.data as CableNodeData;
    const sheath = cableSheathRect(cable, data);
    const callout = calloutNode("callout-1", {
      x: sheath.x - CALLOUT_BOX.width - CALLOUT_BOX.gap,
      y: sheath.y + sheath.height / 2 - CALLOUT_BOX.minHeight / 2,
    });

    const { from, to } = pickLeaderAnchors(callout, cable, data);
    const box = calloutBoxRect(callout);

    expect(to.x).toBe(sheath.x);
    expect(from.x).toBeGreaterThanOrEqual(box.x + box.width - 1);
  });

  it("anchors right-side callout to the outer cable face", () => {
    const cable = cableNode("cable-1", "right", { x: 500, y: 200 });
    const data = cable.data as CableNodeData;
    const sheath = cableSheathRect(cable, data);
    const callout = calloutNode("callout-1", {
      x: sheath.x + sheath.width + CALLOUT_BOX.gap,
      y: sheath.y,
    });

    const { from, to } = pickLeaderAnchors(callout, cable, data);

    expect(from.x).toBeLessThan(
      callout.position.x + (callout.width ?? CALLOUT_BOX.width),
    );
    expect(to.x).toBe(sheath.x + sheath.width);
  });
});
