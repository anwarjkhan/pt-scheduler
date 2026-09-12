/**
 * One-off: make sure every town the website lists is a service area (5-mile radius unless it already exists).
 * Run with: npx tsx prisma/add-site-areas.ts
 */
import { PrismaClient } from "@prisma/client";
import { searchAddresses } from "../src/lib/geocode";

const db = new PrismaClient();
const TOWNS = ["Weybridge", "Esher", "Hampton Court", "Cobham", "Hersham", "Oxshott"];

async function main() {
  for (const label of TOWNS) {
    const existing = await db.serviceArea.findFirst({ where: { label: { equals: label } } });
    if (existing) {
      console.log(`✓ ${label} already exists (${existing.radiusMiles} mi)`);
      continue;
    }
    const [hit] = await searchAddresses(`${label}, Surrey`);
    if (!hit) {
      console.warn(`✗ ${label}: no geocode result`);
      continue;
    }
    await db.serviceArea.create({ data: { label, formatted: hit.formatted, placeId: hit.placeId, lat: hit.lat, lng: hit.lng, radiusMiles: 5 } });
    console.log(`+ ${label} → ${hit.formatted} (${hit.lat.toFixed(4)}, ${hit.lng.toFixed(4)})`);
    await new Promise((r) => setTimeout(r, 1100)); // be polite to Nominatim (1 req/s)
  }
}

main().finally(() => db.$disconnect());
