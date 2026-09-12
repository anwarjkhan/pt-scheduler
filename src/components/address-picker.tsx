"use client";

import { useEffect, useRef, useState } from "react";
import { useJsApiLoader } from "@react-google-maps/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type AddressValue = { formatted: string; placeId: string | null; lat: number; lng: number };

const LIBRARIES: "places"[] = ["places"];
const browserKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

/**
 * Address entry. With a browser Maps key this is Google Places Autocomplete; without one it
 * degrades to manual address + coordinates so the app stays usable in development.
 * Emits hidden inputs (address, placeId, lat, lng) so it works inside plain <form action>.
 */
export function AddressPicker({
  value,
  onChange,
  label = "Address",
  namePrefix = "",
}: {
  value: AddressValue | null;
  onChange?: (v: AddressValue | null) => void;
  label?: string;
  namePrefix?: string;
}) {
  const [v, setV] = useState<AddressValue | null>(value);
  useEffect(() => setV(value), [value]);
  const update = (next: AddressValue | null) => {
    setV(next);
    onChange?.(next);
  };

  return (
    <div className="space-y-2">
      {browserKey ? (
        <PlacesInput label={label} value={v} onSelect={update} />
      ) : (
        <ManualInput label={label} value={v} onChange={update} />
      )}
      <input type="hidden" name={`${namePrefix}address`} value={v?.formatted ?? ""} />
      <input type="hidden" name={`${namePrefix}placeId`} value={v?.placeId ?? ""} />
      <input type="hidden" name={`${namePrefix}lat`} value={v?.lat ?? ""} />
      <input type="hidden" name={`${namePrefix}lng`} value={v?.lng ?? ""} />
    </div>
  );
}

function PlacesInput({
  label,
  value,
  onSelect,
}: {
  label: string;
  value: AddressValue | null;
  onSelect: (v: AddressValue | null) => void;
}) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: browserKey!, libraries: LIBRARIES });
  const ref = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value?.formatted ?? "");
  useEffect(() => setText(value?.formatted ?? ""), [value]);

  useEffect(() => {
    if (!isLoaded || !ref.current) return;
    const ac = new google.maps.places.Autocomplete(ref.current, {
      fields: ["formatted_address", "place_id", "geometry"],
    });
    const listener = ac.addListener("place_changed", () => {
      const p = ac.getPlace();
      const loc = p.geometry?.location;
      if (!loc || !p.formatted_address) return;
      const next = { formatted: p.formatted_address, placeId: p.place_id ?? null, lat: loc.lat(), lng: loc.lng() };
      setText(next.formatted);
      onSelect(next);
    });
    return () => listener.remove();
  }, [isLoaded, onSelect]);

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <Input
        ref={ref}
        value={text}
        placeholder={isLoaded ? "Start typing an address…" : "Loading maps…"}
        onChange={(e) => {
          setText(e.target.value);
          onSelect(null); // typed text isn't a selection until chosen from the dropdown
        }}
      />
      {text && !value && <p className="text-xs text-amber-600">Pick an address from the suggestions.</p>}
    </div>
  );
}

function ManualInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: AddressValue | null;
  onChange: (v: AddressValue | null) => void;
}) {
  const [formatted, setFormatted] = useState(value?.formatted ?? "");
  const [lat, setLat] = useState(value ? String(value.lat) : "");
  const [lng, setLng] = useState(value ? String(value.lng) : "");
  useEffect(() => {
    setFormatted(value?.formatted ?? "");
    setLat(value ? String(value.lat) : "");
    setLng(value ? String(value.lng) : "");
  }, [value]);

  const emit = (f: string, la: string, ln: string) => {
    const a = parseFloat(la);
    const b = parseFloat(ln);
    onChange(f && Number.isFinite(a) && Number.isFinite(b) ? { formatted: f, placeId: null, lat: a, lng: b } : null);
  };

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label>{label}</Label>
        <Input
          value={formatted}
          placeholder="12 High Street, Town"
          onChange={(e) => {
            setFormatted(e.target.value);
            emit(e.target.value, lat, lng);
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label>Latitude</Label>
          <Input
            value={lat}
            inputMode="decimal"
            placeholder="51.5074"
            onChange={(e) => {
              setLat(e.target.value);
              emit(formatted, e.target.value, lng);
            }}
          />
        </div>
        <div className="space-y-1">
          <Label>Longitude</Label>
          <Input
            value={lng}
            inputMode="decimal"
            placeholder="-0.1278"
            onChange={(e) => {
              setLng(e.target.value);
              emit(formatted, lat, e.target.value);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        No Google Maps browser key set — enter coordinates manually (right-click a spot in Google Maps to copy them).
      </p>
    </div>
  );
}
