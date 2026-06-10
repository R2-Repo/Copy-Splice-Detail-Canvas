import { compareTubeColorsTia } from "@/features/diagram/colorCode";
import { connectionsInRowLayoutOrder } from "@/features/diagram/connectionRowOrder";
import {
  pairEndpointsForSide,
} from "@/features/diagram/buildConnectionGraph";
import { detectFullButtSpliceTubes } from "@/features/diagram/fullButtSplice";
import type {
  ConnectionGraph,
  FiberConnection,
  FiberEndpoint,
  TubeColorCode,
} from "@/types/splice";

import type {
  SpliceConnectionLine,
  SpliceReportOptions,
} from "./spliceReportTypes";

function endpointInferred(ep: FiberEndpoint): boolean {
  return (
    ep.fiberNumberSource !== undefined && ep.fiberNumberSource !== "csv"
  );
}

export function formatEndpoint(ep: FiberEndpoint): string {
  return `${ep.cable} / ${ep.tubeColor} / #${ep.fiberNumber} ${ep.fiberColor}`;
}

export function formatStrandShorthand(ep: FiberEndpoint): string {
  const star = endpointInferred(ep) ? "*" : "";
  return `#${ep.fiberNumber} ${ep.fiberColor}${star}`;
}

function uniqueCableCount(graph: ConnectionGraph): number {
  const cables = new Set<string>();
  for (const pair of graph.report.pairs) {
    cables.add(pair.endpointA.cable);
    cables.add(pair.endpointB.cable);
  }
  return cables.size;
}

function fullButtPairIds(graph: ConnectionGraph): Set<string> {
  return new Set(
    detectFullButtSpliceTubes(graph).flatMap((t) => t.pairIds),
  );
}

function formatHeader(graph: ConnectionGraph): string[] {
  const { header } = graph.report;
  const title =
    header.spliceNumber ?? header.name ?? header.id ?? "Unknown splice";
  const lines = ["SPLICE CONNECTION REPORT", title];

  if (header.location) lines.push(`Location: ${header.location}`);
  if (header.reportDate) lines.push(`Date: ${header.reportDate}`);

  const connectionCount = graph.connections.length;
  const cableCount = uniqueCableCount(graph);
  lines.push(
    "",
    `${connectionCount} connection${connectionCount === 1 ? "" : "s"} across ${cableCount} cable${cableCount === 1 ? "" : "s"}`,
  );
  return lines;
}

function formatConnectionLine(
  line: SpliceConnectionLine,
  useShorthandNear: boolean,
): string {
  const near = useShorthandNear
    ? formatStrandShorthand(line.near)
    : formatEndpoint(line.near);
  const far = formatEndpoint(line.far);
  const parts = [`    ${near}  →  ${far}`];

  if (line.circuitName) {
    parts.push(`  Circuit: ${line.circuitName}`);
  }
  if (line.existing) {
    parts.push("  [existing]");
  }

  return parts.join("");
}

function collectInferredNotes(lines: SpliceConnectionLine[]): string[] {
  const notes: string[] = [];
  const inferred = lines.filter((l) => l.inferredNear || l.inferredFar);
  if (inferred.length > 0) {
    notes.push(
      `  * ${inferred.length} strand number${inferred.length === 1 ? "" : "s"} inferred from tube/color (not written in CSV)`,
    );
  }
  return notes;
}

type TubeGroup = {
  tubeColor: TubeColorCode;
  fullButt: boolean;
  lines: SpliceConnectionLine[];
};

type CableGroup = {
  cable: string;
  tubes: TubeGroup[];
};

function buildCableGroups(
  graph: ConnectionGraph,
  options?: SpliceReportOptions,
): CableGroup[] {
  const ordered = connectionsInRowLayoutOrder(graph);
  const buttIds = fullButtPairIds(graph);
  const existing = options?.existingConnectionIds;

  const cableOrder: string[] = [];
  const cableMap = new Map<string, Map<TubeColorCode, SpliceConnectionLine[]>>();

  for (const conn of ordered) {
    const { left: near, right: far } = pairEndpointsForSide(conn.pair, graph);
    const line: SpliceConnectionLine = {
      connectionId: conn.id,
      near,
      far,
      circuitName: conn.pair.circuitName,
      existing: existing?.has(conn.id),
      inferredNear: endpointInferred(near),
      inferredFar: endpointInferred(far),
      fullButt: buttIds.has(conn.id),
    };

    const cable = near.cable;
    if (!cableMap.has(cable)) {
      cableMap.set(cable, new Map());
      cableOrder.push(cable);
    }
    const tubeMap = cableMap.get(cable)!;
    const tubeLines = tubeMap.get(near.tubeColor) ?? [];
    tubeLines.push(line);
    tubeMap.set(near.tubeColor, tubeLines);
  }

  return cableOrder.map((cable) => {
    const tubeMap = cableMap.get(cable)!;
    const tubeColors = [...tubeMap.keys()].sort(compareTubeColorsTia);

    const tubes: TubeGroup[] = tubeColors.map((tubeColor) => {
      const lines = tubeMap.get(tubeColor)!;
      lines.sort(
        (a, b) =>
          a.near.fiberNumber - b.near.fiberNumber ||
          a.near.fiberColor.localeCompare(b.near.fiberColor),
      );
      const fullButt =
        lines.length > 0 && lines.every((l) => l.fullButt);
      return { tubeColor, fullButt, lines };
    });

    return { cable, tubes };
  });
}

function formatBody(groups: CableGroup[]): string[] {
  const lines: string[] = [];

  for (const group of groups) {
    lines.push("", `── ${group.cable} ──`);

    for (const tube of group.tubes) {
      const buttNote = tube.fullButt ? "  [full butt]" : "";
      lines.push("", `  ${tube.tubeColor}${buttNote}`);

      for (const line of tube.lines) {
        lines.push(formatConnectionLine(line, true));
      }
    }
  }

  return lines;
}

function formatFooter(allLines: SpliceConnectionLine[]): string[] {
  const notes = collectInferredNotes(allLines);
  if (notes.length === 0) return [];

  return ["", "────────────────────────────────────────", "Notes:", ...notes];
}

export function buildSpliceConnectionLines(
  graph: ConnectionGraph,
  options?: SpliceReportOptions,
): SpliceConnectionLine[] {
  const ordered = connectionsInRowLayoutOrder(graph);
  const buttIds = fullButtPairIds(graph);
  const existing = options?.existingConnectionIds;

  return ordered.map((conn: FiberConnection) => {
    const { left: near, right: far } = pairEndpointsForSide(conn.pair, graph);
    return {
      connectionId: conn.id,
      near,
      far,
      circuitName: conn.pair.circuitName,
      existing: existing?.has(conn.id),
      inferredNear: endpointInferred(near),
      inferredFar: endpointInferred(far),
      fullButt: buttIds.has(conn.id),
    };
  });
}

export function formatSpliceConnectionReport(
  graph: ConnectionGraph,
  options?: SpliceReportOptions,
): string {
  const connectionLines = buildSpliceConnectionLines(graph, options);
  const groups = buildCableGroups(graph, options);

  const output = [
    ...formatHeader(graph),
    ...formatBody(groups),
    ...formatFooter(connectionLines),
  ];

  return output.join("\n").trimEnd() + "\n";
}
