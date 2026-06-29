import type { SdcRuleId } from "./types";

/** Atomic layout/routing checks — subcodes under parent SDC rules. */
export const SDC_CHECK_IDS = [
  "SDC-ORDER-002-A",
  "SDC-ORDER-002-B",
  "SDC-ORDER-002-C",
  "SDC-LAYOUT-001-A",
  "SDC-LAYOUT-002-A",
  "SDC-LAYOUT-002-B",
  "SDC-LAYOUT-002-C",
  "SDC-LAYOUT-002-D",
  "SDC-LAYOUT-002-E",
  "SDC-ORDER-001-A",
  "SDC-LAYOUT-002-F",
  "SDC-LAYOUT-002-G",
  "SDC-LAYOUT-001-B",
  "SDC-LAYOUT-001-C",
  "SDC-LAYOUT-001-D",
  "SDC-LAYOUT-001-E",
  "SDC-LAYOUT-001-F",
  "SDC-ROUTE-004-A",
  "SDC-ROUTE-002-A",
  "SDC-ROUTE-003-A",
  "SDC-ROUTE-003-B",
  "SDC-ROUTE-003-C",
  "SDC-UX-001-A",
  "SDC-UX-001-B",
  "SDC-UX-001-C",
  "SDC-UX-001-D",
  "SDC-UX-001-E",
  "SDC-LAYOUT-002-H",
] as const;

export type SdcCheckId = (typeof SDC_CHECK_IDS)[number];

export type SdcCheckMeta = {
  id: SdcCheckId;
  title: string;
  parent: SdcRuleId;
  category:
    | "order"
    | "layout"
    | "fanout"
    | "route"
    | "ux"
    | "strand";
};

export const SDC_CHECKS: SdcCheckMeta[] = [
  {
    id: "SDC-ORDER-002-A",
    title: "TIA fiber order within each buffer tube",
    parent: "SDC-ORDER-002",
    category: "order",
  },
  {
    id: "SDC-ORDER-002-B",
    title: "24px pitch within each buffer tube",
    parent: "SDC-ORDER-002",
    category: "order",
  },
  {
    id: "SDC-ORDER-002-C",
    title: "rowYOffset increases top-to-bottom per cable",
    parent: "SDC-ORDER-002",
    category: "order",
  },
  {
    id: "SDC-LAYOUT-001-A",
    title: "Distinct rowYOffset per fiber on multi-tube cables",
    parent: "SDC-LAYOUT-001",
    category: "layout",
  },
  {
    id: "SDC-LAYOUT-002-A",
    title: "Tubes attach at cable sheath center",
    parent: "SDC-LAYOUT-002",
    category: "fanout",
  },
  {
    id: "SDC-LAYOUT-002-B",
    title: "Tube tip centered on fiber group",
    parent: "SDC-LAYOUT-002",
    category: "fanout",
  },
  {
    id: "SDC-LAYOUT-002-C",
    title: "Sheath preserves aspect ratio",
    parent: "SDC-LAYOUT-002",
    category: "fanout",
  },
  {
    id: "SDC-LAYOUT-002-D",
    title: "Multi-tube cables have longer tube reach",
    parent: "SDC-LAYOUT-002",
    category: "fanout",
  },
  {
    id: "SDC-LAYOUT-002-E",
    title: "Right-side breakout mirrors left",
    parent: "SDC-LAYOUT-002",
    category: "fanout",
  },
  {
    id: "SDC-ORDER-001-A",
    title: "Buffer tubes in TIA solid then striped order",
    parent: "SDC-ORDER-001",
    category: "order",
  },
  {
    id: "SDC-LAYOUT-002-F",
    title: "Same-side fiber stem columns aligned",
    parent: "SDC-LAYOUT-002",
    category: "fanout",
  },
  {
    id: "SDC-LAYOUT-002-G",
    title: "Cross-side buffer tube handles horizontally aligned",
    parent: "SDC-LAYOUT-002",
    category: "fanout",
  },
  {
    id: "SDC-LAYOUT-001-B",
    title: "Same-side cables do not overlap",
    parent: "SDC-LAYOUT-001",
    category: "layout",
  },
  {
    id: "SDC-LAYOUT-001-C",
    title: "Same-side cables stack with at least cableGap",
    parent: "SDC-LAYOUT-001",
    category: "layout",
  },
  {
    id: "SDC-LAYOUT-001-D",
    title: "Multi-tube cables offset X from center",
    parent: "SDC-LAYOUT-001",
    category: "layout",
  },
  {
    id: "SDC-LAYOUT-001-E",
    title: "Equal pitch within buffer tube in global rows",
    parent: "SDC-LAYOUT-001",
    category: "layout",
  },
  {
    id: "SDC-LAYOUT-001-F",
    title: "Extra gap at buffer-tube boundaries",
    parent: "SDC-LAYOUT-001",
    category: "layout",
  },
  {
    id: "SDC-LAYOUT-002-H",
    title: "Fiber strands fan toward canvas center",
    parent: "SDC-LAYOUT-002",
    category: "strand",
  },
  {
    id: "SDC-ROUTE-004-A",
    title: "Splice path within two-corner bend budget",
    parent: "SDC-ROUTE-004",
    category: "route",
  },
  {
    id: "SDC-ROUTE-002-A",
    title: "Splice route uses minimum-bend template",
    parent: "SDC-ROUTE-002",
    category: "route",
  },
  {
    id: "SDC-ROUTE-003-A",
    title: "Center vertical splice lanes meet minimum spacing",
    parent: "SDC-ROUTE-003",
    category: "route",
  },
  {
    id: "SDC-ROUTE-003-B",
    title: "Splice paths do not stack on the same track",
    parent: "SDC-ROUTE-003",
    category: "route",
  },
  {
    id: "SDC-ROUTE-003-C",
    title: "Overlapping vertical center legs use distinct midX lanes",
    parent: "SDC-ROUTE-003",
    category: "route",
  },
  {
    id: "SDC-UX-001-A",
    title: "Near-straight legs snapped flat at fixpoint",
    parent: "SDC-UX-001",
    category: "ux",
  },
  {
    id: "SDC-UX-001-B",
    title: "Fusion splice dot on organized line for tube group",
    parent: "SDC-UX-001",
    category: "ux",
  },
  {
    id: "SDC-UX-001-C",
    title: "Source buffer tube fusion dots share column and pitch",
    parent: "SDC-UX-001",
    category: "ux",
  },
  {
    id: "SDC-UX-001-D",
    title: "Fusion splice dot corner clearance",
    parent: "SDC-UX-001",
    category: "ux",
  },
  {
    id: "SDC-UX-001-E",
    title: "Vertical leg lane clearance at fusion dot row",
    parent: "SDC-UX-001",
    category: "ux",
  },
];

