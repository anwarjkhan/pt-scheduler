-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "sessionType" TEXT NOT NULL DEFAULT 'IN_PERSON';

-- AlterTable
ALTER TABLE "BookingSeries" ADD COLUMN     "sessionType" TEXT NOT NULL DEFAULT 'IN_PERSON';
