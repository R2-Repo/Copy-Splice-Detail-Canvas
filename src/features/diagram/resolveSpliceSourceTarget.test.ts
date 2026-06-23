import { describe, expect, it } from "vitest";

import { resolveSpliceSourceTarget } from "./resolveSpliceSourceTarget";

import type { FiberEndpoint } from "@/types/splice";

describe("resolveSpliceSourceTarget", () => {
  const ep = (id: string, side: "left" | "right") => ({
    visualCableId: id,
    handleId: `${id}-h`,
    endpoint: {
      cable: id,
      device: "d",
      fiberNumber: 1,
      tubeColor: "BL" as const,
      fiberColor: "BL" as const,
      csvColumn: "from" as const,
    } satisfies FiberEndpoint,
    canvasSide: side,
  });

  it("keeps csv left→right when on opposite canvas sides", () => {
    const left = ep("A", "left");
    const right = ep("B", "right");
    const { source, target } = resolveSpliceSourceTarget(left, right, {});
    expect(source.visualCableId).toBe("A");
    expect(target.visualCableId).toBe("B");
  });

  it("swaps when csv-left sits on canvas right", () => {
    const left = ep("A", "right");
    const right = ep("B", "left");
    const { source, target } = resolveSpliceSourceTarget(left, right, {
      "cable-A": { x: 900, y: 100 },
      "cable-B": { x: 100, y: 200 },
    });
    expect(source.visualCableId).toBe("B");
    expect(target.visualCableId).toBe("A");
  });

  it("uses upper cable as source when stacked on same column", () => {
    const left = ep("top", "right");
    const right = ep("bottom", "right");
    const { source, target } = resolveSpliceSourceTarget(left, right, {
      "cable-top": { x: 1400, y: 100 },
      "cable-bottom": { x: 1400, y: 400 },
    });
    expect(source.visualCableId).toBe("top");
    expect(target.visualCableId).toBe("bottom");
  });

  it("uses smaller X as source when same side different columns", () => {
    const left = ep("inner", "right");
    const right = ep("outer", "right");
    const { source, target } = resolveSpliceSourceTarget(left, right, {
      "cable-inner": { x: 1300, y: 100 },
      "cable-outer": { x: 1500, y: 100 },
    });
    expect(source.visualCableId).toBe("inner");
    expect(target.visualCableId).toBe("outer");
  });
});
