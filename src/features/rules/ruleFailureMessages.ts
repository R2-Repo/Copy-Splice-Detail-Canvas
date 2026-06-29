import type { SdcCheckId } from "@/features/rules/sdcCheckIds";
import {
  parseSdcCheckId,
  SDC_CHECK_PHRASES,
  sdcParentRuleId,
} from "@/features/rules/sdcCheckIds";
import type { SdcRuleId } from "./types";

export function sdcIdsForLayoutCheck(checkId: SdcCheckId): SdcRuleId[] {
  const parent = sdcParentRuleId(checkId);
  const extra: SdcRuleId[] = [];
  if (checkId === "SDC-ORDER-002-B") {
    extra.push("SDC-LAYOUT-001", "SDC-GRID-001");
  }
  if (checkId === "SDC-LAYOUT-001-E") {
    extra.push("SDC-GRID-001");
  }
  if (checkId === "SDC-UX-001-A") {
    extra.push("SDC-LAYOUT-001");
  }
  return [parent, ...extra.filter((id) => id !== parent)];
}

export { SDC_CHECK_PHRASES as SDC_FAILURE_PHRASES };

/** Map a check failure string to SDC parent rule ID + plain phrase. */
export function formatSdcFailureMessage(
  sdcId: SdcRuleId,
  checkFailure: string,
): string {
  const checkId = parseSdcCheckId(checkFailure);
  if (checkId) {
    const phrase =
      SDC_CHECK_PHRASES[checkId] ??
      checkFailure.replace(/^[^:]+:\s*/, "").trim();
    return `${sdcId}: ${phrase}`;
  }
  return `${sdcId}: ${checkFailure}`;
}
