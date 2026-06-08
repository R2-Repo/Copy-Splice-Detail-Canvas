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
  fiberLabelWidth: 130,
} as const;

export type FiberBreakoutGeom = {
  handleId: string;
  rowIndex: number;
  rowY: number;
  fiberColor: FiberColorAbbrev;
  tubeColor: TubeColorCode;
  fanFrom: { x: number; y: number };
  fanTo: { x: number; y: number };
};

export type TubeBreakoutGeom = {
  tubeColor: TubeColorCode;
  origin: { x: number; y: number };
  end: { x: number; y: number };
  angleDeg: number;
  fibers: FiberBreakoutGeom[];
};

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
  const viewWidth = stemX + BREAKOUT.fiberLabelWidth;

  const tubeGeoms: TubeBreakoutGeom[] = sortedTubes.map((tube) => {
    const tubeCenterY = tubeFiberCenterY(tube, bodyTop, pitch);
    const tubeY = tubeCenterY;
    const sheathTop = sheath.y;
    const sheathBottom = sheath.y + sheath.height;
    const tubeCenterOnSheathFace =
      tubeY >= sheathTop - Y_TOLERANCE && tubeY <= sheathBottom + Y_TOLERANCE;
    // Horizontal when the fiber group center meets the sheath face; otherwise
    // fan from cable center (multi-tube cables span taller than the sheath box).
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
    const endX = tubeFaceX + tubeLength;
    const endY = tubeY;
    const angleDeg =
      Math.abs(endY - originY) <= Y_TOLERANCE
        ? 0
        : (Math.atan2(endY - originY, endX - origin.x) * 180) / Math.PI;

    const fibers: FiberBreakoutGeom[] = tube.fibers.map((fiber) => {
      const rowY = bodyTop + fiber.rowYOffset + pitch / 2;
      return {
        handleId: fiber.handleId,
        rowIndex: fiber.rowIndex,
        rowY,
        fiberColor: fiber.fiberColor,
        tubeColor: fiber.tubeColor,
        fanFrom: { x: endX, y: endY },
        fanTo: { x: stemX, y: rowY },
      };
    });

    return {
      tubeColor: tube.tubeColor,
      origin,
      end: { x: endX, y: endY },
      angleDeg,
      fibers,
    };
  });

  if (side === "right") {
    sheath.x = viewWidth - sheathSize.width;
    for (const tube of tubeGeoms) {
      tube.origin = {
        x: mirrorX(tube.origin.x, viewWidth),
        y: tube.origin.y,
      };
      tube.end = { x: mirrorX(tube.end.x, viewWidth), y: tube.end.y };
      for (const fiber of tube.fibers) {
        fiber.fanFrom = {
          x: mirrorX(fiber.fanFrom.x, viewWidth),
          y: fiber.fanFrom.y,
        };
        fiber.fanTo = {
          x: mirrorX(fiber.fanTo.x, viewWidth),
          y: fiber.fanTo.y,
        };
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
