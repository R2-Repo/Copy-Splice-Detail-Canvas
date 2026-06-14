import type { SpliceLocationCoords } from "@/features/maps/parseSpliceLocation";

export const ARC_GIS_WEBAPP_BASE_URL =
  "https://uplan.maps.arcgis.com/apps/webappviewer/index.html?id=07c3dc8429ca42c4b4066e383631681f";

export const ARC_GIS_SPLICE_MAP_LEVEL = 20;

export function buildArcGisWebAppUrl(
  coords: SpliceLocationCoords,
  spliceLabel?: string,
): string {
  const url = new URL(ARC_GIS_WEBAPP_BASE_URL);
  url.searchParams.set("center", `${coords.lon},${coords.lat}`);
  url.searchParams.set("level", String(ARC_GIS_SPLICE_MAP_LEVEL));
  const trimmedLabel = spliceLabel?.trim();
  url.searchParams.set(
    "marker",
    `${coords.lon};${coords.lat};;;;${trimmedLabel ?? ""}`,
  );
  return url.toString();
}
