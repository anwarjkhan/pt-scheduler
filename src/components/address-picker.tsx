"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { Check, Loader2, MapPin, Search } from "lucide-react";
import type { AddressHit } from "@/lib/geocode";

export type AddressValue = { formatted: string; placeId: string | null; lat: number; lng: number };

/**
 * Postcode / address lookup with suggestions (via /api/geocode: Google when configured, otherwise
 * UK postcodes.io + OpenStreetMap). Emits hidden inputs (address, placeId, lat, lng) so it works
 * inside plain <form action>. A value is only set when a suggestion is chosen.
 */
export function AddressPicker({
  value,
  onChange,
  label = "Address or postcode",
  namePrefix = "",
}: {
  value: AddressValue | null;
  onChange?: (v: AddressValue | null) => void;
  label?: string;
  namePrefix?: string;
}) {
  const id = useId();
  const [selected, setSelected] = useState<AddressValue | null>(value);
  const [text, setText] = useState(value?.formatted ?? "");
  const [hits, setHits] = useState<AddressHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);

  const choose = (h: AddressHit | null) => {
    setSelected(h);
    onChange?.(h);
    if (h) setText(h.formatted);
    setOpen(false);
    setActive(-1);
  };

  // Debounced lookup while typing (only when the text isn't already a chosen suggestion).
  useEffect(() => {
    if (!open || text.trim().length < 3 || (selected && text === selected.formatted)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/geocode?q=${encodeURIComponent(text)}`);
        const j = (await r.json()) as { hits: AddressHit[] };
        if (!cancelled) setHits(j.hits ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [text, open, selected]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || hits.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => (a + 1) % hits.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => (a <= 0 ? hits.length - 1 : a - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      choose(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const showList = open && text.trim().length >= 3 && !(selected && text === selected.formatted);

  return (
    <div ref={rootRef} className="relative space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={text}
          autoComplete="off"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          placeholder="e.g. KT7 0AB or 12 High Street, Esher"
          className={cn("pl-8 pr-8", selected && "border-tjm-confirm")}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            if (selected) {
              setSelected(null);
              onChange?.(null);
            }
          }}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : selected ? <Check className="h-4 w-4 text-tjm-confirm" /> : null}
        </span>
      </div>

      {showList && (
        <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg">
          {hits.length === 0 && !loading && <li className="px-3 py-2 text-sm text-muted-foreground">No matches — try a postcode or add the town.</li>}
          {hits.map((h, i) => (
            <li
              key={`${h.placeId ?? h.formatted}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus so the outside-click handler doesn't fire first
                choose(h);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("flex cursor-pointer items-start gap-2 px-3 py-2 text-sm", i === active && "bg-accent")}
            >
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate">{h.formatted}</span>
            </li>
          ))}
        </ul>
      )}

      {text && !selected && !open && <p className="text-xs text-[#b45200]">Pick a match from the suggestions.</p>}

      <input type="hidden" name={`${namePrefix}address`} value={selected?.formatted ?? ""} />
      <input type="hidden" name={`${namePrefix}placeId`} value={selected?.placeId ?? ""} />
      <input type="hidden" name={`${namePrefix}lat`} value={selected?.lat ?? ""} />
      <input type="hidden" name={`${namePrefix}lng`} value={selected?.lng ?? ""} />
    </div>
  );
}
