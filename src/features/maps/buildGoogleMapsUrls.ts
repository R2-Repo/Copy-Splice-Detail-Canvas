import type { SpliceLocationCoords } from "@/features/maps/parseSpliceLocation";

export const GOOGLE_MAPS_SATELLITE_ZOOM = 17;
export const GOOGLE_MAPS_SATELLITE_MAP_TYPE = "k";

export function buildGoogleMapsEmbedUrl(coords: SpliceLocationCoords): string {
  const url = new URL("https://maps.google.com/maps");
  url.searchParams.set("q", `${coords.lat},${coords.lon}`);
  url.searchParams.set("z", String(GOOGLE_MAPS_SATELLITE_ZOOM));
  url.searchParams.set("t", GOOGLE_MAPS_SATELLITE_MAP_TYPE);
  url.searchParams.set("output", "embed");
  return url.toString();
}
