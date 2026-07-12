-- AlterTable
ALTER TABLE "FeePolicy" ADD COLUMN     "authorityRegistrationGraceDiscountEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "registrationGraceDiscountEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "registrationGraceFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "registrationGraceMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "watcherRewardGraceFeeEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "authorityRegistrationSurchargeAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "baseParkingAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "finalAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "registrationGraceDiscountAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "watcherRewardBasisAmount" INTEGER NOT NULL DEFAULT 0;
