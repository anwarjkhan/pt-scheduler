/**
 * Fabricate wallet activity so the billing screens have something to show.
 * Re-runnable (fixed ids). Run with: npm run db:seed:wallets
 *
 * Two things happen here, in order:
 *
 *  1. Historical bookings are priced. They were created before pricing existed
 *     and the migration deliberately left them null, so without this a charge
 *     would have no session behind it and the ledger would look invented.
 *
 *  2. A spread of balances, chosen so every state in the UI is visible at once:
 *
 *   Alice   WALLET   healthy prepaid credit, several sessions taken out of it
 *   Carol   WALLET   nearly spent — the "top up soon" case
 *   Grace   WALLET   overdrawn, having kept booking past her credit
 *   Bob     MONTHLY  a month accrued and unpaid — the chase list
 *   Dave    MONTHLY  accrued then settled in full, so it nets to zero
 *   Eve     MONTHLY  a late cancellation fee and a goodwill adjustment
 *   Frank   MONTHLY  a card top-up, as Stripe would record it
 *   Harry   MONTHLY  a corrected entry, showing the edit trail
 *   Anwar2  —        untouched, so an empty wallet is on screen too
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

/** Days before now, as a timestamp — keeps the ledger reading chronologically. */
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

type EntrySpec = {
  id: string;
  email: string;
  amountPence: number;
  reason: string;
  note?: string;
  daysAgo: number;
  /** Attach to the nth most recent completed session for this client. */
  useBooking?: number;
  stripeSessionId?: string;
  /** Written as a correction: this is what the row first said. */
  editedFrom?: { amountPence: number; note?: string };
};

