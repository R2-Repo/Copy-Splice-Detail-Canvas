/** Fiber / splice domain types (model-first, independent of React Flow). */

import type { LayoutExpansion } from "@/features/diagram/layoutExpansion";
import type { ParseRowResult } from "@/features/import/parseReasons";

export type { ParseRowResult };

export type FiberColorAbbrev =
  | "BL"
  | "OR"
  | "GR"
  | "BR"
  | "SL"
  | "WH"
  | "RD"
  | "BK"
  | "YL"
  | "VI"
  | "RO"
  | "AQ";

export type TubeColorCode = FiberColorAbbrev | `${FiberColorAbbrev}-BK`;

/** Which side of `<->` the endpoint was parsed from (Bentley From / To columns). */
export type CsvColumnRole = "from" | "to";

export type FiberNumberSource = "csv" | "inferred" | "peer-copy" | "missing";

export type FiberEndpoint = {
  device: string;
  cable: string;
  /** CSV fiber number (Bentley "Number/Buffer" column) — not the tube color. */
  fiberNumber: number;
  /** How fiberNumber was resolved when CSV value was blank. */
  fiberNumberSource?: FiberNumberSource;
  /** CSV buffer tube color (first Color column, e.g. BL). */
  tubeColor: TubeColorCode;
  /** CSV second color — fiber color within the tube. */
  fiberColor: FiberColorAbbrev;
  /** From or To column — disambiguates duplicate cable names (in/out legs). */
  csvColumn: CsvColumnRole;
};

export type SplicePair = {
  id: string;
  endpointA: FiberEndpoint;
  endpointB: FiberEndpoint;
  /** Bentley OS column — circuit name (fiber-level). */
  circuitName?: string;
};

export type SpliceReportHeader = {
  deviceType?: string;
  model?: string;
  name?: string;
  id?: string;
  reportDate?: string;
  location?: string;
  street?: string;
  cityState?: string;
  poleNumber?: string;
  /** CSV "Desc:" field (before Splice#). */
  description?: string;
  spliceNumber?: string;
};

export type DiagramTitleBlock = {
  street?: string;
  cityState?: string;
  poleNumber?: string;
  reportDate?: string;
  description?: string;
  location?: string;
};

export type CableAppearanceSummary = {
  device: string;
  cable: string;
  left: { from: number; to: number };
  right: { from: number; to: number };
};

export type SpliceReport = {
  header: SpliceReportHeader;
  pairs: SplicePair[];
  /** Per-cable From/To counts in Left and Right sections (mirror disambiguation). */
  cableAppearances: CableAppearanceSummary[];
  /** Per-row outcomes for Left + Right sections (diagnostics). */
  rowResults?: ParseRowResult[];
};

/**
 * Unique cable leg in this diagram — not the same as Bentley cable name.
 * Same name may map to two legs (`from` / `to`) at a mid-span case.
 */
export type CableLegId = string;

export type CableLeg = {
  id: CableLegId;
  device: string;
  cable: string;
  /** Disambiguates duplicate names (in/out through-cable legs). */
  csvColumn: CsvColumnRole;
  /** Visual side after layout. */
  side: "left" | "right";
  /** Empirically derived buffer-tube strand count (D3). */
  fibersPerTube: 6 | 12;
  /** Distribution vs stub — affects anchoring/order, not correctness. */
  role: "through" | "drop";
};

export type TubeEndpointKey = string;

export type TubeEndpoint = {
  key: TubeEndpointKey;
  legId: CableLegId;
  tubeColor: TubeColorCode;
};

export type FiberConnection = {
  kind: "fiber";
  id: string;
  pair: SplicePair;
};

export type TubeConnection = {
  kind: "tube";
  id: string;
  endpointA: TubeEndpoint;
  endpointB: TubeEndpoint;
  pairIds: string[];
};

export type DiagramConnection = FiberConnection | TubeConnection;

export type ConnectionGraph = {
  report: SpliceReport;
  legs: CableLeg[];
  connections: DiagramConnection[];
  /** One canvas side per physical cable name (from deduped pairs). */
  cableSides: Map<string, "left" | "right">;
};

export type LayoutNodePosition = {
  id: string;
  x: number;
  y: number;
};

/** Bump when override shape/semantics change — ignores stale localStorage. */
export const LAYOUT_OVERRIDE_VERSION = 14;

/** `${visualCableId}|${tubeColor}` — matches `TubeKey` in tubeRowShift.ts */
export type TubeOverrideKey = `${string}|${string}`;

export type TubeManualOverride = {
  /** Bounded Y shift for tube tip / fan-out origin (fibers stay on row pitch). */
  visualShiftY?: number;
  /** Extra horizontal reach from sheath face toward center (px). */
  stemReachX?: number;
};

/** Parameter-based per-connection routing offset (Phase 5 — replaces segment-index legOverrides over time). */
export type ConnectionOverride = {
  laneOffsetX?: number;
  spliceRowOffsetY?: number;
  dotOffsetX?: number;
};

