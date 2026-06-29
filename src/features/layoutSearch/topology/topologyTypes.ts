import type { LayoutSide } from "../layoutCandidate";

/** Cross-cable connection stats for one unordered pair. */
export type CableAffinity = {
  cableA: string;
  cableB: string;
  connectionCount: number;
  /** connectionCount / connections involving cableA */
  affinityA: number;
  /** connectionCount / connections involving cableB */
  affinityB: number;
  /** Share of pair connections that would be same canvas side if both cables shared a side. */
  sameSideRate: number;
};

export type ProxyBundleGroup = {
  tubeBundleKey: string;
  connectionIds: string[];
  representativeId: string;
};

export type PrimaryPairLock = {
  cableA: string;
  cableB: string;
  sideA: LayoutSide;
  sideB: LayoutSide;
};

/** Search-space + proxy-route hints derived once per import. */
export type TopologyConstraints = {
  lockedCableSides: Record<string, LayoutSide>;
  forbiddenSameSidePairs: Array<{ cableA: string; cableB: string }>;
  searchableCables: string[];
  hubCables: string[];
  satelliteCables: string[];
  proxyBundleGroups: ProxyBundleGroup[];
  /** High-affinity or through-cable pair pinned to opposite sides. */
  primaryPairLock?: PrimaryPairLock;
  lockedCableCount: number;
};

export type TopologyAnalysis = {
  cableKeys: string[];
  affinities: CableAffinity[];
  constraints: TopologyConstraints;
  throughCableConfidence: Record<string, number>;
};

export const LOCK_OPPOSITE_MIN_AFFINITY = 0.75;
export const LOCK_OPPOSITE_MIN_COUNT = 24;
export const PROXY_BUNDLE_MIN_SIZE = 4;
/** Pairs with same-side rate below this are forbidden on the same layout side. */
export const FORBID_SAME_SIDE_MAX_RATE = 0.15;

/** @deprecated Use `PrimaryPairLock`. */
export type DominantPairLock = PrimaryPairLock;
