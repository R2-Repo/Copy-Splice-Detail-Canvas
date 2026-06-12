import { useReactFlow, type Node } from "@xyflow/react";
import { useCallback, type RefObject } from "react";

import { createPrintDiagramHandler } from "@/features/export/printDiagram";
import type { ConnectionGraph } from "@/types/splice";

export function usePrintDiagram(
  nodes: Node[],
  graph: ConnectionGraph | null,
  stageRef: RefObject<HTMLDivElement | null>,
): () => void {
  const { getViewport, setViewport, getNodesBounds } = useReactFlow();

  return useCallback(() => {
    const stage = stageRef.current;
    createPrintDiagramHandler({
      nodes,
      graph,
      stageWidth: stage?.clientWidth ?? 0,
      stageHeight: stage?.clientHeight ?? 0,
      getViewport,
      setViewport,
      getNodesBounds,
    })();
  }, [nodes, graph, stageRef, getViewport, setViewport, getNodesBounds]);
}
