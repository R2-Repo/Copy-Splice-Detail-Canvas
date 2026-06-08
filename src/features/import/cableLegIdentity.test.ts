import { describe, expect, it } from "vitest";

import {
  cableNameKey,
  computeCableCanvasSides,
  csvColumnsForCable,
  recordCableAppearance,
} from "./cableLegIdentity";
import type { FiberEndpoint } from "@/types/splice";

describe("csvColumnsForCable", () => {
  it("splits through-cable: To in Left, From in Right mirror (Example #2 dist)", () => {
    const columns = csvColumnsForCable({
      left: { from: 0, to: 4 },
      right: { from: 4, to: 0 },
    });
    expect(columns).toEqual(["from", "to"]);
  });

  it("single drop leg: From in Left, To in Right mirror only", () => {
    const columns = csvColumnsForCable({
      left: { from: 4, to: 0 },
      right: { from: 0, to: 4 },
    });
    expect(columns).toEqual(["from"]);
  });
});

describe("cableNameKey", () => {
  it("ignores remote device — aggregates by cable name", () => {
    const map = new Map();
    const ep = (device: string, cable: string): FiberEndpoint => ({
      device,
      cable,
      fiberNumber: 1,
      tubeColor: "BL",
      fiberColor: "BL",
      csvColumn: "from",
    });

    recordCableAppearance(map, ep("HUB-A", "11400S DIST"), "from", "left");
    recordCableAppearance(map, ep("HUB-B", "11400S DIST"), "from", "left");
    recordCableAppearance(map, ep("HUB-C", "11400S DIST"), "to", "left");

    expect(map.size).toBe(1);
    expect(map.get(cableNameKey("11400S DIST"))!.left.from).toBe(2);
    expect(map.get(cableNameKey("11400S DIST"))!.left.to).toBe(1);
  });
});

describe("computeCableCanvasSides", () => {
  it("assigns majority From to left and majority To to right", () => {
    const sides = computeCableCanvasSides([
      {
        id: "1",
        endpointA: {
          device: "",
          cable: "DROP",
          fiberNumber: 1,
          tubeColor: "BL",
          fiberColor: "BL",
          csvColumn: "from",
        },
        endpointB: {
          device: "",
          cable: "DIST",
          fiberNumber: 1,
          tubeColor: "BL",
          fiberColor: "BL",
          csvColumn: "to",
        },
      },
      {
        id: "2",
        endpointA: {
          device: "",
          cable: "DROP",
          fiberNumber: 2,
          tubeColor: "BL",
          fiberColor: "OR",
          csvColumn: "from",
        },
        endpointB: {
          device: "",
          cable: "DIST",
          fiberNumber: 2,
          tubeColor: "BL",
          fiberColor: "OR",
          csvColumn: "to",
        },
      },
    ]);

    expect(sides.get("DROP")).toBe("left");
    expect(sides.get("DIST")).toBe("right");
  });
});
