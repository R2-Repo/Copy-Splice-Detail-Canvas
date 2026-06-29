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

import { inwardDirection, isVerticalSide } from "./quadTypes";

const STEM_ALIGN_TOLERANCE = 2;

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

/** Canvas coordinate of the shared stem / label column for one quad cable. */
export function quadStemAlignCanvasValue(
  nodePosition: { x: number; y: number },
  tubes: VisualTube[],
  quadSide: QuadSide,
  scale: number,
  alignedStemX?: number,
): number {
  const geo = leftGeo({ tubes } as VisualCable, scale, alignedStemX);
  const stemLocal = mapLocalPoint(
    geo.stemX,
    0,
    quadSide,
    geo.viewWidth,
    geo.viewHeight,
  );
  if (isVerticalSide(quadSide)) {
    return nodePosition.y + stemLocal.y;
  }
  return nodePosition.x + stemLocal.x;
}

/** True when every fiber fan leg points inward from the sheath on this quad side. */
export function quadFansTowardCenter(
  nodePosition: { x: number; y: number },
  tubes: VisualTube[],
  quadSide: QuadSide,
  scale: number,
  alignedStemX?: number,
): boolean {
  const geo = leftGeo({ tubes } as VisualCable, scale, alignedStemX);
  const inward = inwardDirection(quadSide);
  const sheathCx = geo.sheath.x + geo.sheath.width / 2;
  const sheathCy = geo.sheath.y + geo.sheath.height / 2;
  const sheathMapped = mapLocalPoint(
    sheathCx,
    sheathCy,
    quadSide,
    geo.viewWidth,
    geo.viewHeight,
  );
  const sheathCanvas = {
    x: nodePosition.x + sheathMapped.x,
    y: nodePosition.y + sheathMapped.y,
  };

  for (const tube of geo.tubes) {
    for (const fiber of tube.fibers) {
      const fanMapped = mapLocalPoint(
        fiber.fanTo.x,
        fiber.fanTo.y,
        quadSide,
        geo.viewWidth,
        geo.viewHeight,
      );
      const fanCanvas = {
        x: nodePosition.x + fanMapped.x,
        y: nodePosition.y + fanMapped.y,
      };
      const dx = fanCanvas.x - sheathCanvas.x;
      const dy = fanCanvas.y - sheathCanvas.y;
      if (dx * inward.x + dy * inward.y <= STEM_ALIGN_TOLERANCE) {
        return false;
      }
    }
  }
  return true;
}

/** True when stacked cables on the same quad side share one stem / label column. */
export function quadSameSideStemColumnsAligned(
  nodes: Array<{
    position: { x: number; y: number };
    data: {
      quadSide?: QuadSide;
      tubes: VisualTube[];
      diagramScale?: number;
      alignedStemX?: number;
    };
  }>,
): boolean {
  const bySide = new Map<QuadSide, number[]>();
  for (const node of nodes) {
    const quadSide = node.data.quadSide;
    if (!quadSide) continue;
    const scale = node.data.diagramScale ?? 1;
    const value = quadStemAlignCanvasValue(
      node.position,
      node.data.tubes,
      quadSide,
      scale,
      node.data.alignedStemX,
    );
    const bucket = bySide.get(quadSide) ?? [];
    bucket.push(value);
    bySide.set(quadSide, bucket);
  }

  for (const values of bySide.values()) {
    if (values.length <= 1) continue;
    const expected = values[0]!;
    for (const value of values.slice(1)) {
      if (Math.abs(value - expected) > STEM_ALIGN_TOLERANCE) return false;
    }
  }
  return true;
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
