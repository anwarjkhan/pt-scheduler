import Link from "next/link";
import { db } from "@/lib/db";
import { getTrainerSettings } from "@/lib/settings";
import { getAllClientHealth, weightsFrom } from "@/lib/client-health-data";
import {
  cancellationWeight,
  MIN_DAYS_TO_JUDGE,
  MIN_SESSIONS_TO_JUDGE,
  PROVISIONAL_CEILING,
  STATUS_META,
  type HealthStatus,
} from "@/lib/client-health";
import { StatusPill } from "../../clients/client-health-panel";
import { GuideHeader, Note, Section, SettingLink, Worked } from "../guide-ui";

/**
 * How client scoring works, shown against the trainer's own clients.
 *
 * The weights and thresholds are read from the code and settings rather than
 * restated, so this cannot drift from what the app actually does. The worked
 * example uses a real client, because a rule is far easier to trust applied to
 * a name you recognise.
 */
export default async function ScoringGuide() {
  const [settings, healthMap, clients] = await Promise.all([
    getTrainerSettings(),
    getAllClientHealth(),
    db.user.findMany({ where: { role: "CLIENT" }, select: { id: true, name: true, email: true } }),
  ]);

  const weights = weightsFrom(settings);
  const named = new Map(clients.map((c) => [c.id, c.name ?? c.email]));

  // Prefer a settled, high-scoring client for the worked example — the sum is
  // easiest to follow when nothing is being withheld.
  const entries = [...healthMap.entries()];
  const best =
    entries.filter(([, h]) => h.overall?.confident).sort((a, b) => (b[1].overall?.score ?? 0) - (a[1].overall?.score ?? 0))[0] ??
    entries[0];
  const [bestId, bestHealth] = best ?? [];

  // How many clients sit in each status, so the bands are concrete.
  const counts = new Map<HealthStatus, number>();
  for (const [, h] of entries) counts.set(h.status, (counts.get(h.status) ?? 0) + 1);

  const dimensionRows: { key: keyof typeof weights; label: string; what: string; how: string }[] = [
    {
      key: "reliability",
      label: "Reliability",
      what: "Do they turn up?",
      how: "Sessions kept against sessions committed to. A no-show costs the most; a cancellation costs by how little notice it gave.",
    },
    {
      key: "value",
      label: "Value",
      what: "What are they worth per hour?",
      how: "Earned per hour of your time, plus a bonus for training regularly. Total spend alone would just reward whoever books most.",
    },
    {
      key: "payment",
      label: "Payment",
      what: "Do they pay without chasing?",
      how: "Pre-paid credit scores highest. An owed balance costs more the longer it runs — a month is normal, two is not.",
    },
    {
      key: "effort",
      label: "Effort",
      what: "What do they cost besides training?",
      how: "Travel time against session time, and how often they move appointments. Shown even when it isn't counted.",
    },
  ];

  return (
    <div className="space-y-6">
      <GuideHeader
        title="How client scoring works"
        intro="Every client gets four ratings and one overall score, so you can see at a glance who's worth protecting and who needs a conversation. It's all worked out from sessions you've already run — there's nothing extra to fill in."
      />

      <Note tone="warn">
        <span className="font-medium text-foreground">Clients never see any of this.</span> Scores, statuses and your
        private notes are yours alone — they don&apos;t appear anywhere on the client&apos;s side of the app.
      </Note>

      <Section title="The four things measured" description="Kept separate on purpose.">
        <p>
          A client can be lucrative and exhausting, or lovely and barely profitable. One blended number would hide
          exactly the thing worth acting on, so each is rated on its own and you see the evidence behind it.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Measure</th>
                <th className="pb-2 pr-4 font-medium">The question</th>
                <th className="pb-2 pr-4 font-medium">Your weight</th>
              </tr>
            </thead>
            <tbody>
              {dimensionRows.map((d) => (
                <tr key={d.key} className="border-b last:border-0 align-top">
                  <td className="py-2 pr-4 font-medium">{d.label}</td>
                  <td className="py-2 pr-4">
                    <div>{d.what}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground">{d.how}</div>
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{weights[d.key]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <SettingLink href="/trainer/settings">Change the weights in Settings → Billing</SettingLink>
      </Section>

      <Section title="How the overall score is worked out" description="The four, blended by your weights.">
        {bestId && bestHealth?.overall ? (
          <>
            <Worked
              title={`${named.get(bestId)} — a real example`}
              rows={bestHealth.overall.parts.map((p) => ({
                label: `${p.key[0].toUpperCase()}${p.key.slice(1)} ${p.score} × ${p.weight}%`,
                value: p.counted ? `${Math.round((p.score * p.weight) / 100)}` : "not counted",
              }))}
              total={{ label: "Overall", value: `${bestHealth.overall.score} / 100` }}
            />
            <p className="text-xs text-muted-foreground">
              The total divides by the weights actually counted, not by 100 — which is why the parts above may not add
              up to the score on their own.
            </p>
          </>
        ) : (
          <p className="text-muted-foreground">No clients with enough history to show an example yet.</p>
        )}
        <Note>
          A measure that can&apos;t be worked out is left out, and the rest are rebalanced to make up the difference.
          Travel is the usual one — scoring an unknown distance as zero would quietly mark down every client until
          there&apos;s enough journey data.
        </Note>
      </Section>

      <Section
        title="Nothing is judged too early"
        description={`At least ${MIN_SESSIONS_TO_JUDGE} sessions and ${MIN_DAYS_TO_JUDGE} days.`}
      >
        <p>
          A score from two sessions is noise wearing a number. Until a client passes both marks their score shows with
          a <span className="font-mono">~</span>, is capped at {PROVISIONAL_CEILING}, and sorts below everyone
          settled — so a promising newcomer never outranks someone who has actually earned it.
        </p>
        <p>
          Money is the exception. An unpaid balance is a fact rather than a guess about behaviour, so a long-standing
          debt is flagged whatever the history.
        </p>
      </Section>

      <Section title="What each label means" description="And what it's suggesting you do.">
        <ul className="space-y-3">
          {(
            [
              ["STAR", "Protect this one. Give them the slots they want."],
              ["STEADY", "Nothing to do. Most clients live here."],
              ["DRIFTING", "They've gone quiet. A message now, before they're gone for good."],
              ["ATTENTION", "Chase the money, or have a word about the cancellations."],
              ["TOO_EARLY", "Too new to call. Nothing to do."],
              ["EXEMPT", "You've asked for them not to be scored."],
            ] as const
          ).map(([status, advice]) => (
            <li key={status} className="flex flex-wrap items-baseline gap-2">
              <StatusPill status={status} />
              <span className="text-muted-foreground">{advice}</span>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {counts.get(status) ?? 0} client{(counts.get(status) ?? 0) === 1 ? "" : "s"}
              </span>
            </li>
          ))}
        </ul>
        <p>
          <span className="font-medium text-foreground">{STATUS_META.STAR.label}</span> is deliberately hard to earn —
          near-perfect attendance, a strong rate, a settled balance, at least 10 sessions, and no habit of moving
          appointments. A badge most people wear tells you nothing.
        </p>
        <Note>
          Drifting comes before an unpaid balance. Someone who has stopped coming is the more urgent conversation, and
          the debt is usually a symptom of it.
        </Note>
      </Section>

      <Section
        title="Why a cancellation costs what it does"
        description="Notice given matters more than the number of cancellations."
      >
        <p>
          Cancelling three days out and cancelling forty minutes out are not the same act. Counting them equally would
          punish the considerate client and the inconsiderate one identically, so reliability is docked by how much
          warning you got:
        </p>
        <Worked
          title="Cost to their reliability"
          rows={[
            { label: "Under 2 hours", value: `${cancellationWeight(1) * 100}% — as bad as not turning up` },
            { label: "2 to 12 hours", value: `${Math.round(cancellationWeight(6) * 100)}%` },
            { label: "12 to 24 hours", value: `${Math.round(cancellationWeight(18) * 100)}%` },
            { label: "24 to 48 hours", value: `${Math.round(cancellationWeight(36) * 100)}%` },
            { label: "Over 48 hours", value: "nothing — the slot was rebookable" },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          This is separate from the cancellation <em>fee</em>, which uses your notice window and deposit percentage.
          One affects their rating; the other affects their bill.
        </p>
      </Section>

      <Section title="When the numbers are wrong about someone" description="Illness, bereavement, a planned break.">
        <p>
          Repeated cancellations during a hard few months say nothing about whether someone is a good client. On any
          client&apos;s page you can turn scoring off, with a private note to remind you why. They show as{" "}
          <StatusPill status="EXEMPT" /> and stay out of <span className="font-medium text-foreground">Needs attention</span>.
        </p>
        <p>
          Sessions <em>you</em> cancel, and appointments you move yourself, never count against a client.
        </p>
        <Link href="/trainer/clients" className="font-medium text-tjm-orange hover:underline">
          Go to your clients →
        </Link>
      </Section>
    </div>
  );
}
