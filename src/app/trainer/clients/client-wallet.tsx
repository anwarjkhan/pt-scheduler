"use client";

import { useActionState, useState } from "react";
import { formatInTimeZone } from "date-fns-tz";
import {
  clearDownWallet,
  editEntry,
  recordAdjustment,
  recordSettlement,
  recordTopUp,
  saveClientBilling,
  type WalletActionState,
} from "./wallet-actions";
import { formatMoney, formatSigned } from "@/lib/pricing";
import { REASON_LABELS, type WalletReason } from "@/lib/wallet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type LedgerEntry = {
  id: string;
  amountPence: number;
  currency: string;
  reason: string;
  note: string | null;
  createdAt: string;
  runningBalance: number;
  editedAt: string | null;
  originalAmountPence: number | null;
  fromCard: boolean;
  booking: { startAt: string; durationMin: number; sessionType: string } | null;
};

export type StatementSummary = {
  label: string;
  chargedPence: number;
  creditedPence: number;
  openingPence: number;
  closingPence: number;
};

/**
 * The client's money, on the trainer's side of the app.
 *
 * The balance reads in words as well as sign — "£120.00 in credit" versus
 * "£45.00 owed" — because a minus sign alone is how people misread a
 * statement. A wrong row can be corrected, and what it first said is kept
 * beside it; there is no delete, because a removed row is one nobody can
 * account for later.
 */
