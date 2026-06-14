import { describe, expect, it } from "vitest";

import { parseOrthogonalPathPoints } from "@/features/canvas/edges/splicePathGeometry";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { visualCableIdFromNodeId } from "@/features/diagram/cableDisplaySide";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import { readLeftCsv } from "@/testHelpers/leftCsvPaths";

import { handleCoordsForConnection } from "./handleCoords";
import {
  allowedSegmentAxes,
  legSegmentsFromPaths,
  routeTemplateForHandles,
  shiftVerticalLaneX,
} from "./legSegments";
import { syncManualVisualCable } from "./syncManualVisualCable";

const LEFT_CSVS = [
  "Left-SP-3254.5.csv",
  "Left-SPI-215_I-80.csv",
  "Left-STATE_OFFICE.csv",
] as const;

function diagSegs(path: string): string[] {
  const p = parseOrthogonalPathPoints(path);
  const out: string[] = [];
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1]!;
    const b = p[i]!;
    if (Math.abs(a.y - b.y) > 0.6 && Math.abs(a.x - b.x) > 0.6) {
      out.push(`(${a.x.toFixed(1)},${a.y.toFixed(1)})->(${b.x.toFixed(1)},${b.y.toFixed(1)})`);
    }
  }
  return out;
}

function reversals(path: string): string[] {
  const p = parseOrthogonalPathPoints(path);
  const out: string[] = [];
  for (let i = 2; i < p.length; i++) {
    const a = p[i - 2]!;
    const b = p[i - 1]!;
    const c = p[i]!;
    if (Math.abs(a.x - b.x) <= 0.5 && Math.abs(b.x - c.x) <= 0.5 && (a.y - b.y) * (b.y - c.y) < -0.01) {
      out.push(`V(${a.y.toFixed(0)}->${b.y.toFixed(0)}->${c.y.toFixed(0)})@x${b.x.toFixed(0)}`);
    }
    if (Math.abs(a.y - b.y) <= 0.5 && Math.abs(b.y - c.y) <= 0.5 && (a.x - b.x) * (b.x - c.x) < -0.01) {
      out.push(`H(${a.x.toFixed(0)}->${b.x.toFixed(0)}->${c.x.toFixed(0)})@y${b.y.toFixed(0)}`);
    }
  }
  return out;
}

describe("CHECKPOINT bug repro", () => {
  it("cable move — report reversals (90 hooks) + diagonals", () => {
    const problems: string[] = [];
    for (const csvFile of LEFT_CSVS) {
      const graph = buildConnectionGraph(parseBentleyCsv(readLeftCsv(csvFile)));
      const { nodes, edges } = buildReactFlowGraph(graph);
      for (const cable of nodes.filter((n) => n.type === "cable")) {
        const vcId = visualCableIdFromNodeId(cable.id);
        if (!vcId) continue;
        for (const mv of [{ x: 30, y: 24 }, { x: -30, y: -24 }, { x: 0, y: 40 }, { x: 0, y: 200 }]) {
          const moved = { ...cable, position: { x: cable.position.x + mv.x, y: cable.position.y + mv.y } };
          const res = syncManualVisualCable(nodes, edges, graph, vcId, moved);
          for (const connId of res.touchedConnections) {
            const le = res.edges.find((e) => e.id === `splice-left-${connId}`);
            if (!le) continue;
            const d = le.data as { leftPath?: string; rightPath?: string };
            const lp = String(d.leftPath ?? "");
            const rp = String(d.rightPath ?? "");
            const lEnd = parseOrthogonalPathPoints(lp).at(-1);
            const rStart = parseOrthogonalPathPoints(rp)[0];
            const detached =
              !!lEnd && !!rStart && (Math.abs(lEnd.x - rStart.x) > 0.5 || Math.abs(lEnd.y - rStart.y) > 0.5);
            if (detached) {
              problems.push(`${csvFile} ${vcId} ${connId} mv=${mv.x},${mv.y} DETACH Lend=${JSON.stringify(lEnd)} Rstart=${JSON.stringify(rStart)}`);
            }
            for (const which of ["leftPath", "rightPath"] as const) {
              const p = String(d[which] ?? "");
              const rev = reversals(p);
              const dg = diagSegs(p);
              if (rev.length || dg.length) {
                problems.push(`${csvFile} ${vcId} ${connId} mv=${mv.x},${mv.y} ${which} rev=${JSON.stringify(rev)} diag=${JSON.stringify(dg)}\n   ${p}`);
              }
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it("leg drag — report diagonals (broken 90)", () => {
    const problems: string[] = [];
    for (const csvFile of LEFT_CSVS) {
      const graph = buildConnectionGraph(parseBentleyCsv(readLeftCsv(csvFile)));
      const { nodes, edges } = buildReactFlowGraph(graph);
      for (const le of edges.filter((e) => e.id.startsWith("splice-left-"))) {
        const connId = le.id.replace(/^splice-left-/, "");
        const d = le.data as { leftPath?: string; rightPath?: string; spliceX?: number; spliceY?: number; fullButtSplice?: boolean };
        if (d.fullButtSplice) continue;
        const leftPath = String(d.leftPath ?? "");
        const rightPath = String(d.rightPath ?? "");
        if (!leftPath || !rightPath) continue;
        const handles = handleCoordsForConnection(connId, nodes, graph);
        if (!handles) continue;
        const template = routeTemplateForHandles(handles.source.x, handles.source.y, handles.target.x, handles.target.y);
        const { left, right } = legSegmentsFromPaths(leftPath, rightPath);
        const sx = Number(d.spliceX ?? NaN);
        const sy = Number(d.spliceY ?? NaN);
        const splice = Number.isFinite(sx) && Number.isFinite(sy) ? { x: sx, y: sy } : undefined;
        for (const side of ["left", "right"] as const) {
          const segs = side === "left" ? left : right;
          for (const seg of segs) {
            if (!allowedSegmentAxes(template, side, seg, segs.length, splice).includes("horizontal")) continue;
            for (const delta of [40, -40]) {
              const p = side === "left" ? leftPath : rightPath;
              const shifted = shiftVerticalLaneX(p, seg.index, delta);
              const dg = diagSegs(shifted);
              const rev = reversals(shifted);
              const inPts = parseOrthogonalPathPoints(p);
              const outPts = parseOrthogonalPathPoints(shifted);
              const inF = inPts[0], inL = inPts.at(-1);
              const outF = outPts[0], outL = outPts.at(-1);
              const movedEnd =
                !!inF && !!outF && !!inL && !!outL &&
                (Math.abs(inF.x - outF.x) > 0.5 || Math.abs(inF.y - outF.y) > 0.5 ||
                  Math.abs(inL.x - outL.x) > 0.5 || Math.abs(inL.y - outL.y) > 0.5);
              if (dg.length || rev.length || movedEnd) {
                problems.push(`${csvFile} ${connId} ${side} idx=${seg.index} d=${delta} diag=${JSON.stringify(dg)} rev=${JSON.stringify(rev)} movedEnd=${movedEnd}\n   in=${p}\n   out=${shifted}`);
              }
            }
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
