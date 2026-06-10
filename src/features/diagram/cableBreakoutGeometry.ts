import {
  fiberRowLayoutXs,
  fixedHandleOutsetFromStem,
} from "@/features/diagram/cableLabels";
import type { VisualTube } from "@/features/diagram/visualCables";
import type { FiberColorAbbrev, TubeColorCode } from "@/types/splice";

/** Cable rectangle — uniform scale preserves base aspect ratio (96×46). */
export const SHEATH_SIZE = {
  baseWidth: 96,
  baseHeight: 46,
  minWidth: 84,
  maxWidth: 132,
  /** Size bump per buffer tube beyond the first (applied to both width and height). */
  tubeCountScale: 0.1,
} as const;

const SHEATH_ASPECT = SHEATH_SIZE.baseWidth / SHEATH_SIZE.baseHeight;

const Y_TOLERANCE = 0.5;

export const BREAKOUT = {
  tubeLengthBase: 52,
  /** Extra tube reach per buffer tube beyond the first (pairs with cable X offset). */
  tubeLengthPerMultiTube: 28,
  tubeThickness: 8,
  fiberStemGap: 18,
  /** Pull tube tip back so curved fiber legs fill the fan zone (TUB-002). */
  tubeFanInset: 16,
  /** Horizontal fiber run at each row before curving to the tube tip. */
  fiberFanStub: 8,
  /** Cubic-bezier control offset for smooth fan curves. */
  fiberCurveTension: 10,
  /** Inset from tube tip along axis — keeps label in the fan crest at the junction. */
  tubeLabelTipInset: 2,
  /** Gap from tube outer edge to label (pairs with `tubeThickness`). */
  tubeLabelGap: 10,
  fiberLabelWidth: 130,
} as const;

export type FiberBreakoutGeom = {
  handleId: string;
  rowIndex: number;
  rowY: number;
  fiberColor: FiberColorAbbrev;
  tubeColor: TubeColorCode;
  /** Tube-tip junction — all fibers meet here; Y is the fiber-group center. */
  fanFrom: { x: number; y: number };
  /** Fiber handle at the shared stem column. */
  fanTo: { x: number; y: number };
  /** End of the horizontal row run before the curve; omitted when row is centered. */
  fanElbow?: { x: number; y: number };
  /** Cubic-bezier controls (elbow → junction); omitted when row is centered. */
  fanCurve?: { c1: { x: number; y: number }; c2: { x: number; y: number } };
  /** Junction-adjacent span tucked under the buffer tube stroke (scaled px). */
  fanTailUnderlay: number;
};

function fanTailSplitX(fiber: FiberBreakoutGeom): number {
  const junction = fiber.fanFrom;
  const stem = fiber.fanTo;
  const towardStem = stem.x > junction.x ? 1 : -1;
  return junction.x + towardStem * fiber.fanTailUnderlay;
}

/** Curved/straight tail drawn under the buffer tube at the fan junction. */
export function fiberFanTailPathD(fiber: FiberBreakoutGeom): string {
  const junction = fiber.fanFrom;
  if (!fiber.fanElbow || !fiber.fanCurve) {
    const splitX = fanTailSplitX(fiber);
    return `M ${junction.x} ${junction.y} L ${splitX} ${junction.y}`;
  }
  const elbow = fiber.fanElbow;
  const { c1, c2 } = fiber.fanCurve;
  return `M ${elbow.x} ${elbow.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${junction.x} ${junction.y}`;
}

/** Horizontal stub (and sheath-adjacent run) drawn above the buffer tube. */
export function fiberFanTopPathD(fiber: FiberBreakoutGeom): string {
  const junction = fiber.fanFrom;
  const stem = fiber.fanTo;
  if (!fiber.fanElbow || !fiber.fanCurve) {
    const splitX = fanTailSplitX(fiber);
    return `M ${stem.x} ${stem.y} L ${splitX} ${junction.y}`;
  }
  return `M ${stem.x} ${stem.y} L ${fiber.fanElbow.x} ${fiber.fanElbow.y}`;
}

/** Full fan leg — tail + top (for tests and layout checks). */
export function fiberFanPathD(fiber: FiberBreakoutGeom): string {
  const junction = fiber.fanFrom;
  const stem = fiber.fanTo;
  if (!fiber.fanElbow || !fiber.fanCurve) {
    return `M ${stem.x} ${stem.y} L ${junction.x} ${junction.y}`;
  }
  const elbow = fiber.fanElbow;
  const { c1, c2 } = fiber.fanCurve;
  return `M ${stem.x} ${stem.y} L ${elbow.x} ${elbow.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${junction.x} ${junction.y}`;
}

