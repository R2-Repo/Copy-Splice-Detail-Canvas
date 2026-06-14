import type { QuadSide } from "@/types/splice";

export type Axis = "horizontal" | "vertical";

/** Buffer-tube/fan run axis for a cable on the given side. */
export function axisForSide(side: QuadSide): Axis {
  return side === "top" || side === "bottom" ? "vertical" : "horizontal";
}

export function isVerticalSide(side: QuadSide): boolean {
  return axisForSide(side) === "vertical";
}

/**
 * Unit vector pointing from the cable sheath toward the diagram center (the
 * direction fibers fan and legs leave the cable). Screen coords: +x right, +y down.
 */
export function inwardDirection(side: QuadSide): { x: number; y: number } {
  switch (side) {
    case "left":
      return { x: 1, y: 0 };
    case "right":
      return { x: -1, y: 0 };
    case "top":
      return { x: 0, y: 1 };
    case "bottom":
      return { x: 0, y: -1 };
  }
}

export const QUAD_SIDES: readonly QuadSide[] = [
  "top",
  "right",
  "bottom",
  "left",
] as const;
