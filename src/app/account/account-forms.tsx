"use client";

import { useActionState } from "react";
import { saveNotifications, saveProfile, type AccountState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type User = {
  name: string | null;
  email: string;
  phone: string | null;
  emergencyContact: string | null;
  notes: string | null;
  notifyEmail: boolean;
  notifyReminders: boolean;
  role: string;
};

export function AccountForms({ user }: { user: User }) {
  const [p, profileAction, profilePending] = useActionState<AccountState, FormData>(saveProfile, {});
  const [n, notifyAction, notifyPending] = useActionState<AccountState, FormData>(saveNotifications, {});
  const isTrainer = user.role === "TRAINER";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card id="profile">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Signed in as {user.email}. {isTrainer ? "Clients see your name on their bookings." : "Toby sees these details on your bookings."}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* keyed so inputs remount with fresh defaults after a save (avoids uncontrolled→default-change warnings) */}
          <form key={`${user.name}|${user.phone}|${user.emergencyContact}|${user.notes}`} action={profileAction} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" defaultValue={user.name ?? ""} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" type="tel" defaultValue={user.phone ?? ""} placeholder="07700 900000" />
            </div>
            {!isTrainer && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="emergencyContact">Emergency contact</Label>
                  <Input id="emergencyContact" name="emergencyContact" defaultValue={user.emergencyContact ?? ""} placeholder="Name and number" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="notes">Notes for Toby</Label>
                  <Textarea id="notes" name="notes" defaultValue={user.notes ?? ""} rows={4} placeholder="Parking, access, injuries or health notes…" />
                </div>
              </>
            )}
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={profilePending}>
                {profilePending ? "Saving…" : "Save profile"}
              </Button>
              {p.ok && <span className="text-sm text-[#5f6600]">Saved.</span>}
              {p.error && <span className="text-sm text-destructive">{p.error}</span>}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card id="notifications" className="scroll-mt-24">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Email preferences. (Emails aren&apos;t being sent yet — these are stored ready for when they are.)</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={notifyAction} className="space-y-4">
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="notifyEmail" defaultChecked={user.notifyEmail} className="mt-1 h-4 w-4 accent-tjm-yellow" />
              <span>
                <span className="font-medium">Booking updates</span>
                <span className="block text-muted-foreground">
                  {isTrainer ? "New requests and client cancellations." : "When Toby confirms, declines or cancels a session."}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" name="notifyReminders" defaultChecked={user.notifyReminders} className="mt-1 h-4 w-4 accent-tjm-yellow" />
              <span>
                <span className="font-medium">Session reminders</span>
                <span className="block text-muted-foreground">A reminder 24 hours before each session.</span>
              </span>
            </label>
            <div className="flex items-center gap-3">
              <Button type="submit" variant="outline" disabled={notifyPending}>
                {notifyPending ? "Saving…" : "Save preferences"}
              </Button>
              {n.ok && <span className="text-sm text-[#5f6600]">Saved.</span>}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
