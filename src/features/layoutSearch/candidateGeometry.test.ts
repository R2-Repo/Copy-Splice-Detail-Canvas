import { describe, expect, it } from "vitest";

import {
  candidateGeometryKey,
  CandidateRuleValidationCache,
} from "./candidateGeometry";
import type { LayoutCandidate } from "./layoutCandidate";

function sampleCandidate(width: number): LayoutCandidate {
  return {
    cableSides: { "CABLE-A": "left", "CABLE-B": "right" },
    stackOrder: {
      left: ["CABLE-A"],
      right: ["CABLE-B"],
      top: [],
      bottom: [],
    },
    layoutWidth: width,
    layoutExpansion: {
      centerGapPadding: 0,
      cableGapExtra: 0,
      tubeGroupGapExtra: 0,
    },
  };
}

describe("candidateGeometry", () => {
  it("candidateGeometryKey ignores layout width", () => {
    const a = sampleCandidate(1200);
    const b = sampleCandidate(1400);
    expect(candidateGeometryKey(a)).toBe(candidateGeometryKey(b));
  });

  it("CandidateRuleValidationCache stores by geometry+tier", () => {
    const cache = new CandidateRuleValidationCache();
    const geom = candidateGeometryKey(sampleCandidate(1200));
    const key = cache.cacheKey(geom, "T0", "candidate-screen");
    cache.set(key, {
      feasible: true,
      violations: [
        { id: "SDC-LAYOUT-001", ok: true, severity: "info", detail: "ok" },
      ],
    });
    expect(cache.get(key)?.feasible).toBe(true);
    cache.clear();
    expect(cache.size).toBe(0);
  });
});
