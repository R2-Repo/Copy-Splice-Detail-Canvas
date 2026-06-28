import type { Edge, Node } from "@xyflow/react";

import type { SpliceRoutingLane } from "@/features/diagram/centerRouter";
import type { GridMap, GridRoute } from "@/features/grid/gridTypes";
import type { ConnectionGraph, DiagramLocks, LayoutOverrides, SpliceReport } from "@/types/splice";
import type { VisualCable } from "@/features/diagram/visualCables";

export type RuleSeverity = "fail" | "warn" | "info";

export const SDC_RULE_IDS = [
  "SDC-CORE-001",
  "SDC-DATA-001",
  "SDC-DATA-002",
  "SDC-ORDER-001",
  "SDC-ORDER-002",
  "SDC-LAYOUT-001",
  "SDC-LAYOUT-002",
  "SDC-GRID-001",
  "SDC-ROUTE-001",
  "SDC-ROUTE-002",
  "SDC-ROUTE-003",
  "SDC-SCORE-001",
  "SDC-UX-001",
] as const;

export type SdcRuleId = (typeof SDC_RULE_IDS)[number];

export type RuleResult = {
  id: SdcRuleId;
  severity: RuleSeverity;
  ok: boolean;
  detail: string;
  objectIds?: string[];
};

export type SdcRuleContext = {
  report: SpliceReport;
  graph: ConnectionGraph;
  visualCables?: VisualCable[];
  grid?: GridMap;
  gridRoutes?: Map<string, GridRoute>;
  /** Snapped center lanes from grid router — keyed by connection id. */
  gridLanes?: Map<string, SpliceRoutingLane>;
  /** Pre-snap packed lanes for SDC-ROUTE-002 topology (EDGE-005/010). */
  gridPackedLanes?: Map<string, SpliceRoutingLane>;
  locks?: DiagramLocks;
  overrides?: LayoutOverrides;
  reactFlow?: { nodes: Node[]; edges: Edge[] };
  layoutWidth?: number;
};

/** When a rule may run during staged import evaluation. */
export type RuleRunMode =
  | "import-data"
  | "candidate-screen"
  | "proxy-route"
  | "final-layout";

export type SdcRule = {
  id: SdcRuleId;
  title: string;
  dependencies?: SdcRuleId[];
  /** Rules that must pass before this rule is meaningful. */
  requires?: Array<"graph" | "visualCables" | "grid" | "reactFlow">;
  /** Staged tiers; default `["final-layout"]` — full rule pass only. */
  tiers?: RuleRunMode[];
  check: (ctx: SdcRuleContext) => RuleResult[];
};

export type RunRulesOptions = {
  only?: SdcRuleId[];
  stopOnFail?: boolean;
};
