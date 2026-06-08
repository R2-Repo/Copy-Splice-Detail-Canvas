/** Build-time routing backend — flip to `nodes` once goldens + visual parity hold. */
export type RoutingEngineMode = "legacy" | "nodes";

export const ROUTING_ENGINE: RoutingEngineMode = "nodes";

export function useNodesRoutingEngine(): boolean {
  return ROUTING_ENGINE === "nodes";
}
