import Link from "next/link";
import { notFound } from "next/navigation";
import { formatInTimeZone } from "date-fns-tz";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/session";
import { getSchedulingSettings } from "@/lib/settings";
import { getOrCreateRoom, mintToken, videoConfigured } from "@/lib/video";
import { joinState, joinWindow } from "@/lib/video-window";
import { SessionRoom } from "./session-room";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const dynamic = "force-dynamic";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-lg py-10">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">{children}</CardContent>
      </Card>
    </div>
  );
}

export default async function SessionPage({ params }: PageProps<"/app/session/[id]">) {
  const { id } = await params;
  const user = await requireUser();

  const booking = await db.booking.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, email: true } } },
  });

  // A booking that isn't this client's (and isn't being opened by the trainer)
  // is treated as missing rather than forbidden — no confirming it exists.
  const isTrainer = user.role === "TRAINER";
  if (!booking || (!isTrainer && booking.clientId !== user.id)) notFound();

  const { timezone: tz } = await getSchedulingSettings();
  const when = `${formatInTimeZone(booking.startAt, tz, "EEEE d MMMM, HH:mm")}–${formatInTimeZone(booking.endAt, tz, "HH:mm")}`;
  const back = isTrainer ? "/trainer" : "/app";
  const backLabel = isTrainer ? "Back to calendar" : "Back to my sessions";

  const state = joinState(booking, new Date());

  if (state !== "OPEN") {
    const { opensAt } = joinWindow(booking);
    const copy: Record<typeof state, string> = {
      NOT_ONLINE: "This is an in-person session — there's no video room for it.",
      NOT_CONFIRMED: "This session isn't confirmed, so its video room isn't open.",
      TOO_EARLY: `The room opens at ${formatInTimeZone(opensAt, tz, "HH:mm")} on ${formatInTimeZone(opensAt, tz, "EEEE d MMMM")}.`,
      ENDED: "This session has finished and its room is closed.",
    };
    return (
      <Shell title={state === "TOO_EARLY" ? "Not open yet" : "Room unavailable"}>
        <p>{copy[state]}</p>
        <p>{when}</p>
        <Button nativeButton={false} render={<Link href={back} />}>{backLabel}</Button>
      </Shell>
    );
  }

  if (!videoConfigured()) {
    return (
      <Shell title="Video isn't set up">
        <p>Online sessions aren&apos;t configured yet. Please contact your trainer.</p>
        <Button nativeButton={false} render={<Link href={back} />}>{backLabel}</Button>
      </Shell>
    );
  }

  // From here the viewer is authorised and inside the window, so mint a
  // short-lived credential. is_owner is decided here and never by the browser:
  // it is what makes the trainer the host.
  let roomUrl: string;
  let token: string;
  try {
    const room = await getOrCreateRoom(booking);
    const { closesAt } = joinWindow(booking);
    roomUrl = room.roomUrl;
    token = await mintToken({
      roomName: room.roomName,
      isOwner: isTrainer,
      userName: isTrainer ? "Your trainer" : (booking.client.name ?? booking.client.email),
      userId: user.id,
      expiresAt: closesAt,
    });
  } catch (e) {
    console.error("[video] could not open room for booking", id, e);
    return (
      <Shell title="Couldn't open the room">
        <p>Something went wrong setting up the video call. Try again in a moment.</p>
        <Button nativeButton={false} render={<Link href={back} />}>{backLabel}</Button>
      </Shell>
    );
  }

  return <SessionRoom roomUrl={roomUrl} token={token} backHref={back} when={when} />;
}
