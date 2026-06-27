/**
 * Tests suspended from default fast gates (`test:fast` / `smoke`).
 * Nothing deleted — run via `npm run test:hardening` when explicitly requested.
 * See docs/agent/TESTING.md.
 */

/** Grid feasibility loops + SDC/legacy rule contract oracles. */
export const SLOW_RULE_TEST_FILES = [
  "src/features/rules/sdcLayoutContract.test.ts",
  "src/features/rules/sdcLayoutContractSlow.test.ts",
  "src/features/rules/sdcContract.test.ts",
  "src/features/rules/route002.test.ts",
  "src/features/rules/edge005Reference.test.ts",
  "src/features/grid/gridReferenceContract.test.ts",
  "src/features/grid/gridRouter.test.ts",
  "src/features/diagram/layoutRules.test.ts",
  "src/features/diagram/routingImportContract.test.ts",
  "src/features/diagram/gridReconcileEdge011.test.ts",
  "src/features/diagram/phase7Verification.test.ts",
  "src/features/diagram/importLayoutWidth.test.ts",
  "src/features/diagram/centerRouter.test.ts",
  "src/features/diagram/routingCharacterizationGoldens.test.ts",
  "src/features/diagram/writeGridRoutingGoldens.test.ts",
  "src/features/diagram/layoutDeterminism.test.ts",
  "src/features/diagram/spMisalignRouting.test.ts",
  "src/features/diagram/spHorizontalOverlap.test.ts",
  "src/features/diagram/spFlipMisalignRouting.test.ts",
] as const;

/** Full-graph import/build oracles on example + production CSVs. */
export const SLOW_INTEGRATION_TEST_FILES = [
  "src/features/diagram/buildReactFlowGraph.test.ts",
  "src/features/diagram/buildNodesEngineGraph.test.ts",
  "src/features/diagram/syncNodesEngineDragLayout.test.ts",
  "src/features/diagram/tubeRowShift.test.ts",
  "src/features/diagram/spliceRowLayout.test.ts",
  "src/features/diagram/fullButtSplice.test.ts",
  "src/features/diagram/dominantCablePair.test.ts",
  "src/features/diagram/edgeWiring.test.ts",
  "src/features/diagram/cableSideFlipRouting.test.ts",
  "src/features/diagram/cableBreakoutGeometry.test.ts",
  "src/features/diagram/quad/buildQuadReactFlowGraph.test.ts",
  "src/features/diagram/quad/quadRouter.test.ts",
  "src/features/export/diagramConfig.test.ts",
  "src/features/export/printDiagram.test.ts",
  "src/features/import/importCableCounts.test.ts",
  "src/features/manualAdjust/checkpointRepro.test.ts",
  "src/features/canvas/edges/spliceEdgeRouting.test.ts",
] as const;

export const SUSPENDED_FROM_FAST_GATE = [
  ...SLOW_RULE_TEST_FILES,
  ...SLOW_INTEGRATION_TEST_FILES,
] as const;
