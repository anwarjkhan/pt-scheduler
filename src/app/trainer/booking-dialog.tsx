"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { format, parseISO } from "date-fns";
import type { CalendarBooking } from "@/lib/calendar-data";
import { acceptBooking, acceptSeries, declineBooking, declineSeries, trainerCancelBooking } from "./actions";
import { CommuteSummary } from "@/components/commute-summary";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Repeat, StickyNote, User } from "lucide-react";

export function BookingDialog({ booking: b, onClose }: { booking: CalendarBooking; onClose: () => void }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; warnings?: string[] }>) =>
    start(async () => {
      const r = await fn();
      if (r.error) return setMsg(r.error);
      router.refresh();
      if (r.warnings?.length) setMsg(r.warnings.join(" "));
      else onClose();
    });

  const isPending = b.status === "PENDING";
  const active = ["PENDING", "ACCEPTED"].includes(b.status);
  // Date shown from the trainer-tz startTime rather than the browser's local time.
  const dayLabel = format(parseISO(b.startAt.slice(0, 10)), "EEEE d MMMM");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dayLabel}, {b.startTime}–{b.endTime}
            <StatusBadge status={b.status} />
          </DialogTitle>
          <DialogDescription>{b.durationMin}-minute session</DialogDescription>
        </DialogHeader>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" /> {b.clientName}{" "}
            <span className="text-muted-foreground">({b.clientEmail})</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" /> {b.locationLabel}
          </div>
          {b.seriesId && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Repeat className="h-4 w-4" /> Part of a weekly series
            </div>
          )}
          {b.clientNote && (
            <div className="flex items-start gap-2">
              <StickyNote className="mt-0.5 h-4 w-4 text-muted-foreground" /> {b.clientNote}
            </div>
          )}
        </div>

        {active && <CommuteSummary evaluation={b.evaluation} />}

        {active && (
          <div className="space-y-1">
            <Label htmlFor="reason">Message to client (optional)</Label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for declining / cancelling" />
          </div>
        )}

        {msg && <p className="text-sm text-[#b45200]">{msg}</p>}

        <DialogFooter className="flex-wrap gap-2">
          {isPending && (
            <>
              <Button onClick={() => run(() => acceptBooking(b.id))} disabled={pending}>
                Accept
              </Button>
              <Button variant="outline" onClick={() => run(() => declineBooking(b.id, reason))} disabled={pending}>
                Decline
              </Button>
              {b.seriesId && (
                <>
                  <Button variant="secondary" onClick={() => run(() => acceptSeries(b.seriesId!))} disabled={pending}>
                    Accept whole series
                  </Button>
                  <Button variant="ghost" onClick={() => run(() => declineSeries(b.seriesId!, reason))} disabled={pending}>
                    Decline series
                  </Button>
                </>
              )}
            </>
          )}
          {b.status === "ACCEPTED" && (
            <Button variant="destructive" onClick={() => run(() => trainerCancelBooking(b.id, reason))} disabled={pending}>
              Cancel session
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
