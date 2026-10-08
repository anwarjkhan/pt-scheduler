-- Correction trail: the trainer may now edit a ledger row, but the figures as
-- first written are kept so a disputed charge can always be reconstructed.
ALTER TABLE "WalletEntry" ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "editedById" TEXT,
ADD COLUMN     "originalAmountPence" INTEGER,
ADD COLUMN     "originalNote" TEXT;

-- Card top-ups. stripeSessionId is unique so a webhook delivered more than
-- once — which Stripe does by design — credits the wallet only once.
ALTER TABLE "WalletEntry" ADD COLUMN     "stripeSessionId" TEXT,
ADD COLUMN     "stripePaymentIntentId" TEXT;

CREATE UNIQUE INDEX "WalletEntry_stripeSessionId_key" ON "WalletEntry"("stripeSessionId");
