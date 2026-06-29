import type { FiberEndpoint } from "@/types/splice";

/** Same-side cables share one column X within half pitch. */
const SAME_COLUMN_X_EPS = 12;

export type SpliceEndpointRef = {
  visualCableId: string;
  handleId: string;
  endpoint: FiberEndpoint;
  canvasSide: "left" | "right";
};

/**
 * Pick diagram-left → diagram-right endpoints for routing so midX nest order
 * (SDC-ROUTE-002) and invert logic stay correct after cable side overrides / flips.
 */
export function resolveSpliceSourceTarget(
  csvLeft: SpliceEndpointRef,
  csvRight: SpliceEndpointRef,
  positions: Record<string, { x: number; y: number }>,
): { source: SpliceEndpointRef; target: SpliceEndpointRef } {
  if (csvLeft.canvasSide === "right" && csvRight.canvasSide === "left") {
    return { source: csvRight, target: csvLeft };
  }
  if (csvLeft.canvasSide === "left" && csvRight.canvasSide === "right") {
    return { source: csvLeft, target: csvRight };
  }

  const posLeft = positions[`cable-${csvLeft.visualCableId}`];
  const posRight = positions[`cable-${csvRight.visualCableId}`];
  if (!posLeft || !posRight) {
    return { source: csvLeft, target: csvRight };
  }

  if (Math.abs(posLeft.x - posRight.x) <= SAME_COLUMN_X_EPS) {
    if (posLeft.y <= posRight.y) {
      return { source: csvLeft, target: csvRight };
    }
    return { source: csvRight, target: csvLeft };
  }

  if (posLeft.x <= posRight.x) {
    return { source: csvLeft, target: csvRight };
  }
  return { source: csvRight, target: csvLeft };
}
