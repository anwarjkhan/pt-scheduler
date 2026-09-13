-- CreateTable
CREATE TABLE "SocialPost" (
    "id" TEXT NOT NULL,
    "caption" TEXT NOT NULL,
    "posterUrl" TEXT NOT NULL,
    "videoUrl" TEXT,
    "permalink" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SocialPost_pkey" PRIMARY KEY ("id")
);
