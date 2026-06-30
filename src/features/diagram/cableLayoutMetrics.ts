import type { VisualCable } from "@/features/diagram/visualCables";
import {
  computeCableBreakout,
} from "@/features/diagram/cableBreakoutGeometry";

import {
  getLayoutExpansion,
} from "@/features/diagram/layoutExpansion";

/**
 * Center-to-center spacing between adjacent fiber splice lines within one buffer tube (px).
 * Used for row layout, cable node rows, and edge routing clearance.
 */
export const MIN_FIBER_LINE_GAP = 24;

/** Row pitch matches line gap so handles and splice paths stay evenly spaced. */
export const FIBER_ROW_PITCH = MIN_FIBER_LINE_GAP;

/** Extra vertical gap when splice rows cross a buffer-tube boundary on the left leg. */
export const TUBE_GROUP_GAP = 8;

/** Standard fiber count in one buffer tube (TIA-598). */
export const FIBERS_PER_BUFFER_TUBE = 12;

/** Center spacing between adjacent vertical splice legs — same as row pitch. */
export const SPLICE_LANE_SEP = MIN_FIBER_LINE_GAP;

/** Margin inside cable handles before splice lanes are placed (see spliceEdgeRouting). */
export const SPLICE_ROUTING_END_MARGIN = 16;

/** React Flow handle overhang past the fiber label row (.cable-node__handle ±4px). */
export const SPLICE_HANDLE_OVERHANG = 4;

/** Minimum horizontal run toward diagram center before same-side splices turn vertical. */
export const MIN_HORIZONTAL_INSET_FLOOR = 16;

/**
 * Horizontal jog toward diagram center after the OS/circuit label column.
 * Total run from handle = side circuit label span + this value.
 */
export const MIN_SPLICE_HORIZONTAL_INSET = 60;

/** Fiber row layout — keep in sync with splice-diagram.css */
/** Minimum fan runway before the label column (short — labels expand inward). */
export const FIBER_ROW_SWATCH_WIDTH = 16;
export const FIBER_ROW_INNER_GAP = 5;
/** Gap between circuit label and fiber code column (BL, OR, …). */
export const FIBER_LABEL_CODE_GAP = 2;
export const FIBER_ROW_CODE_MIN_WIDTH = 20;
/** Gap between fiber code (BL) and splice handle dot — keep in sync with CSS. */
export const FIBER_CODE_HANDLE_GAP = 4;
export const FIBER_HANDLE_DOT = 6;
export const FIBER_CIRCUIT_MAX_WIDTH = 128;

/** @deprecated Legacy swatch+code prefix; prefer fiberCodeColumnWidth + dynamic fan strand. */
export function fiberRowPrefixWidth(): number {
  return (
    FIBER_ROW_SWATCH_WIDTH +
    FIBER_ROW_INNER_GAP +
    FIBER_ROW_CODE_MIN_WIDTH +
    FIBER_ROW_INNER_GAP
  );
}

/** Fixed-width fiber code column immediately left of the handle (BL, OR, …). */
export function fiberCodeColumnWidth(): number {
  return FIBER_ROW_CODE_MIN_WIDTH + FIBER_ROW_INNER_GAP;
}

/** Code + gap + handle dot + outward overhang. */
export function fiberHandleStripWidth(): number {
  return (
    FIBER_ROW_CODE_MIN_WIDTH +
    FIBER_CODE_HANDLE_GAP +
    FIBER_HANDLE_DOT +
    SPLICE_HANDLE_OVERHANG
  );
}

/**
 * Minimum horizontal gap between cable columns so splice lanes keep 24px rhythm
 * (including buffer-tube boundary steps from row offsets).
 *
 * Floor of 320px (was 200px) so busy multi-cable diagrams have room for the
 * global vertical-lane deconflict pass to spread without colliding on midX.
 */
const MIN_CENTER_GAP_FLOOR = 320;

export function minCenterGapForRowSpan(
  maxRowOffset: number,
  laneCount: number,
): number {
  const minFromOffsets = maxRowOffset + 2 * SPLICE_ROUTING_END_MARGIN;
  const minFromLanes =
    laneCount <= 1
      ? MIN_CENTER_GAP_FLOOR
      : Math.max(MIN_CENTER_GAP_FLOOR, (laneCount - 1) * SPLICE_LANE_SEP) +
        2 * SPLICE_ROUTING_END_MARGIN;
  const base = Math.max(minFromOffsets, minFromLanes);
  return base + getLayoutExpansion().centerGapPadding;
}

export function diagramCenterXFromLayoutWidth(layoutWidth: number): number {
  return layoutWidth / 2;
}

export const CABLE_LAYOUT = {
  width: 1400,
  leftX: 24,
  rightX: 1000,
  topY: 100,
  cableGap: 32,
  headerH: 56,
  tubeLabelH: 18,
  fiberRowH: FIBER_ROW_PITCH,
  fiberStrandH: 3,
  tubeGap: 6,
  tubeGroupGap: TUBE_GROUP_GAP,
  minFiberLineGap: MIN_FIBER_LINE_GAP,
  spliceLaneSep: SPLICE_LANE_SEP,
} as const;

export type CableXBounds = {
  leftX: number;
  rightX: number;
};

export function cableXForSide(
  side: "left" | "right",
  _tubeCount: number,
  bounds?: CableXBounds,
): number {
  const leftX = bounds?.leftX ?? CABLE_LAYOUT.leftX;
  const rightX = bounds?.rightX ?? CABLE_LAYOUT.rightX;
  return side === "left" ? leftX : rightX;
}

/**
 * After drag: keep release X unless near the side column (magnetic snap).
 * Lets outward / custom spread stick while preserving column alignment on release near the edge.
 */
