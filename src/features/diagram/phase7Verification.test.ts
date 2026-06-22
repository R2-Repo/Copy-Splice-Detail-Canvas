import { describe, expect, it } from "vitest";

import { boundsFromFlowNodes } from "@/features/canvas/diagramViewport";
import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { DEV_FIXTURE_IDS } from "@/features/import/devFixtureMeta";
import { resolveDevFixture } from "@/features/import/devFixturesNode";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { printViewportForBounds } from "@/features/export/printDiagram";
import { allRulesPass, buildSdcRuleContext, runImportRules } from "@/features/rules";
import { LEFT_REFERENCE_CSVS, readLeftCsv } from "@/testHelpers/leftCsvPaths";
import { LAYOUT_CONTRACT_CSVS, readReferenceCsv } from "@/testHelpers/layoutContractCsvPaths";

function assertImportAndBuild(text: string, label: string) {
  const report = parseBentleyCsv(text);
  const graph = buildConnectionGraph(report);
  const importResults = runImportRules(
    buildSdcRuleContext(graph, { skipReactFlow: true }),
  );
  expect(allRulesPass(importResults), `${label} import rules`).toBe(true);

  const built = buildReactFlowGraph(graph, {
    reportKey: `phase7-${label}`,
    positions: {},
  });
  expect(built.nodes.length).toBeGreaterThan(0);
  expect(built.edges.some((e) => e.type === "splice")).toBe(true);

  const cableNodes = built.nodes.filter((n) => n.type === "cable");
  const bounds = boundsFromFlowNodes(cableNodes);
  expect(bounds).not.toBeNull();
  if (!bounds) return built;

  const viewport = printViewportForBounds(bounds);
  expect(Number.isFinite(viewport.x)).toBe(true);
  expect(Number.isFinite(viewport.y)).toBe(true);
  expect(viewport.zoom).toBeGreaterThan(0);

  return built;
}

describe("Phase 7 verification gate", () => {
  describe("layout contract Examples #1–#3", () => {
    it("Example #1 (ring cut) imports, builds, and print-fits", () => {
      assertImportAndBuild(
        readReferenceCsv(LAYOUT_CONTRACT_CSVS.ringCut),
        "example-1",
      );
    });

    it("Example #2 (dominant pair) imports, builds, and print-fits", () => {
      assertImportAndBuild(
        readReferenceCsv(LAYOUT_CONTRACT_CSVS.dominantPair),
        "example-2",
      );
    });

    it("Example #3 (multi-cable) imports, builds, and print-fits", () => {
      assertImportAndBuild(
        readReferenceCsv(LAYOUT_CONTRACT_CSVS.multiCable),
        "example-3",
      );
    });
  });

  describe("D4 left-reference CSVs", () => {
    for (const file of LEFT_REFERENCE_CSVS) {
      it(`${file} imports, builds, and print-fits`, () => {
        assertImportAndBuild(readLeftCsv(file), file);
      });
    }
  });

  describe("dev fixture bundles (?fixture=)", () => {
    for (const id of DEV_FIXTURE_IDS) {
      it(`${id} resolves to importable CSV text`, () => {
        const fixture = resolveDevFixture(id);
        expect(fixture?.id).toBe(id);
        expect(fixture?.text.length).toBeGreaterThan(100);
        assertImportAndBuild(fixture!.text, id);
      });
    }
  });
});