export function ClientWallet({
  clientId,
  clientName,
  balancePence,
  currency,
  billingMode,
  policy,
  globalPolicy,
  ledger,
  statement,
  tz,
}: {
  clientId: string;
  clientName: string;
  balancePence: number;
  currency: string;
  billingMode: string;
  policy: { noticeHours: number | null; depositPct: number | null };
  globalPolicy: { noticeHours: number; depositPct: number };
  ledger: LedgerEntry[];
  statement: StatementSummary;
  tz: string;
}) {
  const inCredit = balancePence > 0;
  const owed = balancePence < 0;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Wallet</CardTitle>
            <CardDescription>
              {billingMode === "WALLET"
                ? "Pre-paid: sessions are deducted from the balance."
                : "Monthly: charges accrue and are settled at month end."}
            </CardDescription>
          </div>
          <div className="text-right">
            <div
              className={cn(
                "font-heading text-3xl font-semibold tabular-nums",
                inCredit && "text-emerald-600 dark:text-emerald-400",
                owed && "text-destructive",
              )}
            >
              {formatMoney(Math.abs(balancePence), currency)}
            </div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">
              {balancePence === 0 ? (billingMode === "WALLET" ? "No credit left" : "Nothing outstanding") : inCredit ? "In credit" : "Owed"}
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <MoneyDialog
            trigger="Record a top-up"
            title={`Record a top-up for ${clientName}`}
            description="Money you've received from the client — bank transfer, cash. This credits their wallet."
            action={recordTopUp}
            clientId={clientId}
            submitLabel="Add credit"
          />
          <MoneyDialog
            trigger="Record a payment"
            title={`Record a payment from ${clientName}`}
            description="Settles what they owe. Part payments are fine."
            action={recordSettlement}
            clientId={clientId}
            submitLabel="Record payment"
            defaultAmount={owed ? (Math.abs(balancePence) / 100).toFixed(2) : ""}
            variant="outline"
          />
          <MoneyDialog
            trigger="Adjustment"
            title={`Adjust ${clientName}'s balance`}
            description="A goodwill credit or a correction. Use a minus sign to charge. A note is required — this is the entry nobody can account for later without one."
            action={recordAdjustment}
            clientId={clientId}
            submitLabel="Save adjustment"
            requireNote
            allowNegative
            variant="outline"
          />
          {balancePence !== 0 && (
            <ClearDownDialog clientId={clientId} clientName={clientName} balancePence={balancePence} currency={currency} />
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>History</CardTitle>
            <CardDescription>
              Every movement, newest first. Editing a row keeps what it originally said, so the history still adds up.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {ledger.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet.</p>
            ) : (
              <ul className="divide-y">
                {ledger.map((e) => (
                  <li key={e.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                    <div className="min-w-32">
                      <div className="font-medium">{REASON_LABELS[e.reason as WalletReason] ?? e.reason}</div>
                      <div className="text-xs text-muted-foreground">{formatInTimeZone(new Date(e.createdAt), tz, "d MMM yyyy")}</div>
                    </div>
                    <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {e.booking && (
                        <div>
                          {formatInTimeZone(new Date(e.booking.startAt), tz, "EEE d MMM, HH:mm")} · {e.booking.durationMin} min
                          {e.booking.sessionType === "ONLINE" ? " · online" : ""}
                        </div>
                      )}
                      {e.note && <div className="mt-0.5">{e.note}</div>}
                      {e.editedAt && (
                        <div className="mt-0.5 italic">
                          edited {formatInTimeZone(new Date(e.editedAt), tz, "d MMM")}
                          {e.originalAmountPence != null && ` · was ${formatSigned(e.originalAmountPence, e.currency)}`}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className={cn("font-medium tabular-nums", e.amountPence < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400")}>
                        {formatSigned(e.amountPence, e.currency)}
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">{formatMoney(e.runningBalance, e.currency)}</div>
                    </div>
                    {!e.fromCard && <EditEntryDialog entry={e} />}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{statement.label}</CardTitle>
              <CardDescription>This calendar month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Opening" value={formatMoney(statement.openingPence, currency)} />
              <Row label="Charged" value={`−${formatMoney(statement.chargedPence, currency)}`} />
              <Row label="Paid in" value={`+${formatMoney(statement.creditedPence, currency)}`} />
              <div className="border-t pt-2">
                <Row label="Closing" value={formatMoney(statement.closingPence, currency)} strong />
              </div>
            </CardContent>
          </Card>

          <BillingSettings
            clientId={clientId}
            billingMode={billingMode}
            policy={policy}
            globalPolicy={globalPolicy}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>{label}</span>
      <span className={cn("tabular-nums", strong && "font-semibold")}>{value}</span>
    </div>
  );
}

/** Shared top-up / payment / adjustment dialog. */
function MoneyDialog({
  trigger,
  title,
  description,
  action,
  clientId,
  submitLabel,
  defaultAmount = "",
  requireNote = false,
  allowNegative = false,
  variant = "default",
}: {
  trigger: string;
  title: string;
  description: string;
  action: (prev: WalletActionState, fd: FormData) => Promise<WalletActionState>;
  clientId: string;
  submitLabel: string;
  defaultAmount?: string;
  requireNote?: boolean;
  allowNegative?: boolean;
  variant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<WalletActionState, FormData>(async (prev, fd) => {
    const r = await action(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});

  return (
    <>
      <Button size="sm" variant={variant} onClick={() => setOpen(true)}>
        {trigger}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction}>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <input type="hidden" name="clientId" value={clientId} />
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor={`amount-${trigger}`}>Amount</Label>
                <div className="relative w-40">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                  <Input
                    id={`amount-${trigger}`}
                    name="amount"
                    defaultValue={defaultAmount}
                    inputMode="decimal"
                    placeholder={allowNegative ? "-10.00" : "60.00"}
                    className="pl-7"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`note-${trigger}`}>Note{requireNote ? "" : " (optional)"}</Label>
                <Input id={`note-${trigger}`} name="note" maxLength={200} placeholder={requireNote ? "Why this adjustment?" : "Bank transfer"} />
              </div>
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Billing mode and the per-client cancellation override. */
function BillingSettings({
  clientId,
  billingMode,
  policy,
  globalPolicy,
}: {
  clientId: string;
  billingMode: string;
  policy: { noticeHours: number | null; depositPct: number | null };
  globalPolicy: { noticeHours: number; depositPct: number };
}) {
  const [state, action, pending] = useActionState<WalletActionState, FormData>(saveClientBilling, {});

  return (
    <Card>
      <CardHeader>
        <CardTitle>Billing</CardTitle>
        <CardDescription>Leave the policy fields blank to use your defaults.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="space-y-4">
          <input type="hidden" name="clientId" value={clientId} />
          <div className="space-y-1">
            <Label htmlFor="billingMode">Pays by</Label>
            <select
              id="billingMode"
              name="billingMode"
              defaultValue={billingMode}
              className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
            >
              <option value="MONTHLY">Monthly — settles at month end</option>
              <option value="WALLET">Wallet — pre-pays and spends down</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cancellationNoticeHours" className="text-xs">
                Notice (hours)
              </Label>
              <Input
                id="cancellationNoticeHours"
                name="cancellationNoticeHours"
                type="number"
                min={0}
                max={168}
                defaultValue={policy.noticeHours ?? ""}
                placeholder={String(globalPolicy.noticeHours)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cancellationDepositPct" className="text-xs">
                Deposit (%)
              </Label>
              <Input
                id="cancellationDepositPct"
                name="cancellationDepositPct"
                type="number"
                min={0}
                max={100}
                defaultValue={policy.depositPct ?? ""}
                placeholder={String(globalPolicy.depositPct)}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </Button>
            {state.ok && <span className="text-xs text-muted-foreground">Saved.</span>}
            {state.error && <span className="text-xs text-destructive">{state.error}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/**
 * Correct a row in place. The original figure is kept and shown beneath the
 * corrected one, so the history still reconstructs.
 */
function EditEntryDialog({ entry }: { entry: LedgerEntry }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WalletActionState, FormData>(async (prev, fd) => {
    const r = await editEntry(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
      >
        Edit
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action}>
            <DialogHeader>
              <DialogTitle>Edit this entry</DialogTitle>
              <DialogDescription>
                The amount as first written is kept and shown to the client alongside the correction, so the history
                still adds up.
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" name="entryId" value={entry.id} />
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor={`edit-amount-${entry.id}`}>Amount</Label>
                <div className="relative w-40">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">£</span>
                  <Input
                    id={`edit-amount-${entry.id}`}
                    name="amount"
                    defaultValue={(entry.amountPence / 100).toFixed(2)}
                    inputMode="decimal"
                    className="pl-7"
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {entry.reason === "ADJUSTMENT"
                    ? "Use a minus sign to charge rather than credit."
                    : entry.amountPence < 0
                      ? "This is a charge — the amount stays a charge however you type it."
                      : "This is a credit — the amount stays a credit however you type it."}
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor={`edit-note-${entry.id}`}>Note</Label>
                <Input id={`edit-note-${entry.id}`} name="note" defaultValue={entry.note ?? ""} maxLength={200} />
              </div>
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Zero a wallet when the client is leaving or has been refunded offline.
 * Writes one entry for the exact balance, so the ledger stays honest without
 * implying the app moved any money.
 */
function ClearDownDialog({
  clientId,
  clientName,
  balancePence,
  currency,
}: {
  clientId: string;
  clientName: string;
  balancePence: number;
  currency: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<WalletActionState, FormData>(async (prev, fd) => {
    const r = await clearDownWallet(prev, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});

  const credit = balancePence > 0;

  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        Clear balance
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={action}>
            <DialogHeader>
              <DialogTitle>Clear {clientName}&apos;s balance?</DialogTitle>
              <DialogDescription>
                {credit
                  ? `This zeroes ${formatMoney(balancePence, currency)} of credit — use it once you've refunded them. The app doesn't move any money; this just records it.`
                  : `This writes off ${formatMoney(Math.abs(balancePence), currency)} they owe. The app doesn't move any money; this just records it.`}
              </DialogDescription>
            </DialogHeader>
            <input type="hidden" name="clientId" value={clientId} />
            <div className="space-y-4 py-4">
              <div className="space-y-1">
                <Label htmlFor="cleardown-note">What happened to it?</Label>
                <Input
                  id="cleardown-note"
                  name="note"
                  maxLength={200}
                  placeholder={credit ? "Refunded by bank transfer" : "Written off"}
                  autoFocus
                />
              </div>
              {state.error && <p className="text-sm text-destructive">{state.error}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Clearing…" : "Clear to zero"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
