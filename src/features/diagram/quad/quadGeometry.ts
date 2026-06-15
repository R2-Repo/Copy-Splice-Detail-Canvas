import {
  computeCableBreakout,
  naturalStemX,
} from "@/features/diagram/cableBreakoutGeometry";
import { fixedHandleOutsetFromStem } from "@/features/diagram/cableLabels";
import {
  CABLE_LAYOUT,
  FIBER_ROW_PITCH,
  fiberRowOffsetInCable,
} from "@/features/diagram/cableLayoutMetrics";
import type { VisualCable, VisualTube } from "@/features/diagram/visualCables";
import type { QuadSide } from "@/types/splice";

import { isVerticalSide } from "./quadTypes";

/**
 * Quad geometry is built from one canonical "left" breakout (sheath at x≈0,
 * fans rightward) which is then mirrored (right) or rotated 90° (top/bottom).
 * Rendering and handle math share the exact same affine map so dots/legs land
 * on the drawn strands regardless of side.
 */
export type QuadBoxSize = { width: number; height: number };

/**
 * Mirror a cable's stack vertically (fiber `rowYOffset` -> max - offset).
 * Geometry is positioned purely from `rowYOffset`, so this is a clean reflection
 * that preserves pitch and box size.
 */
function flipTubesVertically(tubes: VisualTube[]): VisualTube[] {
  const offsets = tubes.flatMap((t) => t.fibers.map((f) => f.rowYOffset));
  if (offsets.length === 0) return tubes;
  const maxY = Math.max(...offsets);
  return tubes.map((t) => ({
    ...t,
    fibers: t.fibers.map((f) => ({ ...f, rowYOffset: maxY - f.rowYOffset })),
  }));
}

/**
 * Top cables render the canonical left breakout rotated +90°, which reverses
 * fiber/tube order along the screen X axis (blue would land on the right).
 * Pre-flipping the stack makes the rotated result read blue->orange->green
 * left->right (matching bottom cables) without mirroring any label text.
 * Left/right/bottom are already correct, so they pass through unchanged.
 */
export function orientTubesForQuadSide(
  tubes: VisualTube[],
  side: QuadSide,
): VisualTube[] {
  return side === "top" ? flipTubesVertically(tubes) : tubes;
}

function leftGeo(vc: VisualCable, scale: number, alignedStemX?: number) {
  return computeCableBreakout(
    vc.tubes,
    "left",
    FIBER_ROW_PITCH,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
    scale,
    alignedStemX,
  );
}

/** React Flow node box size for a cable on the given side (vertical = transposed). */
export function quadCableBoxSize(
  vc: VisualCable,
  side: QuadSide,
  scale: number,
  alignedStemX?: number,
): QuadBoxSize {
  const geo = leftGeo(vc, scale, alignedStemX);
  return isVerticalSide(side)
    ? { width: geo.viewHeight, height: geo.viewWidth }
    : { width: geo.viewWidth, height: geo.viewHeight };
}

/** Map a left-local point into the cable node box for the given side. */
function mapLocalPoint(
  lx: number,
  ly: number,
  side: QuadSide,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  switch (side) {
    case "left":
      return { x: lx, y: ly };
    case "right":
      return { x: viewWidth - lx, y: ly };
    case "top":
      return { x: viewHeight - ly, y: lx };
    case "bottom":
      return { x: ly, y: viewWidth - lx };
  }
}

/** Absolute React Flow handle center for a fiber on a quad cable. */
export function quadFiberHandleCenter(
  vc: VisualCable,
  connectionId: string,
  nodePosition: { x: number; y: number },
  side: QuadSide,
  scale: number,
  alignedStemX?: number,
): { x: number; y: number } {
  const geo = leftGeo(vc, scale, alignedStemX);
  const lx = geo.stemX + fixedHandleOutsetFromStem();
  const ly = fiberRowOffsetInCable(vc, connectionId);
  const local = mapLocalPoint(lx, ly, side, geo.viewWidth, geo.viewHeight);
  return { x: nodePosition.x + local.x, y: nodePosition.y + local.y };
}

/** CSS transform that rotates the canonical left breakout onto a vertical edge. */
export function quadRenderTransform(
  side: QuadSide,
  viewWidth: number,
  viewHeight: number,
): { transform: string; boxWidth: number; boxHeight: number } | null {
  if (side === "top") {
    return {
      transform: `translate(${viewHeight}px, 0px) rotate(90deg)`,
      boxWidth: viewHeight,
      boxHeight: viewWidth,
    };
  }
  if (side === "bottom") {
    return {
      transform: `translate(0px, ${viewWidth}px) rotate(-90deg)`,
      boxWidth: viewHeight,
      boxHeight: viewWidth,
    };
  }
  return null;
}

/** Max stem X per side so fiber label columns line up across stacked cables. */
export function quadStemAlignment(
  cables: Array<{ tubes: VisualTube[]; side: QuadSide }>,
  scale: number,
): Record<QuadSide, number> {
  const out: Record<QuadSide, number> = { left: 0, right: 0, top: 0, bottom: 0 };
  for (const cable of cables) {
    out[cable.side] = Math.max(out[cable.side], naturalStemX(cable.tubes, scale));
  }
  return out;
}
