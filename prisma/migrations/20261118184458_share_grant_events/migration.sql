-- CreateEnum
CREATE TYPE "ShareAction" AS ENUM ('CREATED', 'REVOKED', 'EXTENDED');

-- CreateTable
CREATE TABLE "ShareGrantEvent" (
    "id" TEXT NOT NULL,
    "grantId" TEXT NOT NULL,
    "actorType" "ActorType" NOT NULL,
    "action" "ShareAction" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShareGrantEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ShareGrantEvent_grantId_createdAt_idx" ON "ShareGrantEvent"("grantId", "createdAt");

-- AddForeignKey
ALTER TABLE "ShareGrantEvent" ADD CONSTRAINT "ShareGrantEvent_grantId_fkey" FOREIGN KEY ("grantId") REFERENCES "ShareGrant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
