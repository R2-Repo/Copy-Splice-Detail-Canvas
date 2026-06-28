import { Position, type Node } from "@xyflow/react";

import type { QuadSide } from "@/types/splice";

export const FIBER_ANCHOR_NODE_SIZE = 6;
export const SPLICE_POINT_NODE_SIZE = 9;

type EngineNodeHandle = NonNullable<Node["handles"]>[number];

function handle(
  id: "in" | "out",
  type: "source" | "target",
  position: Position,
  x: number,
  y: number,
): EngineNodeHandle {
  return { id, type, position, x, y, width: 1, height: 1 };
}

/** Static handle geometry for fiber anchors — lets React Flow paint legs before DOM measure. */
export function fiberAnchorNodeHandles(
  _nodeId: string,
  side: "left" | "right",
  quadSide?: QuadSide,
): EngineNodeHandle[] {
  const mid = FIBER_ANCHOR_NODE_SIZE / 2;
  const size = FIBER_ANCHOR_NODE_SIZE;

  switch (quadSide) {
    case "top":
      return [
        handle("in", "target", Position.Top, mid, 0),
        handle("out", "source", Position.Bottom, mid, size),
      ];
    case "bottom":
      return [
        handle("in", "target", Position.Bottom, mid, size),
        handle("out", "source", Position.Top, mid, 0),
      ];
    case "right":
      return [
        handle("in", "target", Position.Right, size, mid),
        handle("out", "source", Position.Left, 0, mid),
      ];
    default:
      break;
  }

  if (side === "left") {
    return [
      handle("in", "target", Position.Left, 0, mid),
      handle("out", "source", Position.Right, size, mid),
    ];
  }

  return [
    handle("in", "target", Position.Right, size, mid),
    handle("out", "source", Position.Left, 0, mid),
  ];
}

/** Static handle geometry for fusion splice points. */
export function splicePointNodeHandles(_nodeId: string): EngineNodeHandle[] {
  const mid = SPLICE_POINT_NODE_SIZE / 2;
  const size = SPLICE_POINT_NODE_SIZE;
  return [
    handle("in", "target", Position.Left, 0, mid),
    handle("out", "source", Position.Right, size, mid),
  ];
}
