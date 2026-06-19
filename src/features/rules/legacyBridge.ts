import type { LayoutRuleId } from "@/features/diagram/layoutRules";
import type { SdcRuleId } from "./types";

/** Legacy layout rule ID → SDC rule ID(s). */
export const LEGACY_TO_SDC: Partial<Record<LayoutRuleId, SdcRuleId[]>> = {
  "FBR-001": ["SDC-ORDER-002"],
  "FBR-002": ["SDC-ORDER-002", "SDC-LAYOUT-001"],
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
  "ROW-001": ["SDC-LAYOUT-001"],
  "ROW-002": ["SDC-LAYOUT-001"],
  "ROW-003": ["SDC-LAYOUT-001"],
  "DOM-001": ["SDC-LAYOUT-001"],
  "DOM-002": ["SDC-LAYOUT-001"],
  "DOM-003": ["SDC-LAYOUT-001"],
  "DOM-004": ["SDC-LAYOUT-001"],
  "EDGE-001": ["SDC-ROUTE-003"],
  "EDGE-004": ["SDC-ROUTE-003"],
  "EDGE-005": ["SDC-ROUTE-002"],
  "EDGE-006": ["SDC-ROUTE-002"],
  "EDGE-007": ["SDC-ROUTE-003"],
  "EDGE-008": ["SDC-ROUTE-003"],
  "EDGE-009": ["SDC-ROUTE-001"],
  "EDGE-010": ["SDC-ROUTE-002"],
  "EDGE-011": ["SDC-ROUTE-003"],
  "EDGE-012": ["SDC-ROUTE-003"],
  "EDGE-013": ["SDC-LAYOUT-001"],
  "DOT-001": ["SDC-UX-001"],
  "DOT-002": ["SDC-UX-001"],
  "DOT-003": ["SDC-UX-001"],
  "DOT-004": ["SDC-UX-001"],
  "STR-001": ["SDC-LAYOUT-002"],
};

export function sdcIdsForLegacy(legacyId: LayoutRuleId): SdcRuleId[] {
  return LEGACY_TO_SDC[legacyId] ?? [];
}