export const SDC_CHECK_PHRASES: Record<SdcCheckId, string> = {
  "SDC-ORDER-002-A": "fiber color order wrong inside tube",
  "SDC-ORDER-002-B": "fiber row pitch not 24px",
  "SDC-ORDER-002-C": "fiber row order wrong on cable",
  "SDC-LAYOUT-001-A": "multi-tube fibers share a row slot",
  "SDC-LAYOUT-002-A": "buffer tube fan-out from sheath wrong",
  "SDC-LAYOUT-002-B": "buffer tube tip not aligned to fiber group",
  "SDC-LAYOUT-002-C": "cable sheath aspect ratio wrong",
  "SDC-LAYOUT-002-D": "multi-tube stem reach too short",
  "SDC-LAYOUT-002-E": "right-side tube geometry not mirrored",
  "SDC-ORDER-001-A": "buffer tube color order wrong",
  "SDC-LAYOUT-002-F": "shared label column misaligned",
  "SDC-LAYOUT-002-G": "cross-side buffer tube alignment wrong",
  "SDC-LAYOUT-001-B": "same-side cables overlap",
  "SDC-LAYOUT-001-C": "same-side cable stack gap too small",
  "SDC-LAYOUT-001-D": "same-side cables not in one column",
  "SDC-LAYOUT-001-E": "splice row pitch not 24px within a buffer tube",
  "SDC-LAYOUT-001-F": "gap too small between buffer tube row groups",
  "SDC-LAYOUT-002-H": "fiber fan-out direction wrong",
  "SDC-ROUTE-004-A": "splice bend budget exceeded (max 2 corners)",
  "SDC-ROUTE-002-A": "splice route template is not the minimum-bend choice",
  "SDC-ROUTE-003-A":
    "center vertical splice lanes are closer than minimum fiber line spacing",
  "SDC-ROUTE-003-B":
    "splice paths stack on the same horizontal or vertical track",
  "SDC-ROUTE-003-C": "center vertical legs stack on the same track",
  "SDC-UX-001-A": "near-straight leg misalignment (snap target missed)",
  "SDC-UX-001-B": "fusion splice dot not on organized line for group",
  "SDC-UX-001-C": "fusion splice dots not aligned per buffer tube group",
  "SDC-UX-001-D": "fusion splice dot too close to a corner",
  "SDC-UX-001-E": "vertical leg crosses fusion splice dot row",
};

export function sdcParentRuleId(checkId: SdcCheckId): SdcRuleId {
  const meta = SDC_CHECKS.find((c) => c.id === checkId);
  if (meta) return meta.parent;
  const prefix = checkId.replace(/-[A-Z]$/, "");
  return prefix as SdcRuleId;
}

export function parseSdcCheckId(failure: string): SdcCheckId | undefined {
  const match = failure.match(
    /^(SDC-(?:CORE|DATA|ORDER|LAYOUT|GRID|ROUTE|SCORE|UX)-\d{3}-[A-Z])/,
  );
  return match?.[1] as SdcCheckId | undefined;
}
