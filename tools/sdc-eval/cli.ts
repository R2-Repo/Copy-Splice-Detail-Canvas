#!/usr/bin/env node
/**
 * Headless import/search/routing/rules CLI for dev sidecar use.
 *   npm run sdc:eval -- parse --file request.json
 *   echo '{"csvPath":"docs/reference/examples/Left-SP-3254.5.csv"}' | npm run sdc:eval -- search
 *   npm run sdc:eval -- evaluate --file eval-request.json
 *   npm run sdc:eval -- rules --file rules-request.json
 */
import "./register-env.ts";

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildSdcRuleContext } from "@/features/rules/buildSdcContext";
import { runRules } from "@/features/rules/runRules";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import type { LayoutCandidate } from "@/features/layoutSearch/layoutCandidate";
import {
  layoutSearch,
  seedFromReportKey,
} from "@/features/layoutSearch/layoutSearch";
import type { SerializableLayoutSearchConfig } from "@/features/layoutSearch/layoutSearchTypes";

import {
  graphSummary,
  graphToJson,
  loadGraphFromInput,
  type GraphJson,
} from "./graphJson";
import {
  ruleRejectCounts,
  serializeEvaluation,
  serializeSearchResult,
  serializeViolations,
} from "./serialize";
import { exportTopCandidates } from "./exportTopCandidates";

type Command = "parse" | "search" | "evaluate" | "rules" | "export-top";

const COMMANDS: Command[] = ["parse", "search", "evaluate", "rules", "export-top"];

function usage(): never {
  console.error(
    `Usage: sdc-eval <command> [--file path]\nCommands: ${COMMANDS.join(", ")}\n` +
      "Reads JSON from --file or stdin; writes JSON to stdout.",
  );
  process.exit(1);
}

function readInput(): unknown {
  const fileIdx = process.argv.indexOf("--file");
  if (fileIdx !== -1) {
    const path = process.argv[fileIdx + 1];
    if (!path) usage();
    return JSON.parse(readFileSync(resolve(path), "utf8"));
  }
  const text = readFileSync(0, "utf8").trim();
  if (!text) usage();
  return JSON.parse(text);
}

function writeOk(payload: unknown): void {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

function writeErr(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function cmdParse(input: {
  graph?: GraphJson;
  csvPath?: string;
  csvText?: string;
  includeGraph?: boolean;
}) {
  const graph = loadGraphFromInput(input);
  const summary = graphSummary(graph);
  writeOk({
    ok: true,
    command: "parse",
    summary,
    graph: input.includeGraph ? graphToJson(graph) : undefined,
  });
}

function cmdSearch(input: {
  graph?: GraphJson;
  csvPath?: string;
  csvText?: string;
  config?: SerializableLayoutSearchConfig;
}) {
  const graph = loadGraphFromInput(input);
  const seed =
    input.config?.seed ?? seedFromReportKey(reportStorageKey(graph));
  const start = performance.now();
  const result = layoutSearch(graph, {
    ...input.config,
    seed,
  });
  writeOk({
    ok: true,
    command: "search",
    summary: graphSummary(graph),
    result: serializeSearchResult(result, performance.now() - start),
  });
}

function cmdEvaluate(input: {
  graph?: GraphJson;
  csvPath?: string;
  csvText?: string;
  candidate: LayoutCandidate;
}) {
  if (!input.candidate) {
    writeErr("evaluate requires candidate");
  }
  const graph = loadGraphFromInput(input);
  const start = performance.now();
  const evaluation = evaluateLayoutCandidate(graph, input.candidate);
  writeOk({
    ok: true,
    command: "evaluate",
    summary: graphSummary(graph),
    wallMs: performance.now() - start,
    evaluation: serializeEvaluation(evaluation),
  });
}

function cmdRules(input: {
  graph?: GraphJson;
  csvPath?: string;
  csvText?: string;
  candidate?: LayoutCandidate;
  skipReactFlow?: boolean;
  layoutWidth?: number;
}) {
  const graph = loadGraphFromInput(input);
  const start = performance.now();

  if (input.candidate) {
    const evaluation = evaluateLayoutCandidate(graph, input.candidate);
    writeOk({
      ok: true,
      command: "rules",
      summary: graphSummary(graph),
      wallMs: performance.now() - start,
      mode: "candidate",
      violations: serializeViolations(evaluation.violations),
      ruleRejectCounts: ruleRejectCounts(evaluation.violations),
      feasible: evaluation.feasible,
      score: evaluation.score,
    });
    return;
  }

  const ctx = buildSdcRuleContext(graph, {
    skipReactFlow: input.skipReactFlow,
    layoutWidth: input.layoutWidth,
  });
  const violations = runRules(ctx);
  writeOk({
    ok: true,
    command: "rules",
    summary: graphSummary(graph),
    wallMs: performance.now() - start,
    mode: input.skipReactFlow ? "skipReactFlow" : "full",
    violations: serializeViolations(violations),
    ruleRejectCounts: ruleRejectCounts(violations),
  });
}

function cmdExportTop(input: {
  graph?: GraphJson;
  csvPath?: string;
  csvText?: string;
  outDir: string;
  top?: number;
  sourceFileName?: string;
  config?: SerializableLayoutSearchConfig;
}) {
  if (!input.outDir) {
    writeErr("export-top requires outDir");
  }
  const result = exportTopCandidates(input);
  writeOk(result);
}

function main(): void {
  const command = process.argv[2] as Command | undefined;
  if (!command || !COMMANDS.includes(command)) {
    usage();
  }

  try {
    const input = readInput() as Record<string, unknown>;
    switch (command) {
      case "parse":
        cmdParse(input as Parameters<typeof cmdParse>[0]);
        break;
      case "search":
        cmdSearch(input as Parameters<typeof cmdSearch>[0]);
        break;
      case "evaluate":
        cmdEvaluate(input as Parameters<typeof cmdEvaluate>[0]);
        break;
      case "rules":
        cmdRules(input as Parameters<typeof cmdRules>[0]);
        break;
      case "export-top":
        cmdExportTop(input as Parameters<typeof cmdExportTop>[0]);
        break;
    }
  } catch (err) {
    writeErr(err instanceof Error ? err.message : String(err));
  }
}

main();
