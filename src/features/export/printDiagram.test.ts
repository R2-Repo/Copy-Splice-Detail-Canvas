import type { Node } from "@xyflow/react";
import { describe, expect, it, vi } from "vitest";

import type { ConnectionGraph } from "@/types/splice";

import {
  boundsFromNodesOrNull,
  createPrintDiagramHandler,
  exportTitleFromGraph,
  flushRenderFrames,
  injectPrintPageStyle,
  PRINT_BODY_CLASS,
  PRINT_PAGE_STYLE_ID,
  printableAreaCssPx,
  printViewportForBounds,
  removePrintPageStyle,
  runDiagramPrint,
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

function buildPrintDeps() {
  const setViewport = vi.fn().mockResolvedValue(true);
  const print = vi.fn();
  const listeners = new Map<string, EventListener>();
  const stage = document.createElement("div");
  const dispatchResize = vi.fn();
  const dispatchBeforePrint = vi.fn();
  const nodes = [
    {
      id: "cable-1",
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      data: {},
    },
  ] as Node[];

  return {
    setViewport,
    print,
    stage,
    dispatchResize,
    dispatchBeforePrint,
    listeners,
    deps: {
      nodes,
      graph: graphWithHeader({ spliceNumber: "SP-TEST" }),
      getStageElement: () => stage,
      getViewport: () => ({ x: 5, y: 10, zoom: 0.8 }),
      setViewport,
      getNodesBounds: () => ({ x: 0, y: 0, width: 500, height: 300 }),
      getNodes: () => nodes,
      print,
      dispatchResize,
      dispatchBeforePrint,
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        cb(0);
        return 1;
      },
      addEventListener: ((type: string, listener: EventListenerOrEventListenerObject) => {
        listeners.set(type, listener as EventListener);
      }) as typeof window.addEventListener,
      removeEventListener: ((type: string) => {
        listeners.delete(type);
      }) as typeof window.removeEventListener,
    },
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

describe("printableAreaCssPx", () => {
  it("derives tabloid landscape printable area from margins", () => {
    expect(printableAreaCssPx()).toEqual({ width: 1536, height: 960 });
  });
});

describe("printViewportForBounds", () => {
  it("fits diagram on tabloid printable area centered", () => {
    const { width, height } = printableAreaCssPx();
    const viewport = printViewportForBounds({
      x: 0,
      y: 0,
      width: 1000,
      height: 800,
    });

    const contentW = 1000 * viewport.zoom;
    const contentH = 800 * viewport.zoom;
    expect(viewport.x).toBeCloseTo((width - contentW) / 2, 1);
    expect(viewport.y).toBeCloseTo((height - contentH) / 2, 1);
  });
});

describe("flushRenderFrames", () => {
  it("waits for the requested animation frame count", async () => {
    let frames = 0;
    await flushRenderFrames((cb) => {
      frames += 1;
      cb(0);
      return frames;
    }, 2);
    expect(frames).toBe(2);
  });
});

describe("print page style injection", () => {
  it("injects and removes tabloid @page rules", () => {
    injectPrintPageStyle();
    const style = document.getElementById(PRINT_PAGE_STYLE_ID);
    expect(style?.textContent).toContain("tabloid landscape");

    removePrintPageStyle();
    expect(document.getElementById(PRINT_PAGE_STYLE_ID)).toBeNull();
  });
});

describe("runDiagramPrint", () => {
  it("locks print scale, sizes stage, and restores on afterprint", async () => {
    const {
      deps,
      print,
      setViewport,
      stage,
      dispatchResize,
      dispatchBeforePrint,
      listeners,
    } = buildPrintDeps();
    const { width, height } = printableAreaCssPx();

    document.title = "Original title";
    await runDiagramPrint(deps);

    expect(dispatchBeforePrint).toHaveBeenCalledTimes(1);
    expect(dispatchResize).toHaveBeenCalledTimes(1);
    expect(stage.style.width).toBe(`${width}px`);
    expect(stage.style.height).toBe(`${height}px`);
    expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(true);
    expect(document.title).toBe("SP-TEST");
    expect(setViewport).toHaveBeenCalledTimes(1);
    expect(print).toHaveBeenCalledTimes(1);

    listeners.get("afterprint")?.(new Event("afterprint"));

    expect(document.body.classList.contains(PRINT_BODY_CLASS)).toBe(false);
    expect(document.title).toBe("Original title");
    expect(stage.style.width).toBe("");
    expect(setViewport).toHaveBeenCalledWith(
      { x: 5, y: 10, zoom: 0.8 },
      { duration: 0 },
    );
  });
});

describe("createPrintDiagramHandler", () => {
  it("delegates to runDiagramPrint", async () => {
    const { deps, print } = buildPrintDeps();
    createPrintDiagramHandler(deps)();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(print).toHaveBeenCalledTimes(1);
  });
});
