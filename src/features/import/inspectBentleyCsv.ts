import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { csvColumnsForCable } from "@/features/import/cableLegIdentity";
import {
  PARSE_REASON_LABELS,
  type ParseRowFailureReason,
} from "@/features/import/parseReasons";
import { parseBentleyCsv, normalizeSectionMarker } from "@/features/import/parseBentleyCsv";

export type FailureBreakdown = {
  reason: ParseRowFailureReason;
  label: string;
  count: number;
  samples: string[];
};

export type CsvInspectReport = {
  header: Record<string, string | undefined>;
  rawRowCounts: { left: number; right: number };
  parsedPairCount: number;
  parseGap: number;
  failureBreakdown: FailureBreakdown[];
  cableLegs: {
    cable: string;
    device: string;
    left: { from: number; to: number };
    right: { from: number; to: number };
    inferredLegs: string[];
  }[];
  graphLegCount: number;
  warnings: string[];
};

function countSectionRows(csv: string, section: "left" | "right"): number {
  let active = false;
  let count = 0;
  for (const raw of csv.split(/\r?\n/)) {
    const line = raw.trim();
    const marker = normalizeSectionMarker(line);
    if (marker) {
      active = section === marker;
      continue;
    }
    if (active && line.includes("<->")) count += 1;
  }
  return count;
}

function legSummary(
  app: import("@/types/splice").CableAppearanceSummary,
): string[] {
  return csvColumnsForCable(app).map(
    (c) => `${c} (${c === "from" ? "diagram left" : "diagram right"})`,
  );
}

function buildFailureBreakdown(
  results: import("@/features/import/parseReasons").ParseRowResult[],
): FailureBreakdown[] {
  const byReason = new Map<ParseRowFailureReason, string[]>();

  for (const r of results) {
    if (r.ok) continue;
    const list = byReason.get(r.reason) ?? [];
    if (list.length < 3) list.push(r.line.slice(0, 120));
    byReason.set(r.reason, list);
  }

  return [...byReason.entries()]
    .map(([reason, samples]) => ({
      reason,
      label: PARSE_REASON_LABELS[reason],
      count: results.filter((x) => !x.ok && x.reason === reason).length,
      samples,
    }))
    .sort((a, b) => b.count - a.count);
}

export function inspectBentleyCsv(csvText: string): CsvInspectReport {
  const report = parseBentleyCsv(csvText);
  const graph = buildConnectionGraph(report);
  const rawLeft = countSectionRows(csvText, "left");
  const rawRight = countSectionRows(csvText, "right");
  const rowResults = report.rowResults ?? [];
  const warnings: string[] = [];

  const parseGap = rawLeft - report.pairs.length;
  if (parseGap > 0) {
    warnings.push(
      `${parseGap} Left-section row(s) did not parse — see failure breakdown below.`,
    );
  }
  if (rawLeft !== rawRight) {
    warnings.push(
      `Left (${rawLeft}) and Right (${rawRight}) row counts differ — Right is not a full mirror; pairs use Left only.`,
    );
  }

  for (const app of report.cableAppearances) {
    if (csvColumnsForCable(app).length === 0) {
      warnings.push(`Cable "${app.cable}" has no inferred legs — check mirror pattern.`);
    }
  }

  const failureBreakdown = buildFailureBreakdown(rowResults);

  const inferred = (report.rowResults ?? []).filter(
    (r) =>
      r.ok &&
      (r.pair.endpointA.fiberNumberSource === "inferred" ||
        r.pair.endpointB.fiberNumberSource === "inferred"),
  ).length;
  if (inferred > 0) {
    warnings.push(`${inferred} row(s) used inferred fiber numbers.`);
  }

  return {
    header: report.header,
    rawRowCounts: { left: rawLeft, right: rawRight },
    parsedPairCount: report.pairs.length,
    parseGap,
    failureBreakdown,
    cableLegs: report.cableAppearances.map((app) => ({
      cable: app.cable,
      device: app.device,
      left: app.left,
      right: app.right,
      inferredLegs: legSummary(app),
    })),
    graphLegCount: graph.legs.length,
    warnings,
  };
}

export function formatInspectReport(inspection: CsvInspectReport): string {
  const lines: string[] = [
    "=== Bentley CSV inspection ===",
    `Splice: ${inspection.header.spliceNumber ?? inspection.header.name ?? "?"}`,
    `Raw rows: Left ${inspection.rawRowCounts.left}, Right ${inspection.rawRowCounts.right}`,
    `Parsed pairs: ${inspection.parsedPairCount} (gap: ${inspection.parseGap})`,
    `Graph cable legs: ${inspection.graphLegCount}`,
    "",
  ];

  if (inspection.failureBreakdown.length) {
    lines.push("Parse failures (Left + Right sections):");
    for (const f of inspection.failureBreakdown) {
      lines.push(`  • ${f.label}: ${f.count}`);
      for (const s of f.samples) lines.push(`      e.g. ${s}…`);
    }
    lines.push("");
  }

  lines.push("Cable legs (inferred):");
  for (const leg of inspection.cableLegs) {
    lines.push(
      `  • ${leg.cable}`,
      `    Device: ${leg.device}`,
      `    Left section  from=${leg.left.from} to=${leg.left.to}`,
      `    Right section from=${leg.right.from} to=${leg.right.to}`,
      `    Legs: ${leg.inferredLegs.join(", ") || "(none)"}`,
    );
  }

  if (inspection.warnings.length) {
    lines.push("", "Warnings:");
    for (const w of inspection.warnings) lines.push(`  ⚠ ${w}`);
  }

  return lines.join("\n");
}
