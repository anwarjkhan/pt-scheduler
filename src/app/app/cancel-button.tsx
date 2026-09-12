"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking } from "./actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function CancelButton({
  bookingId,
  inSeries,
  allowed,
  minNoticeHours,
}: {
  bookingId: string;
  inSeries: boolean;
  allowed: boolean;
  minNoticeHours: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (scope: "one" | "future") =>
    start(async () => {
      const r = await cancelBooking(bookingId, scope);
      if (!r.ok) return setError(r.error ?? "Could not cancel.");
      setOpen(false);
      router.refresh();
    });

  if (!allowed) {
    return (
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <Button size="sm" variant="outline" disabled>
            Cancel
          </Button>
        </TooltipTrigger>
        <TooltipContent>Cancellations need {minNoticeHours} hours&apos; notice — please contact your trainer.</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Cancel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this session?</DialogTitle>
            <DialogDescription>
              {inSeries ? "This session is part of a weekly series." : "Your trainer will be notified."}
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={() => run("one")} disabled={pending}>
              {inSeries ? "Cancel this one" : "Cancel session"}
            </Button>
            {inSeries && (
              <Button variant="destructive" onClick={() => run("future")} disabled={pending}>
                Cancel this &amp; all future
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
