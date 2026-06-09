import type { Edge } from "@xyflow/react";

import {
  buildButtSplicePath,
  buildSplicePath,
  buildSpliceHandleEntries,
  defaultSideCircuitLabelSpan,
  parallelSpliceSegmentsOverlap,
  parseOrthogonalPathPoints,
  routingLaneDataFromLane,
  SPLICE_PATH_EPS,
} from "@/features/canvas/edges/spliceEdgeRouting";
import {
  routeCenterSplices,
  type SpliceHandleEntry,
  type SpliceRoutingLane,
} from "@/features/diagram/centerRouter";
import type { VisualCable } from "@/features/diagram/visualCables";

export type PrecomputedSpliceEdgeData = {
  routingPrecomputed: true;
  leftPath: string;
  rightPath: string;
  spliceX: number;
  spliceY: number;
  routingMidX: number;
  routingJogX?: number;
  routingSourceHorizY?: number;
  routingTargetHorizY?: number;
  routingSourceBendX?: number;
  routingTargetBendX?: number;
};

export type SpliceLayoutPassResult = {
  handleEntries: SpliceHandleEntry[];
  lanes: Map<string, SpliceRoutingLane>;
  edges: Edge[];
};

type HorizSeg = { kind: "h"; y: number; x0: number; x1: number };

function horizontalSegmentsFromPath(path: string): HorizSeg[] {
  const pts = parseOrthogonalPathPoints(path);
  const segs: HorizSeg[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (
      Math.abs(a.y - b.y) <= SPLICE_PATH_EPS &&
      Math.abs(a.x - b.x) > SPLICE_PATH_EPS
    ) {
      segs.push({ kind: "h", y: a.y, x0: a.x, x1: b.x });
    }
  }
  return segs;
}

