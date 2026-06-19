import type { RuleResult, SdcRuleId } from "./types";

export function pass(id: SdcRuleId, detail = "ok"): RuleResult {
  return { id, severity: "info", ok: true, detail };
}

export function fail(
  id: SdcRuleId,
  detail: string,
  objectIds?: string[],
): RuleResult {
  return { id, severity: "fail", ok: false, detail, objectIds };
}

export function warn(
  id: SdcRuleId,
  detail: string,
  objectIds?: string[],
): RuleResult {
  return { id, severity: "warn", ok: true, detail, objectIds };
}
