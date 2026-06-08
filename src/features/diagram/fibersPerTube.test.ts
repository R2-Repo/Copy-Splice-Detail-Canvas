import { describe, expect, it } from "vitest";

import { deriveFibersPerTube } from "./fibersPerTube";
import type { FiberEndpoint } from "@/types/splice";

function ep(
  cable: string,
  fiberNumber: number,
  tubeColor: FiberEndpoint["tubeColor"],
  fiberColor: FiberEndpoint["fiberColor"],
): FiberEndpoint {
  return {
    device: "",
    cable,
    fiberNumber,
    tubeColor,
    fiberColor,
    csvColumn: "from",
  };
}

describe("deriveFibersPerTube (D3)", () => {
  it("detects 12-fiber tubes from high fiber colors", () => {
    const endpoints = [ep("144 DIST", 7, "BL", "RD")];
    expect(deriveFibersPerTube(endpoints)).toBe(12);
  });

  it("detects 6-fiber tubes when only low colors appear", () => {
    const endpoints = [
      ep("6 DROP", 1, "BL", "BL"),
      ep("6 DROP", 2, "BL", "OR"),
      ep("6 DROP", 3, "BL", "GR"),
    ];
    expect(deriveFibersPerTube(endpoints, "6 DROP")).toBe(6);
  });

  it("votes 12 when explicit fiber numbers match 12-count mapping", () => {
    const endpoints = [ep("288 DIST", 85, "BK", "BL")];
    expect(deriveFibersPerTube(endpoints)).toBe(12);
  });

  it("votes 6 when explicit fiber numbers match 6-count mapping only", () => {
    const endpoints = [ep("6 DROP", 4, "BL", "BR")];
    expect(deriveFibersPerTube(endpoints)).toBe(6);
  });
});