/** @internal debug — detect rendered horizontal track collisions (EDGE-011). */
function debugLogRenderedHorizontalOverlaps(
  routedEdges: Edge[],
  lanes: Map<string, SpliceRoutingLane>,
): void {
  const routed = routedEdges
    .filter((edge) => edge.type === "splice")
    .map((edge) => {
      const data = (edge.data ?? {}) as PrecomputedSpliceEdgeData;
      const lane = lanes.get(edge.id);
      return {
        id: edge.id,
        leftPath: data.leftPath,
        rightPath: data.rightPath,
        sourceHorizY: lane?.sourceHorizY,
        targetHorizY: lane?.targetHorizY,
        sourceY: undefined as number | undefined,
        targetY: undefined as number | undefined,
        leftSegments: horizontalSegmentsFromPath(data.leftPath ?? ""),
        rightSegments: horizontalSegmentsFromPath(data.rightPath ?? ""),
        segments: [
          ...horizontalSegmentsFromPath(data.leftPath ?? ""),
          ...horizontalSegmentsFromPath(data.rightPath ?? ""),
        ],
      };
    })
    .filter((r) => r.segments.length > 0);

  const ignoredOffsets: Array<{
    id: string;
    sourceHorizY?: number;
    targetHorizY?: number;
    renderedSourceYs: number[];
    renderedTargetYs: number[];
  }> = [];

  for (const r of routed) {
    const renderedSourceYs = [
      ...new Set(
        r.leftSegments.map((s) => Math.round(s.y)),
      ),
    ];
    const renderedTargetYs = [
      ...new Set(
        r.rightSegments.map((s) => Math.round(s.y)),
      ),
    ];
    if (
      (r.sourceHorizY !== undefined &&
        !renderedSourceYs.some(
          (y) => Math.abs(y - r.sourceHorizY!) <= SPLICE_PATH_EPS,
        )) ||
      (r.targetHorizY !== undefined &&
        !renderedTargetYs.some(
          (y) => Math.abs(y - r.targetHorizY!) <= SPLICE_PATH_EPS,
        ))
    ) {
      ignoredOffsets.push({
        id: r.id,
        sourceHorizY: r.sourceHorizY,
        targetHorizY: r.targetHorizY,
        renderedSourceYs,
        renderedTargetYs,
      });
    }
  }

  const overlaps: Array<{
    a: string;
    b: string;
    y: number;
    xOverlap: number;
  }> = [];
  for (let i = 0; i < routed.length; i++) {
    for (let j = i + 1; j < routed.length; j++) {
      const a = routed[i]!;
      const b = routed[j]!;
      for (const segA of a.segments) {
        for (const segB of b.segments) {
          if (parallelSpliceSegmentsOverlap(segA, segB)) {
            const loA = Math.min(segA.x0, segA.x1);
            const hiA = Math.max(segA.x0, segA.x1);
            const loB = Math.min(segB.x0, segB.x1);
            const hiB = Math.max(segB.x0, segB.x1);
            overlaps.push({
              a: a.id,
              b: b.id,
              y: segA.y,
              xOverlap: Math.min(hiA, hiB) - Math.max(loA, loB),
            });
          }
        }
      }
    }
  }

  // #region agent log
  fetch("http://127.0.0.1:7276/ingest/954dc9e2-dc29-44e2-8638-93624e140b86", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "71ce82",
    },
    body: JSON.stringify({
      sessionId: "71ce82",
      runId: "post-fix-3",
      hypothesisId: "H6-H8",
      location: "computeSpliceLayout.ts:debugLogRenderedHorizontalOverlaps",
      message: "rendered horizontal overlap audit",
      data: {
        edgeCount: routed.length,
        overlapCount: overlaps.length,
        overlaps: overlaps.slice(0, 12),
        ignoredOffsetCount: ignoredOffsets.length,
        ignoredOffsets: ignoredOffsets.slice(0, 8),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

export function computeSpliceEdgeLayout(
  nodes: Array<{
    id: string;
    position: { x: number; y: number };
    data: unknown;
  }>,
  edges: Edge[],
  visualCables: VisualCable[],
  diagramCenterX: number,
): SpliceLayoutPassResult {
  const handleEntries = buildSpliceHandleEntries(nodes, edges, visualCables);
  const lanes = routeCenterSplices(handleEntries, diagramCenterX);
  const routedEdges = attachPrecomputedPaths(edges, handleEntries, lanes, diagramCenterX);
  debugLogRenderedHorizontalOverlaps(routedEdges, lanes);
  return { handleEntries, lanes, edges: routedEdges };
}

export function attachPrecomputedPaths(
  edges: Edge[],
  entries: SpliceHandleEntry[],
  lanes: Map<string, SpliceRoutingLane>,
  diagramCenterX: number,
): Edge[] {
  const byId = new Map(entries.map((e) => [e.id, e]));

  return edges.map((edge) => {
    if (edge.type !== "splice") return edge;
    const entry = byId.get(edge.id);
    const lane = lanes.get(edge.id);
    if (!entry || !lane) return edge;

    const data = (edge.data ?? {}) as Record<string, unknown>;
    const sideSpans =
      (data.sideCircuitSpan as ReturnType<typeof defaultSideCircuitLabelSpan>) ??
      entry.sideCircuitSpan ??
      defaultSideCircuitLabelSpan();
    const fallbackLane = (data.laneIndex as number | undefined) ?? entry.fallbackLane;
    const laneCount = Math.max(1, (data.laneCount as number | undefined) ?? 1);
    const fullButt = data.fullButtSplice === true || entry.fullButtSplice === true;

    const { midX, jogX, sourceHorizY, targetHorizY, sourceBendX, targetBendX } =
      lane;

    const pathResult = fullButt
      ? buildButtSplicePath(
          entry.sourceX,
          entry.sourceY,
          entry.targetX,
          entry.targetY,
          midX,
          sideSpans,
          diagramCenterX,
          fallbackLane,
          laneCount,
        )
      : buildSplicePath(
          entry.sourceX,
          entry.sourceY,
          entry.targetX,
          entry.targetY,
          midX,
          jogX,
          { sourceHorizY, targetHorizY, sourceBendX, targetBendX },
          sideSpans,
          diagramCenterX,
          entry.sourceTagWidth ?? 0,
          entry.targetTagWidth ?? 0,
        );

    const precomputed: PrecomputedSpliceEdgeData = {
      routingPrecomputed: true,
      leftPath: pathResult.leftPath,
      rightPath: pathResult.rightPath,
      spliceX: pathResult.spliceX,
      spliceY: pathResult.spliceY,
      ...routingLaneDataFromLane(lane),
    };

    return {
      ...edge,
      data: {
        ...data,
        ...precomputed,
        diagramCenterX,
      },
    };
  });
}
