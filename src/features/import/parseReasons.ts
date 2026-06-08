/** Why a single Left-section data row failed to parse. */
export type ParseRowFailureReason =
  | "NO_ARROW"
  | "FROM_TOO_FEW_FIELDS"
  | "TO_TOO_FEW_FIELDS"
  | "FROM_INVALID_TUBE"
  | "FROM_INVALID_FIBER"
  | "TO_INVALID_TUBE"
  | "TO_INVALID_FIBER"
  | "MISSING_FIBER_NUMBER"
  | "EMPTY_CABLE";

export type ParseRowSuccess = {
  ok: true;
  pair: import("@/types/splice").SplicePair;
  lineNumber: number;
  line: string;
};

export type ParseRowFailure = {
  ok: false;
  reason: ParseRowFailureReason;
  detail: string;
  lineNumber: number;
  line: string;
};

export type ParseRowResult = ParseRowSuccess | ParseRowFailure;

export const PARSE_REASON_LABELS: Record<ParseRowFailureReason, string> = {
  NO_ARROW: "Row has no <-> splice marker",
  FROM_TOO_FEW_FIELDS: "From side: not enough fields (need device + cable + fiber# + tube + fiber)",
  TO_TOO_FEW_FIELDS: "To side: not enough fields after cable name",
  FROM_INVALID_TUBE: "From side: invalid buffer tube color",
  FROM_INVALID_FIBER: "From side: invalid fiber color",
  TO_INVALID_TUBE: "To side: invalid buffer tube color",
  TO_INVALID_FIBER: "To side: invalid fiber color",
  MISSING_FIBER_NUMBER: "Fiber number missing on both sides after normalization",
  EMPTY_CABLE: "Cable name empty",
};
