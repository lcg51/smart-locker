-- CreateTable
CREATE TABLE "VendorApiCall" (
    "id" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorApiCall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VendorApiCall_vendor_period_key" ON "VendorApiCall"("vendor", "period");
