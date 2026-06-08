import { describe, expect, it } from "vitest";

import {
  displaySideFromCanvasX,
  visualCableIdFromNodeId,
} from "./cableDisplaySide";
import { LAYOUT } from "./layoutSpliceDiagram";

describe("displaySideFromCanvasX", () => {
  it("classifies nodes left of center as left-facing", () => {
    expect(displaySideFromCanvasX(LAYOUT.centerX - 1)).toBe("left");
    expect(displaySideFromCanvasX(0)).toBe("left");
  });

  it("classifies nodes at or right of center as right-facing", () => {
    expect(displaySideFromCanvasX(LAYOUT.centerX)).toBe("right");
    expect(displaySideFromCanvasX(LAYOUT.centerX + 400)).toBe("right");
  });
});

describe("visualCableIdFromNodeId", () => {
  it("strips cable- prefix", () => {
    expect(visualCableIdFromNodeId("cable-left::foo")).toBe("left::foo");
    expect(visualCableIdFromNodeId("fiber-1")).toBeNull();
  });
});
