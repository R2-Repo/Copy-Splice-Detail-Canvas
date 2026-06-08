import type { FiberEndpoint } from "@/types/splice";
import type { ParseRowFailure, ParseRowResult } from "@/features/import/parseReasons";

/** Raw comma-split fragments before normalization. */
export type BentleySpliceRow = {
  line: string;
  lineNumber: number;
  csvSection: "left" | "right";
  leftParts: string[];
  rightParts: string[];
};

export type NormalizedSpliceRow = {
  line: string;
  lineNumber: number;
  endpointA: FiberEndpoint;
  endpointB: FiberEndpoint;
};

export function toParseRowResult(
  row: NormalizedSpliceRow,
  pairId: string,
  circuitName?: string,
): ParseRowResult {
  return {
    ok: true,
    lineNumber: row.lineNumber,
    line: row.line,
    pair: {
      id: pairId,
      endpointA: row.endpointA,
      endpointB: row.endpointB,
      circuitName,
    },
  };
}

export function tokenizeBentleyRow(
  line: string,
  lineNumber: number,
  csvSection: "left" | "right",
): BentleySpliceRow | null {
  const arrowIdx = line.indexOf("<->");
  if (arrowIdx < 0) return null;
  const trim = (s: string) => s.trim();
  return {
    line,
    lineNumber,
    csvSection,
    leftParts: line.slice(0, arrowIdx).split(",").map(trim),
    rightParts: line
      .slice(arrowIdx + 3)
      .replace(/^\s*,\s*/, "")
      .split(",")
      .map(trim),
  };
}

export function failRow(
  line: string,
  lineNumber: number,
  reason: ParseRowFailure["reason"],
  detail: string,
): ParseRowFailure {
  return { ok: false, line, lineNumber, reason, detail };
}
