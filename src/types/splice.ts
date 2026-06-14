/** Fiber / splice domain types (model-first, independent of React Flow). */

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
  spliceNumber?: string;
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

export type LayoutCalloutRecord = {
  targetCableNodeId: string;
  text: string;
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
  /** Cable callout labels keyed by callout node id. */
  callouts?: Record<string, LayoutCalloutRecord>;
  /** When false, callout nodes are hidden but stored text/positions are kept. */
  calloutsVisible?: boolean;
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
  /**
   * Layout engine for this diagram. `horizontal` (default) is the original
   * left/right pipeline; `quad` is the additive 4-side mode. Absent = horizontal.
   */
  layoutMode?: LayoutMode;
  /** Quad mode only: user-assigned canvas side per visual cable id. */
  quadCableSides?: Record<string, QuadSide>;
};

/** Original (left/right) vs additive 4-side layout engine. */
export type LayoutMode = "horizontal" | "quad";

/** A canvas edge a cable can sit on in quad layout mode. */
export type QuadSide = "left" | "right" | "top" | "bottom";
