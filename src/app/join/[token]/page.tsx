import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { getSchedulingSettings } from "@/lib/settings";
import { mintToken, videoConfigured } from "@/lib/video";
import { joinState, joinWindow } from "@/lib/video-window";
import { SessionRoom } from "@/app/app/session/[id]/session-room";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

/**
 * Guest entry by shareable link — the one unauthenticated way into a room.
 *
 * The token in the URL is a bearer credential: whoever holds it gets in while
 * the session is open. It is therefore always a *guest* (never an owner), always
 * bounded by the session window, and revocable by clearing it on the room.
 */
export default async function GuestJoinPage({ params }: PageProps<"/join/[token]">) {
  const { token } = await params;

  const room = await db.videoRoom.findUnique({
    where: { guestToken: token },
    include: { booking: { include: { client: { select: { name: true, email: true } } } } },
  });
  // A bad or revoked token should look like nothing was ever there.
  if (!room?.booking) notFound();

  const booking = room.booking;
  const { timezone: tz } = await getSchedulingSettings();
  const when = `${formatInTimeZone(booking.startAt, tz, "EEEE d MMMM, HH:mm")}–${formatInTimeZone(booking.endAt, tz, "HH:mm")}`;
  const state = joinState(booking, new Date());

  if (state !== "OPEN" || !videoConfigured()) {
    const { opensAt } = joinWindow(booking);
    const message =
      state === "TOO_EARLY"
        ? `This session opens at ${formatInTimeZone(opensAt, tz, "HH:mm")} on ${formatInTimeZone(opensAt, tz, "EEEE d MMMM")}. Come back then using this same link.`
        : state === "ENDED"
          ? "This session has finished."
          : "This link isn't active.";
    return (
      <div className="mx-auto max-w-lg py-10">
        <Card>
          <CardHeader>
            <CardTitle>{state === "TOO_EARLY" ? "Not open yet" : "Session unavailable"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>{message}</p>
            <p>{when}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { closesAt } = joinWindow(booking);
  const token_ = await mintToken({
    roomName: room.roomName,
    // Never an owner: a link-holder cannot mute, admit or end the call.
    isOwner: false,
    userName: booking.client.name ?? "Guest",
    userId: `guest-${room.id}`,
    expiresAt: closesAt,
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <SessionRoom roomUrl={room.roomUrl} token={token_} backHref="/" when={when} />
    </div>
  );
}
