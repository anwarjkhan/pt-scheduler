"use client";

import { useState, useTransition } from "react";
import { createGuestLink, revokeGuestLink } from "./session-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Copy, Link2 } from "lucide-react";

/**
 * Produce a shareable guest link for a confirmed online session.
 *
 * The link is a bearer credential — whoever holds it can join while the session
 * is open — so it is only created when the trainer asks, and can be revoked.
 */
export function ShareLink({ bookingId }: { bookingId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const make = () =>
    start(async () => {
      setErr(null);
      const r = await createGuestLink(bookingId);
      if (r.error) return setErr(r.error);
      setUrl(r.url ?? null);
    });

  const revoke = () =>
    start(async () => {
      await revokeGuestLink(bookingId);
      setUrl(null);
      setCopied(false);
    });

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  if (!url) {
    return (
      <div className="space-y-1">
        <Button type="button" variant="outline" size="sm" onClick={make} disabled={pending}>
          <Link2 className="h-4 w-4" /> {pending ? "Creating…" : "Get join link"}
        </Button>
        {err && <p className="text-sm text-[#b45200]">{err}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="text-xs" />
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Anyone with this link can join while the session is open.{" "}
        <button type="button" onClick={revoke} disabled={pending} className="underline">
          Revoke
        </button>
      </p>
    </div>
  );
}
