import { describe, expect, it } from "vitest";

import {
  fiberNumberToAbbrev,
  fiberNumberToTube,
  parseTubeColorCode,
  TIA_12_COLORS,
} from "./colorCode";

describe("colorCode", () => {
  it("has 12 TIA colors", () => {
    expect(TIA_12_COLORS).toHaveLength(12);
  });

  it("maps 144-count fiber numbers", () => {
    expect(fiberNumberToTube(1)).toBe(1);
    expect(fiberNumberToTube(12)).toBe(1);
    expect(fiberNumberToTube(13)).toBe(2);
    expect(fiberNumberToTube(144)).toBe(12);
    expect(fiberNumberToAbbrev(1)).toBe("BL");
    expect(fiberNumberToAbbrev(12)).toBe("AQ");
    expect(fiberNumberToAbbrev(13)).toBe("BL");
  });

  it("parses striped tube codes", () => {
    expect(parseTubeColorCode("BL-BK")).toBe("BL-BK");
    expect(parseTubeColorCode("OR-BK")).toBe("OR-BK");
    expect(parseTubeColorCode("BL")).toBe("BL");
    expect(parseTubeColorCode("xx")).toBeNull();
  });
});
