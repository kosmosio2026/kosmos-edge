-- CreateTable
CREATE TABLE "AuthorityRegistrationCorrectionHistory" (
    "id" TEXT NOT NULL,
    "registrationProxyLogId" TEXT NOT NULL,
    "parkingSessionId" TEXT NOT NULL,
    "correctedByUserId" TEXT,
    "previousPlateNumber" TEXT,
    "newPlateNumber" TEXT NOT NULL,
    "previousContactPhone" TEXT,
    "newContactPhone" TEXT,
    "correctionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorityRegistrationCorrectionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthorityRegistrationCorrectionHistory_registrationProxyLog_idx" ON "AuthorityRegistrationCorrectionHistory"("registrationProxyLogId");

-- CreateIndex
CREATE INDEX "AuthorityRegistrationCorrectionHistory_parkingSessionId_idx" ON "AuthorityRegistrationCorrectionHistory"("parkingSessionId");

-- CreateIndex
CREATE INDEX "AuthorityRegistrationCorrectionHistory_correctedByUserId_idx" ON "AuthorityRegistrationCorrectionHistory"("correctedByUserId");

-- CreateIndex
CREATE INDEX "AuthorityRegistrationCorrectionHistory_createdAt_idx" ON "AuthorityRegistrationCorrectionHistory"("createdAt");

-- CreateIndex
CREATE INDEX "AuthorityRegistrationCorrectionHistory_newPlateNumber_idx" ON "AuthorityRegistrationCorrectionHistory"("newPlateNumber");

-- AddForeignKey
ALTER TABLE "AuthorityRegistrationCorrectionHistory" ADD CONSTRAINT "AuthorityRegistrationCorrectionHistory_registrationProxyLo_fkey" FOREIGN KEY ("registrationProxyLogId") REFERENCES "RegistrationProxyLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityRegistrationCorrectionHistory" ADD CONSTRAINT "AuthorityRegistrationCorrectionHistory_parkingSessionId_fkey" FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityRegistrationCorrectionHistory" ADD CONSTRAINT "AuthorityRegistrationCorrectionHistory_correctedByUserId_fkey" FOREIGN KEY ("correctedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
