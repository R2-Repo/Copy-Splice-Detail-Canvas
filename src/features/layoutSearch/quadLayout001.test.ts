import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

import {
  heuristicBaselineCandidate,
  type LayoutCandidate,
} from "./layoutCandidate";
import { evaluateT1 } from "./tieredEvaluate";
import { analyzeTopology } from "./topology/analyzeTopology";
import { syntheticTopBottomReliefGraph } from "./fixtures/syntheticGraphs";

const examples = join(process.cwd(), "docs/reference/examples");

function leftSpTopCableCandidate(graph: ReturnType<typeof buildConnectionGraph>): LayoutCandidate {
  const baseline = heuristicBaselineCandidate(graph);
  const dropKey = Object.keys(baseline.cableSides).find((k) => k.includes("DROP"));
  expect(dropKey).toBeDefined();
  return {
    ...baseline,
    cableSides: { ...baseline.cableSides, [dropKey!]: "top" },
    stackOrder: {
      left: baseline.stackOrder.left.filter((c) => c !== dropKey),
      right: [...baseline.stackOrder.right],
      top: [dropKey!],
      bottom: [],
    },
  };
}

function expectLayout001Pass(
  graph: ReturnType<typeof buildConnectionGraph>,
  candidate: LayoutCandidate,
): void {
  const topology = analyzeTopology(graph);
  const result = evaluateT1(graph, candidate, topology.constraints);
  const layout001 = result.violations.find((v) => v.id === "SDC-LAYOUT-001");
  expect(layout001?.ok ?? true).toBe(true);
}

describe("quad LAYOUT-001 at T1 proxy", () => {
  it("Left-SP top cable + left stack does not false-fail LAYOUT-001", () => {
    const graph = buildConnectionGraph(
      parseBentleyCsv(readFileSync(join(examples, "Left-SP-3254.5.csv"), "utf8")),
    );
    expectLayout001Pass(graph, leftSpTopCableCandidate(graph));
  });

  it("synthetic top/bottom relief passes LAYOUT-001 at T1", () => {
    const graph = syntheticTopBottomReliefGraph();
    const baseline = heuristicBaselineCandidate(graph);
    expectLayout001Pass(graph, {
      ...baseline,
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
    });
  });
});
