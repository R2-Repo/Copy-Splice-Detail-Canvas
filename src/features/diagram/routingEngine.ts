/** Build-time and per-diagram routing backend selection. */
export type RoutingEngineMode = "legacy" | "nodes" | "grid";

/** Default production path until grid contract fully green. */
export const ROUTING_ENGINE: RoutingEngineMode = "nodes";

export function routingEngineMode(
  overrides?: { routingEngine?: RoutingEngineMode },
): RoutingEngineMode {
  const env = import.meta.env.VITE_ROUTING_ENGINE as RoutingEngineMode | undefined;
  return overrides?.routingEngine ?? env ?? ROUTING_ENGINE;
}

export function useNodesRoutingEngine(
  overrides?: { routingEngine?: RoutingEngineMode },
): boolean {
  const mode = routingEngineMode(overrides);
  return mode === "nodes" || mode === "grid";
}

export function useGridRoutingEngine(
  overrides?: { routingEngine?: RoutingEngineMode },
): boolean {
  return routingEngineMode(overrides) === "grid";
}
