import { CableCalloutNode } from "@/features/canvas/nodes/CableCalloutNode";
import { CableNode } from "@/features/canvas/nodes/CableNode";
import { DiagramTitleNode } from "@/features/canvas/nodes/DiagramTitleNode";
import { FiberAnchorNode } from "@/features/canvas/nodes/FiberAnchorNode";
import { SplicePointNode } from "@/features/canvas/nodes/SplicePointNode";
import { TubeAnchorNode } from "@/features/canvas/nodes/TubeAnchorNode";

export const spliceNodeTypes = {
  cable: CableNode,
  cableCallout: CableCalloutNode,
  diagramTitle: DiagramTitleNode,
  fiberAnchor: FiberAnchorNode,
  splicePoint: SplicePointNode,
  tubeAnchor: TubeAnchorNode,
};
