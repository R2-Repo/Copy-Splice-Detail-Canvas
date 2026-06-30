import { createHash } from "node:crypto";

import { connectionRowIndexMap } from "@/features/diagram/connectionRowOrder";
import { reportStorageKey } from "@/features/diagram/layoutSpliceDiagram";
import {
  buildVisualCablesForLayout,
  type VisualCable,
} from "@/features/diagram/visualCables";
import { evaluateLayoutCandidate } from "@/features/layoutSearch/evaluateCandidate";
import type { LayoutCandidate } from "@/features/layoutSearch/layoutCandidate";
import {
  INFEASIBLE_LAYOUT_SCORE,
  layoutSearch,
  seedFromReportKey,
  widthStepsForGraph,
} from "@/features/layoutSearch/layoutSearch";
import type { SerializableLayoutSearchConfig } from "@/features/layoutSearch/layoutSearchTypes";
import {
  evaluateCandidateTiered,
  type EvalTier,
} from "@/features/layoutSearch/tieredEvaluate";
import { analyzeTopology } from "@/features/layoutSearch/topology/analyzeTopology";
import type { TopologyAnalysis } from "@/features/layoutSearch/topology/topologyTypes";
import { buildSdcRuleContext } from "@/features/rules/buildSdcContext";
import { runRules } from "@/features/rules/runRules";
import type { ConnectionGraph } from "@/types/splice";

import { exportTopCandidates } from "./exportTopCandidates";
import {
  graphFromJson,
  graphSummary,
  graphToJson,
  loadGraphFromInput,
  type GraphJson,
} from "./graphJson";
import {
  ruleRejectCounts,
  serializeCandidate,
  serializeEvaluateBatchResult,
  serializeEvaluation,
  serializeSearchResult,
  serializeTieredResult,
  serializeTopologyAnalysis,
  serializeViolations,
} from "./serialize";

export type GraphInput = {
  graph?: GraphJson;
  csvPath?: string;
  csvText?: string;
  sessionKey?: string;
};

export type GraphSession = {
  sessionKey: string;
  graph: ConnectionGraph;
  summary: ReturnType<typeof graphSummary>;
  evalCache: {
    visualCables: VisualCable[];
    rowIndex: Map<string, number>;
  };
  topology: TopologyAnalysis;
  layoutWidths: number[];
};

export type SessionStore = Map<string, GraphSession>;

function hashGraphInput(input: GraphInput): string {
  if (input.sessionKey) return input.sessionKey;
  if (input.csvPath) return `csv:${input.csvPath}`;
  if (input.csvText) {
    return `text:${createHash("sha256").update(input.csvText).digest("hex").slice(0, 16)}`;
  }
  if (input.graph) {
    return `graph:${createHash("sha256").update(JSON.stringify(input.graph)).digest("hex").slice(0, 16)}`;
  }
  throw new Error("Provide graph, csvPath, csvText, or sessionKey");
}

export function getOrCreateSession(
  store: SessionStore,
  input: GraphInput,
): GraphSession {
  const key = hashGraphInput(input);
  const existing = store.get(key);
  if (existing) return existing;

  const graph = loadGraphFromInput(input);
  const { visualCables } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables);
  const topology = analyzeTopology(graph);
  const session: GraphSession = {
    sessionKey: key,
    graph,
    summary: graphSummary(graph),
    evalCache: { visualCables, rowIndex },
    topology,
    layoutWidths: widthStepsForGraph(graph),
  };
  store.set(key, session);
  return session;
}

export function handlePing() {
  return {
    ok: true,
    command: "ping",
    pid: process.pid,
    uptimeMs: Math.round(process.uptime() * 1000),
  };
}

export function handleParse(
  input: GraphInput & { includeGraph?: boolean },
  store: SessionStore,
) {
  const session = getOrCreateSession(store, input);
  return {
    ok: true,
    command: "parse",
    sessionKey: session.sessionKey,
    summary: session.summary,
    graph: input.includeGraph ? graphToJson(session.graph) : undefined,
  };
}

export function handleAnalyzeTopology(input: GraphInput, store: SessionStore) {
  const session = getOrCreateSession(store, input);
  return {
    ok: true,
    command: "analyze-topology",
    sessionKey: session.sessionKey,
    summary: session.summary,
    analysis: serializeTopologyAnalysis(session.topology),
    layoutWidths: session.layoutWidths,
  };
}

export function handleSearch(
  input: GraphInput & { config?: SerializableLayoutSearchConfig },
  store: SessionStore,
) {
  const session = getOrCreateSession(store, input);
  const seed =
    input.config?.seed ?? seedFromReportKey(reportStorageKey(session.graph));
  const start = performance.now();
  const result = layoutSearch(session.graph, {
    ...input.config,
    seed,
  });
  return {
    ok: true,
    command: "search",
    sessionKey: session.sessionKey,
    summary: session.summary,
    result: serializeSearchResult(result, performance.now() - start),
  };
}

export function handleEvaluate(
  input: GraphInput & { candidate: LayoutCandidate },
  store: SessionStore,
) {
  if (!input.candidate) {
    throw new Error("evaluate requires candidate");
  }
  const session = getOrCreateSession(store, input);
  const start = performance.now();
  const evaluation = evaluateLayoutCandidate(session.graph, input.candidate);
  return {
    ok: true,
    command: "evaluate",
    sessionKey: session.sessionKey,
    summary: session.summary,
    wallMs: performance.now() - start,
    evaluation: serializeEvaluation(evaluation),
  };
}

