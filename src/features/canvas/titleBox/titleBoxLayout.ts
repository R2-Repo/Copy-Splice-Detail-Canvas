import {
  boundsFromFlowNodes,
  type DiagramBounds,
  type FlowNodeBoundsInput,
} from "@/features/canvas/diagramViewport";
import { CABLE_LAYOUT } from "@/features/diagram/cableLayoutMetrics";

export const DIAGRAM_TITLE_NODE_ID = "diagram-title";

export const TITLE_BOX = {
  /** Minimum gap between title box bottom and diagram top (flow px). */
  gapBelow: 24,
  minWidth: 320,
  maxWidth: 520,
  widthRatio: 0.38,
  baseFontPx: 11,
  lineHeightRatio: 1.4,
  rowCount: 4,
  paddingY: 8,
  paddingX: 10,
  borderPx: 1,
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function titleBoxWidth(layoutWidth: number): number {
  return clamp(
    layoutWidth * TITLE_BOX.widthRatio,
    TITLE_BOX.minWidth,
    TITLE_BOX.maxWidth,
  );
}

export function titleBoxFontSize(diagramScale: number): number {
  return TITLE_BOX.baseFontPx * diagramScale;
}

export function titleBoxLineHeight(diagramScale: number): number {
  return titleBoxFontSize(diagramScale) * TITLE_BOX.lineHeightRatio;
}

export function titleBoxHeight(diagramScale: number): number {
  const lineHeight = titleBoxLineHeight(diagramScale);
  return (
    TITLE_BOX.paddingY * 2 +
    TITLE_BOX.rowCount * lineHeight +
    TITLE_BOX.borderPx * 2
  );
}

export function diagramContentBounds(
  nodes: FlowNodeBoundsInput[],
): DiagramBounds | null {
  return boundsFromFlowNodes(nodes);
}

export function titleBoxPosition(
  layoutWidth: number,
  diagramScale: number,
  diagramBounds: DiagramBounds | null,
): { x: number; y: number; width: number; height: number; fontSize: number } {
  const width = titleBoxWidth(layoutWidth);
  const height = titleBoxHeight(diagramScale);
  const gapBelow = TITLE_BOX.gapBelow;

  if (diagramBounds) {
    const x = diagramBounds.x;
    const y = diagramBounds.y - gapBelow - height;
    return {
      x,
      y,
      width,
      height,
      fontSize: titleBoxFontSize(diagramScale),
    };
  }

  const y = CABLE_LAYOUT.topY - gapBelow - height;
  return {
    x: CABLE_LAYOUT.leftX,
    y,
    width,
    height,
    fontSize: titleBoxFontSize(diagramScale),
  };
}
