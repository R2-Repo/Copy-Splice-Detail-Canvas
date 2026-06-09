import fs from "node:fs";

const header = `import {
  FIBER_ROW_PITCH,
  MIN_SPLICE_HORIZONTAL_INSET,
  SPLICE_LANE_SEP,
} from "@/features/diagram/cableLayoutMetrics";
import type { SideCircuitLabelSpan } from "@/features/diagram/cableLabels";
import {
  canvasSideForHandle,
  circuitLabelSpanForSide,
  clampMidXForMinHorizontalInset,
  defaultSideCircuitLabelSpan,
  inwardSignForColumn,
  isSameColumnSplice,
  laneClearXBeforeVertical,
  resolveButtSpliceMidX,
  spliceMidOrderInverts,
  spliceMidXFromRowOffset,
  spliceMidXInsetBounds,
  spliceRoutingBounds,
  SPLICE_PATH_EPS,
  targetClearXBeforeVertical,
  type SpliceHandleEntry,
  type SpliceRoutingLane,
} from "@/features/canvas/edges/spliceEdgeRouting";

function inwardAnchorFromColumn(
  columnX: number,
  diagramCenterX: number,
  sideSpans: SideCircuitLabelSpan,
  laneOffsetPx = 0,
): number {
  const inward = inwardSignForColumn(columnX, diagramCenterX);
  const side = canvasSideForHandle(columnX, diagramCenterX);
  const run =
    circuitLabelSpanForSide(side, sideSpans) +
    MIN_SPLICE_HORIZONTAL_INSET +
    laneOffsetPx;
  return columnX + inward * run;
}

`;

const footer = `

/** Map layout handle entries to midX lane candidates (plan §4.4 step 1–3 inputs). */
export function handleEntriesToCandidates(
  entries: SpliceHandleEntry[],
): MidXLaneCandidate[] {
  return entries.map((entry) => ({
    id: entry.id,
    sourceX: entry.sourceX,
    sourceY: entry.sourceY,
    targetX: entry.targetX,
    targetY: entry.targetY,
    rowOffset: entry.rowOffset ?? entry.fallbackLane,
    tubeBundleKey: entry.tubeBundleKey,
    fullButtSplice: entry.fullButtSplice,
    sourceTagWidth: entry.sourceTagWidth,
    targetTagWidth: entry.targetTagWidth,
  }));
}

/** Center lane assignment entry point for the nodes routing engine. */
export function assignCenterLanes(
  entries: SpliceHandleEntry[],
  diagramCenterX: number,
): Map<string, SpliceRoutingLane> {
  return assignSpliceRoutingLanesFromHandleEntries(entries, diagramCenterX);
}
`;

const body = fs.readFileSync("_lane_extract.txt", "utf8");
fs.writeFileSync(
  "src/features/diagram/spliceCenterLanes.ts",
  header + body + footer,
);
console.log("spliceCenterLanes.ts written");
