import { describe, expect, it } from "vitest";

import { DEFAULT_LAYOUT_EXPANSION } from "@/features/diagram/layoutExpansion";
import { syntheticTopBottomReliefGraph } from "@/features/layoutSearch/fixtures/syntheticGraphs";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import {
  type LayoutCandidate,
  type LayoutSide,
} from "@/features/layoutSearch/layoutCandidate";

import {
  sdcLayout003,
  validateCandidateStackSides,
  validateRenderedSideAssignment,
} from "./layout003";
import { fail } from "./helpers";

describe("SDC-LAYOUT-003", () => {
  it("fails when stack order disagrees with cableSides", () => {
    const candidate: LayoutCandidate = {
      cableSides: { "CABLE-A": "top", "CABLE-B": "bottom" },
      stackOrder: {
        left: [],
        right: [],
        top: ["CABLE-B"],
        bottom: ["CABLE-A"],
      },
      layoutWidth: 1200,
      layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
    };
    expect(validateCandidateStackSides(candidate)).toEqual([
      "CABLE-A on top but missing from top stack",
      "CABLE-B on bottom but missing from bottom stack",
      "CABLE-B listed on top stack but cableSides is bottom",
      "CABLE-A listed on bottom stack but cableSides is top",
    ]);
  });

  it("passes stack/side consistency for a coherent candidate", () => {
    const candidate: LayoutCandidate = {
      cableSides: {
        "CABLE-A": "top" as LayoutSide,
        "CABLE-B": "bottom" as LayoutSide,
      },
      stackOrder: {
        left: [],
        right: [],
        top: ["CABLE-A"],
        bottom: ["CABLE-B"],
      },
      layoutWidth: 1200,
      layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
    };
    expect(validateCandidateStackSides(candidate)).toEqual([]);
    const result = sdcLayout003.check({
      report: syntheticTopBottomReliefGraph().report,
      graph: syntheticTopBottomReliefGraph(),
      overrides: {
        reportKey: "t",
        positions: {},
        optimizedLayoutCandidate: candidate,
      },
    });
    expect(result[0]?.ok).toBe(true);
  });

  it("top/bottom relief candidate does not false-fail LAYOUT-002 stem/fan checks", () => {
    const graph = syntheticTopBottomReliefGraph();
    const candidate: LayoutCandidate = {
      cableSides: {
        "CABLE-A": "top",
        "CABLE-B": "bottom",
      },
      stackOrder: {
        left: [],
        right: [],
        top: ["CABLE-A"],
        bottom: ["CABLE-B"],
      },
      layoutWidth: 1400,
      layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
    };

    const result = evaluateLayoutCandidate(graph, candidate);
    const layout002 = result.violations.find((v) => v.id === "SDC-LAYOUT-002");
    const layout003 = result.violations.find((v) => v.id === "SDC-LAYOUT-003");

    expect(layout003?.ok ?? true).toBe(true);
    expect(layout002?.detail.includes("shared label column misaligned")).not.toBe(
      true,
    );
    expect(layout002?.detail.includes("fiber fan-out direction wrong")).not.toBe(
      true,
    );
  });

  it("validateRenderedSideAssignment catches paint mismatch", () => {
    const graph = syntheticTopBottomReliefGraph();
    const failures = validateRenderedSideAssignment({
      report: graph.report,
      graph,
      visualCables: [
        {
          id: "vc-a",
          legId: "leg-a",
          device: "D",
          cable: "CABLE-A",
          side: "left",
          order: 0,
          tubes: [],
        },
      ],
      reactFlow: {
        nodes: [
          {
            id: "cable-vc-a",
            type: "cable",
            position: { x: 0, y: 0 },
            data: {
              label: "CABLE-A",
              legId: "leg-a",
              side: "left",
              quadSide: "bottom",
              tubes: [],
              nodeHeight: 100,
              fiberPitch: 24,
            },
          },
        ],
        edges: [],
      },
      overrides: {
        reportKey: "t",
        positions: {},
        optimizedLayoutCandidate: {
          cableSides: { "CABLE-A": "top" },
          stackOrder: { left: [], right: [], top: ["CABLE-A"], bottom: [] },
          layoutWidth: 1200,
          layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
        },
      },
    });
    expect(failures[0]).toContain("bottom");
    expect(failures[0]).toContain("top");
  });

  it("reports fail severity for inconsistent candidate", () => {
    const graph = syntheticTopBottomReliefGraph();
    const [result] = sdcLayout003.check({
      report: graph.report,
      graph,
      overrides: {
        reportKey: "t",
        positions: {},
        optimizedLayoutCandidate: {
          cableSides: { "CABLE-A": "left" },
          stackOrder: { left: [], right: ["CABLE-A"], top: [], bottom: [] },
          layoutWidth: 1200,
          layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
        },
      },
    });
    expect(result).toEqual(
      fail(
        "SDC-LAYOUT-003",
        "CABLE-A on left but missing from left stack; CABLE-A listed on right stack but cableSides is left",
        expect.any(Array),
      ),
    );
  });
});
