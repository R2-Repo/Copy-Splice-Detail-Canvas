import {
  fiberNumberFromTubeAndColor,
  fibersPerBufferTubeFromCableName,
  TIA_12_COLORS,
  TIA_TUBE_ORDER,
} from "@/features/diagram/colorCode";
import type { FiberEndpoint } from "@/types/splice";

function fiberColorIndex(fiberColor: FiberEndpoint["fiberColor"]): number {
  return TIA_12_COLORS.findIndex((c) => c.abbrev === fiberColor);
}

/**
 * Derive 6 vs 12 fibers per buffer tube from observed endpoint data (D3).
 * Uses all endpoints on a cable when available; name regex is last-resort fallback.
 */
export function deriveFibersPerTube(
  endpoints: FiberEndpoint[],
  cableName?: string,
): 6 | 12 {
  if (endpoints.length === 0) {
    return cableName ? fibersPerBufferTubeFromCableName(cableName) : 12;
  }

  const cable = cableName ?? endpoints[0]!.cable;
  let maxFiber = 0;

  for (const ep of endpoints) {
    if (fiberColorIndex(ep.fiberColor) >= 6) return 12;

    if (!Number.isFinite(ep.fiberNumber)) continue;

    maxFiber = Math.max(maxFiber, ep.fiberNumber);
    const posInTube = ((ep.fiberNumber - 1) % 12) + 1;
    if (posInTube > 6) return 12;

    const match6 = fiberNumberFromTubeAndColor(ep.tubeColor, ep.fiberColor, 6);
    const match12 = fiberNumberFromTubeAndColor(ep.tubeColor, ep.fiberColor, 12);
    if (ep.fiberNumber === match12 && ep.fiberNumber !== match6) return 12;
    if (ep.fiberNumber === match6 && !Number.isFinite(match12)) return 6;
  }

  if (maxFiber > 6) return 12;

  if (maxFiber > 0 && maxFiber <= 6) {
    const allLowColors = endpoints.every(
      (ep) => fiberColorIndex(ep.fiberColor) < 6,
    );
    if (allLowColors) {
      const allMatch6 = endpoints
        .filter((ep) => Number.isFinite(ep.fiberNumber))
        .every((ep) => {
          const match6 = fiberNumberFromTubeAndColor(
            ep.tubeColor,
            ep.fiberColor,
            6,
          );
          return ep.fiberNumber === match6;
        });
      if (allMatch6 && maxFiber <= 6) {
        const nameFallback = fibersPerBufferTubeFromCableName(cable);
        if (nameFallback === 6) return 6;
        if (maxFiber <= 6 && endpoints.every((ep) => ep.fiberNumber <= 6)) {
          const maxTube = Math.max(
            ...endpoints.map((ep) => TIA_TUBE_ORDER.indexOf(ep.tubeColor)),
          );
          if (maxTube <= 0 && maxFiber <= 6) return 6;
        }
      }
    }
  }

  return fibersPerBufferTubeFromCableName(cable);
}

/** Collect every endpoint on a cable name across splice pairs. */
export function endpointsForCable(
  pairs: { endpointA: FiberEndpoint; endpointB: FiberEndpoint }[],
  cable: string,
): FiberEndpoint[] {
  const out: FiberEndpoint[] = [];
  for (const pair of pairs) {
    for (const ep of [pair.endpointA, pair.endpointB]) {
      if (ep.cable === cable) out.push(ep);
    }
  }
  return out;
}

export function fibersPerTubeByCable(
  pairs: { endpointA: FiberEndpoint; endpointB: FiberEndpoint }[],
): Map<string, 6 | 12> {
  const cables = new Set<string>();
  for (const pair of pairs) {
    cables.add(pair.endpointA.cable);
    cables.add(pair.endpointB.cable);
  }
  const map = new Map<string, 6 | 12>();
  for (const cable of cables) {
    map.set(cable, deriveFibersPerTube(endpointsForCable(pairs, cable), cable));
  }
  return map;
}
