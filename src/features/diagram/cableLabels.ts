/** Bentley-style cable header from name (e.g. "006 SMFO (R2)"). */
import {
  FIBER_CODE_HANDLE_GAP,
  FIBER_CIRCUIT_MAX_WIDTH,
  FIBER_HANDLE_DOT,
  FIBER_LABEL_CODE_GAP,
  FIBER_ROW_CODE_MIN_WIDTH,
  FIBER_ROW_INNER_GAP,
  FIBER_ROW_SWATCH_WIDTH,
  SPLICE_HANDLE_OVERHANG,
  fiberCodeColumnWidth,
  fiberRowPrefixWidth,
} from "@/features/diagram/cableLayoutMetrics";
import type { VisualCable } from "@/features/diagram/visualCables";

export function smfoLabelForCable(cable: string): string | undefined {
  if (/DROP/i.test(cable)) {
    const m = cable.match(/\b(\d+)\s*[- ]?DROP/i) ?? cable.match(/^(\d+)/);
    const n = m ? m[1]!.padStart(3, "0") : "006";
    return `${n} SMFO (R2)`;
  }
  if (/DK-/i.test(cable)) return "006 SMFO (R2)";
  const m =
    cable.match(/\b(144|288|96|48|24|18|12|6)\b/i) ??
    cable.match(/\b(\d{2,3})\s*[- ]?(?:SMF|DIST)/i);
  if (m) return `${m[1]!.padStart(3, "0")} SMFO (R2)`;
  return undefined;
}

export function formatCircuitTag(circuitName?: string, fiberColor?: string): string | undefined {
  if (!circuitName) return undefined;
  const base = circuitName.replace(/\s+/g, " ").trim();
  if (!fiberColor) return `(${base})`;
  return `(${base})`;
}

const CIRCUIT_TAG_FONT =
  '500 0.5rem system-ui, -apple-system, "Segoe UI", sans-serif';

let measureCanvas: HTMLCanvasElement | null = null;
const circuitTagWidthCache = new Map<string, number>();

function estimateCircuitTagWidth(tag: string): number {
  return Math.min(tag.length * 4.5, FIBER_CIRCUIT_MAX_WIDTH);
}

/** Rendered width of a circuit/OS tag (matches `.cable-node__circuit`). */
export function formattedCircuitTagWidth(circuitName?: string): number {
  const tag = formatCircuitTag(circuitName);
  if (!tag) return 0;

  const cached = circuitTagWidthCache.get(tag);
  if (cached !== undefined) return cached;

  if (typeof document === "undefined") {
    const width = estimateCircuitTagWidth(tag);
    circuitTagWidthCache.set(tag, width);
    return width;
  }

  try {
    if (!measureCanvas) {
      measureCanvas = document.createElement("canvas");
    }
    const ctx = measureCanvas.getContext("2d");
    if (ctx) {
      ctx.font = CIRCUIT_TAG_FONT;
      const width = Math.min(ctx.measureText(tag).width, FIBER_CIRCUIT_MAX_WIDTH);
      circuitTagWidthCache.set(tag, width);
      return width;
    }
  } catch {
    // jsdom or other environments without canvas 2d
  }

  const width = estimateCircuitTagWidth(tag);
  circuitTagWidthCache.set(tag, width);
  return width;
}

/** Stem → React Flow handle center (label row + handle overhang). */
export function fiberRowLabelWidth(circuitName?: string): number {
  return fiberRowPrefixWidth() + formattedCircuitTagWidth(circuitName);
}

/** Outset from stem X to splice handle center on one cable side. */
export function spliceHandleOutsetFromStem(circuitName?: string): number {
  return (
    formattedCircuitTagWidth(circuitName) +
    fiberCodeColumnWidth() +
    SPLICE_HANDLE_OVERHANG
  );
}

/** Fixed stem → handle center: swatch runway + max label slot + code column + overhang. */
export function fixedHandleOutsetFromStem(): number {
  return (
    FIBER_ROW_SWATCH_WIDTH +
    FIBER_ROW_INNER_GAP +
    FIBER_CIRCUIT_MAX_WIDTH +
    fiberCodeColumnWidth() +
    SPLICE_HANDLE_OVERHANG
  );
}

export type FiberRowLayoutXs = {
  handleX: number;
  codeLeftX: number;
  labelEndX: number;
  labelStartX: number;
  fanToX: number;
};

/** Per-row X anchors (left-cable local coords; mirror for right in CableNode). */
export function fiberRowLayoutXs(
  stemX: number,
  circuitName?: string,
): FiberRowLayoutXs {
  const tagW = formattedCircuitTagWidth(circuitName);
  const handleX = stemX + fixedHandleOutsetFromStem();
  const codeLeftX =
    handleX -
    FIBER_HANDLE_DOT / 2 -
    FIBER_CODE_HANDLE_GAP -
    FIBER_ROW_CODE_MIN_WIDTH;
  const labelEndX = codeLeftX - FIBER_LABEL_CODE_GAP;
  const labelStartX = labelEndX - tagW;
  return {
    handleX,
    codeLeftX,
    labelEndX,
    labelStartX,
    /** Fan horizontal meets the label start — strand does not run through label text. */
    fanToX: labelStartX,
  };
}

/** @internal test helper */
export function resetCircuitTagWidthCacheForTests(): void {
  circuitTagWidthCache.clear();
}

export type SideCircuitLabelSpan = { left: number; right: number };

function maxCircuitTagWidthForCables(cables: VisualCable[]): number {
  let max = 0;
  for (const vc of cables) {
    for (const tube of vc.tubes) {
      for (const fiber of tube.fibers) {
        max = Math.max(max, formattedCircuitTagWidth(fiber.circuitName));
      }
    }
  }
  return max;
}

/** Longest handle→circuit-tag span per canvas side (prefix + max OS width). */
export function computeSideCircuitLabelSpans(
  visualCables: VisualCable[],
  sideOf: (vc: VisualCable) => "left" | "right",
): SideCircuitLabelSpan {
  const codeCol = fiberCodeColumnWidth();
  const leftCables = visualCables.filter((vc) => sideOf(vc) === "left");
  const rightCables = visualCables.filter((vc) => sideOf(vc) === "right");
  return {
    left: codeCol + maxCircuitTagWidthForCables(leftCables),
    right: codeCol + maxCircuitTagWidthForCables(rightCables),
  };
}
