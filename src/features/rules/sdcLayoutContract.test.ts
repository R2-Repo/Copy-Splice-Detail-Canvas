import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type { SplicePair } from "@/types/splice";
import {
  allRulesPass,
  runImportRules,
  SDC_RULE_IDS,
  SDC_RULES,
} from "@/features/rules";
import { buildSdcRuleContext } from "@/features/rules/buildSdcContext";
import {
  compareCandidates,
  defaultLayoutWidth,
  heuristicBaselineCandidate,
} from "@/features/layoutSearch/layoutCandidate";
import { DEFAULT_LAYOUT_EXPANSION } from "@/features/diagram/layoutExpansion";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import { layoutSearch, seedFromReportKey } from "@/features/layoutSearch/layoutSearch";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import {
  LAYOUT_CONTRACT_CSVS,
  readReferenceCsv,
} from "@/testHelpers/layoutContractCsvPaths";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";
import {
  shouldSkipGridRulesForFixture,
  skipReasonForFixture,
} from "@/testHelpers/knownLayoutIssues";
import { evaluateSearchLayoutForFixture } from "@/testHelpers/searchLayoutContext";

const legacyExamples = join(process.cwd(), "docs/reference/examples/old csv examples");

function graphFromCsv(text: string) {
  return buildConnectionGraph(parseBentleyCsv(text));
}

