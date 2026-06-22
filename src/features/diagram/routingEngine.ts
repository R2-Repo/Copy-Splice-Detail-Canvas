/** Build-time and per-diagram routing backend selection. */
export type RoutingEngineMode = "legacy" | "nodes" | "grid";

/** Default production path — grid (parity goldens in gridRouter.test.ts). */
export const ROUTING_ENGINE: RoutingEngineMode = "grid";

/** Escape hatch: set VITE_ROUTING_ENGINE=nodes or per-diagram `routingEngine: "nodes"`. */
export const NODES_ENGINE_ESCAPE = "nodes" as const;

export function routingEngineMode(
  overrides?: { routingEngine?: RoutingEngineMode },
): RoutingEngineMode {
  const env = import.meta.env.VITE_ROUTING_ENGINE as RoutingEngineMode | undefined;
  return overrides?.routingEngine ?? env ?? ROUTING_ENGINE;
}

/** Center-lane routing (nodes snap packer or grid reservation) — not legacy composite edges. */
export function useNodesRoutingEngine(
  overrides?: { routingEngine?: RoutingEngineMode },
): boolean {
  const mode = routingEngineMode(overrides);
  return mode === NODES_ENGINE_ESCAPE || mode === "grid";
}

export function useLegacyRoutingEngine(
  overrides?: { routingEngine?: RoutingEngineMode },
): boolean {
  return routingEngineMode(overrides) === "legacy";
}

export function useGridRoutingEngine(
  overrides?: { routingEngine?: RoutingEngineMode },
): boolean {
  return routingEngineMode(overrides) === "grid";
}
