import { describe, expect, it } from "vitest";

import { onEditLock, unlockHybridItem } from "./onEditLock";

describe("unlockHybridItem", () => {
  it("clears fusion-dot lock and dotShiftX override", () => {
    const base = onEditLock(
      {
        reportKey: "test",
        positions: {},
        legOverrides: {
          "conn-1": { dotShiftX: 12, leftSegments: { 0: { dx: 4 } } },
        },
        gridLocks: {
          segments: [],
          dots: ["conn-1"],
          tubeGroups: [],
        },
      },
      "fusionDot",
      { dotId: "conn-1" },
    );

    const next = unlockHybridItem(base, "fusionDot", "conn-1");

    expect(next.gridLocks?.dots).not.toContain("conn-1");
    expect(next.legOverrides?.["conn-1"]?.dotShiftX).toBeUndefined();
    expect(next.legOverrides?.["conn-1"]?.leftSegments).toEqual({ 0: { dx: 4 } });
  });

  it("removes leg override entry when only dotShiftX was set", () => {
    const base = onEditLock(
      {
        reportKey: "test",
        positions: {},
        legOverrides: { "conn-2": { dotShiftX: 8 } },
        gridLocks: {
          segments: [],
          dots: ["conn-2"],
          tubeGroups: [],
        },
      },
      "fusionDot",
      { dotId: "conn-2" },
    );

    const next = unlockHybridItem(base, "fusionDot", "conn-2");

    expect(next.legOverrides?.["conn-2"]).toBeUndefined();
    expect(next.gridLocks?.dots).toEqual([]);
  });

  it("locks fusion dot without leg override (default position lock)", () => {
    const next = onEditLock(
      { reportKey: "test", positions: {} },
      "fusionDot",
      { dotId: "conn-3" },
    );
    expect(next.gridLocks?.dots).toContain("conn-3");
    expect(next.legOverrides).toBeUndefined();
  });
});
