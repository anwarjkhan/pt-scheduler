"use client";

import { useActionState, useState } from "react";
import { addServiceArea, deleteServiceArea, updateServiceArea, type SettingsState } from "./actions";
import { AddressPicker } from "@/components/address-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pencil, Trash2 } from "lucide-react";
import { MapLink } from "@/components/map-link";

export type ServiceAreaRow = {
  id: string;
  label: string;
  formatted: string;
  placeId: string | null;
  lat: number;
  lng: number;
  radiusMiles: number;
};

/** Trainer-managed list of towns/areas with a radius each. Clients can only save addresses inside one. */
export function ServiceAreas({ areas, fallbackMiles }: { areas: ServiceAreaRow[]; fallbackMiles: number }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addServiceArea, {});
  const [editing, setEditing] = useState<string | null>(null);
  // Remount the add form (clearing it) after each successful add.
  const formKey = state.ok ? areas.length : -1;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Service areas</CardTitle>
        <CardDescription>
          Where you take bookings. A client address is accepted if it&apos;s within the radius of <em>any</em> area (by driving distance).
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          {areas.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              No areas yet — clients can currently book anywhere within <strong>{fallbackMiles} miles</strong> of your home address (the fallback
              radius below). Add your first area to switch to area-based coverage.
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {areas.map((a) =>
                editing === a.id ? (
                  <li key={a.id} className="p-3">
                    <EditAreaForm area={a} onDone={() => setEditing(null)} />
                  </li>
                ) : (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <MapLink target={a} className="h-4 w-4 text-tjm-orange" label={a.label} />
                    <div className="min-w-0 flex-1">
                      <div className="font-heading font-semibold">
                        {a.label} <span className="font-normal text-muted-foreground">· within {a.radiusMiles} mi</span>
                      </div>
                      <div className="truncate text-xs text-muted-foreground">{a.formatted}</div>
                    </div>
                    <button
                      type="button"
                      aria-label={`Edit ${a.label}`}
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setEditing(a.id)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${a.label}`}
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Remove ${a.label}? Clients will no longer be able to book addresses that only fall inside it.`)) deleteServiceArea(a.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ),
              )}
            </ul>
          )}
        </div>

        <form key={formKey} action={action} className="space-y-3 rounded-md border p-4">
          <div className="font-heading text-sm font-semibold">Add an area</div>
          <AreaFields />
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add area"}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}

/** Name / centre point / radius inputs, shared by the add and edit forms. */
function AreaFields({ area }: { area?: ServiceAreaRow }) {
  const id = area?.id ?? "new";
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`area-label-${id}`}>Name</Label>
        <Input id={`area-label-${id}`} name="label" placeholder="Weybridge" defaultValue={area?.label} required />
      </div>
      <AddressPicker
        value={area ? { formatted: area.formatted, placeId: area.placeId, lat: area.lat, lng: area.lng } : null}
        label="Centre point (town or address)"
      />
      <div className="space-y-1">
        <Label htmlFor={`area-radius-${id}`}>Radius (miles)</Label>
        <Input id={`area-radius-${id}`} name="radiusMiles" type="number" step="0.5" min="0.5" max="50" defaultValue={area?.radiusMiles ?? 5} className="w-32" />
      </div>
    </>
  );
}

function EditAreaForm({ area, onDone }: { area: ServiceAreaRow; onDone: () => void }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updateServiceArea.bind(null, area.id), {});
  // Close the editor once the save has gone through.
  const [seenOk, setSeenOk] = useState(false);
  if (state.ok && !seenOk) {
    setSeenOk(true);
    onDone();
  }

  return (
    <form action={action} className="space-y-3">
      <div className="font-heading text-sm font-semibold">Edit {area.label}</div>
      <AreaFields area={area} />
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
