import { Client, TravelMode } from "@googlemaps/google-maps-services-js";
import { db } from "@/lib/db";
import { coordKey, estimateCommute, type Commute, type CommuteFn, type LatLng } from "@/lib/scheduling";

const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
export const mapsEnabled = !!serverKey;

const client = new Client({});

/** Cache entries older than this are refreshed (traffic patterns drift, roads change). */
const CACHE_TTL_MS = 30 * 24 * 3600 * 1000;

async function fetchDrivingTime(from: LatLng, to: LatLng): Promise<Commute> {
  if (!serverKey) return { ...estimateCommute(from, to), estimated: true };
  try {
    const res = await client.distancematrix({
      params: {
        key: serverKey,
        origins: [from],
        destinations: [to],
        mode: TravelMode.driving,
        units: "imperial" as never,
      },
    });
    const el = res.data.rows[0]?.elements[0];
    if (!el || el.status !== "OK") return { ...estimateCommute(from, to), estimated: true };
    return { seconds: el.duration.value, meters: el.distance.value, estimated: false };
  } catch (err) {
    console.error("Distance Matrix failed, falling back to estimate", err);
    return { ...estimateCommute(from, to), estimated: true };
  }
}

/** Commute lookup with a DB cache keyed by rounded coordinates. */
export const getCommute: CommuteFn = async (from, to) => {
  const fromKey = coordKey(from);
  const toKey = coordKey(to);
  if (fromKey === toKey) return { seconds: 0, meters: 0, estimated: false };

  const cached = await db.commuteCache.findUnique({ where: { fromKey_toKey: { fromKey, toKey } } });
  const fresh = cached && Date.now() - cached.fetchedAt.getTime() < CACHE_TTL_MS;
  // Reuse a fresh real result; also reuse an estimate when we still have no key (no point re-estimating).
  if (cached && fresh && (!cached.estimated || !mapsEnabled)) {
    return { seconds: cached.seconds, meters: cached.meters, estimated: cached.estimated };
  }

  const c = await fetchDrivingTime(from, to);
  await db.commuteCache.upsert({
    where: { fromKey_toKey: { fromKey, toKey } },
    update: { seconds: c.seconds, meters: c.meters, estimated: c.estimated, fetchedAt: new Date() },
    create: { fromKey, toKey, seconds: c.seconds, meters: c.meters, estimated: c.estimated },
  });
  return c;
};

export type GeocodeResult = { formatted: string; placeId: string | null; lat: number; lng: number };

/** Resolve a free-text address (or Place ID) to coordinates. */
export async function geocode(input: { address?: string; placeId?: string }): Promise<GeocodeResult | null> {
  if (!serverKey) return null;
  try {
    const res = await client.geocode({
      params: input.placeId
        ? { key: serverKey, place_id: input.placeId }
        : { key: serverKey, address: input.address ?? "" },
    });
    const r = res.data.results[0];
    if (!r) return null;
    return {
      formatted: r.formatted_address,
      placeId: r.place_id,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
    };
  } catch (err) {
    console.error("Geocode failed", err);
    return null;
  }
}
