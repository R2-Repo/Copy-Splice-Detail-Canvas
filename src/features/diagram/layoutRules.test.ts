import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import {
  buildLayoutRuleContext,
  checkAllLayoutRules,
  checkLayoutRule,
  LAYOUT_RULE_IDS,
  LAYOUT_RULES,
  type LayoutRuleId,
} from "./layoutRules";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { TIA_12_COLORS } from "@/features/diagram/colorCode";

const examples = join(process.cwd(), "docs/reference/examples");
const legacyExamples = join(examples, "old csv examples");
const EXAMPLE_NUMBERS = [1, 2, 3] as const;
const STAGE_WIDTH_FIXTURE = 1920;

function graphFromExample(n: (typeof EXAMPLE_NUMBERS)[number]) {
  const csv = readFileSync(
    join(legacyExamples, `CSV Splice Detail Example #${n}.csv`),
    "utf8",
  );
  return buildConnectionGraph(parseBentleyCsv(csv));
}

function productionCsvPath(file: string): string {
  const legacy = join(legacyExamples, file);
  try {
    readFileSync(legacy);
    return legacy;
  } catch {
    return join(examples, file);
  }
}

/** Rules that only apply when the diagram has the relevant structure. */
function ruleApplies(id: LayoutRuleId, exampleNum: number): boolean {
  switch (id) {
    case "FBR-004":
    case "ROW-002":
      return exampleNum === 3;
    case "TUB-004":
      return true;
    default:
      return true;
  }
}

describe("layout rules contract (internal checks → SDC)", () => {
  it("documents every enforced rule ID", () => {
    expect(LAYOUT_RULES.map((r) => r.id).sort()).toEqual(
      [...LAYOUT_RULE_IDS].sort(),
    );
  });

  for (const n of EXAMPLE_NUMBERS) {
    describe(`Example #${n}`, () => {
      const ctx = buildLayoutRuleContext(graphFromExample(n), undefined, undefined, {
        skipFeasibility: true,
      });

      for (const ruleId of LAYOUT_RULE_IDS) {
        if (!ruleApplies(ruleId, n)) continue;

        it(`${ruleId}: ${LAYOUT_RULES.find((r) => r.id === ruleId)!.title}`, () => {
          const result = checkLayoutRule(ruleId, ctx);
          expect(result.ok, result.detail).toBe(true);
        });
      }

      it("passes all applicable rules in one pass", () => {
        const results = checkAllLayoutRules(ctx).filter((r) =>
          ruleApplies(r.id, n),
        );
        const failed = results.filter((r) => !r.ok);
        expect(failed, failed.map((f) => `${f.id}: ${f.detail}`).join("; ")).toEqual(
          [],
        );
      });
    });
  }
});

describe("reference production CSV layout sanity", () => {
  const productionCsvs = [
    { file: "300N_MAIN.csv", cableNodes: 4 },
    { file: "SP-I-15_11400S.csv", cableNodes: 6 },
    { file: "I-215_4700S.csv", cableNodes: 7 },
    { file: "SPI-215_I-80.csv", cableNodes: 7 },
  ] as const;

  for (const { file, cableNodes } of productionCsvs) {
    it(`${file} builds ${cableNodes} cable nodes and passes STR-001`, () => {
      const csv = readFileSync(productionCsvPath(file), "utf8");
      const graph = buildConnectionGraph(parseBentleyCsv(csv));
      const ctx = buildLayoutRuleContext(graph, undefined, undefined, {
        skipFeasibility: true,
      });
      expect(ctx.visualCables.length).toBe(cableNodes);
      const { nodes } = buildReactFlowGraph(
        graph,
        undefined,
        ctx.layoutWidth,
      );
      expect(nodes.filter((n) => n.type === "cable")).toHaveLength(cableNodes);
      const str001 = checkLayoutRule("STR-001", ctx);
      expect(str001.ok, str001.detail).toBe(true);
    });
  }

  it("Left-SPI-215_I-80.csv passes strict EDGE-004, EDGE-011, and EDGE-012", () => {
    const csv = readFileSync(join(examples, "Left-SPI-215_I-80.csv"), "utf8");
    const ctx = buildLayoutRuleContext(
      buildConnectionGraph(parseBentleyCsv(csv)),
      undefined,
      undefined,
      { stageWidth: STAGE_WIDTH_FIXTURE },
    );
    for (const id of ["EDGE-004", "EDGE-011", "EDGE-012"] as const) {
      const result = checkLayoutRule(id, ctx);
      expect(result.ok, result.detail).toBe(true);
    }
    expect(ctx.layoutExpansion.centerGapPadding).toBeGreaterThanOrEqual(0);
  });

  it("SPI-215_I-80.csv passes fiber spacing rules FBR-001 and FBR-002", () => {
    const csv = readFileSync(productionCsvPath("SPI-215_I-80.csv"), "utf8");
    const ctx = buildLayoutRuleContext(buildConnectionGraph(parseBentleyCsv(csv)), undefined, undefined, {
      skipFeasibility: true,
    });
    for (const id of ["FBR-001", "FBR-002"] as const) {
      const result = checkLayoutRule(id, ctx);
      expect(result.ok, result.detail).toBe(true);
    }
  });
});

