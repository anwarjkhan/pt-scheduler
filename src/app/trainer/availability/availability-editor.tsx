"use client";

import { useActionState, useState } from "react";
import { addException, addRule, applyDefaultTemplate, deleteException, deleteRecurringException, deleteRule, type ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Repeat, Trash2 } from "lucide-react";

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type Rule = { id: string; weekday: number; startTime: string; endTime: string };
type Exception = {
  id: string;
  date: string;
  type: "UNAVAILABLE" | "EXTRA";
  startTime: string | null;
  endTime: string | null;
  note: string | null;
  recurringId?: string;
};
type Recurring = {
  id: string;
  weekday: number;
  intervalWeeks: number;
  startDate: string;
  endDate: string | null;
  type: string;
  startTime: string | null;
  endTime: string | null;
  note: string | null;
};

export function AvailabilityEditor({ rules, exceptions, recurring }: { rules: Rule[]; exceptions: Exception[]; recurring: Recurring[] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <WeeklyTemplate rules={rules} />
      <Exceptions exceptions={exceptions} recurring={recurring} />
    </div>
  );
}

function WeeklyTemplate({ rules }: { rules: Rule[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addRule, {});
  const order = [1, 2, 3, 4, 5, 6, 0];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly hours</CardTitle>
        <CardDescription>Your default working hours. Add multiple ranges per day for split shifts.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-md border">
          {order.map((wd) => {
            const day = rules.filter((r) => r.weekday === wd);
            return (
              <li key={wd} className="flex items-start gap-3 px-3 py-2">
                <span className="w-24 shrink-0 pt-1 text-sm font-medium">{WEEKDAYS[wd]}</span>
                <div className="flex flex-1 flex-wrap gap-2">
                  {day.length === 0 && <span className="pt-1 text-sm text-muted-foreground">Off</span>}
                  {day.map((r) => (
                    <span key={r.id} className="inline-flex items-center gap-1 rounded-md bg-accent px-2 py-1 text-sm">
                      {r.startTime}–{r.endTime}
                      <button
                        type="button"
                        aria-label="Remove range"
                        className="ml-1 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteRule(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>

        <form action={action} className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="weekday">Day</Label>
            <select id="weekday" name="weekday" className="h-9 rounded-md border bg-transparent px-2 text-sm" defaultValue={1}>
              {order.map((wd) => (
                <option key={wd} value={wd}>
                  {WEEKDAYS[wd]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-start">From</Label>
            <Input id="r-start" name="startTime" type="time" defaultValue="07:00" required className="w-28" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-end">To</Label>
            <Input id="r-end" name="endTime" type="time" defaultValue="20:00" required className="w-28" />
          </div>
          <Button type="submit" disabled={pending}>
            Add range
          </Button>
          {rules.length === 0 && (
            <Button type="button" variant="outline" onClick={() => applyDefaultTemplate()}>
              Use Mon–Fri 07:00–20:00
            </Button>
          )}
        </form>
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </CardContent>
    </Card>
  );
}

function Exceptions({ exceptions, recurring }: { exceptions: Exception[]; recurring: Recurring[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(addException, {});
  const [type, setType] = useState<"UNAVAILABLE" | "EXTRA">("UNAVAILABLE");
  const [allDay, setAllDay] = useState(true);
  const [repeat, setRepeat] = useState("0");
  const today = new Date().toISOString().slice(0, 10);
  // Show one-offs plus the next few generated occurrences so the list stays readable.
  const upcoming = exceptions.filter((e) => e.date >= today).slice(0, 12);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exceptions</CardTitle>
        <CardDescription>Days off, shortened days, or extra hours — one-off or repeating.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {recurring.length > 0 && (
          <div>
            <div className="mb-1 font-heading text-xs font-semibold uppercase tracking-widest text-muted-foreground">Repeating</div>
            <ul className="divide-y rounded-md border">
              {recurring.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <Repeat className="h-4 w-4 shrink-0 text-tjm-orange" />
                  <Badge variant={r.type === "EXTRA" ? "default" : "destructive"}>{r.type === "EXTRA" ? "Extra" : "Off"}</Badge>
                  <span className="flex-1 text-muted-foreground">
                    {r.intervalWeeks === 1 ? "Every" : `Every ${r.intervalWeeks}${r.intervalWeeks === 2 ? "nd" : "th"}`} {WEEKDAYS[r.weekday]}
                    {r.startTime ? ` ${r.startTime}–${r.endTime}` : ", all day"} from {r.startDate}
                    {r.endDate ? ` until ${r.endDate}` : ""}
                    {r.note ? ` · ${r.note}` : ""}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove repeating exception"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => {
                      if (confirm("Remove this repeating exception and all its future occurrences?")) deleteRecurringException(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <ul className="divide-y rounded-md border">
          {upcoming.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">No upcoming exceptions.</li>}
          {upcoming.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
              <span className="w-28 shrink-0 font-medium">{e.date}</span>
              <Badge variant={e.type === "EXTRA" ? "default" : "destructive"}>{e.type === "EXTRA" ? "Extra" : "Off"}</Badge>
              <span className="flex-1 text-muted-foreground">
                {e.startTime ? `${e.startTime}–${e.endTime}` : "All day"}
                {e.note ? ` · ${e.note}` : ""}
                {e.recurringId && <Repeat className="ml-1 inline h-3.5 w-3.5" aria-label="From a repeating exception" />}
              </span>
              {e.recurringId ? (
                <span className="text-xs text-muted-foreground">repeats</span>
              ) : (
                <button
                  type="button"
                  aria-label="Remove exception"
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() => deleteException(e.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>

        <form action={action} className="space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="e-date">Date</Label>
              <Input id="e-date" name="date" type="date" required min={today} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="e-type">Type</Label>
              <select
                id="e-type"
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="UNAVAILABLE">Unavailable</option>
                <option value="EXTRA">Extra hours</option>
              </select>
            </div>
            {type === "UNAVAILABLE" && (
              <label className="flex h-9 items-center gap-2 text-sm">
                <input type="checkbox" name="allDay" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
                All day
              </label>
            )}
            {(type === "EXTRA" || !allDay) && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="e-start">From</Label>
                  <Input id="e-start" name="startTime" type="time" required className="w-28" />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="e-end">To</Label>
                  <Input id="e-end" name="endTime" type="time" required className="w-28" />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="e-repeat">Repeat</Label>
              <select
                id="e-repeat"
                name="repeat"
                value={repeat}
                onChange={(e) => setRepeat(e.target.value)}
                className="h-9 rounded-md border bg-transparent px-2 text-sm"
              >
                <option value="0">Doesn&apos;t repeat</option>
                <option value="1">Every week</option>
                <option value="2">Every 2 weeks</option>
                <option value="4">Every 4 weeks</option>
              </select>
            </div>
            {repeat !== "0" && (
              <div className="space-y-1">
                <Label htmlFor="e-until">Until (optional)</Label>
                <Input id="e-until" name="until" type="date" min={today} />
              </div>
            )}
            <div className="min-w-40 flex-1 space-y-1">
              <Label htmlFor="e-note">Note (optional)</Label>
              <Input id="e-note" name="note" placeholder="Holiday, course, etc." />
            </div>
            <Button type="submit" disabled={pending}>
              {repeat !== "0" ? "Add repeating" : "Add exception"}
            </Button>
          </div>
          {repeat !== "0" && <p className="text-xs text-muted-foreground">Repeats on the same weekday as the date you pick, starting from that date.</p>}
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
        </form>
      </CardContent>
    </Card>
  );
}
