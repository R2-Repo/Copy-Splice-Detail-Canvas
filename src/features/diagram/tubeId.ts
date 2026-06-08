import type { CableLegId, TubeColorCode, TubeEndpointKey } from "@/types/splice";

/**
 * One buffer tube per (cable leg, tube color). CSV "Buffer" is a fiber/buffer
 * index within the cable — not a separate tube when tube color repeats (e.g. BL 1–4).
 */
export function tubeEndpointKey(
  legId: CableLegId,
  tubeColor: TubeColorCode,
): TubeEndpointKey {
  return `${legId}|${tubeColor}`;
}

export function tubeNodeId(
  legId: CableLegId,
  tubeColor: TubeColorCode,
): string {
  return `tube-${tubeEndpointKey(legId, tubeColor)}`;
}

/** React Flow handle id for a collapsed full-butt-splice buffer tube. */
export function tubeHandleId(
  legId: CableLegId,
  tubeColor: TubeColorCode,
): string {
  return `tube-${tubeEndpointKey(legId, tubeColor)}`;
}
