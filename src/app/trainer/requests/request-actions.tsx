"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptBooking, acceptSeries, declineBooking, declineSeries } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Result = { ok?: boolean; error?: string; warnings?: string[] };

function useRun() {
  const router = useRouter();
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<Result>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.error ?? (r.warnings?.length ? r.warnings.join(" ") : null));
      router.refresh();
    });
  return { run, msg, pending };
}

export function SingleActions({ id }: { id: string }) {
  const { run, msg, pending } = useRun();
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={() => run(() => acceptBooking(id))} disabled={pending}>
        Accept
      </Button>
      <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="h-7 w-44 text-xs" />
      <Button size="sm" variant="outline" onClick={() => run(() => declineBooking(id, reason))} disabled={pending}>
        Decline
      </Button>
      {msg && <span className="text-xs text-[#b45200]">{msg}</span>}
    </div>
  );
}

export function SeriesActions({ seriesId, occurrences }: { seriesId: string; occurrences: { id: string; label: string; warning: boolean }[] }) {
  const { run, msg, pending } = useRun();
  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState("");
  const toggle = (id: string) =>
    setSkip((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div className="space-y-2">
      <ul className="grid gap-1 sm:grid-cols-2">
        {occurrences.map((o) => (
          <li key={o.id} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!skip.has(o.id)} onChange={() => toggle(o.id)} id={`occ-${o.id}`} />
            <label htmlFor={`occ-${o.id}`} className={o.warning ? "text-destructive" : ""}>
              {o.label}
              {o.warning && " ⚠ tight commute"}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => run(() => acceptSeries(seriesId, [...skip]))} disabled={pending || skip.size === occurrences.length}>
          Accept {skip.size ? `${occurrences.length - skip.size} of ${occurrences.length}` : "all"}
        </Button>
        <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="h-7 w-44 text-xs" />
        <Button size="sm" variant="outline" onClick={() => run(() => declineSeries(seriesId, reason))} disabled={pending}>
          Decline series
        </Button>
        {msg && <span className="text-xs text-[#b45200]">{msg}</span>}
      </div>
    </div>
  );
}
