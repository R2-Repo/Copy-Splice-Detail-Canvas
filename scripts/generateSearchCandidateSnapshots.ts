/**
 * One-off script: run layoutSearch on reference fixtures and write snapshot JSON.
 * Usage: npx tsx scripts/generateSearchCandidateSnapshots.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { layoutSearch, seedFromReportKey } from "@/features/layoutSearch/layoutSearch";
import {
  LAYOUT_CONTRACT_CSVS,
  readReferenceCsv,
} from "@/testHelpers/layoutContractCsvPaths";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

const OUT_DIR = join(process.cwd(), "src/testHelpers/fixtures/searchCandidates");

const FIXTURES: Array<{
  label: string;
  load: () => string;
  maxRounds: number;
  timeBudgetMs?: number;
}> = [
  {
    label: "example-1",
    load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.ringCut),
    maxRounds: 2000,
  },
  {
    label: "example-2",
    load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.dominantPair),
    maxRounds: 2000,
    timeBudgetMs: 120_000,
  },
  {
    label: "example-3",
    load: () => readReferenceCsv(LAYOUT_CONTRACT_CSVS.multiCable),
    maxRounds: 2000,
    timeBudgetMs: 180_000,
  },
  {
    label: "left-sp-3254.5",
    load: () => readLeftCsv("Left-SP-3254.5.csv"),
    maxRounds: 2000,
    timeBudgetMs: 180_000,
  },
  {
    label: "left-spi-215_i-80",
    load: () => readLeftCsv("Left-SPI-215_I-80.csv"),
    maxRounds: 500,
    timeBudgetMs: 180_000,
  },
];

mkdirSync(OUT_DIR, { recursive: true });

for (const fixture of FIXTURES) {
  console.log(`Searching ${fixture.label}…`);
  const graph = buildConnectionGraph(parseBentleyCsv(fixture.load()));
  const seed = seedFromReportKey(reportStorageKey(graph));
  const result = layoutSearch(graph, {
    seed,
    maxRounds: fixture.maxRounds,
    plateauRounds: 128,
    timeBudgetMs: fixture.timeBudgetMs,
  });
  const snapshot = {
    cableSides: result.best.cableSides,
    stackOrder: result.best.stackOrder,
    layoutWidth: result.best.layoutWidth,
    layoutExpansion: result.best.layoutExpansion,
    id: result.best.id ?? `search-${fixture.label}`,
  };
  const outPath = join(OUT_DIR, `${fixture.label}.json`);
  writeFileSync(outPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  console.log(
    `  → ${outPath} feasible=${result.bestScore < Number.MAX_SAFE_INTEGER} score=${result.bestScore}`,
  );
}

console.log("Done.");
