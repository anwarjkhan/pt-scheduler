"use client";

import { useActionState } from "react";
import Link from "next/link";
import { saveBillingSettings, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const DURATIONS = [30, 60, 90, 120] as const;
const TYPES = [
  { value: "IN_PERSON", label: "In person" },
  { value: "ONLINE", label: "Online" },
] as const;

export type RateMap = Record<string, number>;

/**
 * Prices and the money-side rules.
 *
 * The rate grid is the pair every booking already carries — session type by
 * duration — so there is nothing new to choose at booking time. A blank cell
 * means that combination is not sold: booking it raises an error rather than
 * pricing at zero, which is the failure nobody notices until the statement.
 */
export function Billing({
  rates,
  initial,
}: {
  rates: RateMap;
  initial: {
    currency: string;
    cancellationNoticeHours: number;
    cancellationDepositPct: number;
    autoCompleteAfterHours: number;
    weightReliability: number;
    weightValue: number;
    weightPayment: number;
    weightEffort: number;
  };
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveBillingSettings, {});

  return (
    <form action={action} className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Not sure what a setting does?{" "}
        <Link href="/trainer/guide/pricing" className="font-medium text-tjm-orange hover:underline">
          How pricing works
        </Link>{" "}
        and{" "}
        <Link href="/trainer/guide/scoring" className="font-medium text-tjm-orange hover:underline">
          how scoring works
        </Link>{" "}
        explain these with your own numbers.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Session prices</CardTitle>
          <CardDescription>
            What each session costs. The price is fixed when a client books, so changing a rate here never alters a
            session someone has already booked. Leave a cell blank if you don&apos;t sell that combination.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  {DURATIONS.map((d) => (
                    <th key={d} className="pb-2 pr-4 font-medium">
                      {d} min
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {TYPES.map((t) => (
                  <tr key={t.value} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{t.label}</td>
                    {DURATIONS.map((d) => {
                      const pence = rates[`${t.value}:${d}`];
                      return (
                        <td key={d} className="py-2 pr-4">
                          <div className="relative w-28">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                              £
                            </span>
                            <Input
                              name={`rate:${t.value}:${d}`}
                              defaultValue={pence == null ? "" : (pence / 100).toFixed(2)}
                              inputMode="decimal"
                              placeholder="—"
                              aria-label={`${t.label} ${d} minute price`}
                              className="pl-7"
                            />
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 w-40 space-y-1">
            <Label htmlFor="currency">Currency</Label>
            <Input id="currency" name="currency" defaultValue={initial.currency} maxLength={3} className="uppercase" />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cancellation policy</CardTitle>
            <CardDescription>
              The default for every client. You can override it per client on their page. A no-show is charged at the
              same deposit rate.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label htmlFor="cancellationNoticeHours">Free cancellation up to</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cancellationNoticeHours"
                  name="cancellationNoticeHours"
                  type="number"
                  min={0}
                  max={168}
                  defaultValue={initial.cancellationNoticeHours}
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cancellationDepositPct">Charged after that</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="cancellationDepositPct"
                  name="cancellationDepositPct"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={initial.cancellationDepositPct}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
            <p className="col-span-2 text-xs text-muted-foreground">
              Clients see this on their wallet page and in the cancel dialog, with the actual amount in pounds before
              they confirm.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Completing sessions</CardTitle>
            <CardDescription>
              A session is charged when it&apos;s marked complete. Anything you don&apos;t mark yourself is completed
              automatically after this long.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-40 space-y-1">
              <Label htmlFor="autoCompleteAfterHours">Auto-complete after</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="autoCompleteAfterHours"
                  name="autoCompleteAfterHours"
                  type="number"
                  min={1}
                  max={720}
                  defaultValue={initial.autoCompleteAfterHours}
                />
                <span className="text-sm text-muted-foreground">hours</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Client scoring</CardTitle>
          <CardDescription>
            How much each part counts toward a client&apos;s overall score, shown on their page and in your client
            list. They don&apos;t need to add up to 100 — the balance between them is what matters. Only you ever see
            these scores.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Weight name="weightReliability" label="Reliability" hint="Turning up" value={initial.weightReliability} />
          <Weight name="weightValue" label="Value" hint="Earned per hour" value={initial.weightValue} />
          <Weight name="weightPayment" label="Payment" hint="Pays without chasing" value={initial.weightPayment} />
          <Weight name="weightEffort" label="Effort" hint="Travel and moves" value={initial.weightEffort} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save billing settings"}
        </Button>
        {state.ok && <span className="text-sm text-muted-foreground">Saved.</span>}
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
      </div>
    </form>
  );
}

/** One scoring weight. */
function Weight({ name, label, hint, value }: { name: string; label: string; hint: string; value: number }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={name}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={name} name={name} type="number" min={0} max={100} defaultValue={value} />
        <span className="text-sm text-muted-foreground">%</span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
