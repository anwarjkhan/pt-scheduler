import { db } from "@/lib/db";
import { SITE } from "@/content/site";

export type Pillar = { id: string; label: string; body: string };

/**
 * Hero chips for the marketing site. Falls back to the labels in site.ts when
 * the table is empty (fresh database, or before Toby has written anything), so
 * the hero never renders bare. Fallback entries have no body — the UI shows
 * them as plain chips rather than opening an empty modal.
 */
export async function getPillars(): Promise<Pillar[]> {
  const rows = await db.pillar.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
  if (rows.length > 0) return rows.map((p) => ({ id: p.id, label: p.label, body: p.body }));
  return SITE.hero.pillars.map((label) => ({ id: `fallback-${label}`, label, body: "" }));
}
