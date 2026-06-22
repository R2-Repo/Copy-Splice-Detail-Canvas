import { describe, expect, it } from "vitest";

import {
  clearAllHybridLocks,
  lockCablePosition,
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

  it("lockCablePosition stores cable-node position key", () => {
    const o = lockCablePosition(base, "vc-left", { x: 10, y: 20 });
    expect(o.positions["cable-vc-left"]).toEqual({ x: 10, y: 20 });
    expect(o.locks?.cables?.["vc-left"]).toBe(true);
    expect(o.gridLocks?.cables).toContain("vc-left");
  });

  it("clears all lock kinds via clearAllHybridLocks", () => {
    let o = lockCablePosition(base, "vc-left", { x: 10, y: 20 });
    o = lockTubeGroup(o, "vc-left|BL");
    o = lockGridSegments(o, ["horizontal:0,0:100,0"]);
    o = onEditLock(o, "fusionDot", { dotId: "conn-1" });
    o = onEditLock(o, "legSegments", { segmentIds: ["vertical:50,0:50,100"] });

    const cleared = clearAllHybridLocks(o);
    expect(cleared.locks).toBeUndefined();
    expect(cleared.gridLocks).toBeUndefined();
    expect(cleared.legOverrides).toBeUndefined();
    expect(cleared.autoAdjustEnabled).toBe(true);
  });

  it("unlockHybridItem clears cable, tube, segment, and fusion-dot keys", () => {
    let o = lockCablePosition(base, "vc-a", { x: 1, y: 2 });
    o = lockTubeGroup(o, "vc-a|OR");
    o = lockGridSegments(o, ["seg-a", "seg-b"]);
    o = onEditLock(o, "fusionDot", { dotId: "conn-x" });

    o = unlockHybridItem(o, "cable", "vc-a");
    expect(o.gridLocks?.cables).not.toContain("vc-a");
    expect(o.locks?.cables?.["vc-a"]).toBeUndefined();

    o = unlockHybridItem(o, "tubeGroup", "vc-a|OR");
    expect(o.gridLocks?.tubeGroups).not.toContain("vc-a|OR");

    o = unlockHybridItem(o, "segment", "seg-a");
    expect(o.gridLocks?.segments).toEqual(["seg-b"]);

    o = unlockHybridItem(o, "fusionDot", "conn-x");
    expect(o.gridLocks?.dots).toEqual([]);
  });
});
