import { TrainerCalendarView } from "./calendar-view";
import { sweepCompletedSessions } from "./actions";

export default async function TrainerCalendarPage({ searchParams }: PageProps<"/trainer">) {
  // Finish off sessions that were never marked, so their charges land without
  // the trainer having to tick every box. Idempotent and cheap when nothing is
  // due; the codebase has no cron, so it rides on the page that loads anyway.
  await sweepCompletedSessions();
  return <TrainerCalendarView sp={await searchParams} />;
}
