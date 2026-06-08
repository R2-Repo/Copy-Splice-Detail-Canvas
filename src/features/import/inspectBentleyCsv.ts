import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { deriveFibersPerTube } from "@/features/diagram/fibersPerTube";
import { cableNameKey, csvColumnsForCable } from "@/features/import/cableLegIdentity";
import { logicalEndpointKey } from "@/features/import/parseBentleyCsv";
import type { FiberEndpoint, SplicePair } from "@/types/splice";
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

function endpointsForLeg(
  legId: string,
  pairs: SplicePair[],
): FiberEndpoint[] {
  const out: FiberEndpoint[] = [];
  for (const pair of pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      if (`${cableNameKey(ep.cable)}::${ep.csvColumn}` === legId) {
        out.push(ep);
      }
    }
  }
  return out;
}

function fiberRange(endpoints: FiberEndpoint[]): [number, number] | null {
  const nums = endpoints
    .map((ep) => ep.fiberNumber)
    .filter((n) => Number.isFinite(n));
  if (nums.length === 0) return null;
  return [Math.min(...nums), Math.max(...nums)];
}

function rangesDisjoint(
  a: [number, number] | null,
  b: [number, number] | null,
): boolean {
  if (!a || !b) return false;
  return a[1] < b[0] || b[1] < a[0];
}

/** Warn when duplicate cable names look like distinct physical cables (A3). */
function distinctCableLegWarnings(
  pairs: SplicePair[],
  appearances: import("@/types/splice").CableAppearanceSummary[],
): string[] {
  const warnings: string[] = [];

  for (const app of appearances) {
    const columns = csvColumnsForCable(app);
    if (columns.length < 2) continue;

    const legIds = columns.map((c) => `${cableNameKey(app.cable)}::${c}`);
    const ranges = legIds.map((id) => fiberRange(endpointsForLeg(id, pairs)));
    const counts = legIds.map((id) =>
      deriveFibersPerTube(endpointsForLeg(id, pairs), app.cable),
    );

    if (rangesDisjoint(ranges[0] ?? null, ranges[1] ?? null)) {
      warnings.push(
        `Cable "${app.cable}" has two legs with disjoint fiber ranges — name may not be unique.`,
      );
    }
    if (counts[0] !== counts[1]) {
      warnings.push(
        `Cable "${app.cable}" has two legs with different derived fibers-per-tube (${counts[0]} vs ${counts[1]}) — name may not be unique.`,
      );
    }

    const fibersByLeg = legIds.map((id) => {
      const set = new Set(
        endpointsForLeg(id, pairs).map((ep) => logicalEndpointKey(ep)),
      );
      return set;
    });
    if (
      fibersByLeg[0] &&
      fibersByLeg[1] &&
      [...fibersByLeg[0]].every((k) => !fibersByLeg[1]!.has(k)) &&
      fibersByLeg[0].size > 0 &&
      fibersByLeg[1].size > 0
    ) {
      warnings.push(
        `Cable "${app.cable}" has two legs with no shared fibers — verify this is one spliced cable (D1).`,
      );
    }
  }

  return warnings;
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

  warnings.push(...distinctCableLegWarnings(report.pairs, report.cableAppearances));

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
