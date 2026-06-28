import type { RunRulesOptions, RuleResult, RuleRunMode, SdcRuleContext } from "./types";
import { SDC_RULES, rulesInOrder } from "./registry";

export function runRules(
  ctx: SdcRuleContext,
  options?: RunRulesOptions,
): RuleResult[] {
  const rules = rulesInOrder(options?.only);
  const results: RuleResult[] = [];

  for (const rule of rules) {
    if (rule.requires?.length) {
      const ready = rule.requires.every((req) => {
        if (req === "graph") return !!ctx.graph;
        if (req === "visualCables") return !!ctx.visualCables?.length;
        if (req === "grid") return !!ctx.grid;
        if (req === "reactFlow") return !!ctx.reactFlow;
        return true;
      });
      if (!ready) continue;
    }

    const ruleResults = rule.check(ctx);
    results.push(...ruleResults);

    if (options?.stopOnFail && ruleResults.some((r) => !r.ok && r.severity === "fail")) {
      break;
    }
  }

  return results;
}

function rulesForTier(tier: RuleRunMode) {
  return SDC_RULES.filter((rule) => {
    const tiers = rule.tiers ?? ["final-layout"];
    return tiers.includes(tier);
  });
}

/** Staged rule screening — `final-layout` runs the full registry. */
export function runRulesForTier(
  ctx: SdcRuleContext,
  tier: RuleRunMode,
  options?: RunRulesOptions,
): RuleResult[] {
  if (tier === "final-layout") {
    return runRules(ctx, options);
  }

  const results: RuleResult[] = [];
  for (const rule of rulesForTier(tier)) {
    if (rule.requires?.length) {
      const ready = rule.requires.every((req) => {
        if (req === "graph") return !!ctx.graph;
        if (req === "visualCables") return !!ctx.visualCables?.length;
        if (req === "grid") return !!ctx.grid;
        if (req === "reactFlow") return !!ctx.reactFlow;
        return true;
      });
      if (!ready) continue;
    }

    const ruleResults = rule.check(ctx);
    results.push(...ruleResults);

    if (options?.stopOnFail && ruleResults.some((r) => !r.ok && r.severity === "fail")) {
      break;
    }
  }

  return results;
}

/** DATA + ORDER rules only — safe to run immediately after CSV parse. */
export function runImportRules(ctx: SdcRuleContext): RuleResult[] {
  return runRules(ctx, {
    only: [
      "SDC-CORE-001",
      "SDC-DATA-001",
      "SDC-DATA-002",
      "SDC-ORDER-001",
      "SDC-ORDER-002",
    ],
  });
}

export function allRulesPass(results: RuleResult[]): boolean {
  return !results.some((r) => !r.ok && r.severity === "fail");
}

export function failedRules(results: RuleResult[]): RuleResult[] {
  return results.filter((r) => !r.ok && r.severity === "fail");
}
