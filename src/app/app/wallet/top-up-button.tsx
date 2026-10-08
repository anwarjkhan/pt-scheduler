"use client";

import { useActionState, useEffect, useState } from "react";
import { startTopUp, type TopUpState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const PRESETS = [50, 100, 200, 500];

/**
 * Card top-up.
 *
 * The action returns a Checkout URL rather than redirecting server-side, so
 * the dialog can show a validation error in place instead of bouncing the
 * client to Stripe and back for a typo.
 */
export function TopUpButton({ currencySymbol = "£" }: { currencySymbol?: string }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("50");
  const [state, action, pending] = useActionState<TopUpState, FormData>(startTopUp, {});

  // Hand off to Stripe once the session exists.
  useEffect(() => {
    if (state.url) window.location.href = state.url;
  }, [state.url]);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Top up by card</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action}>
            <DialogHeader>
              <DialogTitle>Top up your wallet</DialogTitle>
              <DialogDescription>
                Pay by card. The credit appears on your balance as soon as the payment clears.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={amount === String(p) ? "default" : "outline"}
                    onClick={() => setAmount(String(p))}
                  >
                    {currencySymbol}
                    {p}
                  </Button>
                ))}
              </div>

              <div className="space-y-1">
                <Label htmlFor="topup-amount">Amount</Label>
                <div className="relative w-40">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    {currencySymbol}
                  </span>
                  <Input
                    id="topup-amount"
                    name="amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    inputMode="decimal"
                    className="pl-7"
                  />
                </div>
              </div>

              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            </div>

            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !!state.url}>
                {pending || state.url ? "Taking you to checkout…" : "Continue to payment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
