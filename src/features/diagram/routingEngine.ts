/** Build-time and per-diagram routing backend selection. */
export type RoutingEngineMode = "composite" | "nodes" | "grid";

/** @deprecated Saved configs may still use `"legacy"`. */
export type LegacyRoutingEngineMode = "legacy" | RoutingEngineMode;

/** Default production path — grid (parity goldens in gridRouter.test.ts). */
export const ROUTING_ENGINE: RoutingEngineMode = "grid";

/** Escape hatch: set VITE_ROUTING_ENGINE=nodes or per-diagram `routingEngine: "nodes"`. */
export const NODES_ENGINE_ESCAPE = "nodes" as const;

export function normalizeRoutingEngineMode(
  mode?: LegacyRoutingEngineMode | string,
): RoutingEngineMode | undefined {
  if (!mode) return undefined;
  if (mode === "legacy") return "composite";
  if (mode === "composite" || mode === "nodes" || mode === "grid") return mode;
  return undefined;
}

export function routingEngineMode(
  overrides?: { routingEngine?: LegacyRoutingEngineMode },
): RoutingEngineMode {
  const env = normalizeRoutingEngineMode(
    import.meta.env.VITE_ROUTING_ENGINE as string | undefined,
  );
  return (
    normalizeRoutingEngineMode(overrides?.routingEngine) ?? env ?? ROUTING_ENGINE
  );
}

/** Center-lane routing (nodes snap packer or grid reservation) — not composite splice edges. */
export function useNodesRoutingEngine(
  overrides?: { routingEngine?: LegacyRoutingEngineMode },
): boolean {
  const mode = routingEngineMode(overrides);
  return mode === NODES_ENGINE_ESCAPE || mode === "grid";
}

export function useCompositeRoutingEngine(
  overrides?: { routingEngine?: LegacyRoutingEngineMode },
): boolean {
  return routingEngineMode(overrides) === "composite";
}

/** @deprecated Use `useCompositeRoutingEngine`. */
export const useLegacyRoutingEngine = useCompositeRoutingEngine;

export function useGridRoutingEngine(
  overrides?: { routingEngine?: LegacyRoutingEngineMode },
): boolean {
  return routingEngineMode(overrides) === "grid";
}
