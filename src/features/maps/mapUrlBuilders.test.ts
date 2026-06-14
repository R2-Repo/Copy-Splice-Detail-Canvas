import { describe, expect, it } from "vitest";

import {
  ARC_GIS_SPLICE_MAP_LEVEL,
  buildArcGisWebAppUrl,
} from "./buildArcGisWebAppUrl";
import {
  GOOGLE_MAPS_SATELLITE_MAP_TYPE,
  GOOGLE_MAPS_SATELLITE_ZOOM,
  buildGoogleMapsEmbedUrl,
} from "./buildGoogleMapsUrls";

const coords = { lat: 40.696435, lon: -112.038535 };

describe("map URL builders", () => {
  it("builds ArcGIS map URL with center, zoom, and marker", () => {
    const built = buildArcGisWebAppUrl(coords, "SP-2724.5");
    const parsed = new URL(built);
    expect(parsed.searchParams.get("id")).toBe("07c3dc8429ca42c4b4066e383631681f");
    expect(parsed.searchParams.get("center")).toBe("-112.038535,40.696435");
    expect(parsed.searchParams.get("level")).toBe(
      String(ARC_GIS_SPLICE_MAP_LEVEL),
    );
    expect(parsed.searchParams.get("marker")).toBe(
      "-112.038535;40.696435;;;;SP-2724.5",
    );
  });

  it("builds Google Maps satellite URL without API key", () => {
    const mapsEmbed = new URL(buildGoogleMapsEmbedUrl(coords));
    expect(mapsEmbed.searchParams.get("q")).toBe("40.696435,-112.038535");
    expect(mapsEmbed.searchParams.get("z")).toBe(
      String(GOOGLE_MAPS_SATELLITE_ZOOM),
    );
    expect(mapsEmbed.searchParams.get("t")).toBe(GOOGLE_MAPS_SATELLITE_MAP_TYPE);
    expect(mapsEmbed.searchParams.get("output")).toBe("embed");
  });
});
