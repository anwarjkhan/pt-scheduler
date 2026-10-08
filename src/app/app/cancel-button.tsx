"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelBooking, quoteCancellation, type CancellationQuote } from "./actions";
import { formatMoney } from "@/lib/pricing";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * Cancelling is a priced decision, not a locked door.
 *
 * It used to render disabled inside the notice window, telling the client to
 * phone the trainer. Now they may always cancel — but the fee is quoted in
 * actual money, from the server, before the confirm button appears. Charging
 * someone via a button that said only "Cancel session" is not consent.
 */
export function CancelButton({ bookingId, inSeries }: { bookingId: string; inSeries: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"one" | "future">("one");
  const [quote, setQuote] = useState<CancellationQuote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  /** Ask the server what this would cost, then show the dialog. */
  const openFor = (next: "one" | "future") =>
    start(async () => {
      setError(null);
      setScope(next);
      const r = await quoteCancellation(bookingId, next);
      if (r.error || !r.quote) {
        setError(r.error ?? "Could not work out the cancellation fee.");
        setQuote(null);
      } else {
        setQuote(r.quote);
      }
      setOpen(true);
    });

  const confirm = () =>
    start(async () => {
      const r = await cancelBooking(bookingId, scope);
      if (!r.ok) return setError(r.error ?? "Could not cancel.");
      setOpen(false);
      setQuote(null);
      router.refresh();
    });

  const fee = quote?.feePence ?? 0;
  const chargedCount = quote?.items.filter((i) => i.feePence > 0).length ?? 0;

  return (
    <>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => openFor("one")} disabled={pending}>
          Cancel
        </Button>
        {inSeries && (
          <Button size="sm" variant="outline" onClick={() => openFor("future")} disabled={pending}>
            Cancel series
          </Button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {scope === "future" ? "Cancel this and all future sessions?" : "Cancel this session?"}
            </DialogTitle>
            <DialogDescription>
              {quote && quote.count > 1
                ? `${quote.count} sessions would be cancelled.`
                : "Your trainer will be notified."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            {fee > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
                <p className="font-medium text-destructive">
                  Cancelling now costs {formatMoney(fee, quote?.currency)}.
                </p>
                <p className="mt-1 text-muted-foreground">
                  {chargedCount > 1
                    ? `${chargedCount} of these sessions are inside the ${quote?.policy.noticeHours}-hour notice period, so ${quote?.policy.depositPct}% of each applies.`
                    : `This session is inside the ${quote?.policy.noticeHours}-hour notice period, so ${quote?.policy.depositPct}% of the price applies.`}{" "}
                  It will be added to your wallet balance.
                </p>
              </div>
            ) : quote ? (
              <div className="rounded-md border bg-muted/40 p-3">
                <p className="font-medium">No charge.</p>
                <p className="mt-1 text-muted-foreground">
                  {quote.freeUntil
                    ? `You're cancelling with more than ${quote.policy.noticeHours} hours' notice.`
                    : "This cancellation is free."}
                </p>
              </div>
            ) : null}

            {error && <p className="text-destructive">{error}</p>}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Keep it
            </Button>
            <Button variant="destructive" onClick={confirm} disabled={pending || !quote}>
              {pending
                ? "Cancelling…"
                : fee > 0
                  ? `Cancel and pay ${formatMoney(fee, quote?.currency)}`
                  : "Cancel session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
