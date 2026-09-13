"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdhocOnlineSession, createGuestLink } from "./session-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, Copy, Video } from "lucide-react";

export type ClientOption = { id: string; name: string };

const DURATIONS = [30, 60, 90, 120];

/**
 * Book an online session directly, without waiting for a client to request one.
 * Opens either from the "New online session" button or by clicking empty space
 * in the calendar, which pre-fills the date and time.
 */
export function NewSessionDialog({
  clients,
  open,
  onClose,
  initialDate,
  initialTime,
}: {
  clients: ClientOption[];
  open: boolean;
  onClose: () => void;
  initialDate: string;
  initialTime?: string;
}) {
  const router = useRouter();
  const [clientId, setClientId] = useState("");
  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime ?? "09:00");
  const [duration, setDuration] = useState(60);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setMsg(null);
      const r = await createAdhocOnlineSession({ clientId, date, startTime: time, duration, note: note || undefined });
      if (r.error) return setMsg(r.error);
      router.refresh();
      // Go straight for the link — sharing it is the point of booking this way.
      const l = await createGuestLink(r.bookingId!);
      if (l.url) setLink(l.url);
      setMsg(r.warnings?.length ? r.warnings.join(" ") : null);
    });

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-4 w-4" /> New online session
          </DialogTitle>
          <DialogDescription>
            Booked straight into your calendar as confirmed — the client doesn&apos;t need to accept it.
          </DialogDescription>
        </DialogHeader>

        {link ? (
          <div className="space-y-3">
            <p className="text-sm">Session booked. Send this link to your client:</p>
            <div className="flex gap-2">
              <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can join while the session is open, so share it only with your client. It works
              from 15 minutes before the start, and it&apos;s also in their account under My sessions.
            </p>
            {msg && <p className="text-sm text-[#b45200]">{msg}</p>}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="client">Client</Label>
              <select
                id="client"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="h-9 w-full rounded-md border bg-transparent px-3 text-sm"
              >
                <option value="">Choose a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="date">Date</Label>
                <Input id="date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
              <div className="w-28 space-y-1">
                <Label htmlFor="time">Start</Label>
                <Input id="time" type="time" step={300} value={time} onChange={(e) => setTime(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Duration</Label>
              <div className="flex flex-wrap gap-2">
                {DURATIONS.map((m) => (
                  <Button key={m} type="button" size="sm" variant={duration === m ? "default" : "outline"} onClick={() => setDuration(m)}>
                    {m} min
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="note">Note (optional)</Label>
              <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What you'll cover" />
            </div>

            {msg && <p className="text-sm text-[#b45200]">{msg}</p>}
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2">
          {!link && (
            <Button onClick={submit} disabled={pending || !clientId}>
              {pending ? "Booking…" : "Book and get link"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {link ? "Done" : "Cancel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
