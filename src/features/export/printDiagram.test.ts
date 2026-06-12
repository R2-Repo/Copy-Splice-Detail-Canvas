import type { Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import type { ConnectionGraph } from "@/types/splice";

import {
  boundsFromNodesOrNull,
  createPrintDiagramHandler,
  exportTitleFromGraph,
  PRINT_BODY_CLASS,
  printViewportForBounds,
} from "./printDiagram";

function graphWithHeader(
  header: { spliceNumber?: string; name?: string },
): ConnectionGraph {
  return {
    report: { header, pairs: [], cableAppearances: [] },
    legs: [],
    connections: [],
    cableSides: new Map(),
  };
}

describe("exportTitleFromGraph", () => {
  it("prefers splice number over name", () => {
    expect(
      exportTitleFromGraph(
        graphWithHeader({ spliceNumber: "SP-3022.4", name: "Enclosure A" }),
      ),
    ).toBe("SP-3022.4");
  });

  it("falls back to name then default", () => {
    expect(exportTitleFromGraph(graphWithHeader({ name: "Enclosure A" }))).toBe(
      "Enclosure A",
    );
    expect(exportTitleFromGraph(null)).toBe("Splice detail");
  });
});

describe("boundsFromNodesOrNull", () => {
  it("returns null for empty nodes", () => {
    expect(boundsFromNodesOrNull([], () => null)).toBeNull();
  });

  it("uses getNodesBounds when available", () => {
    const nodes = [{ id: "a", position: { x: 0, y: 0 }, data: {} }] as Node[];
    const bounds = boundsFromNodesOrNull(nodes, () => ({
      x: 10,
      y: 20,
      width: 100,
      height: 50,
    }));
    expect(bounds).toEqual({ x: 10, y: 20, width: 100, height: 50 });
  });
});

describe("printViewportForBounds", () => {
  it("fits diagram width with max zoom 1", () => {
    const viewport = printViewportForBounds(
      { x: 0, y: 0, width: 1000, height: 800 },
      1200,
      900,
    );

    expect(viewport.zoom).toBeLessThanOrEqual(1);
    expect(viewport.x).toBeGreaterThan(0);
    expect(viewport.y).toBeGreaterThan(0);
  });
});

describe("createPrintDiagramHandler", () => {
  it("prepares print state and restores on afterprint", async () => {
    const setViewport = vi.fn().mockResolvedValue(true);
    const print = vi.fn();
    const listeners = new Map<string, EventListener>();

    const handler = createPrintDiagramHandler({
      nodes: [
        {
          id: "cable-1",
          position: { x: 0, y: 0 },
          width: 200,
          height: 100,
          data: {},
        },
      ] as Node[],
      graph: graphWithHeader({ spliceNumber: "SP-TEST" }),
      stageWidth: 1200,
      stageHeight: 800,
      getViewport: () => ({ x: 5, y: 10, zoom: 0.8 }),
      setViewport,
      getNodesBounds: () => ({ x: 0, y: 0, width: 500, height: 300 }),
      print,
      requestAnimationFrame: (cb) => {
        cb(0);
        return 1;
      },
      addEventListener: (type, listener) => {
        listeners.set(type, listener as EventListener);
      },
      removeEventListener: (type) => {
        listeners.delete(type);
      },
    });

    document.title = "Original title";
    handler();

    expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(true);
    expect(document.title).toBe("SP-TEST");
    expect(setViewport).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);

    listeners.get("afterprint")?.(new Event("afterprint"));

    expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(false);
    expect(document.title).toBe("Original title");
    expect(setViewport).toHaveBeenCalledWith(
      { x: 5, y: 10, zoom: 0.8 },
      { duration: 0 },
    );
  });
});
