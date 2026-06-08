import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CABLE_LAYOUT,
  cableNodeLayoutHeight,
} from "@/features/diagram/cableLayoutMetrics";
import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";

function cableBoxesOverlap(
  a: { y: number; height: number },
  b: { y: number; height: number },
): boolean {
  return a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("SPI-215 stub stack spacing", () => {
  const graph = buildConnectionGraph(
    parseBentleyCsv(
      readFileSync(
        join(process.cwd(), "docs/reference/examples/SPI-215_I-80.csv"),
        "utf8",
      ),
    ),
  );

  it("12-SMF ORANGE ST and CONNEXT TIE never overlap", () => {
    const { nodes } = buildReactFlowGraph(graph);
    const stubs = nodes.filter(
      (n) =>
        /ORANGE ST/i.test(String(n.data.label)) ||
        /CONNEXT TIE/i.test(String(n.data.label)),
    );
    expect(stubs).toHaveLength(2);

    const scale = Number(stubs[0]!.data.diagramScale ?? 1);
    const boxes = stubs.map((n) => {
      const vcSide = n.data.side as "left" | "right";
      const tubes = n.data.tubes as import("@/features/diagram/visualCables").VisualCable["tubes"];
      return {
        label: String(n.data.label).slice(0, 30),
        y: n.position.y,
        height: cableNodeLayoutHeight(
          {
            id: "",
            legId: "",
            device: "",
            cable: String(n.data.label),
            side: vcSide,
            order: 0,
            tubes,
          },
          scale,
        ),
      };
    });
    boxes.sort((a, b) => a.y - b.y);
    expect(cableBoxesOverlap(boxes[0]!, boxes[1]!)).toBe(false);
    const gap = boxes[1]!.y - (boxes[0]!.y + boxes[0]!.height);
    expect(gap).toBeGreaterThanOrEqual(CABLE_LAYOUT.cableGap - 1);
  });

  it("repairs stale saved Y positions that overlap", () => {
    const { nodes: autoNodes } = buildReactFlowGraph(graph);
    const stubIds = autoNodes
      .filter(
        (n) =>
          /ORANGE ST/i.test(String(n.data.label)) ||
          /CONNEXT TIE/i.test(String(n.data.label)),
      )
      .map((n) => n.id);

    const { nodes } = buildReactFlowGraph(graph, {
      reportKey: "test",
      layoutVersion: 10,
      positions: Object.fromEntries(stubIds.map((id) => [id, { x: 900, y: 2600 }])),
    });

    const stubNodes = nodes.filter((n) => stubIds.includes(n.id));
    expect(stubNodes).toHaveLength(2);
    const ys = stubNodes.map((n) => n.position.y).sort((a, b) => a - b);
    expect(ys[1]! - ys[0]!).toBeGreaterThan(0);
  });
});
