-- CreateTable
CREATE TABLE "AuthorityRegistrationReviewHistory" (
    "id" TEXT NOT NULL,
    "registrationProxyLogId" TEXT NOT NULL,
    "reviewedByUserId" TEXT,
    "previousStatus" "AuthorityRegistrationReviewStatus",
    "newStatus" "AuthorityRegistrationReviewStatus" NOT NULL,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorityRegistrationReviewHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuthorityRegistrationReviewHistory_registrationProxyLogId_idx" ON "AuthorityRegistrationReviewHistory"("registrationProxyLogId");

-- CreateIndex
CREATE INDEX "AuthorityRegistrationReviewHistory_reviewedByUserId_idx" ON "AuthorityRegistrationReviewHistory"("reviewedByUserId");

-- CreateIndex
CREATE INDEX "AuthorityRegistrationReviewHistory_newStatus_idx" ON "AuthorityRegistrationReviewHistory"("newStatus");

-- CreateIndex
CREATE INDEX "AuthorityRegistrationReviewHistory_createdAt_idx" ON "AuthorityRegistrationReviewHistory"("createdAt");

-- AddForeignKey
ALTER TABLE "AuthorityRegistrationReviewHistory" ADD CONSTRAINT "AuthorityRegistrationReviewHistory_registrationProxyLogId_fkey" FOREIGN KEY ("registrationProxyLogId") REFERENCES "RegistrationProxyLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuthorityRegistrationReviewHistory" ADD CONSTRAINT "AuthorityRegistrationReviewHistory_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
