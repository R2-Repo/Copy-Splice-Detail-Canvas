import type { SpliceHandleEntry, SpliceRoutingLane } from "@/features/diagram/centerRouter";
import type {
  BundleOverride,
  ConnectionOverride,
  LayoutOverrides,
} from "@/types/splice";

import type { ConnectionLegOverrides } from "./types";

/** Parameter-based routing offset per fiber connection (Phase 5). */
export type { ConnectionOverride, BundleOverride };

function sumSegmentAxis(
  segments: Record<number, { dx?: number; dy?: number }> | undefined,
  axis: "dx" | "dy",
): number {
  if (!segments) return 0;
  let total = 0;
  for (const patch of Object.values(segments)) {
    total += patch[axis] ?? 0;
  }
  return total;
}

/** Derive parameter overrides from legacy segment-index leg overrides. */
export function connectionOverrideFromLeg(
  leg?: ConnectionLegOverrides,
): ConnectionOverride | undefined {
  if (!leg) return undefined;
  const laneOffsetX =
    sumSegmentAxis(leg.leftSegments, "dx") +
    sumSegmentAxis(leg.rightSegments, "dx");
  const spliceRowOffsetY =
    sumSegmentAxis(leg.leftSegments, "dy") +
    sumSegmentAxis(leg.rightSegments, "dy");
  const out: ConnectionOverride = {};
  if (Math.abs(laneOffsetX) > 0.5) out.laneOffsetX = laneOffsetX;
  if (Math.abs(spliceRowOffsetY) > 0.5) out.spliceRowOffsetY = spliceRowOffsetY;
  if (leg.dotShiftX != null && Math.abs(leg.dotShiftX) > 0.5) {
    out.dotOffsetX = leg.dotShiftX;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Merge stored connection overrides with bridged leg fields (stored wins per key). */
export function effectiveConnectionOverrides(
  overrides?: Pick<
    LayoutOverrides,
    "connectionOverrides" | "legOverrides"
  >,
): Map<string, ConnectionOverride> {
  const out = new Map<string, ConnectionOverride>();
  if (!overrides) return out;

  for (const [connId, leg] of Object.entries(overrides.legOverrides ?? {})) {
    const bridged = connectionOverrideFromLeg(leg);
    if (bridged) out.set(connId, { ...bridged });
  }
  for (const [connId, stored] of Object.entries(
    overrides.connectionOverrides ?? {},
  )) {
    out.set(connId, { ...out.get(connId), ...stored });
  }
  return out;
}

/** Dual-write connection params from committed leg overrides. */
export function syncConnectionOverridesFromLegs(
  legs?: LayoutOverrides["legOverrides"],
  existing?: LayoutOverrides["connectionOverrides"],
): LayoutOverrides["connectionOverrides"] | undefined {
  if (!legs || Object.keys(legs).length === 0) return existing;
  const next: Record<string, ConnectionOverride> = { ...(existing ?? {}) };
  for (const [connId, leg] of Object.entries(legs)) {
    const derived = connectionOverrideFromLeg(leg);
    if (derived) next[connId] = { ...next[connId], ...derived };
    else delete next[connId];
  }
  return Object.keys(next).length ? next : undefined;
}

/** Bridge leg → connection on load when connection map is absent for a conn id. */
export function normalizeLayoutOverridesOnLoad(
  overrides: LayoutOverrides,
): LayoutOverrides {
  const synced = syncConnectionOverridesFromLegs(
    overrides.legOverrides,
    overrides.connectionOverrides,
  );
  if (synced === overrides.connectionOverrides) return overrides;
  return { ...overrides, connectionOverrides: synced };
}

function connectionIdFromLaneEdgeId(edgeId: string): string {
  return edgeId
    .replace(/^splice-left-/, "")
    .replace(/^splice-right-/, "")
    .replace(/^splice-/, "")
    .replace(/^butt-/, "");
}

/** Apply lane / bundle parameter offsets before path precompute. Manual mode only. */
export function applyRoutingParameterOverrides(
  lanes: Map<string, SpliceRoutingLane>,
  entries: SpliceHandleEntry[],
  overrides?: Pick<
    LayoutOverrides,
    | "connectionOverrides"
    | "bundleOverrides"
    | "legOverrides"
    | "autoAdjustEnabled"
  >,
): Map<string, SpliceRoutingLane> {
  if (overrides?.autoAdjustEnabled !== false) return lanes;

  const connOverrides = effectiveConnectionOverrides(overrides);
  const bundleOverrides = overrides?.bundleOverrides;
  if (!connOverrides.size && !bundleOverrides) return lanes;

  const entryByEdgeId = new Map(entries.map((e) => [e.id, e]));
  const next = new Map(lanes);

  for (const [edgeId, lane] of lanes) {
    const connId = connectionIdFromLaneEdgeId(edgeId);
    const conn = connOverrides.get(connId);
    const entry = entryByEdgeId.get(edgeId);
    const bundle = entry?.tubeBundleKey
      ? bundleOverrides?.[entry.tubeBundleKey]
      : undefined;

    let midX = lane.midX;
    let jogX = lane.jogX;
    if (conn?.laneOffsetX) {
      midX += conn.laneOffsetX;
      if (jogX != null) jogX += conn.laneOffsetX;
    }
    if (bundle?.laneOffsetX) {
      midX += bundle.laneOffsetX;
      if (jogX != null) jogX += bundle.laneOffsetX;
    }

    if (midX !== lane.midX || jogX !== lane.jogX) {
      next.set(edgeId, {
        ...lane,
        midX,
        ...(jogX !== undefined ? { jogX } : {}),
      });
    }
  }

  return next;
}

/** Resolve leg apply payload: segment detail from legOverrides, else dot from connectionOverrides. */
export function legOverridesForConnectionApply(
  connId: string,
  overrides?: Pick<
    LayoutOverrides,
    "legOverrides" | "connectionOverrides"
  >,
): ConnectionLegOverrides | undefined {
  const leg = overrides?.legOverrides?.[connId];
  const conn = effectiveConnectionOverrides(overrides).get(connId);

  const hasSegmentDetail =
    leg &&
    ((leg.leftSegments && Object.keys(leg.leftSegments).length > 0) ||
      (leg.rightSegments && Object.keys(leg.rightSegments).length > 0));

  if (hasSegmentDetail) return leg;

  if (conn?.dotOffsetX != null) {
    return { dotShiftX: conn.dotOffsetX };
  }
  if (leg?.dotShiftX != null) return { dotShiftX: leg.dotShiftX };
  return undefined;
}

/** Drop per-connection routing overrides after cable side flip (paths are invalid). */
export function stripRoutingOverridesForConnections(
  overrides: Pick<
    LayoutOverrides,
    "legOverrides" | "connectionOverrides"
  > | undefined,
  connectionIds: string[],
): Pick<LayoutOverrides, "legOverrides" | "connectionOverrides"> {
  if (!overrides || connectionIds.length === 0) {
    return {
      legOverrides: overrides?.legOverrides,
      connectionOverrides: overrides?.connectionOverrides,
    };
  }
  const drop = new Set(connectionIds);
  const legOverrides = { ...(overrides.legOverrides ?? {}) };
  const connectionOverrides = { ...(overrides.connectionOverrides ?? {}) };
  for (const id of drop) {
    delete legOverrides[id];
    delete connectionOverrides[id];
  }
  return {
    legOverrides: Object.keys(legOverrides).length ? legOverrides : undefined,
    connectionOverrides: Object.keys(connectionOverrides).length
      ? connectionOverrides
      : undefined,
  };
}
