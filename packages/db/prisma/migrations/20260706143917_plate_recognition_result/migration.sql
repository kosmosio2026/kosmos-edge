-- CreateTable
CREATE TABLE "PlateRecognitionResult" (
    "id" TEXT NOT NULL,
    "parkingSessionId" TEXT,
    "enforcementCaseId" TEXT,
    "registrationProxyLogId" TEXT,
    "imageUrl" TEXT,
    "provider" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'KR',
    "suggestedPlateNumber" TEXT NOT NULL,
    "reviewedPlateNumber" TEXT,
    "confidence" DOUBLE PRECISION,
    "candidates" JSONB,
    "rawResponse" JSONB,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlateRecognitionResult_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlateRecognitionResult_parkingSessionId_idx" ON "PlateRecognitionResult"("parkingSessionId");

-- CreateIndex
CREATE INDEX "PlateRecognitionResult_enforcementCaseId_idx" ON "PlateRecognitionResult"("enforcementCaseId");

-- CreateIndex
CREATE INDEX "PlateRecognitionResult_registrationProxyLogId_idx" ON "PlateRecognitionResult"("registrationProxyLogId");

-- CreateIndex
CREATE INDEX "PlateRecognitionResult_createdByUserId_idx" ON "PlateRecognitionResult"("createdByUserId");

-- CreateIndex
CREATE INDEX "PlateRecognitionResult_suggestedPlateNumber_idx" ON "PlateRecognitionResult"("suggestedPlateNumber");

-- CreateIndex
CREATE INDEX "PlateRecognitionResult_reviewedPlateNumber_idx" ON "PlateRecognitionResult"("reviewedPlateNumber");

-- CreateIndex
CREATE INDEX "PlateRecognitionResult_createdAt_idx" ON "PlateRecognitionResult"("createdAt");

-- AddForeignKey
ALTER TABLE "PlateRecognitionResult" ADD CONSTRAINT "PlateRecognitionResult_parkingSessionId_fkey" FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlateRecognitionResult" ADD CONSTRAINT "PlateRecognitionResult_enforcementCaseId_fkey" FOREIGN KEY ("enforcementCaseId") REFERENCES "EnforcementCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlateRecognitionResult" ADD CONSTRAINT "PlateRecognitionResult_registrationProxyLogId_fkey" FOREIGN KEY ("registrationProxyLogId") REFERENCES "RegistrationProxyLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlateRecognitionResult" ADD CONSTRAINT "PlateRecognitionResult_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
