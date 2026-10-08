import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getTrainerSettings } from "@/lib/settings";
import { getBalance, getLedger, REASON_LABELS, type WalletReason } from "@/lib/wallet";
import { resolvePolicy } from "@/lib/cancellation";
import { formatMoney, formatSigned } from "@/lib/pricing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { stripeConfigured } from "@/lib/stripe";
import { TopUpButton } from "./top-up-button";

/**
 * The client's own view of their money.
 *
 * Deliberately plain: what they hold or owe, what each movement was, and the
 * cancellation terms in words. A client should be able to read their own
 * policy without having to ask the trainer what it is.
 */
export default async function WalletPage({ searchParams }: PageProps<"/app/wallet">) {
  const user = await requireUser();
  const { topup } = await searchParams;
  const settings = await getTrainerSettings();
  const tz = settings.timezone;

  const [me, balance, ledger] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { billingMode: true, cancellationNoticeHours: true, cancellationDepositPct: true },
    }),
    getBalance(user.id),
    getLedger(user.id, 100),
  ]);

  const policy = resolvePolicy(me, settings);
  const currency = settings.currency;
  const wallet = me?.billingMode === "WALLET";
  const inCredit = balance > 0;
  const owed = balance < 0;

  const canPayByCard = stripeConfigured();

  return (
    <div className="space-y-6">
      <h1 className="font-heading text-2xl font-semibold">Wallet</h1>

      {topup === "success" && (
        <Alert>
          <AlertDescription>
            Thanks — your payment went through. The credit appears below as soon as it clears, usually within a few
            seconds. Refresh if you don&apos;t see it yet.
          </AlertDescription>
        </Alert>
      )}
      {topup === "cancelled" && (
        <Alert>
          <AlertDescription>Payment cancelled — nothing was charged.</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{wallet ? "Your balance" : "Your account"}</CardTitle>
          <CardDescription>
            {wallet
              ? "You pay in advance and each session comes out of your balance."
              : "Your sessions are added up and settled at the end of the month."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "font-heading text-4xl font-semibold tabular-nums",
              inCredit && "text-emerald-600 dark:text-emerald-400",
              owed && "text-destructive",
            )}
          >
            {formatMoney(Math.abs(balance), currency)}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {balance === 0
              ? wallet
                ? canPayByCard
                  ? "No credit left — top up to book your next session."
                  : "No credit left — top up with Toby before your next session."
                : "Nothing outstanding."
              : inCredit
                ? "in credit"
                : canPayByCard
                  ? "owed — pay by card below, or settle with Toby."
                  : "owed — settle this with Toby."}
          </p>
          {canPayByCard && (
            <div className="mt-4">
              <TopUpButton />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cancelling a session</CardTitle>
        </CardHeader>
        <CardContent className="text-sm">
          {policy.depositPct === 0 ? (
            <p>You can cancel any session free of charge.</p>
          ) : (
            <p>
              You can cancel free up to <strong>{policy.noticeHours} hours</strong> before a session. After that,{" "}
              <strong>{policy.depositPct}%</strong> of the session price applies. The exact amount is always shown
              before you confirm.
            </p>
          )}
          <p className="mt-2 text-muted-foreground">
            If you don&apos;t turn up without cancelling, the same {policy.depositPct}% applies. If Toby cancels, you
            are never charged.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>History</CardTitle>
          <CardDescription>Every payment and charge, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {ledger.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="divide-y">
              {ledger.map((e) => (
                <li key={e.id} className="flex flex-wrap items-start gap-3 py-3 text-sm">
                  <div className="min-w-36">
                    <div className="font-medium">{REASON_LABELS[e.reason as WalletReason] ?? e.reason}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatInTimeZone(e.createdAt, tz, "d MMM yyyy")}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                    {e.booking && (
                      <div>
                        {formatInTimeZone(e.booking.startAt, tz, "EEE d MMM, HH:mm")} · {e.booking.durationMin} min
                        {e.booking.sessionType === "ONLINE" ? " · online" : ""}
                      </div>
                    )}
                    {e.note && <div className="mt-0.5">{e.note}</div>}
                    {e.editedAt && (
                      <div className="mt-0.5 italic">
                        corrected {formatInTimeZone(e.editedAt, tz, "d MMM")}
                        {e.originalAmountPence != null && ` · was ${formatSigned(e.originalAmountPence, e.currency)}`}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        "font-medium tabular-nums",
                        e.amountPence < 0 ? "text-destructive" : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {formatSigned(e.amountPence, e.currency)}
                    </div>
                    <div className="text-xs tabular-nums text-muted-foreground">
                      {formatMoney(e.runningBalance, e.currency)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