/** Parameter-based tube-bundle lane offset keyed by `tubeBundleKey`. */
export type BundleOverride = {
  laneOffsetX?: number;
  rowOffsetY?: number;
};

export type LayoutCalloutRecord = {
  targetCableNodeId: string;
  text: string;
};

/**
 * User-locked diagram elements — frozen across auto/manual mode switches and
 * across other elements moving. Absence of a key = unlocked. Additive: new
 * tiers (legs, dots, buffer tubes) extend this shape without a version bump.
 */
export type DiagramLocks = {
  /** Locked per-tube fan-out groups, keyed by `${visualCableId}|${tubeColor}`. */
  tubeGroups?: Record<TubeOverrideKey, true>;
};

export type LayoutOverrides = {
  reportKey: string;
  layoutVersion?: number;
  positions: Record<string, { x: number; y: number }>;
  /** Last auto-layout Y per node id — used to preserve user drag delta on row refresh. */
  autoLayoutY?: Record<string, number>;
  existingEdgeIds?: string[];
  /** User-dragged display side per visual cable id (mirrors sheath/tubes/strands). */
  cableSides?: Record<string, "left" | "right">;
  /** Collapse full-butt-spliced buffer tubes (hide strands, show tube splice squares). */
  collapseFullButtSplices?: boolean;
  /** Import-time canvas width used for column placement and strand center. */
  layoutWidth?: number;
  /** Feasibility expansion applied when resolving import layout (SDC-ROUTE-004-A/011/012). */
  layoutExpansion?: LayoutExpansion;
  /** Cable callout labels keyed by callout node id. */
  callouts?: Record<string, LayoutCalloutRecord>;
  /** Editable diagram title block (upper-left); defaults from CSV header on import. */
  titleBlock?: DiagramTitleBlock;
  /** When false, callout nodes are hidden but stored text/positions are kept. */
  calloutsVisible?: boolean;
  /** User-controlled callout size multiplier (0.5–3.0). */
  calloutScale?: number;
  /** When true, callouts compensate for canvas zoom so they stay readable. */
  calloutAutoZoom?: boolean;
  /** When false, cable drag and resize skip auto row/tube relayout (default true). */
  autoAdjustEnabled?: boolean;
  /** User-locked buffer tube tip / fan-out reach per tube key. */
  tubeOverrides?: Record<TubeOverrideKey, TubeManualOverride>;
  /** Per-tube fan-out + labels vertical shift (manual adjust engine). */
  fanoutOverrides?: Record<TubeOverrideKey, { shiftY: number }>;
  /** Per-splice leg segment adjustments (manual adjust engine). */
  legOverrides?: Record<
    string,
    {
      leftSegments?: Record<number, { dx?: number; dy?: number }>;
      rightSegments?: Record<number, { dx?: number; dy?: number }>;
      /** Manual fusion-dot slide along the leg (= leg color transition point). */
      dotShiftX?: number;
    }
  >;
  /** Parameter-based per-connection routing offsets (Phase 5). */
  connectionOverrides?: Record<string, ConnectionOverride>;
  /** Parameter-based tube-bundle lane offsets keyed by `tubeBundleKey`. */
  bundleOverrides?: Record<string, BundleOverride>;
  /**
   * Layout engine for this diagram. `horizontal` (default) is the original
   * left/right pipeline; `quad` is the additive 4-side mode. Absent = horizontal.
   */
  layoutMode?: LayoutMode;
  /** Quad mode only: user-assigned canvas side per visual cable id. */
  quadCableSides?: Record<string, QuadSide>;
  /** User-locked elements (frozen across auto/manual + other moves). */
  locks?: DiagramLocks;
  /**
   * Routing backend for this diagram. `nodes` (default) = current lane router;
   * `grid` = grid reservation router; `legacy` = pre-nodes composite edges.
   */
  routingEngine?: "composite" | "nodes" | "grid" | "legacy";
  /** Grid-mode persisted routes keyed by connection id. */
  gridRoutes?: Record<
    string,
    {
      connectionId: string;
      points: Array<{ x: number; y: number }>;
      segmentIds: string[];
    }
  >;
  /** Grid-mode locked segments, dots, and tube groups. */
  gridLocks?: {
    segments: string[];
    dots: string[];
    tubeGroups: string[];
  };
  /** Routing-first auto layout: winning search candidate snapshot. */
  optimizedLayoutCandidate?: OptimizedLayoutCandidate;
};

/** Serializable layout-search candidate (stored in overrides + `.sdc.json`). */
export type OptimizedLayoutCandidate = {
  cableSides: Record<string, QuadSide>;
  stackOrder: Record<QuadSide, string[]>;
  layoutWidth: number;
  layoutExpansion: LayoutExpansion;
  id?: string;
};

/** Original (left/right) vs additive 4-side layout engine. */
export type LayoutMode = "horizontal" | "quad";

/** A canvas edge a cable can sit on in quad layout mode. */
export type QuadSide = "left" | "right" | "top" | "bottom";