describe("collapsed full butt splice layout (EDGE-004)", () => {
  it("Example #3 OR tube passes EDGE-004 when collapsed", () => {
    const ctx = buildLayoutRuleContext(graphFromExample(3), undefined, {
      collapseFullButtSplices: true,
    }, { skipFeasibility: true });
    const buttEdges = ctx.reactFlow.edges.filter((e) => e.id.startsWith("butt-"));
    expect(buttEdges.length).toBeGreaterThan(0);
    const result = checkLayoutRule("EDGE-004", ctx);
    expect(result.ok, result.detail).toBe(true);
  });

  it("300N_MAIN collapsed butt tubes pass EDGE-004", () => {
    const csv = readFileSync(productionCsvPath("300N_MAIN.csv"), "utf8");
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const ctx = buildLayoutRuleContext(graph, undefined, {
      collapseFullButtSplices: true,
    }, { skipFeasibility: true });
    const buttEdges = ctx.reactFlow.edges.filter((e) => e.id.startsWith("butt-"));
    expect(buttEdges.length).toBeGreaterThan(0);
    const result = checkLayoutRule("EDGE-004", ctx);
    expect(result.ok, result.detail).toBe(true);
  }, 30_000);

  it("synthetic 12-fiber BL↔OR collapsed tube passes EDGE-004", () => {
    const pairs = TIA_12_COLORS.map((color, index) => ({
      id: `pair-${index}`,
      endpointA: {
        device: "DEV-A",
        cable: "CABLE-A",
        fiberNumber: index + 1,
        tubeColor: "BL" as const,
        fiberColor: color.abbrev,
        csvColumn: "from" as const,
      },
      endpointB: {
        device: "DEV-B",
        cable: "CABLE-B",
        fiberNumber: index + 1,
        tubeColor: "OR" as const,
        fiberColor: color.abbrev,
        csvColumn: "to" as const,
      },
    }));
    const graph = buildConnectionGraph({
      header: {},
      pairs,
      cableAppearances: [
        {
          device: "DEV-A",
          cable: "CABLE-A",
          left: { from: 12, to: 0 },
          right: { from: 0, to: 0 },
        },
        {
          device: "DEV-B",
          cable: "CABLE-B",
          left: { from: 0, to: 0 },
          right: { from: 0, to: 12 },
        },
      ],
    });
    const ctx = buildLayoutRuleContext(graph, undefined, {
      collapseFullButtSplices: true,
    }, { skipFeasibility: true });
    expect(ctx.reactFlow.edges.some((e) => e.id.startsWith("butt-"))).toBe(true);
    const result = checkLayoutRule("EDGE-004", ctx);
    expect(result.ok, result.detail).toBe(true);
  });

  it("Example #3 collapsed passes TUB-008 on butt tube pairs", () => {
    const ctx = buildLayoutRuleContext(graphFromExample(3), undefined, {
      collapseFullButtSplices: true,
    });
    const tub008 = checkLayoutRule("TUB-008", ctx);
    expect(tub008.ok, tub008.detail).toBe(true);
  });
});
