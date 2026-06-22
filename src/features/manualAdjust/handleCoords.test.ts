import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { Node } from "@xyflow/react";

import { buildConnectionGraph } from "@/features/diagram/buildConnectionGraph";
import { buildReactFlowGraph } from "@/features/diagram/buildReactFlowGraph";
import { buildVisualCablesForLayout } from "@/features/diagram/visualCables";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type { CableNodeData } from "@/features/canvas/nodes/types";

import { fiberAnchorCenter, fiberAnchorNodePosition } from "./handleCoords";

const legacyExamples = join(
  process.cwd(),
  "docs/reference/examples/old csv examples",
);

describe("fiberAnchorCenter", () => {
  it("matches buildNodesEngineGraph anchor positions for scaled cables", () => {
    const csv = readFileSync(
      join(legacyExamples, "CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { nodes } = buildReactFlowGraph(graph);
    const { visualCables } = buildVisualCablesForLayout(graph);
    const vcById = new Map(visualCables.map((vc) => [vc.id, vc]));

    const anchors = nodes.filter((n) => n.type === "fiberAnchor");
    expect(anchors.length).toBeGreaterThan(0);

    for (const anchor of anchors) {
      const data = anchor.data as {
        connectionId: string;
        visualCableId: string;
      };
      const cableNode = nodes.find(
        (n) => n.id === `cable-${data.visualCableId}`,
      ) as Node | undefined;
      const vc = vcById.get(data.visualCableId);
      expect(cableNode).toBeDefined();
      expect(vc).toBeDefined();
      if (!cableNode || !vc) continue;

      const center = fiberAnchorCenter(
        data.connectionId,
        data.visualCableId,
        vc,
        cableNode,
      );
      const scale = (cableNode.data as CableNodeData).diagramScale ?? 1;
      expect(anchor.position.x + 3).toBeCloseTo(center.x, 0);
      expect(anchor.position.y + 3).toBeCloseTo(center.y, 0);
      if (scale !== 1) {
        const defaultCenter = fiberAnchorCenter(
          data.connectionId,
          data.visualCableId,
          { ...vc, tubes: vc.tubes },
          {
            ...cableNode,
            data: { ...(cableNode.data as CableNodeData), diagramScale: 1 },
          },
        );
        expect(defaultCenter.x).not.toBeCloseTo(center.x, 0);
      }
    }
  });
});

describe("fiberAnchorNodePosition", () => {
  it("matches rendered fiberAnchor node top-left", () => {
    const csv = readFileSync(
      join(legacyExamples, "CSV Splice Detail Example #2.csv"),
      "utf8",
    );
    const graph = buildConnectionGraph(parseBentleyCsv(csv));
    const { nodes } = buildReactFlowGraph(graph);
    const anchor = nodes.find((n) => n.type === "fiberAnchor");
    expect(anchor).toBeDefined();
    if (!anchor) return;
    const data = anchor.data as {
      connectionId: string;
      visualCableId: string;
    };
    const cableNode = nodes.find(
      (n) => n.id === `cable-${data.visualCableId}`,
    )!;
    const vc = buildVisualCablesForLayout(graph).visualCables.find(
      (v) => v.id === data.visualCableId,
    )!;
    expect(anchor.position).toEqual(
      fiberAnchorNodePosition(data.connectionId, vc, cableNode, 6),
    );
  });
});