export type TubeBreakoutGeom = {
  tubeColor: TubeColorCode;
  origin: { x: number; y: number };
  end: { x: number; y: number };
  angleDeg: number;
  /** Anchor for the tube color abbreviation in the fan crest at the junction. */
  labelPos: {
    x: number;
    y: number;
    /** `above` = crest over upward/horizontal tubes; `below` = crest under downward tubes. */
    placement: "above" | "below";
  };
  fibers: FiberBreakoutGeom[];
};

/** Tube label in the fan crest: above stroke when tube angles up, below when it angles down. */
export function tubeLabelPosition(
  origin: { x: number; y: number },
  end: { x: number; y: number },
  scale = 1,
): TubeBreakoutGeom["labelPos"] {
  const dx = end.x - origin.x;
  const dy = end.y - origin.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const inset = BREAKOUT.tubeLabelTipInset * scale;
  const alongX = end.x - ux * inset;
  const alongY = end.y - uy * inset;
  const placement: "above" | "below" =
    dy > Y_TOLERANCE ? "below" : "above";
  // Perpendicular into the open crest between fan legs and the buffer tube.
  let nx = -uy;
  let ny = ux;
  if (placement === "below") {
    if (ny < 0) {
      nx = uy;
      ny = -ux;
    }
  } else if (ny > 0) {
    nx = uy;
    ny = -ux;
  }
  const normalLen = Math.hypot(nx, ny) || 1;
  const offset = BREAKOUT.tubeThickness / 2 + BREAKOUT.tubeLabelGap * scale;
  return {
    x: alongX + (nx / normalLen) * offset,
    y: alongY + (ny / normalLen) * offset,
    placement,
  };
}

