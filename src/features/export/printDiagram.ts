import type { Node, Viewport } from "@xyflow/react";

import {
  boundsFromFlowNodes,
  viewportForFitPage,
  type DiagramBounds,
} from "@/features/canvas/diagramViewport";
import type { ConnectionGraph } from "@/types/splice";

export const PRINT_BODY_CLASS = "printing-diagram";
export const PRINT_PAGE_STYLE_ID = "splice-diagram-print-page";

/** Minimal edge padding when fitting diagram to tabloid printable area. */
export const PRINT_FIT_PADDING_RATIO = 0.02;

/** US Tabloid landscape at 96 CSS px/in. */
export const PRINT_CSS_PX_PER_IN = 96;
export const PRINT_PAGE = {
  widthIn: 17,
  heightIn: 11,
  marginIn: 0.5,
} as const;

export function printableAreaCssPx(
  page = PRINT_PAGE,
  pxPerIn = PRINT_CSS_PX_PER_IN,
): { width: number; height: number } {
  return {
    width: (page.widthIn - 2 * page.marginIn) * pxPerIn,
    height: (page.heightIn - 2 * page.marginIn) * pxPerIn,
  };
}

export function exportTitleFromGraph(
  graph: ConnectionGraph | null,
  fallback = "Splice detail",
): string {
  if (!graph) return fallback;
  return (
    graph.report.header.spliceNumber ??
    graph.report.header.name ??
    fallback
  );
}

export function boundsFromNodesOrNull(
  nodes: Node[],
  getNodesBounds: (nodes: Node[]) => DiagramBounds | null,
): DiagramBounds | null {
  if (nodes.length === 0) return null;
  return getNodesBounds(nodes) ?? boundsFromFlowNodes(nodes);
}

export function printViewportForBounds(bounds: DiagramBounds): Viewport {
  const { width, height } = printableAreaCssPx();
  return viewportForFitPage(bounds, width, height, {
    paddingRatio: PRINT_FIT_PADDING_RATIO,
  });
}

export function flushRenderFrames(
  requestAnimationFrame: (cb: FrameRequestCallback) => number,
  frameCount = 2,
): Promise<void> {
  if (frameCount <= 0) return Promise.resolve();

  return new Promise((resolve) => {
    const step = (remaining: number) => {
      if (remaining <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(remaining - 1));
    };
    step(frameCount);
  });
}

export function injectPrintPageStyle(doc: Document = document): void {
  if (doc.getElementById(PRINT_PAGE_STYLE_ID)) return;

  const style = doc.createElement("style");
  style.id = PRINT_PAGE_STYLE_ID;
  style.media = "print";
  style.textContent = `
    @page {
      size: 17in 11in;
      margin: 0.5in;
    }
  `;
  doc.head.appendChild(style);
}

export function removePrintPageStyle(doc: Document = document): void {
  doc.getElementById(PRINT_PAGE_STYLE_ID)?.remove();
}

type StageStyleSnapshot = {
  width: string;
  height: string;
  maxWidth: string;
  maxHeight: string;
};

function applyPrintStageSize(stage: HTMLElement): StageStyleSnapshot {
  const { width, height } = printableAreaCssPx();
  const saved: StageStyleSnapshot = {
    width: stage.style.width,
    height: stage.style.height,
    maxWidth: stage.style.maxWidth,
    maxHeight: stage.style.maxHeight,
  };

  document.body.style.setProperty("--print-stage-width", `${width}px`);
  document.body.style.setProperty("--print-stage-height", `${height}px`);
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
  stage.style.maxWidth = `${width}px`;
  stage.style.maxHeight = `${height}px`;

  return saved;
}

function restorePrintStageSize(
  stage: HTMLElement,
  saved: StageStyleSnapshot,
): void {
  document.body.style.removeProperty("--print-stage-width");
  document.body.style.removeProperty("--print-stage-height");
  stage.style.width = saved.width;
  stage.style.height = saved.height;
  stage.style.maxWidth = saved.maxWidth;
  stage.style.maxHeight = saved.maxHeight;
}

export type PrintDiagramDeps = {
  nodes: Node[];
  graph: ConnectionGraph | null;
  getStageElement: () => HTMLElement | null;
  getViewport: () => Viewport;
  setViewport: (
    viewport: Viewport,
    options?: { duration?: number },
  ) => Promise<boolean>;
  getNodesBounds: (nodes: Node[]) => DiagramBounds | null;
  print?: () => void;
  requestAnimationFrame?: (cb: FrameRequestCallback) => number;
  addEventListener?: typeof window.addEventListener;
  removeEventListener?: typeof window.removeEventListener;
  dispatchResize?: () => void;
};

export function createPrintDiagramHandler(deps: PrintDiagramDeps): () => void {
  return () => {
    void runDiagramPrint(deps);
  };
}

export async function runDiagramPrint(deps: PrintDiagramDeps): Promise<boolean> {
  const bounds = boundsFromNodesOrNull(deps.nodes, deps.getNodesBounds);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return false;

  const stage = deps.getStageElement();
  if (!stage) return false;

  const { width: printWidth, height: printHeight } = printableAreaCssPx();
  if (printWidth <= 0 || printHeight <= 0) return false;

  const savedViewport = deps.getViewport();
  const savedTitle = document.title;
  const savedStageStyle = applyPrintStageSize(stage);
  const printFn = deps.print ?? (() => window.print());
  const raf = deps.requestAnimationFrame ?? requestAnimationFrame.bind(window);
  const dispatchResize =
    deps.dispatchResize ?? (() => window.dispatchEvent(new Event("resize")));

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove(PRINT_BODY_CLASS);
    document.title = savedTitle;
    removePrintPageStyle();
    restorePrintStageSize(stage, savedStageStyle);
    void deps.setViewport(savedViewport, { duration: 0 });
    deps.removeEventListener?.("afterprint", cleanup);
  };

  document.title = exportTitleFromGraph(deps.graph);
  injectPrintPageStyle();
  document.body.classList.add(PRINT_BODY_CLASS);
  deps.addEventListener?.("afterprint", cleanup);

  dispatchResize();
  await flushRenderFrames(raf, 2);

  await deps.setViewport(printViewportForBounds(bounds), { duration: 0 });
  await flushRenderFrames(raf, 3);

  printFn();
  return true;
}
