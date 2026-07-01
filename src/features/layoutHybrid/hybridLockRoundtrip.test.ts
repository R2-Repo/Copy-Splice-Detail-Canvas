import { describe, expect, it } from "vitest";

import {
  clearAllHybridLocks,
  lockGridSegments,
  lockTubeGroup,
  unlockHybridItem,
} from "./applyLocksToGrid";
import { onEditLock } from "./onEditLock";

describe("hybrid lock roundtrip", () => {
  const base = {
    reportKey: "test",
    positions: {},
    autoAdjustEnabled: true,
  };

  it("clears all lock kinds via clearAllHybridLocks", () => {
    let o = lockTubeGroup(base, "vc-left|BL");
    o = lockGridSegments(o, ["horizontal:0,0:100,0"]);
    o = onEditLock(o, "fusionDot", { dotId: "conn-1" });
    o = onEditLock(o, "legSegments", { segmentIds: ["vertical:50,0:50,100"] });

    const cleared = clearAllHybridLocks(o);
    expect(cleared.locks).toBeUndefined();
    expect(cleared.gridLocks).toBeUndefined();
    expect(cleared.legOverrides).toBeUndefined();
    expect(cleared.connectionOverrides).toBeUndefined();
    expect(cleared.bundleOverrides).toBeUndefined();
    expect(cleared.autoAdjustEnabled).toBe(true);
  });

  it("unlockHybridItem clears tube, segment, and fusion-dot keys", () => {
    let o = lockTubeGroup(base, "vc-a|OR");
    o = lockGridSegments(o, ["seg-a", "seg-b"]);
    o = onEditLock(o, "fusionDot", { dotId: "conn-x" });

    o = unlockHybridItem(o, "tubeGroup", "vc-a|OR");
    expect(o.gridLocks?.tubeGroups).not.toContain("vc-a|OR");

    o = unlockHybridItem(o, "segment", "seg-a");
    expect(o.gridLocks?.segments).toEqual(["seg-b"]);

    o = unlockHybridItem(o, "fusionDot", "conn-x");
    expect(o.gridLocks?.dots).toEqual([]);
  });
});
