"use client";

import { useActionState, useState } from "react";
import { saveHealthExemption, type WalletActionState } from "./wallet-actions";
import { STATUS_META, type ClientHealth, type HealthStatus } from "@/lib/client-health";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * How a client is doing, for the trainer's eyes only.
 *
 * Shows the four dimensions with the evidence behind each, because "£240 owed
 * for 26 days" is something to act on and "Health: 42" is something to argue
 * with. The dots are a glance; the sentence is the point.
 */
export function ClientHealthPanel({
  clientId,
  health,
  exempt,
  exemptReason,
}: {
  clientId: string;
  health: ClientHealth;
  exempt: boolean;
  exemptReason: string | null;
}) {
  const dims = [
    { key: "Reliability", d: health.reliability },
    { key: "Value", d: health.value },
    { key: "Effort", d: health.effort },
    { key: "Payment", d: health.payment },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <CardTitle className="flex items-center gap-2">
            How it&apos;s going
            <StatusPill status={health.status} />
          </CardTitle>
          <ExemptionDialog clientId={clientId} exempt={exempt} exemptReason={exemptReason} />
        </div>
        <CardDescription>{health.headline}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="mb-3 text-xs text-muted-foreground">Only you see this — it never appears on the client&apos;s side.</p>
        <ul className="space-y-2.5">
          {dims.map(({ key, d }) => (
            <li key={key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
              <span className="w-24 shrink-0 font-medium">{key}</span>
              <Dots score={d.score} confident={d.confident} />
              <span className={cn("min-w-0 flex-1 text-muted-foreground", !d.confident && "italic")}>{d.reason}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/** Five dots. Hollow throughout when there is not enough history to mean anything. */
function Dots({ score, confident }: { score: number; confident: boolean }) {
  const filled = confident ? Math.round(score / 20) : 0;
  const tone = !confident ? "text-muted-foreground/40" : score >= 80 ? "text-emerald-600 dark:text-emerald-400" : score >= 60 ? "text-muted-foreground" : "text-destructive";
  return (
    <span className={cn("shrink-0 font-mono text-xs tracking-tight", tone)} aria-label={confident ? `${score} out of 100` : "Not enough history"}>
      {"●".repeat(filled)}
      {"○".repeat(5 - filled)}
    </span>
  );
}

export function StatusPill({ status, className }: { status: HealthStatus; className?: string }) {
  const meta = STATUS_META[status];
  const tones: Record<string, string> = {
    good: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
    neutral: "bg-muted text-muted-foreground",
    warn: "bg-tjm-orange/15 text-[#b45200] dark:text-tjm-orange",
    bad: "bg-destructive/15 text-destructive",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 font-heading text-[11px] font-bold", tones[meta.tone], className)}>
      {meta.label}
    </span>
  );
}

/**
 * Turn scoring off for a client.
 *
 * The numbers are sometimes wrong about a person — illness, bereavement, a
 * planned break — and a tool that cannot be told so is one the trainer learns
 * to distrust.
 */
function ExemptionDialog({
  clientId,
  exempt,
  exemptReason,
}: {
  clientId: string;
  exempt: boolean;
  exemptReason: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WalletActionState, FormData>(async (prev, fd) => {
    const r = await saveHealthExemption(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        {exempt ? "Resume scoring" : "Don't score"}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action}>
            <DialogHeader>
              <DialogTitle>{exempt ? "Start scoring this client again?" : "Leave this client out of scoring?"}</DialogTitle>
              <DialogDescription>
                {exempt
                  ? "They'll be rated alongside everyone else from now on."
                  : "For when the numbers would be unfair — illness, a bereavement, a long planned break. They'll show as “Not scored” and stay out of Needs attention."}
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="exempt" value={exempt ? "false" : "true"} />
            {!exempt && (
              <div className="space-y-1 py-4">
                <Label htmlFor="exempt-reason">Reason (optional, private to you)</Label>
                <Input
                  id="exempt-reason"
                  name="reason"
                  defaultValue={exemptReason ?? ""}
                  maxLength={200}
                  placeholder="Recovering from surgery — revisit in spring"
                  autoFocus
                />
              </div>
            )}
            {state.error && <p className="pb-2 text-sm text-destructive">{state.error}</p>}
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : exempt ? "Resume scoring" : "Leave out of scoring"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
