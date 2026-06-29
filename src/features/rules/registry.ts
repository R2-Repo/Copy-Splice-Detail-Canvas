import { sdcCore001 } from "./core001";
import { sdcData001 } from "./data001";
import { sdcData002 } from "./data002";
import { sdcGrid001 } from "./grid001";
import { sdcLayout001 } from "./layout001";
import { sdcLayout002 } from "./layout002";
import { sdcLayout003 } from "./layout003";
import { sdcOrder001 } from "./order001";
import { sdcOrder002 } from "./order002";
import { sdcRoute001 } from "./route001";
import { sdcRoute002 } from "./route002";
import { sdcRoute003 } from "./route003";
import { sdcRoute004 } from "./route004";
import { sdcScore001 } from "./score001";
import { sdcUx001 } from "./ux001";
import type { SdcRule, SdcRuleId } from "./types";

/** Processing order per splice_detail_canvas_rule_pack/00_Rule_Index.md */
export const SDC_RULES: SdcRule[] = [
  sdcCore001,
  sdcData001,
  sdcData002,
  sdcOrder001,
  sdcOrder002,
  sdcLayout002,
  sdcLayout003,
  sdcLayout001,
  sdcRoute001,
  sdcGrid001,
  sdcUx001,
  sdcRoute002,
  sdcRoute003,
  sdcRoute004,
  sdcScore001,
];

export const SDC_RULE_BY_ID: Map<SdcRuleId, SdcRule> = new Map(
  SDC_RULES.map((r) => [r.id, r]),
);

export function rulesInOrder(only?: SdcRuleId[]): SdcRule[] {
  if (!only?.length) return SDC_RULES;
  const set = new Set(only);
  return SDC_RULES.filter((r) => set.has(r.id));
}

function contextReady(
  rule: SdcRule,
  ctx: import("./types").SdcRuleContext,
): boolean {
  if (!rule.requires?.length) return true;
  for (const req of rule.requires) {
    if (req === "graph" && !ctx.graph) return false;
    if (req === "visualCables" && !ctx.visualCables?.length) return false;
    if (req === "grid" && !ctx.grid) return false;
    if (req === "reactFlow" && !ctx.reactFlow) return false;
  }
  return true;
}

export function canRunRule(
  rule: SdcRule,
  ctx: import("./types").SdcRuleContext,
): boolean {
  return contextReady(rule, ctx);
}
