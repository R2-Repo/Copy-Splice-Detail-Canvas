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
