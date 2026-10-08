import Link from "next/link";
import { db } from "@/lib/db";
import { getTrainerSettings } from "@/lib/settings";
import { getAllClientHealth } from "@/lib/client-health-data";
import { formatMoney } from "@/lib/pricing";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Index for the trainer's guide.
 *
 * Each card carries a live figure from the thing it explains, so the guide
 * doubles as a quick check that the settings are what you think they are.
 */
export default async function GuideIndex() {
  const [settings, rules, health] = await Promise.all([
    getTrainerSettings(),
    db.priceRule.count(),
    getAllClientHealth(),
  ]);

  const standard = await db.priceRule.findFirst({ where: { sessionType: "IN_PERSON", durationMin: 60 } });
  const scored = [...health.values()].filter((h) => h.overall?.confident).length;

  const topics = [
    {
      href: "/trainer/guide/pricing",
      title: "How pricing works",
      description:
        "What a session costs, when a client is charged, what a late cancellation costs them, and how wallets work.",
      stat:
        rules === 0
          ? "No rates set yet"
          : `${rules} rates · ${standard ? `${formatMoney(standard.amountPence, settings.currency)} for an hour` : "in person and online"}`,
    },
    {
      href: "/trainer/guide/scoring",
      title: "How client scoring works",
      description:
        "The four things measured, how they combine into one score, what each label is suggesting you do, and how to switch it off for someone.",
      stat: `${settings.cancellationNoticeHours}h notice · ${scored} client${scored === 1 ? "" : "s"} fully scored`,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold">Guide</h1>
        <p className="max-w-2xl text-muted-foreground">
          How the money and the client ratings actually work, using your own numbers. These pages read your live
          settings, so they always match what the app is doing.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {topics.map((t) => (
          <Link key={t.href} href={t.href} className="group">
            <Card className="h-full transition-colors hover:border-tjm-orange">
              <CardHeader>
                <CardTitle className="group-hover:text-tjm-orange">{t.title}</CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t.stat}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
