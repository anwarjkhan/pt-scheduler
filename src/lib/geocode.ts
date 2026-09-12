import { Client } from "@googlemaps/google-maps-services-js";

export type AddressHit = { formatted: string; placeId: string | null; lat: number; lng: number; source: "google" | "postcodes.io" | "osm" };

const serverKey = process.env.GOOGLE_MAPS_SERVER_KEY;
const client = new Client({});

/** Small in-memory cache so repeated keystrokes/queries don't re-hit the providers. */
const cache = new Map<string, { at: number; hits: AddressHit[] }>();
const TTL = 10 * 60 * 1000;

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d?[A-Z]{0,2}$/i;

/**
 * Address / postcode lookup. Google Geocoding when configured; otherwise postcodes.io (UK postcodes,
 * with autocomplete for partials) plus OpenStreetMap Nominatim for street addresses. UK-biased.
 */
export async function searchAddresses(raw: string): Promise<AddressHit[]> {
  const q = raw.trim().replace(/\s+/g, " ");
  if (q.length < 3) return [];
  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.hits;

  const hits = serverKey ? await viaGoogle(q) : await viaFree(q);
  cache.set(key, { at: Date.now(), hits });
  return hits;
}

async function viaGoogle(q: string): Promise<AddressHit[]> {
  try {
    const res = await client.geocode({ params: { key: serverKey!, address: q, region: "gb" } });
    return res.data.results.slice(0, 6).map((r) => ({
      formatted: r.formatted_address,
      placeId: r.place_id,
      lat: r.geometry.location.lat,
      lng: r.geometry.location.lng,
      source: "google" as const,
    }));
  } catch (err) {
    console.error("Google geocode failed", err);
    return [];
  }
}

async function viaFree(q: string): Promise<AddressHit[]> {
  const compact = q.replace(/\s/g, "");
  const out: AddressHit[] = [];

  // Postcode (full or partial) → postcodes.io
  if (UK_POSTCODE.test(q) && compact.length >= 3) {
    try {
      const full = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}`);
      if (full.ok) {
        const j = (await full.json()) as { result?: PcResult };
        if (j.result) out.push(pc(j.result));
      } else {
        const ac = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(compact)}/autocomplete?limit=6`);
        const j = (await ac.json()) as { result?: string[] | null };
        if (j.result?.length) {
          const bulk = await fetch("https://api.postcodes.io/postcodes", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ postcodes: j.result }),
          });
          const b = (await bulk.json()) as { result?: { result: PcResult | null }[] };
          for (const r of b.result ?? []) if (r.result) out.push(pc(r.result));
        }
      }
    } catch (err) {
      console.error("postcodes.io failed", err);
    }
    if (out.length) return out;
  }

  // Street address / place → Nominatim (OSM). Polite usage: identify ourselves, UK only, small limit.
  try {
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.searchParams.set("q", q);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("countrycodes", "gb");
    url.searchParams.set("limit", "6");
    url.searchParams.set("addressdetails", "0");
    const res = await fetch(url, { headers: { "User-Agent": "TJM-Training-booking/1.0 (toby@tjmtraining.com)", "Accept-Language": "en-GB" } });
    if (res.ok) {
      const j = (await res.json()) as { display_name: string; lat: string; lon: string; place_id: number }[];
      for (const r of j) out.push({ formatted: r.display_name, placeId: `osm:${r.place_id}`, lat: Number(r.lat), lng: Number(r.lon), source: "osm" });
    }
  } catch (err) {
    console.error("Nominatim failed", err);
  }
  return out;
}

type PcResult = { postcode: string; latitude: number; longitude: number; admin_district: string | null; parish: string | null; region: string | null };
function pc(r: PcResult): AddressHit {
  const where = [r.parish && r.parish !== "" && !r.parish.includes("unparished") ? r.parish : null, r.admin_district].filter(Boolean).join(", ");
  return { formatted: `${r.postcode}${where ? ` — ${where}` : ""}`, placeId: `pc:${r.postcode}`, lat: r.latitude, lng: r.longitude, source: "postcodes.io" };
}
