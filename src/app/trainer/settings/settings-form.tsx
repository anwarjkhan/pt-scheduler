"use client";

import { useActionState } from "react";
import { saveSettings, type SettingsState } from "./actions";
import { AddressPicker, type AddressValue } from "@/components/address-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const TIMEZONES = ["Europe/London", "Europe/Dublin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"];

export function SettingsForm({
  initial,
}: {
  initial: {
    timezone: string;
    home: AddressValue | null;
    maxRadiusMiles: number;
    bufferMinutes: number;
    slotStepMinutes: number;
    minNoticeHours: number;
  };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});

  return (
    <form action={action} className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Home base</CardTitle>
          <CardDescription>Where you start and end your day. Used for the service radius and first/last commute.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AddressPicker value={initial.home} label="Home address" />
          <div className="space-y-1">
            <Label htmlFor="timezone">Timezone</Label>
            <select
              id="timezone"
              name="timezone"
              defaultValue={initial.timezone}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {TIMEZONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Booking rules</CardTitle>
          <CardDescription>Applied to every client booking.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label htmlFor="maxRadiusMiles">Service radius (miles)</Label>
            <Input id="maxRadiusMiles" name="maxRadiusMiles" type="number" step="0.5" defaultValue={initial.maxRadiusMiles} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bufferMinutes">Commute buffer (min)</Label>
            <Input id="bufferMinutes" name="bufferMinutes" type="number" defaultValue={initial.bufferMinutes} />
            <p className="text-xs text-muted-foreground">Added on top of drive time for parking/setup.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="slotStepMinutes">Slot step (min)</Label>
            <select
              id="slotStepMinutes"
              name="slotStepMinutes"
              defaultValue={initial.slotStepMinutes}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              {[15, 30, 60].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="minNoticeHours">Min notice (hours)</Label>
            <Input id="minNoticeHours" name="minNoticeHours" type="number" defaultValue={initial.minNoticeHours} />
            <p className="text-xs text-muted-foreground">For new bookings and client cancellations.</p>
          </div>
        </CardContent>
      </Card>

      <div className="md:col-span-2 flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
        {state.ok && <span className="text-sm text-[#5f6600]">Saved.</span>}
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}