describe("SDC layout contract (search-produced layouts)", () => {
  it("documents every active SDC rule ID", () => {
    expect(SDC_RULES.map((r) => r.id).sort()).toEqual([...SDC_RULE_IDS].sort());
  });

  describe("SDC-SCORE-001 (Tier 2)", () => {
    it("search winner beats heuristic baseline on 3-cable synthetic fixture", () => {
      const pairs: SplicePair[] = [
        {
          id: "pair-ac",
          endpointA: {
            device: "DEV-L",
            cable: "CABLE-A",
            fiberNumber: 1,
            tubeColor: "BL",
            fiberColor: "BL",
            csvColumn: "from",
          },
          endpointB: {
            device: "DEV-R",
            cable: "CABLE-C",
            fiberNumber: 2,
            tubeColor: "BL",
            fiberColor: "OR",
            csvColumn: "to",
          },
        },
        {
          id: "pair-bc",
          endpointA: {
            device: "DEV-L",
            cable: "CABLE-B",
            fiberNumber: 1,
            tubeColor: "BL",
            fiberColor: "BL",
            csvColumn: "from",
          },
          endpointB: {
            device: "DEV-R",
            cable: "CABLE-C",
            fiberNumber: 1,
            tubeColor: "BL",
            fiberColor: "BL",
            csvColumn: "to",
          },
        },
        {
          id: "pair-ab",
          endpointA: {
            device: "DEV-L",
            cable: "CABLE-A",
            fiberNumber: 2,
            tubeColor: "BL",
            fiberColor: "OR",
            csvColumn: "from",
          },
          endpointB: {
            device: "DEV-L",
            cable: "CABLE-B",
            fiberNumber: 2,
            tubeColor: "BL",
            fiberColor: "OR",
            csvColumn: "from",
          },
        },
      ];
      const graph = buildConnectionGraph({
        header: { spliceNumber: "SYN-3C" },
        pairs,
        cableAppearances: [
          {
            device: "DEV-L",
            cable: "CABLE-A",
            left: { from: 2, to: 0 },
            right: { from: 0, to: 0 },
          },
          {
            device: "DEV-L",
            cable: "CABLE-B",
            left: { from: 2, to: 0 },
            right: { from: 0, to: 0 },
          },
          {
            device: "DEV-R",
            cable: "CABLE-C",
            left: { from: 0, to: 2 },
            right: { from: 2, to: 0 },
          },
        ],
      });

      const seed = seedFromReportKey(reportStorageKey(graph));
      const baselineEval = evaluateLayoutCandidate(
        graph,
        heuristicBaselineCandidate(graph),
      );
      const searchResult = layoutSearch(graph, { seed, maxRounds: 0 });

      expect(baselineEval.feasible).toBe(true);
      expect(searchResult.bestScore).toBeLessThanOrEqual(baselineEval.score);
      expect(
        compareCandidates(
          { score: searchResult.bestScore, candidate: searchResult.best },
          { score: baselineEval.score, candidate: heuristicBaselineCandidate(graph) },
        ),
      ).toBeLessThanOrEqual(0);
    });

    it("compareCandidates tie-break prefers fewer sides then lexicographic id", () => {
      const shared = {
        layoutWidth: defaultLayoutWidth(),
        layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
      };
      const twoSide = {
        ...shared,
        stackOrder: { left: ["A"], right: ["B"], top: [], bottom: [] },
        cableSides: { A: "left" as const, B: "right" as const },
        id: "aaa-two-sides",
      };
      const fourSide = {
        ...shared,
        stackOrder: {
          left: ["A"],
          right: ["B"],
          top: ["C"],
          bottom: [],
        },
        cableSides: {
          A: "left" as const,
          B: "right" as const,
          C: "top" as const,
        },
        id: "bbb-four-sides",
      };
      const score = 100;
      expect(
        compareCandidates(
          { score, candidate: twoSide },
          { score, candidate: fourSide },
        ),
      ).toBeLessThan(0);
      expect(
        compareCandidates(
          { score, candidate: { ...twoSide, id: "aaa" } },
          { score, candidate: { ...twoSide, id: "bbb" } },
        ),
      ).toBeLessThan(0);
    });
  });

  const fixtures: Array<{
    label: string;
    load: () => string;
    importOnly?: boolean;
    searchOptions?: { maxRounds?: number; plateauRounds?: number; timeBudgetMs?: number };
  }> = [
    {
      label: "example-1",
      load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.ringCut),
      searchOptions: { maxRounds: 500 },
    },
    {
      label: "example-2",
      load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.dominantPair),
      searchOptions: { maxRounds: 500, plateauRounds: 64 },
    },
    {
      label: "example-3",
      load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.multiCable),
      searchOptions: { maxRounds: 500, plateauRounds: 64 },
    },
    {
      label: "left-sp-3254.5",
      load: () => readLeftCsv("Left-SP-3254.5.csv"),
      searchOptions: { maxRounds: 500, plateauRounds: 64, timeBudgetMs: 120_000 },
    },
    {
      label: "300n_main",
      load: () =>
        readFileSync(join(legacyExamples, "300N_MAIN.csv"), "utf8"),
      importOnly: true,
    },
  ];

  for (const fixture of fixtures) {
    describe(fixture.label, () => {
      it("passes import rules (DATA + ORDER)", () => {
        const ctx = buildSdcRuleContext(graphFromCsv(fixture.load()), {
          skipReactFlow: true,
        });
        const failed = runImportRules(ctx).filter((r) => !r.ok);
        expect(
          failed,
          failed.map((f) => `${f.id}: ${f.detail}`).join("; "),
        ).toEqual([]);
      });

      if (!fixture.importOnly) {
        const skipGrid = shouldSkipGridRulesForFixture(fixture.label);
        const gridTest = skipGrid ? it.skip : it;
        gridTest(
          `passes all applicable SDC rules on search-produced layout${skipGrid ? ` (${skipReasonForFixture(fixture.label)})` : ""}`,
          () => {
            const graph = graphFromCsv(fixture.load());
            const { evaluation } = evaluateSearchLayoutForFixture(
              graph,
              fixture.label,
              fixture.searchOptions,
            );
            const failed = evaluation.violations.filter(
              (r) => !r.ok && r.severity === "fail",
            );
            expect(
              failed,
              failed.map((f) => `${f.id}: ${f.detail}`).join("; "),
            ).toEqual([]);
            expect(evaluation.feasible).toBe(true);
            expect(allRulesPass(evaluation.violations)).toBe(true);

            const scoreRule = evaluation.violations.find(
              (r) => r.id === "SDC-SCORE-001",
            );
            expect(scoreRule?.ok).toBe(true);
            expect(scoreRule?.detail).toMatch(/^soft=/);
            expect(evaluation.score).toBeLessThan(Number.MAX_SAFE_INTEGER);
          },
        );
      }
    });
  }
});
