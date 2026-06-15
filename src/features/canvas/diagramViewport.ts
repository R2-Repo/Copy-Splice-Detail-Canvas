export type DiagramBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type FlowNodeBoundsInput = {
  position: { x: number; y: number };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number } | null;
};

export type ViewportFitOptions = {
  paddingRatio?: number;
  maxZoom?: number;
  minZoom?: number;
};

/** Horizontal padding on each side when fitting the diagram to the stage. */
export const VIEWPORT_EDGE_PADDING_RATIO = 0.08;

/** Usable diagram width at React Flow zoom = 1 inside the stage. */
export function stageInnerWidth(
  stageWidth: number,
  paddingRatio = VIEWPORT_EDGE_PADDING_RATIO,
): number {
  return Math.max(1, stageWidth * (1 - 2 * paddingRatio));
}

export function boundsFromFlowNodes(
  nodes: FlowNodeBoundsInput[],
): DiagramBounds | null {
  if (nodes.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const width = node.measured?.width ?? node.width ?? 0;
    const height = node.measured?.height ?? node.height ?? 0;
    if (width <= 0 || height <= 0) continue;
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + width);
    maxY = Math.max(maxY, node.position.y + height);
  }

  if (!Number.isFinite(minX)) return null;

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function clampZoom(
  zoom: number,
  options?: ViewportFitOptions,
): number {
  const maxZoom = options?.maxZoom ?? Infinity;
  const minZoom = options?.minZoom ?? 0;
  return Math.max(minZoom, Math.min(maxZoom, zoom));
}

/**
 * Fit diagram width to the stage; top-align vertically so tall splices keep
 * full horizontal span and the user pans down instead of shrinking to fit height.
 */
export function viewportForFitWidth(
  bounds: DiagramBounds,
  stageWidth: number,
  stageHeight: number,
  options?: ViewportFitOptions,
): { x: number; y: number; zoom: number } {
  const paddingRatio = options?.paddingRatio ?? 0.08;
  const padX = stageWidth * paddingRatio;
  const padY = stageHeight * paddingRatio;
  const innerW = Math.max(1, stageWidth - 2 * padX);

  const zoom = clampZoom(innerW / bounds.width, {
    ...options,
    maxZoom: options?.maxZoom ?? 1,
  });

  const x = padX - bounds.x * zoom;
  const y = padY - bounds.y * zoom;

  return { x, y, zoom };
}

/**
 * Fit diagram bounds inside a page-sized area, centered on both axes.
 * Used for print export where the full diagram must fit one tabloid page.
 */
export function viewportForFitPage(
  bounds: DiagramBounds,
  pageWidth: number,
  pageHeight: number,
  options?: ViewportFitOptions,
): { x: number; y: number; zoom: number } {
  const paddingRatio = options?.paddingRatio ?? VIEWPORT_EDGE_PADDING_RATIO;
  const padX = pageWidth * paddingRatio;
  const padY = pageHeight * paddingRatio;
  const innerW = Math.max(1, pageWidth - 2 * padX);
  const innerH = Math.max(1, pageHeight - 2 * padY);

  const zoom = clampZoom(Math.min(innerW / bounds.width, innerH / bounds.height), {
    ...options,
    maxZoom: options?.maxZoom ?? 1,
  });

  const contentW = bounds.width * zoom;
  const contentH = bounds.height * zoom;
  const x = (pageWidth - contentW) / 2 - bounds.x * zoom;
  const y = (pageHeight - contentH) / 2 - bounds.y * zoom;

  return { x, y, zoom };
}

/**
 * Place the diagram at zoom 1 so canvas pixels map 1:1 to screen pixels.
 * Use when layout width is sized to `stageInnerWidth` — avoids zooming out a
 * wide canvas until cables look unchanged on screen.
 */
export function viewportAtUnitZoom(
  bounds: DiagramBounds,
  stageWidth: number,
  stageHeight: number,
  paddingRatio = VIEWPORT_EDGE_PADDING_RATIO,
): { x: number; y: number; zoom: number } {
  const padX = stageWidth * paddingRatio;
  const padY = stageHeight * paddingRatio;
  return {
    x: padX - bounds.x,
    y: padY - bounds.y,
    zoom: 1,
  };
}

/**
 * Zoom 1 with a canvas X coordinate centered on the stage. Spreads the center
 * routing gap across the viewport instead of shrinking the whole diagram to fit.
 */
export function viewportAtUnitZoomFocused(
  bounds: DiagramBounds,
  stageWidth: number,
  stageHeight: number,
  focusCenterX: number,
  paddingRatio = VIEWPORT_EDGE_PADDING_RATIO,
): { x: number; y: number; zoom: number } {
  const padY = stageHeight * paddingRatio;
  return {
    x: stageWidth / 2 - focusCenterX,
    y: padY - bounds.y,
    zoom: 1,
  };
}
