import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  assignSpliceRoutingLanesFromHandleEntries,
  assignSpliceRoutingLanesFromLiveHandles,
  buildSpliceHandleEntries,
  buildSplicePath,
  bundleMidOrderInverts,
  hvDemarcatedPathsCross,
  reconcileBundleJogXForRender,
  routingMidXForRender,
  spliceMidOrderInverts,
} from "@/features/canvas/edges/spliceEdgeRouting";
import { buildConnectionGraph } from "./buildConnectionGraph";
import { buildLayoutRuleContext } from "./layoutRules";
import { parseBentleyCsv } from "@/features/import/parseBentleyCsv";
import type { FiberConnection } from "@/types/splice";

function fiberConns(
  graph: ReturnType<typeof buildConnectionGraph>,
  pred: (c: FiberConnection) => boolean,
): FiberConnection[] {
  return graph.connections.filter(
    (c): c is FiberConnection => c.kind === "fiber" && pred(c),
  );
}

describe("visual QA — 3161.4 BL tube cross-side bundle", () => {
  const csv = readFileSync(
    join(process.cwd(), "docs/reference/examples/3161.4.csv"),
    "utf8",
  );
  const graph = buildConnectionGraph(parseBentleyCsv(csv));
  const ctx = buildLayoutRuleContext(graph);
  const { nodes, edges } = ctx.reactFlow;

  function blTubeMembers(maxFiber = 12) {
    return fiberConns(
      graph,
      (c) =>
        c.pair.endpointA.tubeColor === "BL" &&
        c.pair.endpointA.fiberNumber >= 1 &&
        c.pair.endpointA.fiberNumber <= maxFiber &&
        c.pair.endpointA.cable.includes("1230"),
    );
  }

  function lanesForFullGraph() {
    const entries = buildSpliceHandleEntries(nodes, edges, ctx.visualCables);
    const importRouting = assignSpliceRoutingLanesFromHandleEntries(
      entries,
      ctx.layoutWidth / 2,
    );
    return { entries, importRouting };
  }

  it("BL 1-12 share one tubeBundleKey", () => {
    const members = blTubeMembers(12);
    const keys = new Set(
      members.map(
        (c) =>
          (edges.find((e) => e.id === `splice-${c.id}`)?.data as {
            tubeBundleKey?: string;
          })?.tubeBundleKey,
      ),
    );
    expect([...keys]).toHaveLength(1);
  });

  it("BL 1-12: reports per-fiber invert uniformity", () => {
    const members = blTubeMembers(12);
    expect(members.length).toBe(12);
    const entries = buildSpliceHandleEntries(nodes, edges, ctx.visualCables);
    const ids = new Set(members.map((c) => c.id));
    const subset = entries.filter((e) => ids.has(e.id.replace("splice-", "")));
    const inverts = subset.map((e) =>
      spliceMidOrderInverts(e.sourceX, e.sourceY, e.targetX, e.targetY),
    );
    const uniform = new Set(inverts).size === 1;
    expect(
      bundleMidOrderInverts(
        subset.map((e) => ({
          id: e.id,
          sourceX: e.sourceX,
          sourceY: e.sourceY,
          targetX: e.targetX,
          targetY: e.targetY,
          rowOffset: e.rowOffset ?? 0,
          tubeBundleKey: e.tubeBundleKey,
        })),
      ),
    ).toBe(true);
    expect(uniform).toBe(true);
  });

  it("BL 1-12 full-graph import lanes: top outermost midX, no within-bundle crossing", () => {
    const members = blTubeMembers(12);
    const { importRouting } = lanesForFullGraph();
    const ordered = [...members].sort(
      (a, b) => a.pair.endpointA.fiberNumber - b.pair.endpointA.fiberNumber,
    );
    const entries = buildSpliceHandleEntries(nodes, edges, ctx.visualCables);
    const mids = ordered.map((c) => importRouting.get(`splice-${c.id}`)!.midX);

    expect(mids[0]).toBeGreaterThan(mids[mids.length - 1]!);
    for (let i = 1; i < mids.length; i++) {
      expect(mids[i - 1]! - mids[i]!).toBeGreaterThanOrEqual(23);
    }

    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const a = entries.find((e) => e.id === `splice-${ordered[i]!.id}`)!;
        const b = entries.find((e) => e.id === `splice-${ordered[j]!.id}`)!;
        const la = importRouting.get(a.id)!;
        const lb = importRouting.get(b.id)!;
        expect(
          hvDemarcatedPathsCross(
            a.sourceX,
            a.sourceY,
            a.targetX,
            a.targetY,
            la.midX,
            b.sourceX,
            b.sourceY,
            b.targetX,
            b.targetY,
            lb.midX,
            la.jogX,
            lb.jogX,
          ),
        ).toBe(false);
      }
    }
  });

  it("BL 1-12 full-import edges store descending midX", () => {
    const members = blTubeMembers(12);
    const ordered = [...members].sort(
      (a, b) => a.pair.endpointA.fiberNumber - b.pair.endpointA.fiberNumber,
    );
    const stored = ordered.map(
      (c) =>
        (edges.find((e) => e.id === `splice-${c.id}`)?.data as {
          routingMidX?: number;
        })?.routingMidX ?? NaN,
    );
    expect(stored[0]).toBeGreaterThan(stored[stored.length - 1]!);
  });

  it("BL 1-12 render midX preserves descending order after inset clamp", () => {
    const members = blTubeMembers(12);
    const ordered = [...members].sort(
      (a, b) => a.pair.endpointA.fiberNumber - b.pair.endpointA.fiberNumber,
    );
    const entries = buildSpliceHandleEntries(nodes, edges, ctx.visualCables);
    const rendered = ordered.map((c) => {
      const edge = edges.find((e) => e.id === `splice-${c.id}`)!;
      const entry = entries.find((e) => e.id === edge.id)!;
      const data = edge.data as { routingMidX?: number; diagramCenterX?: number };
      return routingMidXForRender(
        data.routingMidX!,
        entry.sourceX,
        entry.targetX,
        data.diagramCenterX ?? ctx.layoutWidth / 2,
        entry.sideCircuitSpan ?? { left: 66, right: 66 },
        entry.sourceTagWidth ?? 0,
        entry.targetTagWidth ?? 0,
      );
    });
    expect(rendered[0]).toBeGreaterThan(rendered[rendered.length - 1]!);
  });

  it("BL 1-12 full-import render paths do not cross within bundle", () => {
    const members = blTubeMembers(12);
    const ordered = [...members].sort(
      (a, b) => a.pair.endpointA.fiberNumber - b.pair.endpointA.fiberNumber,
    );
    const entries = buildSpliceHandleEntries(nodes, edges, ctx.visualCables);
    const paths = ordered.map((c) => {
      const edge = edges.find((e) => e.id === `splice-${c.id}`)!;
      const entry = entries.find((e) => e.id === edge.id)!;
      const data = edge.data as {
        routingMidX?: number;
        routingJogX?: number;
        diagramCenterX?: number;
      };
      const midX = routingMidXForRender(
        data.routingMidX!,
        entry.sourceX,
        entry.targetX,
        data.diagramCenterX ?? ctx.layoutWidth / 2,
        entry.sideCircuitSpan ?? { left: 66, right: 66 },
        entry.sourceTagWidth ?? 0,
        entry.targetTagWidth ?? 0,
      );
      return {
        entry,
        midX,
        jogX: data.routingJogX,
        path: buildSplicePath(
          entry.sourceX,
          entry.sourceY,
          entry.targetX,
          entry.targetY,
          midX,
          data.routingJogX,
          undefined,
          entry.sideCircuitSpan ?? { left: 66, right: 66 },
          data.diagramCenterX ?? ctx.layoutWidth / 2,
          entry.sourceTagWidth ?? 0,
          entry.targetTagWidth ?? 0,
        ),
      };
    });

    for (let i = 0; i < paths.length; i++) {
      for (let j = i + 1; j < paths.length; j++) {
        const a = paths[i]!;
        const b = paths[j]!;
        expect(
          hvDemarcatedPathsCross(
            a.entry.sourceX,
            a.entry.sourceY,
            a.entry.targetX,
            a.entry.targetY,
            a.midX,
            b.entry.sourceX,
            b.entry.sourceY,
            b.entry.targetX,
            b.entry.targetY,
            b.midX,
            a.jogX,
            b.jogX,
          ),
        ).toBe(false);
      }
    }
  });

  it("BL 1-12 keeps descending midX after simulated cable Y drag", () => {
    const members = blTubeMembers(12);
    const ordered = [...members].sort(
      (a, b) => a.pair.endpointA.fiberNumber - b.pair.endpointA.fiberNumber,
    );
    const blEdge = edges.find((e) => e.id === `splice-${ordered[0]!.id}`)!;
    const cableNodeId = blEdge.source.includes("1230")
      ? blEdge.source
      : blEdge.target;
    const shiftedNodes = nodes.map((n) =>
      n.id === cableNodeId
        ? { ...n, position: { ...n.position, y: n.position.y + 48 } }
        : n,
    );
    const entries = buildSpliceHandleEntries(
      shiftedNodes,
      edges,
      ctx.visualCables,
    );
    const { lanes } = assignSpliceRoutingLanesFromLiveHandles(
      entries,
      ctx.layoutWidth / 2,
    );
    const mids = ordered.map((c) => lanes.get(`splice-${c.id}`)!.midX);
    expect(mids[0]).toBeGreaterThan(mids[mids.length - 1]!);
    for (let i = 1; i < mids.length; i++) {
      expect(mids[i - 1]! - mids[i]!).toBeGreaterThanOrEqual(23);
    }
  });

  it("BL 1-2 render paths do not backtrack on source horizontals", () => {
    const members = blTubeMembers(2);
    const ordered = [...members].sort(
      (a, b) => a.pair.endpointA.fiberNumber - b.pair.endpointA.fiberNumber,
    );
    const entries = buildSpliceHandleEntries(nodes, edges, ctx.visualCables);
    const centerX = ctx.layoutWidth / 2;
    for (const conn of ordered) {
      const edge = edges.find((e) => e.id === `splice-${conn.id}`)!;
      const entry = entries.find((e) => e.id === edge.id)!;
      const data = edge.data as {
        routingMidX?: number;
        routingJogX?: number;
        diagramCenterX?: number;
      };
      const renderMidX = routingMidXForRender(
        data.routingMidX!,
        entry.sourceX,
        entry.targetX,
        data.diagramCenterX ?? centerX,
        entry.sideCircuitSpan ?? { left: 66, right: 66 },
        entry.sourceTagWidth ?? 0,
        entry.targetTagWidth ?? 0,
      );
      const renderJogX = reconcileBundleJogXForRender(
        renderMidX,
        data.routingJogX,
        entry.sourceX,
        data.diagramCenterX ?? centerX,
      );
      const { leftPath } = buildSplicePath(
        entry.sourceX,
        entry.sourceY,
        entry.targetX,
        entry.targetY,
        renderMidX,
        renderJogX,
        undefined,
        entry.sideCircuitSpan ?? { left: 66, right: 66 },
        data.diagramCenterX ?? centerX,
        entry.sourceTagWidth ?? 0,
        entry.targetTagWidth ?? 0,
      );
      const horizTokens = leftPath.match(/L ([\d.]+),([\d.]+)/g) ?? [];
      const sameRowXs: number[] = [];
      for (const token of horizTokens) {
        const match = token.match(/L ([\d.]+),([\d.]+)/);
        if (!match) continue;
        const x = Number(match[1]);
        const y = Number(match[2]);
        if (Math.abs(y - entry.sourceY) > 0.5) break;
        sameRowXs.push(x);
      }
      const inward = entry.sourceX <= (data.diagramCenterX ?? centerX) ? 1 : -1;
      for (let i = 1; i < sameRowXs.length; i++) {
        const delta = sameRowXs[i]! - sameRowXs[i - 1]!;
        expect(inward > 0 ? delta : -delta).toBeGreaterThan(-0.01);
      }
    }
  });
});
