import { CableNode } from "@/features/canvas/nodes/CableNode";
import { FiberAnchorNode } from "@/features/canvas/nodes/FiberAnchorNode";
import { SplicePointNode } from "@/features/canvas/nodes/SplicePointNode";
import { TubeAnchorNode } from "@/features/canvas/nodes/TubeAnchorNode";

export const spliceNodeTypes = {
  cable: CableNode,
  fiberAnchor: FiberAnchorNode,
  splicePoint: SplicePointNode,
  tubeAnchor: TubeAnchorNode,
};
