import type { Node } from "@xyflow/react";

import type { CableNodeData } from "@/features/canvas/nodes/types";
import type { VisualCable } from "@/features/diagram/visualCables";
import { visualCableFromCableNode } from "@/features/manualAdjust/handleCoords";
import type { QuadSide } from "@/types/splice";

import { isVerticalSide } from "./quadTypes";
import { orientTubesForQuadSide, quadFiberHandleCenter } from "./quadGeometry";

/** Map canvas drag delta to tube `visualShiftY` on top/bottom edges. */
export function quadFanShiftDeltaFromDrag(
  quadSide: "top" | "bottom",
  start: { x: number; y: number },
  current: { x: number; y: number },
): number {
  const deltaX = current.x - start.x;
  // mapLocalPoint: top x = viewHeight - ly; bottom x = ly
  return quadSide === "top" ? -deltaX : deltaX;
}

/** Fan shift delta for fiber drag — L/R uses canvas Y; T/B uses canvas X. */
export function fanShiftDeltaFromFiberDrag(
  start: { x: number; y: number },
  current: { x: number; y: number },
  quadSide?: QuadSide,
): number {
  if (quadSide === "top" || quadSide === "bottom") {
    return quadFanShiftDeltaFromDrag(quadSide, start, current);
  }
  return current.y - start.y;
}

function orientedVcForQuadCable(
  vcRaw: VisualCable,
  cableData: CableNodeData,
  quadSide: QuadSide,
): VisualCable {
  const live = visualCableFromCableNode(vcRaw, cableData);
  return {
    ...live,
    tubes: orientTubesForQuadSide(live.tubes, quadSide),
  };
}

/** Absolute handle center for a fiber on a quad top/bottom cable. */
export function quadFiberHandleCenterForCable(
  connectionId: string,
  vcRaw: VisualCable,
  cableNode: Node,
): { x: number; y: number } {
  const cableData = cableNode.data as CableNodeData;
  const quadSide = cableData.quadSide!;
  const oriented = orientedVcForQuadCable(vcRaw, cableData, quadSide);
  return quadFiberHandleCenter(
    oriented,
    connectionId,
    cableNode.position,
    quadSide,
    cableData.diagramScale ?? 1,
    cableData.alignedStemX,
  );
}

/** Top-left React Flow position for a fiber anchor on a quad T/B cable. */
export function quadFiberAnchorNodePosition(
  connectionId: string,
  vcRaw: VisualCable,
  cableNode: Node,
  anchorDotSize = 6,
): { x: number; y: number } {
  const center = quadFiberHandleCenterForCable(connectionId, vcRaw, cableNode);
  return {
    x: center.x - anchorDotSize / 2,
    y: center.y - anchorDotSize / 2,
  };
}

export function isQuadVerticalCableData(
  data: CableNodeData,
): data is CableNodeData & { quadSide: "top" | "bottom" } {
  return data.quadSide === "top" || data.quadSide === "bottom";
}

export function isQuadVerticalSide(side: QuadSide | undefined): side is "top" | "bottom" {
  return side !== undefined && isVerticalSide(side);
}
