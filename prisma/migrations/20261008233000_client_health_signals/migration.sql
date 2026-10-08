-- Reschedule trail. Moving a booking previously overwrote startAt in place, so
-- a client who shifts every appointment looked identical to one who never
-- moves any. rescheduledBy keeps a move the trainer made from counting against
-- the client.
ALTER TABLE "Booking" ADD COLUMN     "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastRescheduledAt" TIMESTAMP(3),
ADD COLUMN     "rescheduledBy" TEXT;

-- Scoring exemption, for the cases the numbers get wrong: illness, bereavement,
-- a long planned break. Trainer-only; never read by a client-facing page.
ALTER TABLE "User" ADD COLUMN     "healthExempt" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "healthExemptReason" TEXT;
