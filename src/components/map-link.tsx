import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

export type MapTarget = {
  formatted: string;
  placeId?: string | null;
  lat?: number | null;
  lng?: number | null;
};

/**
 * Google Maps URL for an address, best identifier first:
 * a place id pins the exact place, coordinates pin the exact point, and the
 * formatted address is a plain search fallback.
 */
export function mapsUrl({ formatted, placeId, lat, lng }: MapTarget) {
  const base = "https://www.google.com/maps/search/?api=1";
  if (placeId) return `${base}&query=${encodeURIComponent(formatted)}&query_place_id=${encodeURIComponent(placeId)}`;
  if (lat != null && lng != null) return `${base}&query=${lat},${lng}`;
  return `${base}&query=${encodeURIComponent(formatted)}`;
}

/**
 * The pin icon as a link to Google Maps. Only the icon is the hit target, so it
 * can sit inside rows that are themselves links or buttons without nesting one
 * interactive element in another.
 */
export function MapLink({ target, className, label }: { target: MapTarget; className?: string; label?: string }) {
  return (
    <a
      href={mapsUrl(target)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={`Open ${label ?? target.formatted} in Google Maps`}
      aria-label={`Open ${label ?? target.formatted} in Google Maps`}
      className={cn("shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-tjm-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", className)}
    >
      <MapPin className="h-full w-full" />
    </a>
  );
}