export type CableBreakoutGeom = {
  bodyTop: number;
  cableCenterY: number;
  sheath: { x: number; y: number; width: number; height: number };
  stemX: number;
  tubes: TubeBreakoutGeom[];
  viewWidth: number;
  viewHeight: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Slight scale for small vs large splice diagrams. */
export function computeDiagramScale(rowCount: number): number {
  if (rowCount <= 4) return 1.08;
  if (rowCount <= 10) return 1;
  if (rowCount <= 20) return 0.94;
  return 0.88;
}

export function computeSheathSize(
  scale: number,
  tubeCount = 1,
): {
  width: number;
  height: number;
} {
  const tubeMultiplier =
    1 + Math.max(0, tubeCount - 1) * SHEATH_SIZE.tubeCountScale;
  const width = clamp(
    SHEATH_SIZE.baseWidth * scale * tubeMultiplier,
    SHEATH_SIZE.minWidth,
    SHEATH_SIZE.maxWidth,
  );

  return {
    width,
    height: width / SHEATH_ASPECT,
  };
}

function tubeFiberCenterY(
  tube: VisualTube,
  bodyTop: number,
  pitch: number,
): number {
  const offsets = tube.fibers.map((f) => f.rowYOffset);
  const mid = (Math.min(...offsets) + Math.max(...offsets)) / 2;
  return bodyTop + mid + pitch / 2;
}

function tubeLengthForCount(tubeCount: number, scale: number): number {
  const extra =
    tubeCount > 1
      ? (tubeCount - 1) * BREAKOUT.tubeLengthPerMultiTube
      : 0;
  return (BREAKOUT.tubeLengthBase + extra) * scale;
}

/** Longer tubes when more fibers fan out from the buffer tube. */
function tubeLengthForFiberCount(fiberCount: number, scale: number): number {
  const fiberBonus = Math.max(0, fiberCount - 1) * 4;
  return (BREAKOUT.tubeLengthBase + fiberBonus) * scale;
}

function maxTubeLengthForCable(
  tubes: VisualTube[],
  scale: number,
): number {
  const tubeCount = Math.max(1, tubes.length);
  let maxLen = tubeLengthForCount(tubeCount, scale);
  for (const tube of tubes) {
    maxLen = Math.max(
      maxLen,
      tubeLengthForFiberCount(Math.max(1, tube.fibers.length), scale),
    );
  }
  return maxLen;
}

/** Horizontal distance from sheath face to fiber fan stem (side-invariant). */
export function tubeReachFromSheath(tubes: VisualTube[], scale = 1): number {
  return maxTubeLengthForCable(tubes, scale) + BREAKOUT.fiberStemGap;
}

/** Absolute stem X from the node’s left edge (before right-side mirroring). */
export function naturalStemX(tubes: VisualTube[], scale = 1): number {
  const tubeCount = Math.max(1, tubes.length);
  const sheath = computeSheathSize(scale, tubeCount);
  return (
    sheath.width + maxTubeLengthForCable(tubes, scale) + BREAKOUT.fiberStemGap
  );
}

/** Max stem X per canvas side so fiber label columns align across stacked cables. */
export function computeSideStemAlignment(
  cables: Array<{ tubes: VisualTube[]; side: "left" | "right" }>,
  _pitch: number,
  _headerH: number,
  _tubeLabelH: number,
  scale = 1,
): { left: number; right: number } {
  let left = 0;
  let right = 0;
  for (const cable of cables) {
    const stem = naturalStemX(cable.tubes, scale);
    if (cable.side === "left") left = Math.max(left, stem);
    else right = Math.max(right, stem);
  }
  return { left, right };
}

function mirrorX(x: number, width: number): number {
  return width - x;
}

/** Shared horizontal stub length before each fiber angles to the tube tip. */
export function fiberFanElbowX(
  stemX: number,
  endX: number,
  scale: number,
): number {
  const gap = Math.max(0, stemX - endX);
  const stub = clamp(
    BREAKOUT.fiberFanStub * scale,
    4,
    Math.max(4, gap - 4),
  );
  return stemX - stub;
}

function isCenterFanRow(rowY: number, tubeTipY: number): boolean {
  return Math.abs(rowY - tubeTipY) <= Y_TOLERANCE;
}

export function computeCableBreakout(
  tubes: VisualTube[],
  side: "left" | "right",
  pitch: number,
  headerH: number,
  tubeLabelH: number,
  scale = 1,
  alignedStemX?: number,
): CableBreakoutGeom {
  const allOffsets = tubes.flatMap((t) => t.fibers.map((f) => f.rowYOffset));
  const maxYOffset = allOffsets.length ? Math.max(...allOffsets) : 0;
  const bodyTop = headerH + tubeLabelH;
  const bodyHeight = maxYOffset + pitch;
  const viewHeight = bodyTop + bodyHeight;

  const sortedTubes = [...tubes].sort((a, b) => {
    const ay = tubeFiberCenterY(a, bodyTop, pitch);
    const by = tubeFiberCenterY(b, bodyTop, pitch);
    return ay - by;
  });

  const tubeCenterYs = sortedTubes.map((tube) =>
    tubeFiberCenterY(tube, bodyTop, pitch),
  );
  const minTubeY = tubeCenterYs.length ? Math.min(...tubeCenterYs) : bodyTop;
  const maxTubeY = tubeCenterYs.length ? Math.max(...tubeCenterYs) : bodyTop;
  const cableCenterY = (minTubeY + maxTubeY) / 2;
  const sheathSize = computeSheathSize(scale, sortedTubes.length);
  const sheath = {
    x: 0,
    y: cableCenterY - sheathSize.height / 2,
    width: sheathSize.width,
    height: sheathSize.height,
  };

  const defaultTubeLength = maxTubeLengthForCable(sortedTubes, scale);
  const tubeFaceX = sheathSize.width;
  const stemXAbsolute =
    alignedStemX ??
    tubeFaceX + defaultTubeLength + BREAKOUT.fiberStemGap;
  const stemX = stemXAbsolute;
  const handleColumnW = fixedHandleOutsetFromStem();
  const viewWidth = stemX + handleColumnW;

  const tubeGeoms: TubeBreakoutGeom[] = sortedTubes.map((tube) => {
    const tubeCenterY = tubeFiberCenterY(tube, bodyTop, pitch);
    const tubeY = tubeCenterY;
    const sheathTop = sheath.y;
    const sheathBottom = sheath.y + sheath.height;
    const tubeCenterOnSheathFace =
      tubeY >= sheathTop - Y_TOLERANCE && tubeY <= sheathBottom + Y_TOLERANCE;
    // Horizontal when the fiber group center meets the sheath face; otherwise
    // fan from cable center (multi-tube cables span taller than the sheath box).
    // Expanded geometry ignores visualShiftY (TUB-002); collapsed handles add it separately.
    const originY = tubeCenterOnSheathFace ? tubeY : cableCenterY;
    const origin = { x: tubeFaceX, y: originY };
    const perTubeLength = Math.max(
      defaultTubeLength,
      tubeLengthForFiberCount(Math.max(1, tube.fibers.length), scale),
    );
    const tubeLength = Math.max(
      perTubeLength,
      stemXAbsolute - BREAKOUT.fiberStemGap - tubeFaceX,
    );
    const reachDelta = tube.stemReachX ?? 0;
    const fanInset = BREAKOUT.tubeFanInset * scale;
    const curveK = BREAKOUT.fiberCurveTension * scale;
    const rawEndX = tubeFaceX + tubeLength + reachDelta;
    const endX = rawEndX - fanInset;
    const endY = tubeY;
    const elbowX = fiberFanElbowX(stemX, endX, scale);
    const fibers: FiberBreakoutGeom[] = tube.fibers.map((fiber) => {
      const rowY = bodyTop + fiber.rowYOffset + pitch / 2;
      const junction = { x: endX, y: endY };
      const fanToX = fiberRowLayoutXs(stemX, fiber.circuitName).fanToX;
      const stem = { x: fanToX, y: rowY };
      if (isCenterFanRow(rowY, endY)) {
        return {
          handleId: fiber.handleId,
          rowIndex: fiber.rowIndex,
          rowY,
          fiberColor: fiber.fiberColor,
          tubeColor: fiber.tubeColor,
          fanFrom: junction,
          fanTo: stem,
          fanTailUnderlay: fanInset,
        };
      }
      return {
        handleId: fiber.handleId,
        rowIndex: fiber.rowIndex,
        rowY,
        fiberColor: fiber.fiberColor,
        tubeColor: fiber.tubeColor,
        fanFrom: junction,
        fanTo: stem,
        fanElbow: { x: elbowX, y: rowY },
        fanCurve: {
          c1: { x: elbowX - curveK, y: rowY },
          c2: { x: endX + curveK, y: endY },
        },
        fanTailUnderlay: fanInset,
      };
    });

    const shiftY = tube.visualShiftY ?? 0;
    const shiftedEndY = endY + shiftY;
    const end = { x: endX, y: shiftedEndY };
    const shiftedOrigin =
      Math.abs(originY - endY) <= Y_TOLERANCE
        ? { x: origin.x, y: shiftedEndY }
        : origin;
    const shiftedFibers = fibers.map((fiber) => ({
      ...fiber,
      rowY: fiber.rowY + shiftY,
      fanFrom: { x: fiber.fanFrom.x, y: shiftedEndY },
      fanTo: { x: fiber.fanTo.x, y: fiber.rowY + shiftY },
      ...(fiber.fanElbow
        ? { fanElbow: { x: fiber.fanElbow.x, y: fiber.rowY + shiftY } }
        : {}),
      ...(fiber.fanCurve
        ? {
            fanCurve: {
              c1: { x: fiber.fanCurve.c1.x, y: fiber.rowY + shiftY },
              c2: { x: fiber.fanCurve.c2.x, y: shiftedEndY },
            },
          }
        : {}),
    }));

    return {
      tubeColor: tube.tubeColor,
      origin: shiftedOrigin,
      end,
      angleDeg:
        Math.abs(shiftedOrigin.y - shiftedEndY) <= Y_TOLERANCE
          ? 0
          : (Math.atan2(
              shiftedEndY - shiftedOrigin.y,
              end.x - shiftedOrigin.x,
            ) *
              180) /
            Math.PI,
      labelPos: tubeLabelPosition(shiftedOrigin, end, scale),
      fibers: shiftedFibers,
    };
  });

  // Single-tube cables: fan-out drag moves sheath + tube + fan as one unit (TUB/manual).
  if (sortedTubes.length === 1) {
    const shiftY = sortedTubes[0]!.visualShiftY ?? 0;
    if (Math.abs(shiftY) > Y_TOLERANCE) {
      sheath.y += shiftY;
    }
  }

  if (side === "right") {
    sheath.x = viewWidth - sheathSize.width;
    for (const tube of tubeGeoms) {
      tube.origin = {
        x: mirrorX(tube.origin.x, viewWidth),
        y: tube.origin.y,
      };
      tube.end = { x: mirrorX(tube.end.x, viewWidth), y: tube.end.y };
      tube.labelPos = {
        ...tube.labelPos,
        x: mirrorX(tube.labelPos.x, viewWidth),
      };
      for (const fiber of tube.fibers) {
        fiber.fanFrom = {
          x: mirrorX(fiber.fanFrom.x, viewWidth),
          y: fiber.fanFrom.y,
        };
        fiber.fanTo = {
          x: mirrorX(fiber.fanTo.x, viewWidth),
          y: fiber.fanTo.y,
        };
        if (fiber.fanElbow) {
          fiber.fanElbow = {
            x: mirrorX(fiber.fanElbow.x, viewWidth),
            y: fiber.fanElbow.y,
          };
        }
        if (fiber.fanCurve) {
          fiber.fanCurve = {
            c1: {
              x: mirrorX(fiber.fanCurve.c1.x, viewWidth),
              y: fiber.fanCurve.c1.y,
            },
            c2: {
              x: mirrorX(fiber.fanCurve.c2.x, viewWidth),
              y: fiber.fanCurve.c2.y,
            },
          };
        }
      }
    }
  }

  return {
    bodyTop,
    cableCenterY,
    sheath,
    stemX: side === "left" ? stemX : viewWidth - stemX,
    tubes: tubeGeoms,
    viewWidth,
    viewHeight,
  };
}