export function handleEvaluateTier(
  input: GraphInput & {
    candidate: LayoutCandidate;
    maxTier?: EvalTier;
    bestScore?: number;
  },
  store: SessionStore,
) {
  if (!input.candidate) {
    throw new Error("evaluate-tier requires candidate");
  }
  const session = getOrCreateSession(store, input);
  const start = performance.now();
  const maxTier = input.maxTier ?? "T2";
  const bestScore = input.bestScore ?? INFEASIBLE_LAYOUT_SCORE;
  const tiered = evaluateCandidateTiered(
    session.graph,
    input.candidate,
    {
      constraints: session.topology.constraints,
      bestScore,
      tieredEvalEnabled: true,
      maxTier,
    },
    session.evalCache,
  );
  return {
    ok: true,
    command: "evaluate-tier",
    sessionKey: session.sessionKey,
    summary: session.summary,
    wallMs: performance.now() - start,
    result: serializeTieredResult(tiered),
  };
}

export function handleEvaluateBatch(
  input: GraphInput & {
    candidates: LayoutCandidate[];
    maxTier?: EvalTier;
    bestScore?: number;
  },
  store: SessionStore,
) {
  if (!input.candidates?.length) {
    throw new Error("evaluate-batch requires candidates");
  }
  const session = getOrCreateSession(store, input);
  const start = performance.now();
  const maxTier = input.maxTier ?? "T2";
  let bestScore = input.bestScore ?? INFEASIBLE_LAYOUT_SCORE;
  const results = input.candidates.map((candidate) => {
    const itemStart = performance.now();
    const tiered = evaluateCandidateTiered(
      session.graph,
      candidate,
      {
        constraints: session.topology.constraints,
        bestScore,
        tieredEvalEnabled: true,
        maxTier,
      },
      session.evalCache,
    );
    if (tiered.feasible && tiered.score < bestScore) {
      bestScore = tiered.score;
    }
    return {
      candidateId: candidate.id ?? "",
      wallMs: performance.now() - itemStart,
      result: serializeTieredResult(tiered),
    };
  });
  return {
    ok: true,
    command: "evaluate-batch",
    sessionKey: session.sessionKey,
    summary: session.summary,
    ...serializeEvaluateBatchResult(results, performance.now() - start),
  };
}

export function handleRules(
  input: GraphInput & {
    candidate?: LayoutCandidate;
    skipReactFlow?: boolean;
    layoutWidth?: number;
  },
  store: SessionStore,
) {
  const session = getOrCreateSession(store, input);
  const start = performance.now();

  if (input.candidate) {
    const evaluation = evaluateLayoutCandidate(session.graph, input.candidate);
    return {
      ok: true,
      command: "rules",
      sessionKey: session.sessionKey,
      summary: session.summary,
      wallMs: performance.now() - start,
      mode: "candidate" as const,
      violations: serializeViolations(evaluation.violations),
      ruleRejectCounts: ruleRejectCounts(evaluation.violations),
      feasible: evaluation.feasible,
      score: evaluation.score,
    };
  }

  const ctx = buildSdcRuleContext(session.graph, {
    skipReactFlow: input.skipReactFlow,
    layoutWidth: input.layoutWidth,
  });
  const violations = runRules(ctx);
  return {
    ok: true,
    command: "rules",
    sessionKey: session.sessionKey,
    summary: session.summary,
    wallMs: performance.now() - start,
    mode: input.skipReactFlow ? ("skipReactFlow" as const) : ("full" as const),
    violations: serializeViolations(violations),
    ruleRejectCounts: ruleRejectCounts(violations),
  };
}

export function handleExportTop(
  input: GraphInput & {
    outDir: string;
    top?: number;
    sourceFileName?: string;
    config?: SerializableLayoutSearchConfig;
  },
  _store: SessionStore,
) {
  if (!input.outDir) {
    throw new Error("export-top requires outDir");
  }
  return exportTopCandidates(input);
}

export type DaemonCommand =
  | "ping"
  | "shutdown"
  | "parse"
  | "analyze-topology"
  | "search"
  | "evaluate"
  | "evaluate-tier"
  | "evaluate-batch"
  | "rules"
  | "export-top";

export function dispatchCommand(
  command: DaemonCommand,
  payload: Record<string, unknown>,
  store: SessionStore,
): Record<string, unknown> {
  switch (command) {
    case "ping":
      return handlePing();
    case "parse":
      return handleParse(payload as Parameters<typeof handleParse>[0], store);
    case "analyze-topology":
      return handleAnalyzeTopology(
        payload as Parameters<typeof handleAnalyzeTopology>[0],
        store,
      );
    case "search":
      return handleSearch(payload as Parameters<typeof handleSearch>[0], store);
    case "evaluate":
      return handleEvaluate(
        payload as Parameters<typeof handleEvaluate>[0],
        store,
      );
    case "evaluate-tier":
      return handleEvaluateTier(
        payload as Parameters<typeof handleEvaluateTier>[0],
        store,
      );
    case "evaluate-batch":
      return handleEvaluateBatch(
        payload as Parameters<typeof handleEvaluateBatch>[0],
        store,
      );
    case "rules":
      return handleRules(payload as Parameters<typeof handleRules>[0], store);
    case "export-top":
      return handleExportTop(
        payload as Parameters<typeof handleExportTop>[0],
        store,
      );
    case "shutdown":
      return { ok: true, command: "shutdown" };
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

/** Rehydrate graph from session key only (for cached sessions). */
export function sessionFromKey(
  store: SessionStore,
  sessionKey: string,
): GraphSession | undefined {
  return store.get(sessionKey);
}

export function graphInputFromSession(session: GraphSession): GraphInput {
  return { sessionKey: session.sessionKey };
}

export { graphFromJson, graphToJson };
