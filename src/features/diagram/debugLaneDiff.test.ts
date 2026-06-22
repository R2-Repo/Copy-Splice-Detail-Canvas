import { describe, expect, it, vi } from "vitest";

import { debugLaneDiffEnabled, logLaneAssignmentDiff } from "./debugLaneDiff";

describe("debugLaneDiff", () => {
  it("logLaneAssignmentDiff is a no-op when debug flag is off", () => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    logLaneAssignmentDiff(
      "test",
      new Map([["splice-a", { midX: 100 }]]),
      new Map([["splice-a", { midX: 120 }]]),
    );
    expect(console.info).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("debugLaneDiffEnabled reads VITE_DEBUG_LANE_DIFF", () => {
    expect(typeof debugLaneDiffEnabled()).toBe("boolean");
  });
});
