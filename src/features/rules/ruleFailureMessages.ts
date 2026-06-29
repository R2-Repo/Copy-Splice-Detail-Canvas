import type { LayoutRuleId } from "@/features/diagram/layoutRules";
import type { SdcRuleId } from "./types";

/** Internal layout check ID → public SDC rule ID(s). Private until validators move into SDC modules. */
const CHECK_TO_SDC: Partial<Record<LayoutRuleId, SdcRuleId[]>> = {
  "FBR-001": ["SDC-ORDER-002"],
  "FBR-002": ["SDC-ORDER-002", "SDC-LAYOUT-001", "SDC-GRID-001"],
  "FBR-003": ["SDC-ORDER-002"],
  "FBR-004": ["SDC-LAYOUT-001"],
  "TUB-001": ["SDC-LAYOUT-002"],
  "TUB-002": ["SDC-LAYOUT-002"],
  "TUB-003": ["SDC-LAYOUT-002"],
  "TUB-004": ["SDC-LAYOUT-002"],
  "TUB-005": ["SDC-LAYOUT-002"],
  "TUB-006": ["SDC-ORDER-001"],
  "TUB-007": ["SDC-LAYOUT-002"],
  "TUB-008": ["SDC-LAYOUT-002"],
  "CBL-001": ["SDC-LAYOUT-001"],
  "CBL-002": ["SDC-LAYOUT-001"],
  "CBL-003": ["SDC-LAYOUT-001"],
  "CBL-004": ["SDC-LAYOUT-001"],
  "CBL-005": ["SDC-DATA-001"],
  "ROW-001": ["SDC-LAYOUT-001", "SDC-GRID-001"],
  "ROW-002": ["SDC-LAYOUT-001"],
  "ROW-003": ["SDC-LAYOUT-001"],
  "DOM-001": ["SDC-LAYOUT-001"],
  "DOM-002": ["SDC-LAYOUT-001"],
  "DOM-003": ["SDC-LAYOUT-001"],
  "DOM-004": ["SDC-LAYOUT-001"],
  "EDGE-001": ["SDC-ROUTE-003"],
  "EDGE-004": ["SDC-ROUTE-004"],
  "EDGE-005": ["SDC-ROUTE-002"],
  "EDGE-006": ["SDC-ROUTE-002"],
  "EDGE-007": ["SDC-ROUTE-003"],
  "EDGE-008": ["SDC-ROUTE-003"],
  "EDGE-009": ["SDC-ROUTE-001"],
  "EDGE-010": ["SDC-ROUTE-002"],
  "EDGE-011": ["SDC-ROUTE-003"],
  "EDGE-012": ["SDC-ROUTE-003"],
  "EDGE-013": ["SDC-LAYOUT-001", "SDC-UX-001"],
  "DOT-001": ["SDC-UX-001"],
  "DOT-002": ["SDC-UX-001"],
  "DOT-003": ["SDC-UX-001"],
  "DOT-004": ["SDC-UX-001"],
  "STR-001": ["SDC-LAYOUT-002"],
};

export function sdcIdsForLayoutCheck(checkId: LayoutRuleId): SdcRuleId[] {
  return CHECK_TO_SDC[checkId] ?? [];
}

/** @deprecated Use `sdcIdsForLayoutCheck`. */
export const sdcIdsForLegacy = sdcIdsForLayoutCheck;

/** @deprecated Internal bridge only. */
export const LEGACY_TO_SDC = CHECK_TO_SDC;

/** Plain-English phrases for SDC failure output. */
export const SDC_FAILURE_PHRASES: Partial<Record<LayoutRuleId, string>> = {
  "CBL-001": "same-side cables overlap",
  "CBL-002": "same-side cable stack gap too small",
  "CBL-003": "same-side cables not in one column",
  "CBL-004": "splice rows not straight across",
  "CBL-005": "ring-cut cable split missing",
  "ROW-001": "splice row pitch not 24px within a buffer tube",
  "ROW-002": "gap too small between buffer tube row groups",
  "ROW-003": "ring-cut or stub row gap too tight",
  "DOM-001": "stub rows not after main splice rows",
  "DOM-002": "main splice row ordering unclear",
  "DOM-003": "splice row alignment broken",
  "DOM-004": "splice row ordering wrong",
  "EDGE-001": "splice paths overlap",
  "EDGE-004": "splice bend budget exceeded (max 2 corners)",
  "EDGE-005": "tube bundle midX nest order wrong",
  "EDGE-006": "tube bundle jog trunk invalid",
  "EDGE-007": "center nest corners invalid",
  "EDGE-011": "splice paths stack on the same horizontal or vertical track",
  "EDGE-012": "center vertical legs stack on the same track",
  "EDGE-013": "near-straight leg misalignment (snap target missed)",
  "TUB-001": "buffer tube fan-out from sheath wrong",
  "TUB-002": "buffer tube tip not aligned to fiber group",
  "TUB-003": "cable sheath aspect ratio wrong",
  "TUB-004": "multi-tube stem reach too short",
  "TUB-005": "right-side tube geometry not mirrored",
  "TUB-006": "buffer tube color order wrong",
  "TUB-007": "shared label column misaligned",
  "TUB-008": "cross-side buffer tube alignment wrong",
  "STR-001": "fiber fan-out direction wrong",
  "FBR-001": "fiber color order wrong inside tube",
  "FBR-002": "fiber row pitch not 24px",
  "FBR-003": "fiber row order wrong on cable",
  "FBR-004": "multi-tube fibers share a row slot",
  "DOT-001": "fusion splice dot not on organized line for group",
  "DOT-002": "fusion splice dots not aligned per buffer tube group",
  "DOT-003": "fusion splice dot too close to a corner",
  "DOT-004": "vertical leg crosses fusion splice dot row",
};

/** @deprecated Use `SDC_FAILURE_PHRASES`. */
export const LEGACY_FAILURE_PHRASES = SDC_FAILURE_PHRASES;

function checkIdFromFailure(failure: string): LayoutRuleId | undefined {
  const match = failure.match(/^(FBR|TUB|CBL|ROW|DOM|EDGE|STR|DOT)-\d{3}/);
  return match?.[0] as LayoutRuleId | undefined;
}

/** Map an internal check failure string to SDC ID + plain phrase. */
export function formatSdcFailureMessage(
  sdcId: SdcRuleId,
  checkFailure: string,
): string {
  const checkId = checkIdFromFailure(checkFailure);
  if (checkId) {
    const phrase =
      SDC_FAILURE_PHRASES[checkId] ??
      checkFailure.replace(/^[^:]+:\s*/, "").trim();
    return `${sdcId}: ${phrase}`;
  }
  return `${sdcId}: ${checkFailure}`;
}
