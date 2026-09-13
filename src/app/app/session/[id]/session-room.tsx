"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type DailyIframe from "@daily-co/daily-js";
import { Button } from "@/components/ui/button";

/**
 * Mounts Daily's prebuilt call into the page. Deliberately thin — every decision
 * about who may be here, and as what, was made on the server; this only renders
 * the room the server already authorised.
 */
export function SessionRoom({
  roomUrl,
  token,
  backHref,
  when,
}: {
  roomUrl: string;
  token: string;
  backHref: string;
  when: string;
}) {
  const router = useRouter();
  const holder = useRef<HTMLDivElement>(null);
  const frame = useRef<ReturnType<typeof DailyIframe.createFrame> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const el = holder.current;
    if (!el) return;

    (async () => {
      const { default: Daily } = await import("@daily-co/daily-js");
      // Strict Mode mounts effects twice in dev; bail if we lost the race.
      if (cancelled || frame.current) return;

      const call = Daily.createFrame(el, {
        showLeaveButton: true,
        showFullscreenButton: true,
        iframeStyle: { width: "100%", height: "100%", border: "0" },
      });
      frame.current = call;

      call.on("left-meeting", () => router.push(backHref));
      call.on("error", (ev) => setError(ev?.errorMsg ?? "The call ended unexpectedly."));

      try {
        await call.join({ url: roomUrl, token });
      } catch {
        if (!cancelled) setError("Couldn't connect to the session.");
      }
    })();

    return () => {
      cancelled = true;
      frame.current?.destroy();
      frame.current = null;
    };
  }, [roomUrl, token, backHref, router]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="font-heading text-xl font-semibold">Online session</h1>
          <p className="text-sm text-muted-foreground">{when}</p>
        </div>
        <Button variant="outline" onClick={() => router.push(backHref)}>
          Leave
        </Button>
      </div>

      {error && <p className="text-sm text-[#b45200]">{error}</p>}

      <div ref={holder} className="h-[70vh] min-h-100 w-full overflow-hidden rounded-lg border bg-black" />

      <p className="text-xs text-muted-foreground">
        Your browser will ask for camera and microphone access the first time you join.
      </p>
    </div>
  );
}
