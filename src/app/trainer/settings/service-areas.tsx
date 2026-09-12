"use client";

import { useActionState } from "react";
import { addServiceArea, deleteServiceArea, type SettingsState } from "./actions";
import { AddressPicker } from "@/components/address-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, Trash2 } from "lucide-react";

export type ServiceAreaRow = { id: string; label: string; formatted: string; radiusMiles: number };

/** Trainer-managed list of towns/areas with a radius each. Clients can only save addresses inside one. */
export function ServiceAreas({ areas, fallbackMiles }: { areas: ServiceAreaRow[]; fallbackMiles: number }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addServiceArea, {});
  // Remount the form (clearing it) after each successful add.
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
              {areas.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <MapPin className="h-4 w-4 shrink-0 text-tjm-orange" />
                  <div className="min-w-0 flex-1">
                    <div className="font-heading font-semibold">
                      {a.label} <span className="font-normal text-muted-foreground">· within {a.radiusMiles} mi</span>
                    </div>
                    <div className="truncate text-xs text-muted-foreground">{a.formatted}</div>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${a.label}`}
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => deleteServiceArea(a.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form key={formKey} action={action} className="space-y-3 rounded-md border p-4">
          <div className="font-heading text-sm font-semibold">Add an area</div>
          <div className="space-y-1">
            <Label htmlFor="area-label">Name</Label>
            <Input id="area-label" name="label" placeholder="Weybridge" required />
          </div>
          <AddressPicker value={null} label="Centre point (town or address)" />
          <div className="space-y-1">
            <Label htmlFor="area-radius">Radius (miles)</Label>
            <Input id="area-radius" name="radiusMiles" type="number" step="0.5" min="0.5" max="50" defaultValue={5} className="w-32" />
          </div>
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add area"}
          </Button>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
