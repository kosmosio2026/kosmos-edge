-- AlterTable
ALTER TABLE "RegistrationProxyLog" ADD COLUMN     "correctedAt" TIMESTAMP(3),
ADD COLUMN     "correctedByUserId" TEXT,
ADD COLUMN     "correctedContactPhone" TEXT,
ADD COLUMN     "correctedVehiclePlateNumber" TEXT,
ADD COLUMN     "correctionNote" TEXT;

-- CreateIndex
CREATE INDEX "RegistrationProxyLog_correctedByUserId_idx" ON "RegistrationProxyLog"("correctedByUserId");

-- CreateIndex
CREATE INDEX "RegistrationProxyLog_correctedAt_idx" ON "RegistrationProxyLog"("correctedAt");

-- AddForeignKey
ALTER TABLE "RegistrationProxyLog" ADD CONSTRAINT "RegistrationProxyLog_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
