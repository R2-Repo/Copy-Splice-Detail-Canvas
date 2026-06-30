import type { LayoutSide } from "@/features/layoutSearch/layoutCandidate";

/** Dev-only side-drag trace (`VITE_DEBUG_SIDE_DRAG=1` in `.env.local`). */
export function debugSideDragEnabled(): boolean {
  return (
    import.meta.env.DEV === true &&
    import.meta.env.VITE_DEBUG_SIDE_DRAG === "1"
  );
}

export type SideDragLogContext = {
  phase: "preview" | "commit" | "detect" | "bounds";
  visualId?: string;
  nodeId?: string;
  drag?: { x: number; y: number };
  currentSide?: LayoutSide;
  newSide?: LayoutSide;
  sideChanged?: boolean;
  layoutMode?: string;
  bounds?: Record<string, number>;
  resolved?: { x: number; y: number };
  nodeCount?: number;
  note?: string;
};

export function logSideDrag(label: string, ctx: SideDragLogContext): void {
  if (!debugSideDragEnabled()) return;
  console.info(`[side-drag] ${label}`, ctx);
}
