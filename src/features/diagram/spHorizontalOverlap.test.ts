import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildReactFlowGraph } from "./buildReactFlowGraph";
import { computeCanvasPlacement } from "./canvasPlacement";
import { connectionRowIndexMap } from "./connectionRowOrder";
import {
  findSpliceOverlapPair,
  type LayoutRuleContext,
} from "./layoutRules";
import { DEFAULT_LAYOUT_EXPANSION } from "./layoutExpansion";
import { orderedFiberConnections } from "./buildConnectionGraph";
import { buildVisualCablesForLayout } from "./visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import {
  parallelSpliceSegmentsOverlap,
  parseOrthogonalPathPoints,
  SPLICE_PATH_EPS,
} from "@/features/canvas/edges/splicePathGeometry";

const SP_CSV = readFileSync(
  join(process.cwd(), "public/qa-fixtures/sp.csv"),
  "utf8",
);

const WATCH = ["|BL|SL|", "|BL|WH|", "|BL|GR|", "|BL|BR|"];

type HorizSeg = { kind: "h"; y: number; x0: number; x1: number };

function horizSegmentsFromPath(path: string): HorizSeg[] {
  const pts = parseOrthogonalPathPoints(path);
  const segs: HorizSeg[] = [];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]!;
    const b = pts[i]!;
    if (Math.abs(a.y - b.y) <= SPLICE_PATH_EPS && Math.abs(a.x - b.x) > SPLICE_PATH_EPS) {
      segs.push({ kind: "h", y: a.y, x0: a.x, x1: b.x });
    }
  }
  return segs;
}

function ctxFromSp(): LayoutRuleContext {
  const graph = buildConnectionGraph(parseBentleyCsv(SP_CSV));
  const built = buildReactFlowGraph(
    graph,
    { reportKey: "sp-overlap", positions: {}, routingEngine: "grid" } as never,
    1920,
  );
  const { visualCables, dominant } = buildVisualCablesForLayout(graph);
  const rowIndex = connectionRowIndexMap(graph, visualCables, dominant);
  const placement = computeCanvasPlacement(graph, visualCables, dominant, rowIndex);
  return {
    graph,
    visualCables,
    dominant,
    placement,
    layout: built.layout as LayoutRuleContext["layout"],
    reactFlow: { nodes: built.nodes, edges: built.edges },
    layoutWidth: built.layout.layoutWidth,
    layoutExpansion: DEFAULT_LAYOUT_EXPANSION,
  };
}

function renderedHorizOverlaps(ctx: LayoutRuleContext) {
  const paths: Array<{ id: string; segs: HorizSeg[]; midX?: number }> = [];
  for (const conn of orderedFiberConnections(ctx.graph)) {
    if (conn.kind !== "fiber") continue;
    if (!WATCH.some((w) => conn.id.includes(w.slice(1, -1)))) continue;
    const edge = ctx.reactFlow.edges.find(
      (e) =>
        e.type === "splice" &&
        (e.id === `splice-left-${conn.id}` ||
          e.id === `splice-${conn.id}` ||
          e.id === `splice-right-${conn.id}`),
    );
    if (!edge) continue;
    const d = (edge.data ?? {}) as {
      leftPath?: string;
      rightPath?: string;
      routingMidX?: number;
      midX?: number;
    };
    const left = String(d.leftPath ?? "");
    const right = String(d.rightPath ?? "");
    paths.push({
      id: conn.id,
      segs: [...horizSegmentsFromPath(left), ...horizSegmentsFromPath(right)],
      midX: Number(d.routingMidX ?? d.midX),
    });
  }

  const hits: string[] = [];
  for (let i = 0; i < paths.length; i++) {
    for (let j = i + 1; j < paths.length; j++) {
      const a = paths[i]!;
      const b = paths[j]!;
      for (const segA of a.segs) {
        for (const segB of b.segs) {
          if (parallelSpliceSegmentsOverlap(segA, segB)) {
            hits.push(
              `${a.id.split("::")[0]?.slice(-24)} vs ${b.id.split("::")[0]?.slice(-24)} :: h@${segA.y.toFixed(0)} mid=${a.midX}/${b.midX}`,
            );
          }
        }
      }
    }
  }
  return { paths, hits };
}

describe("SP import SL/WH/GR/BR rendered horizontal overlap audit", () => {
  it("no stacked horizontal paths among watched fibers on import", () => {
    const ctx = ctxFromSp();
    const { paths, hits } = renderedHorizOverlaps(ctx);
    const overlap = findSpliceOverlapPair(ctx);
    const summary = paths.map((p) => ({
      fibers: p.id
        .split("::")
        .map((side) => side.split("|").slice(-2).join(""))
        .join("->"),
      midX: p.midX,
      horizCount: p.segs.length,
    }));
    expect(hits, JSON.stringify({ overlap, summary, hits }, null, 2)).toEqual(
      [],
    );
  });
});
