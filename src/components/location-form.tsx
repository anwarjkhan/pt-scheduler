"use client";

import { useActionState, useEffect } from "react";
import { addLocation, type LocationState } from "@/app/app/locations/actions";
import { AddressPicker } from "@/components/address-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LocationForm({ onCreated }: { onCreated?: (id: string) => void }) {
  const [state, action, pending] = useActionState<LocationState, FormData>(addLocation, {});
  useEffect(() => {
    if (state.ok && state.id) onCreated?.(state.id);
  }, [state, onCreated]);

  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor="label">Label (optional)</Label>
        <Input id="label" name="label" placeholder="Home, Office, Park…" />
      </div>
      <AddressPicker value={null} />
      <Button type="submit" disabled={pending}>
        {pending ? "Checking distance…" : "Save location"}
      </Button>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state.ok && <p className="text-sm text-[#5f6600]">Saved.</p>}
    </form>
  );
}
