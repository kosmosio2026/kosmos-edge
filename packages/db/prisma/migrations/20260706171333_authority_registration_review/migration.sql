-- CreateEnum
CREATE TYPE "AuthorityRegistrationReviewStatus" AS ENUM ('PENDING_REVIEW', 'REVIEWED', 'NEEDS_CORRECTION', 'REJECTED');

-- AlterTable
ALTER TABLE "RegistrationProxyLog" ADD COLUMN     "reviewNote" TEXT,
ADD COLUMN     "reviewStatus" "AuthorityRegistrationReviewStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "reviewedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "RegistrationProxyLog_reviewStatus_idx" ON "RegistrationProxyLog"("reviewStatus");

-- CreateIndex
CREATE INDEX "RegistrationProxyLog_reviewedByUserId_idx" ON "RegistrationProxyLog"("reviewedByUserId");

-- AddForeignKey
ALTER TABLE "RegistrationProxyLog" ADD CONSTRAINT "RegistrationProxyLog_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