async function main() {
  const trainer = await db.user.findFirst({ where: { role: "TRAINER" }, select: { id: true } });
  const byEmail = new Map(
    (await db.user.findMany({ where: { role: "CLIENT" }, select: { id: true, email: true } })).map((u) => [u.email, u.id]),
  );
  const rules = await db.priceRule.findMany();
  const settings = await db.trainerSettings.findUnique({ where: { id: "singleton" } });
  const currency = settings?.currency ?? "GBP";

  if (rules.length === 0) {
    console.error("No price rules — run the migration first, or set rates in Settings → Billing.");
    process.exit(1);
  }

  // ---------- 1. Price the history ----------
  // Charges have to point at real sessions, or the ledger is a fiction.
  const unpriced = await db.booking.findMany({
    where: { priceAmountPence: null, status: { in: ["COMPLETED", "ACCEPTED", "PENDING"] } },
    select: { id: true, sessionType: true, durationMin: true },
  });
  let pricedCount = 0;
  for (const b of unpriced) {
    const rule = rules.find((r) => r.sessionType === b.sessionType && r.durationMin === b.durationMin);
    if (!rule) continue; // an unsold combination stays unpriced, as it would in real use
    await db.booking.update({
      where: { id: b.id },
      data: { priceAmountPence: rule.amountPence, priceCurrency: currency },
    });
    pricedCount++;
  }

  // ---------- 2. Billing modes ----------
  const walletClients = ["alice@example.com", "carol@example.com", "grace@example.com"];
  for (const email of walletClients) {
    const id = byEmail.get(email);
    if (id) await db.user.update({ where: { id }, data: { billingMode: "WALLET" } });
  }

  // Grace gets a shorter free-cancellation window, so a per-client override is
  // visible on screen rather than only in the settings form.
  const grace = byEmail.get("grace@example.com");
  if (grace) await db.user.update({ where: { id: grace }, data: { cancellationNoticeHours: 48 } });

  // ---------- 3. The ledger ----------
  const specs: EntrySpec[] = [
    // Alice — pre-paid and spending down.
    { id: "seedw-alice-1", email: "alice@example.com", amountPence: 60000, reason: "TOPUP", note: "Bank transfer — 10 session block", daysAgo: 60 },
    { id: "seedw-alice-2", email: "alice@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 45, useBooking: 0 },
    { id: "seedw-alice-3", email: "alice@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 38, useBooking: 1 },
    { id: "seedw-alice-4", email: "alice@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 31, useBooking: 2 },
    { id: "seedw-alice-5", email: "alice@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 24, useBooking: 3 },

    // Carol — nearly out of credit.
    { id: "seedw-carol-1", email: "carol@example.com", amountPence: 24000, reason: "TOPUP", note: "Cash", daysAgo: 50 },
    { id: "seedw-carol-2", email: "carol@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 40, useBooking: 0 },
    { id: "seedw-carol-3", email: "carol@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 33, useBooking: 1 },
    { id: "seedw-carol-4", email: "carol@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 26, useBooking: 2 },
    { id: "seedw-carol-5", email: "carol@example.com", amountPence: -5000, reason: "SESSION_CHARGE", daysAgo: 19, useBooking: 3 },

    // Grace — kept booking past her credit, so the wallet is overdrawn.
    { id: "seedw-grace-1", email: "grace@example.com", amountPence: 12000, reason: "TOPUP", note: "Bank transfer", daysAgo: 55 },
    { id: "seedw-grace-2", email: "grace@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 42, useBooking: 0 },
    { id: "seedw-grace-3", email: "grace@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 35, useBooking: 1 },
    { id: "seedw-grace-4", email: "grace@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 28, useBooking: 2 },
    { id: "seedw-grace-5", email: "grace@example.com", amountPence: -3500, reason: "SESSION_CHARGE", daysAgo: 21, useBooking: 3 },

    // Bob — a month accrued, nothing paid yet.
    { id: "seedw-bob-1", email: "bob@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 26, useBooking: 0 },
    { id: "seedw-bob-2", email: "bob@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 19, useBooking: 1 },
    { id: "seedw-bob-3", email: "bob@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 12, useBooking: 2 },
    { id: "seedw-bob-4", email: "bob@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 5, useBooking: 3 },

    // Dave — accrued and settled, so his balance is clean.
    { id: "seedw-dave-1", email: "dave@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 48, useBooking: 0 },
    { id: "seedw-dave-2", email: "dave@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 41, useBooking: 1 },
    { id: "seedw-dave-3", email: "dave@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 34, useBooking: 2 },
    { id: "seedw-dave-4", email: "dave@example.com", amountPence: 18000, reason: "SETTLEMENT", note: "September — paid by bank transfer", daysAgo: 30 },

    // Eve — a late cancellation, then some goodwill.
    { id: "seedw-eve-1", email: "eve@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 22, useBooking: 0 },
    { id: "seedw-eve-2", email: "eve@example.com", amountPence: -2400, reason: "CANCELLATION_FEE", note: "Cancelled inside the 24h notice period (40% of £60.00)", daysAgo: 15 },
    { id: "seedw-eve-3", email: "eve@example.com", amountPence: 2400, reason: "ADJUSTMENT", note: "Waived — she was ill, first time", daysAgo: 14 },

    // Frank — paid by card, as the Stripe webhook would have recorded it.
    { id: "seedw-frank-1", email: "frank@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 20, useBooking: 0 },
    { id: "seedw-frank-2", email: "frank@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 13, useBooking: 1 },
    { id: "seedw-frank-3", email: "frank@example.com", amountPence: 10000, reason: "TOPUP", note: "Card payment", daysAgo: 10, stripeSessionId: "cs_test_seed_frank_001" },

    // Harry — a mistyped top-up, since corrected. Shows the edit trail.
    { id: "seedw-harry-1", email: "harry@example.com", amountPence: 7500, reason: "TOPUP", note: "Bank transfer (corrected)", daysAgo: 18, editedFrom: { amountPence: 75000, note: "Bank transfer" } },
    { id: "seedw-harry-2", email: "harry@example.com", amountPence: -6000, reason: "SESSION_CHARGE", daysAgo: 11, useBooking: 0 },
  ];

  // Completed sessions per client, newest first, so useBooking can point at one.
  const bookingsFor = new Map<string, string[]>();
  for (const email of new Set(specs.filter((s) => s.useBooking != null).map((s) => s.email))) {
    const clientId = byEmail.get(email);
    if (!clientId) continue;
    const rows = await db.booking.findMany({
      where: { clientId, status: "COMPLETED" },
      orderBy: { startAt: "desc" },
      select: { id: true },
      take: 8,
    });
    bookingsFor.set(email, rows.map((r) => r.id));
  }

  // A booking can carry only one entry per reason (the idempotency guard), so
  // skip any that is already spoken for rather than letting the insert fail.
  const claimed = new Set<string>();
  let written = 0;
  let skipped = 0;

  for (const spec of specs) {
    const clientId = byEmail.get(spec.email);
    if (!clientId) {
      skipped++;
      continue;
    }

    let bookingId: string | null = null;
    if (spec.useBooking != null) {
      const candidates = bookingsFor.get(spec.email) ?? [];
      const picked = candidates[spec.useBooking];
      if (picked && !claimed.has(`${picked}:${spec.reason}`)) {
        bookingId = picked;
        claimed.add(`${picked}:${spec.reason}`);
      }
      // No session to hang it on: keep the entry, just unlinked. The balance
      // still demonstrates the UI.
    }

    // Date a session charge from the session itself, so the ledger reads in
    // step with the history rather than from whenever the seed was run.
    let at = daysAgo(spec.daysAgo);
    if (bookingId) {
      const b = await db.booking.findUnique({ where: { id: bookingId }, select: { endAt: true } });
      if (b) at = b.endAt;
    }
    const data = {
      clientId,
      amountPence: spec.amountPence,
      currency,
      reason: spec.reason,
      bookingId,
      note: spec.note ?? null,
      createdById: trainer?.id ?? "seed",
      createdAt: at,
      stripeSessionId: spec.stripeSessionId ?? null,
      ...(spec.editedFrom
        ? {
            editedAt: daysAgo(spec.daysAgo - 1),
            editedById: trainer?.id ?? "seed",
            originalAmountPence: spec.editedFrom.amountPence,
            originalNote: spec.editedFrom.note ?? null,
          }
        : {}),
    };

    await db.walletEntry.upsert({ where: { id: spec.id }, update: data, create: { id: spec.id, ...data } });
    written++;
  }

  // ---------- Report ----------
  console.log(`Priced ${pricedCount} historical bookings.`);
  console.log(`Wrote ${written} wallet entries${skipped ? ` (${skipped} skipped — client not found)` : ""}.\n`);

  const sums = await db.walletEntry.groupBy({ by: ["clientId"], _sum: { amountPence: true } });
  const names = new Map(
    (await db.user.findMany({ where: { role: "CLIENT" }, select: { id: true, name: true, email: true, billingMode: true } })).map(
      (u) => [u.id, u],
    ),
  );
  const money = (p: number) => `${p < 0 ? "-" : ""}£${(Math.abs(p) / 100).toFixed(2)}`;

  let credit = 0;
  let owed = 0;
  for (const row of sums.sort((a, b) => (a._sum.amountPence ?? 0) - (b._sum.amountPence ?? 0))) {
    const u = names.get(row.clientId);
    const bal = row._sum.amountPence ?? 0;
    if (bal > 0) credit += bal;
    if (bal < 0) owed += Math.abs(bal);
    console.log(`  ${(u?.name ?? "?").padEnd(16)} ${(u?.billingMode ?? "").padEnd(8)} ${money(bal).padStart(10)}`);
  }
  console.log(`\n  Prepaid credit held: ${money(credit)}`);
  console.log(`  Owed to Toby:        ${money(owed)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
