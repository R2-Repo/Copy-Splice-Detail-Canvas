import type { SpliceLocationCoords } from "@/features/maps/parseSpliceLocation";

export const GOOGLE_EARTH_BASE_URL = "https://earth.google.com/web/";
export const EARTH_CAMERA_ALTITUDE_M = 1500;
export const EARTH_CAMERA_DISTANCE_M = 200;
export const EARTH_FOV_DEG = 35;
export const EARTH_HEADING_DEG = 0;
export const EARTH_TILT_DEG = 45;
export const EARTH_ROLL_DEG = 0;

export function buildGoogleEarthUrl(coords: SpliceLocationCoords): string {
  return `${GOOGLE_EARTH_BASE_URL}@${coords.lat},${coords.lon},${EARTH_CAMERA_ALTITUDE_M}a,${EARTH_CAMERA_DISTANCE_M}d,${EARTH_FOV_DEG}y,${EARTH_HEADING_DEG}h,${EARTH_TILT_DEG}t,${EARTH_ROLL_DEG}r`;
}

export function buildGoogleEarthSearchUrl(coords: SpliceLocationCoords): string {
  return `${GOOGLE_EARTH_BASE_URL}search/${coords.lat},${coords.lon}`;
}
