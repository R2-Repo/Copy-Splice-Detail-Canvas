import { describe, expect, it } from "vitest";

import {
  FIBER_ANCHOR_NODE_SIZE,
  fiberAnchorNodeHandles,
  splicePointNodeHandles,
} from "@/features/canvas/nodes/spliceEngineNodeHandles";
import { wireSplitSpliceEdges } from "@/features/diagram/buildNodesEngineGraph";

describe("spliceEngineNodeHandles", () => {
  it("declares in/out handles for left-side fiber anchors", () => {
    const handles = fiberAnchorNodeHandles("anchor-a", "left");
    expect(handles).toHaveLength(2);
    expect(handles.map((h) => h.id).sort()).toEqual(["in", "out"]);
    expect(handles.find((h) => h.id === "out")?.x).toBe(FIBER_ANCHOR_NODE_SIZE);
  });

  it("declares left/right fusion-point handles", () => {
    const handles = splicePointNodeHandles("splice-a");
    expect(handles.map((h) => h.id).sort()).toEqual(["in", "out"]);
  });
});

describe("wireSplitSpliceEdges", () => {
  it("wires precomputed composite edges to anchor and splice-point nodes", () => {
    const composite = [
      {
        id: "splice-conn-1",
        source: "cable-left",
        target: "cable-right",
        type: "splice",
        data: {
          routingPrecomputed: true,
          leftPath: "M 0 0 L 10 0",
          rightPath: "M 10 0 L 20 0",
          spliceX: 10,
          spliceY: 0,
        },
      },
    ] as never;
    const entries = [
      {
        id: "splice-conn-1",
        sourceNodeId: "cable-left",
        targetNodeId: "cable-right",
        sourceX: 0,
        sourceY: 0,
        targetX: 20,
        targetY: 0,
        fallbackLane: 0,
      },
    ] as never;

    const wired = wireSplitSpliceEdges(composite, entries);
    expect(wired).toHaveLength(2);
    expect(wired[0]?.source).toBe("fiberAnchor-left::conn-1");
    expect(wired[0]?.target).toBe("splicePoint-conn-1");
    expect(wired[1]?.source).toBe("splicePoint-conn-1");
    expect(wired[1]?.target).toBe("fiberAnchor-right::conn-1");
  });
});
