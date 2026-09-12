"use client";

import { useActionState, useEffect, useState } from "react";
import { addPillar, deletePillar, movePillar, updatePillar, type SettingsState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Pencil, Trash2 } from "lucide-react";

export type PillarRow = { id: string; label: string; body: string };

/** Matches BODY_MAX in ./actions.ts, which enforces it server-side. */
export const PILLAR_BODY_MAX = 250;

/** Textarea with a live character count that turns red as the cap approaches. */
function BodyField({ id, defaultValue, rows = 5, placeholder }: { id: string; defaultValue?: string; rows?: number; placeholder?: string }) {
  const [value, setValue] = useState(defaultValue ?? "");
  const left = PILLAR_BODY_MAX - value.length;
  return (
    <>
      <Textarea
        id={id}
        name="body"
        required
        rows={rows}
        maxLength={PILLAR_BODY_MAX}
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <p className={`text-right text-xs ${left <= 25 ? "text-destructive" : "text-muted-foreground"}`}>
        {left} character{left === 1 ? "" : "s"} left
      </p>
    </>
  );
}

/**
 * The hero chips (Health, Movement, Prehab…). Each has a label shown on the chip
 * and body text shown in a modal when a visitor clicks it.
 */
export function Pillars({ pillars, usingFallback }: { pillars: PillarRow[]; usingFallback: boolean }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(addPillar, {});
  const [editing, setEditing] = useState<string | null>(null);
  const formKey = state.ok ? pillars.length : -1;

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <CardTitle>Hero chips</CardTitle>
        <CardDescription>
          The keywords across the top of the home page. Visitors click one to read what you mean by it — a chip with no text stays unclickable.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        <div>
          {usingFallback && (
            <p className="mb-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              These are the defaults from the original site. Editing or adding one saves the whole set so you can change them freely.
            </p>
          )}
          <ul className="divide-y rounded-md border">
            {pillars.map((p, i) => (
              <li key={p.id}>
                {editing === p.id ? (
                  <div className="p-3">
                    <EditPillarForm pillar={p} onDone={() => setEditing(null)} />
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="font-heading font-semibold">{p.label}</div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {p.body || <span className="italic">No text yet — the chip won&apos;t open.</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Move ${p.label} up`}
                        disabled={i === 0 || usingFallback}
                        onClick={() => movePillar(p.id, "up")}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move ${p.label} down`}
                        disabled={i === pillars.length - 1 || usingFallback}
                        onClick={() => movePillar(p.id, "down")}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                      >
                        <ChevronDown className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Edit ${p.label}`}
                        onClick={() => setEditing(p.id)}
                        className="rounded-sm p-1 text-muted-foreground hover:bg-muted"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!usingFallback && (
                        <form action={() => deletePillar(p.id)}>
                          <button type="submit" aria-label={`Delete ${p.label}`} className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>

        <form key={formKey} action={action} className="space-y-3">
          <h3 className="font-heading text-sm font-semibold uppercase tracking-widest text-muted-foreground">Add a chip</h3>
          <div className="space-y-1">
            <Label htmlFor="pillar-label">Label</Label>
            <Input id="pillar-label" name="label" required maxLength={40} placeholder="e.g. Strength" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pillar-body">What it means</Label>
            <BodyField id="pillar-body" placeholder="Shown over the hero photo when a visitor hovers the chip." />
          </div>
          {state.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add chip"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EditPillarForm({ pillar, onDone }: { pillar: PillarRow; onDone: () => void }) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(updatePillar.bind(null, pillar.id), {});
  // Close on success — in an effect, not during render.
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  return (
    <form action={action} className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={`label-${pillar.id}`}>Label</Label>
        <Input id={`label-${pillar.id}`} name="label" defaultValue={pillar.label} required maxLength={40} />
      </div>
      <div className="space-y-1">
        <Label htmlFor={`body-${pillar.id}`}>What it means</Label>
        <BodyField id={`body-${pillar.id}`} defaultValue={pillar.body} rows={6} />
      </div>
      {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
