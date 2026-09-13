-- AlterTable
ALTER TABLE "VideoRoom" ADD COLUMN "guestToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VideoRoom_guestToken_key" ON "VideoRoom"("guestToken");
