export type SpliceLocationCoords = {
  lat: number;
  lon: number;
};

function isValidLatitude(lat: number): boolean {
  return Number.isFinite(lat) && lat >= -90 && lat <= 90;
}

function isValidLongitude(lon: number): boolean {
  return Number.isFinite(lon) && lon >= -180 && lon <= 180;
}

/**
 * Parse Bentley header `Location:` values like:
 * - "40.696435 -112.038535"
 * - "40.696435,-112.038535"
 */
export function parseSpliceLocation(
  location: string | null | undefined,
): SpliceLocationCoords | null {
  if (!location) return null;
  const normalized = location.trim().replaceAll(",", " ");
  if (!normalized) return null;

  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length !== 2) return null;

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!isValidLatitude(lat) || !isValidLongitude(lon)) return null;

  return { lat, lon };
}
