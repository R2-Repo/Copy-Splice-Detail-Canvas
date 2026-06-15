import { useReactFlow, type Node } from "@xyflow/react";
import { useCallback, type RefObject } from "react";

import { createPrintDiagramHandler } from "@/features/export/printDiagram";
import type { ConnectionGraph } from "@/types/splice";

export function usePrintDiagram(
  nodes: Node[],
  graph: ConnectionGraph | null,
  stageRef: RefObject<HTMLElement | null>,
): () => void {
  const { getViewport, setViewport, getNodesBounds } = useReactFlow();

  return useCallback(() => {
    createPrintDiagramHandler({
      nodes,
      graph,
      getStageElement: () => stageRef.current,
      getViewport,
      setViewport,
      getNodesBounds,
    })();
  }, [nodes, graph, stageRef, getViewport, setViewport, getNodesBounds]);
}
