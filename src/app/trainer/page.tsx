import { TrainerCalendarView } from "./calendar-view";

export default async function TrainerCalendarPage({ searchParams }: PageProps<"/trainer">) {
  return <TrainerCalendarView sp={await searchParams} />;
}
