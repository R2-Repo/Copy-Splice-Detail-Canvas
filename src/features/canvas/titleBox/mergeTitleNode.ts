import type { Node } from "@xyflow/react";

import {
  diagramContentBounds,
  DIAGRAM_TITLE_NODE_ID,
  titleBoxPosition,
} from "@/features/canvas/titleBox/titleBoxLayout";
import { resolveTitleBlock } from "@/features/canvas/titleBox/titleBlockFields";
import type { DiagramTitleBlock, SpliceReportHeader } from "@/types/splice";

import type { DiagramTitleNodeData } from "@/features/canvas/nodes/types";

const OVERLAY_NODE_TYPES = new Set(["cableCallout", "diagramTitle"]);

export function mergeTitleNode(
  nodes: Node[],
  header: SpliceReportHeader,
  layoutWidth: number,
  diagramScale: number,
  titleBlockOverrides?: DiagramTitleBlock,
): Node[] {
  const withoutTitle = nodes.filter((n) => n.type !== "diagramTitle");
  const contentNodes = withoutTitle.filter(
    (n) => !OVERLAY_NODE_TYPES.has(n.type ?? ""),
  );
  const diagramBounds = diagramContentBounds(contentNodes);
  const fields = resolveTitleBlock(header, titleBlockOverrides);
  const layout = titleBoxPosition(layoutWidth, diagramScale, diagramBounds);

  const titleNode: Node = {
    id: DIAGRAM_TITLE_NODE_ID,
    type: "diagramTitle",
    position: { x: layout.x, y: layout.y },
    width: layout.width,
    height: layout.height,
    zIndex: 1000,
    data: {
      ...fields,
      diagramScale,
      boxWidth: layout.width,
    } satisfies DiagramTitleNodeData,
    draggable: false,
    selectable: false,
  };

  return [...withoutTitle, titleNode];
}
