import { describe, expect, it, vi } from "vitest";

import { parseForcedLayoutSides, layoutSearchMode } from "./importSearchConfig";

describe("importSearchConfig", () => {
  it("parseForcedLayoutSides returns empty when unset", () => {
    expect(parseForcedLayoutSides()).toEqual([]);
  });

  it("layoutSearchMode defaults to beam", () => {
    expect(layoutSearchMode()).toBe("beam");
  });

  it("parseForcedLayoutSides parses cable:side pairs", () => {
    vi.stubEnv("VITE_FORCE_LAYOUT_SIDES", "CableA:top,CableB:right");
    expect(parseForcedLayoutSides()).toEqual([
      { cable: "CableA", side: "top" },
      { cable: "CableB", side: "right" },
    ]);
    vi.unstubAllEnvs();
  });
});
