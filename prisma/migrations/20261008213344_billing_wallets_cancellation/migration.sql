-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "noShow" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priceAmountPence" INTEGER,
ADD COLUMN     "priceCurrency" TEXT;

-- AlterTable
ALTER TABLE "TrainerSettings" ADD COLUMN     "autoCompleteAfterHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "cancellationDepositPct" INTEGER NOT NULL DEFAULT 40,
ADD COLUMN     "cancellationNoticeHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'GBP';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "billingMode" TEXT NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "cancellationDepositPct" INTEGER,
ADD COLUMN     "cancellationNoticeHours" INTEGER,
ADD COLUMN     "customRates" JSONB;

-- CreateTable
CREATE TABLE "PriceRule" (
    "id" TEXT NOT NULL,
    "sessionType" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriceRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WalletEntry" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amountPence" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "reason" TEXT NOT NULL,
    "bookingId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PriceRule_sessionType_durationMin_key" ON "PriceRule"("sessionType", "durationMin");

-- CreateIndex
CREATE INDEX "WalletEntry_clientId_createdAt_idx" ON "WalletEntry"("clientId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletEntry_bookingId_reason_key" ON "WalletEntry"("bookingId", "reason");

-- CreateIndex
CREATE INDEX "Booking_status_endAt_idx" ON "Booking"("status", "endAt");

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WalletEntry" ADD CONSTRAINT "WalletEntry_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------- Seed the standard rates ----------
-- Placeholder UK rates so the app is usable immediately; the trainer edits
-- these in Settings → Billing. A missing pair is an error at booking time,
-- never a silent £0, so every sellable combination needs a row.
INSERT INTO "PriceRule" ("id", "sessionType", "durationMin", "amountPence", "createdAt", "updatedAt") VALUES
  ('seed_price_ip_30',  'IN_PERSON',  30,  3500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_price_ip_60',  'IN_PERSON',  60,  6000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_price_ip_90',  'IN_PERSON',  90,  8500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_price_ip_120', 'IN_PERSON', 120, 11000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_price_on_30',  'ONLINE',     30,  2500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_price_on_60',  'ONLINE',     60,  4500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_price_on_90',  'ONLINE',     90,  6500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('seed_price_on_120', 'ONLINE',    120,  8500, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("sessionType", "durationMin") DO NOTHING;

-- ---------- Backfill completion ----------
-- COMPLETED was previously derived at render time (ACCEPTED && endAt < now).
-- Persist that for past sessions so history keeps reading the same, but leave
-- priceAmountPence NULL on every pre-existing row: these predate pricing and
-- must never retroactively debit a wallet.
UPDATE "Booking"
   SET "status" = 'COMPLETED', "completedAt" = "endAt"
 WHERE "status" = 'ACCEPTED' AND "endAt" < CURRENT_TIMESTAMP;
