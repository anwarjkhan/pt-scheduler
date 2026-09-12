import type { LatLng } from "./types";

const EARTH_RADIUS_M = 6_371_000;

export function haversineMeters(a: LatLng, b: LatLng): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

export const METERS_PER_MILE = 1609.344;

/** Rounded coordinate key used for commute caching (~1m precision). */
export function coordKey(p: LatLng): string {
  return `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;
}

/**
 * Fallback when no Maps key: assume roads add 30% over straight line and an average 22 mph,
 * plus 3 minutes for parking/walking.
 */
export function estimateCommute(a: LatLng, b: LatLng): { seconds: number; meters: number } {
  const meters = haversineMeters(a, b) * 1.3;
  const mph = 22;
  const seconds = (meters / METERS_PER_MILE / mph) * 3600 + 180;
  return { seconds: Math.round(seconds), meters: Math.round(meters) };
}