export function resolveCableDragStopX(
  draggedX: number,
  side: "left" | "right",
  bounds: CableXBounds,
  snapThreshold = CABLE_LAYOUT.fiberRowH,
): number {
  const columnX = cableXForSide(side, 1, bounds);
  const clamped = Math.min(Math.max(draggedX, bounds.leftX), bounds.rightX);
  if (Math.abs(clamped - columnX) <= snapThreshold) {
    return columnX;
  }
  return clamped;
}

export type CableYBounds = {
  topY: number;
  bottomY: number;
};

/** Horizontal envelope for top/bottom cable stack-axis drag. */
export type CableStackXBounds = {
  minX: number;
  maxX: number;
};

export function cableYForSide(
  side: "top" | "bottom",
  bounds?: CableYBounds,
): number {
  const topY = bounds?.topY ?? CABLE_LAYOUT.topY;
  const bottomY = bounds?.bottomY ?? topY + 600;
  return side === "top" ? topY : bottomY;
}

/**
 * After drag: keep release Y unless near the top/bottom band (magnetic snap).
 */
export function resolveCableDragStopY(
  draggedY: number,
  side: "top" | "bottom",
  bounds: CableYBounds,
  snapThreshold = CABLE_LAYOUT.fiberRowH,
): number {
  const columnY = cableYForSide(side, bounds);
  const clamped = Math.min(Math.max(draggedY, bounds.topY), bounds.bottomY);
  if (Math.abs(clamped - columnY) <= snapThreshold) {
    return columnY;
  }
  return clamped;
}

/**
 * After drag on top/bottom: keep release X unless near the auto stack column (magnetic snap).
 * Clamps to the horizontal envelope so cables stay on the edge band.
 */
export function resolveCableDragStopStackX(
  draggedX: number,
  autoStackX: number,
  bounds: CableStackXBounds,
  snapThreshold = CABLE_LAYOUT.fiberRowH,
): number {
  const clamped = Math.min(Math.max(draggedX, bounds.minX), bounds.maxX);
  if (Math.abs(clamped - autoStackX) <= snapThreshold) {
    return autoStackX;
  }
  return clamped;
}

export function fiberRowY(rowIndex: number, baseTop = CABLE_LAYOUT.topY): number {
  const rowStart = baseTop + CABLE_LAYOUT.headerH;
  return rowStart + rowIndex * CABLE_LAYOUT.fiberRowH;
}

/** Absolute Y for a splice row top edge from its cumulative vertical offset. */
export function fiberRowYFromOffset(
  rowYOffset: number,
  baseTop = CABLE_LAYOUT.topY,
): number {
  return baseTop + CABLE_LAYOUT.headerH + rowYOffset;
}

/**
 * Offset from cable node top to handle center.
 * Uses global rowIndex so fiber rows stay on the correct pitch even if row indices skip.
 */
export function fiberRowOffsetInCable(
  vc: VisualCable,
  connectionId: string,
): number {
  let shiftY = 0;
  const fiber = vc.tubes
    .flatMap((t) =>
      t.fibers.map((f) => ({ tube: t, fiber: f })),
    )
    .find(({ fiber: f }) => f.connectionId === connectionId);
  if (!fiber) return CABLE_LAYOUT.headerH;
  shiftY = fiber.tube.visualShiftY ?? 0;

  const rowStart = CABLE_LAYOUT.headerH + CABLE_LAYOUT.tubeLabelH;
  return rowStart + fiber.fiber.rowYOffset + CABLE_LAYOUT.fiberRowH / 2 + shiftY;
}

export function fiberRowOffsetInTubes(
  tubes: VisualCable["tubes"],
  connectionId: string,
): number {
  let shiftY = 0;
  const match = tubes
    .flatMap((t) => t.fibers.map((f) => ({ tube: t, fiber: f })))
    .find(({ fiber: f }) => f.connectionId === connectionId);
  if (!match) return CABLE_LAYOUT.headerH;
  shiftY = match.tube.visualShiftY ?? 0;
  const rowStart = CABLE_LAYOUT.headerH + CABLE_LAYOUT.tubeLabelH;
  return rowStart + match.fiber.rowYOffset + CABLE_LAYOUT.fiberRowH / 2 + shiftY;
}

export function compactVisualCableHeight(fiberCount: number): number {
  if (fiberCount <= 0) return CABLE_LAYOUT.headerH;
  const maxYOffset = Math.max(0, fiberCount - 1) * FIBER_ROW_PITCH;
  return (
    CABLE_LAYOUT.headerH +
    CABLE_LAYOUT.tubeLabelH +
    maxYOffset +
    CABLE_LAYOUT.fiberRowH +
    CABLE_LAYOUT.tubeGap
  );
}

export function visualCableHeight(vc: VisualCable): number {
  const fibers = vc.tubes.flatMap((t) => t.fibers);
  if (fibers.length === 0) return CABLE_LAYOUT.headerH;

  const maxYOffset = Math.max(...fibers.map((f) => f.rowYOffset));

  return (
    CABLE_LAYOUT.headerH +
    CABLE_LAYOUT.tubeLabelH +
    maxYOffset +
    CABLE_LAYOUT.fiberRowH +
    CABLE_LAYOUT.tubeGap
  );
}

/** Layout/render height — max of compact row math and breakout SVG bounds. */
export function cableNodeLayoutHeight(
  vc: VisualCable,
  scale = 1,
): number {
  const geo = computeCableBreakout(
    vc.tubes,
    vc.side,
    FIBER_ROW_PITCH,
    CABLE_LAYOUT.headerH,
    CABLE_LAYOUT.tubeLabelH,
    scale,
  );
  return Math.max(visualCableHeight(vc), geo.viewHeight);
}
