import { LAYOUT_OVERRIDE_VERSION, type SpliceReport } from "@/types/splice";

import {
  DIAGRAM_CONFIG_SCHEMA_VERSION,
  type DiagramConfigFile,
  type DiagramConfigLayout,
} from "./diagramConfigTypes";

export class DiagramConfigParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DiagramConfigParseError";
  }
}

export function isDiagramConfigCandidate(
  value: unknown,
): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.schemaVersion === "number" &&
    record.report !== undefined &&
    typeof record.report === "object"
  );
}

function isSpliceReport(value: unknown): value is SpliceReport {
  if (!value || typeof value !== "object") return false;
  const report = value as SpliceReport;
  return Array.isArray(report.pairs);
}

export function looksLikeDiagramConfigText(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return isDiagramConfigCandidate(parsed);
  } catch {
    return false;
  }
}

export function parseDiagramConfig(text: string): DiagramConfigFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new DiagramConfigParseError("Invalid JSON");
  }

  if (!isDiagramConfigCandidate(raw)) {
    throw new DiagramConfigParseError("Not a valid diagram config file");
  }

  if (raw.schemaVersion !== DIAGRAM_CONFIG_SCHEMA_VERSION) {
    throw new DiagramConfigParseError(
      `Unsupported config schema version ${String(raw.schemaVersion)}`,
    );
  }

  if (!isSpliceReport(raw.report)) {
    throw new DiagramConfigParseError("Config missing report pairs");
  }

  const layout = raw.layout as DiagramConfigLayout | undefined;
  if (
    layout?.layoutVersion !== undefined &&
    layout.layoutVersion !== LAYOUT_OVERRIDE_VERSION
  ) {
    throw new DiagramConfigParseError(
      `Unsupported layout version ${String(layout.layoutVersion)}`,
    );
  }

  const cableSides = raw.cableSides;
  if (!cableSides || typeof cableSides !== "object") {
    throw new DiagramConfigParseError("Config missing cableSides");
  }

  if (!layout || typeof layout !== "object") {
    throw new DiagramConfigParseError("Config missing layout");
  }

  return raw as DiagramConfigFile;
}
