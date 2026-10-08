import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { getTrainerSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/pricing";
import { GuideHeader, Note, Section, SettingLink, Worked } from "../guide-ui";

/**
 * How money works, explained with the trainer's own numbers.
 *
 * Everything here is read live: the rate table, the cancellation policy, the
 * auto-complete window. A guide that drifts out of step with the settings is
 * worse than none at all, so no figure is written into the prose.
 */
export default async function PricingGuide() {
  const [settings, rules, customRateClients] = await Promise.all([
    getTrainerSettings(),
    db.priceRule.findMany({ orderBy: [{ sessionType: "asc" }, { durationMin: "asc" }] }),
    // Prisma distinguishes JSON null from a missing column, so a plain
    // `not: null` is rejected here — DbNull is the one that means "no value".
    db.user.count({ where: { role: "CLIENT", NOT: { customRates: { equals: Prisma.DbNull } } } }),
  ]);

  const cur = settings.currency;
  const example = rules.find((r) => r.sessionType === "IN_PERSON" && r.durationMin === 60) ?? rules[0];
  const fee = example ? Math.round((example.amountPence * settings.cancellationDepositPct) / 100) : 0;

  const overrides = await db.user.count({
    where: { role: "CLIENT", OR: [{ cancellationNoticeHours: { not: null } }, { cancellationDepositPct: { not: null } }] },
  });

  return (
    <div className="space-y-6">
      <GuideHeader
        title="How pricing works"
        intro="What a session costs, when a client is charged, and what happens when they cancel. Every figure below is your live setting, so this page is always in step with the app."
      />

      <Section
        title="What a session costs"
        description="Price comes from the session type and length — nothing extra to choose when booking."
      >
        {rules.length === 0 ? (
          <Note tone="warn">
            No rates are set yet, so no one can book. Add them under{" "}
            <SettingLink href="/trainer/settings">Settings → Billing</SettingLink>
          </Note>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  {[30, 60, 90, 120].map((d) => (
                    <th key={d} className="pb-2 pr-4 font-medium">
                      {d} min
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(["IN_PERSON", "ONLINE"] as const).map((t) => (
                  <tr key={t} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{t === "IN_PERSON" ? "In person" : "Online"}</td>
                    {[30, 60, 90, 120].map((d) => {
                      const r = rules.find((x) => x.sessionType === t && x.durationMin === d);
                      return (
                        <td key={d} className="py-2 pr-4 tabular-nums">
                          {r ? formatMoney(r.amountPence, cur) : <span className="text-muted-foreground">not sold</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p>
          A blank cell means you don&apos;t sell that combination. Booking it fails with a clear message rather than
          going through at nothing — a free session nobody meant to give away is the one mistake that goes unnoticed.
        </p>

        <div>
          <p className="mb-2 font-medium">Which price applies, in order:</p>
          <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
            <li>
              <span className="text-foreground">That client&apos;s own rate</span>, if you&apos;ve set one
              {customRateClients > 0 ? ` (${customRateClients} client${customRateClients === 1 ? " has" : "s have"} one)` : " (nobody has one yet)"}.
            </li>
            <li>
              <span className="text-foreground">The standard rate</span> from the table above.
            </li>
            <li>
              <span className="text-foreground">Otherwise it won&apos;t book</span>, and tells you which rate is
              missing.
            </li>
          </ol>
        </div>

        <SettingLink href="/trainer/settings">Change rates in Settings → Billing</SettingLink>
      </Section>

      <Section
        title="The price is fixed when they book"
        description="Raising a rate never changes a session someone has already booked."
      >
        <p>
          The price is worked out once, at the moment the booking is made, and stored on it. If you raise your rates
          on the 10th, a session booked on the 1st for the 20th still costs what the client agreed to.
        </p>
        <Note>
          This is also what makes a month-end statement reproducible: the figures can&apos;t shift under you after the
          fact.
        </Note>
      </Section>

      <Section title="When a client is actually charged" description="Completing a session is what moves money.">
        <p>
          Nothing is charged at booking. A session becomes chargeable when it&apos;s marked complete — either by you,
          from the calendar, or automatically{" "}
          <span className="font-medium text-foreground">{settings.autoCompleteAfterHours} hours</span> after it ends if
          you haven&apos;t got to it.
        </p>
        {example && (
          <Worked
            title={`A ${example.durationMin}-minute ${example.sessionType === "ONLINE" ? "online" : "in-person"} session`}
            rows={[
              { label: "Booked", value: "nothing charged" },
              { label: "Session happens", value: "nothing charged" },
              { label: "Marked complete", value: `−${formatMoney(example.amountPence, cur)} from their balance` },
            ]}
          />
        )}
        <p>
          A charge can only ever land once per session, however many times a button is pressed or the sweep runs. If
          you cancel a session yourself, the client is never charged — and anything already taken is refunded.
        </p>
      </Section>

      <Section
        title="Late cancellations and no-shows"
        description={`Currently ${settings.cancellationNoticeHours} hours' notice, then ${settings.cancellationDepositPct}% of the session price.`}
      >
        <p>
          Clients can always cancel. Inside the notice window they pay a share of the price, and the exact amount in
          pounds is shown to them before they confirm — they&apos;re never charged by a button that just said
          &ldquo;cancel&rdquo;.
        </p>
        {example && (
          <Worked
            title={`Cancelling a ${formatMoney(example.amountPence, cur)} session`}
            rows={[
              {
                label: `More than ${settings.cancellationNoticeHours}h before`,
                value: "no charge",
              },
              {
                label: `Within ${settings.cancellationNoticeHours}h`,
                value: `${formatMoney(fee, cur)} (${settings.cancellationDepositPct}%)`,
              },
              { label: "Didn't turn up", value: `${formatMoney(fee, cur)} — same as a late cancellation` },
            ]}
          />
        )}
        <p>
          Cancelling a whole series only charges the occurrences actually inside the window — usually just the next
          one — so a client ending a weekly booking isn&apos;t hit with a fee for every remaining week.
        </p>
        <p>
          {overrides > 0
            ? `${overrides} client${overrides === 1 ? " has" : "s have"} their own policy instead of this default.`
            : "Every client is on this default. You can give any of them their own terms on their page."}
        </p>
        <SettingLink href="/trainer/settings">Change the policy in Settings → Billing</SettingLink>
      </Section>

      <Section title="Wallets: pre-paid or monthly" description="Both work the same way underneath.">
        <p>
          Every client has a running balance. <span className="font-medium text-foreground">Pre-paid</span> clients pay
          up front and spend down, so their balance is usually positive;{" "}
          <span className="font-medium text-foreground">monthly</span> clients accrue charges and settle at the end, so
          theirs is usually negative. Charges and payments are recorded identically either way — switching someone
          between the two is a single setting with nothing to migrate.
        </p>
        <Note>
          A pre-paid client who runs out isn&apos;t blocked from booking. They see what they&apos;re short and you see
          it flagged — losing a booking over a timing accident costs more than a temporarily negative balance.
        </Note>
        <p>
          You record money as it arrives — bank transfer, cash — on the client&apos;s page. If card payments are set
          up, clients can also top up themselves and the credit lands automatically.
        </p>
      </Section>

      <Section title="Fixing mistakes" description="Nothing is deleted; corrections stay visible.">
        <p>
          You can edit a ledger entry, and what it first said is kept and shown beside it. Entries are never removed:
          a row that vanished is one nobody can account for later, and the whole point of the history is that it adds
          up.
        </p>
        <p>
          <span className="font-medium text-foreground">Clear balance</span> zeroes a wallet in one entry — for when
          someone leaves and you&apos;ve refunded them outside the app. It records what happened; it doesn&apos;t move
          any money itself.
        </p>
        <Note tone="warn">
          Card payments can&apos;t be edited, so the ledger always matches what the card processor actually did. Use an
          adjustment instead.
        </Note>
      </Section>
    </div>
  );
}
