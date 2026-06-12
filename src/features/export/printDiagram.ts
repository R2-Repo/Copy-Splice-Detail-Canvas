import type { Node, Viewport } from "@xyflow/react";

import {
  boundsFromFlowNodes,
  viewportForFitWidth,
  VIEWPORT_EDGE_PADDING_RATIO,
  type DiagramBounds,
} from "@/features/canvas/diagramViewport";
import type { ConnectionGraph } from "@/types/splice";

export const PRINT_BODY_CLASS = "printing-diagram";

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

export function printViewportForBounds(
  bounds: DiagramBounds,
  stageWidth: number,
  stageHeight: number,
): Viewport {
  return viewportForFitWidth(bounds, stageWidth, stageHeight, {
    maxZoom: 1,
    paddingRatio: VIEWPORT_EDGE_PADDING_RATIO,
  });
}

export type PrintDiagramDeps = {
  nodes: Node[];
  graph: ConnectionGraph | null;
  stageWidth: number;
  stageHeight: number;
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
};

export function createPrintDiagramHandler(deps: PrintDiagramDeps): () => void {
  return () => {
    const bounds = boundsFromNodesOrNull(deps.nodes, deps.getNodesBounds);
    if (!bounds || bounds.width <= 0 || bounds.height <= 0) return;
    if (deps.stageWidth <= 0 || deps.stageHeight <= 0) return;

    const savedViewport = deps.getViewport();
    const savedTitle = document.title;
    const printFn = deps.print ?? (() => window.print());
    const raf = deps.requestAnimationFrame ?? requestAnimationFrame.bind(window);

    const cleanup = () => {
      document.body.classList.remove(PRINT_BODY_CLASS);
      document.title = savedTitle;
      void deps.setViewport(savedViewport, { duration: 0 });
      deps.removeEventListener?.("afterprint", cleanup);
    };

    document.title = exportTitleFromGraph(deps.graph);
    document.body.classList.add(PRINT_BODY_CLASS);
    deps.addEventListener?.("afterprint", cleanup);

    void deps
      .setViewport(
        printViewportForBounds(bounds, deps.stageWidth, deps.stageHeight),
        { duration: 0 },
      )
      .then(() => {
        raf(() => {
          printFn();
        });
      });
  };
}
