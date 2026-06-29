import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import {
  buildLayoutRuleContext,
  checkLayoutRule,
  type LayoutRuleId,
} from "./layoutRules";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { LEFT_REFERENCE_CSVS, readLeftCsv } from "@/testHelpers/leftCsvPaths";
import {
  LAYOUT_CONTRACT_CSVS,
  readReferenceCsv,
} from "@/testHelpers/layoutContractCsvPaths";

const STAGE_WIDTH = 1920;

/** Rules governing fiber-strand routing on import (grid engine default). */
const ROUTING_RULE_IDS = [
  "EDGE-004",
  "EDGE-006",
  "EDGE-008",
  "EDGE-011",
  "EDGE-012",
  "EDGE-013",
  "DOT-001",
  "DOT-002",
  "DOT-003",
  "DOT-004",
] as const satisfies readonly LayoutRuleId[];

type RoutingFixture = {
  label: string;
  load: () => string;
};

const FIXTURES: RoutingFixture[] = [
  {
    label: "example-1",
    load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.ringCut),
  },
  {
    label: "example-2",
    load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.dominantPair),
  },
  {
    label: "example-3",
    load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.multiCable),
  },
  ...LEFT_REFERENCE_CSVS.map((file) => ({
    label: file.replace(/\.csv$/, "").toLowerCase(),
    load: () => readLeftCsv(file),
  })),
];

function ruleContextForCsv(text: string, label: string) {
  const graph = buildConnectionGraph(parseBentleyCsv(text));
  return buildLayoutRuleContext(
    graph,
    undefined,
    { reportKey: label, positions: {}, routingEngine: "grid" } as never,
    { stageWidth: STAGE_WIDTH },
  );
}

describe("routing import contract (grid, feasibility loop)", () => {
  for (const fixture of FIXTURES) {
    describe(fixture.label, () => {
      const ctx = ruleContextForCsv(fixture.load(), fixture.label);

      for (const ruleId of ROUTING_RULE_IDS) {
        it(`${ruleId} passes after feasible import layout`, () => {
          const result = checkLayoutRule(ruleId, ctx);
          expect(result.ok, result.detail).toBe(true);
        });
      }

      it("uses grid splice edges with precomputed paths", () => {
        const primaryEdges = ctx.reactFlow.edges.filter(
          (e) => e.type === "splice" && e.id.startsWith("splice-left-"),
        );
        expect(primaryEdges.length).toBeGreaterThan(0);
        for (const edge of primaryEdges) {
          const data = edge.data as Record<string, unknown>;
          expect(String(data.leftPath ?? "")).not.toBe("");
          expect(String(data.rightPath ?? "")).not.toBe("");
        }
      });
    });
  }
});
