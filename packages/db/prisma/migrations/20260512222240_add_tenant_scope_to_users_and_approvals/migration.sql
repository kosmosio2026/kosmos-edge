/*
  Warnings:

  - A unique constraint covering the columns `[code]` on the table `Tenant` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `code` to the `Tenant` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Tenant` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ApprovalRequestType" ADD VALUE 'PARKING_LOT_ACCESS';
ALTER TYPE "ApprovalRequestType" ADD VALUE 'PARKING_LOT_CREATION';

-- AlterTable
ALTER TABLE "ApprovalRequest" ADD COLUMN     "tenantId" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tenantId" TEXT;

-- CreateTable
CREATE TABLE "ManagerParkingLot" (
    "id" TEXT NOT NULL,
    "managerProfileUserId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManagerParkingLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperatorParkingSection" (
    "id" TEXT NOT NULL,
    "operatorProfileUserId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperatorParkingSection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagerParkingLot_managerProfileUserId_parkingLotId_key" ON "ManagerParkingLot"("managerProfileUserId", "parkingLotId");

-- CreateIndex
CREATE UNIQUE INDEX "OperatorParkingSection_operatorProfileUserId_sectionId_key" ON "OperatorParkingSection"("operatorProfileUserId", "sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_code_key" ON "Tenant"("code");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerParkingLot" ADD CONSTRAINT "ManagerParkingLot_managerProfileUserId_fkey" FOREIGN KEY ("managerProfileUserId") REFERENCES "ManagerProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManagerParkingLot" ADD CONSTRAINT "ManagerParkingLot_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorParkingSection" ADD CONSTRAINT "OperatorParkingSection_operatorProfileUserId_fkey" FOREIGN KEY ("operatorProfileUserId") REFERENCES "OperatorProfile"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorParkingSection" ADD CONSTRAINT "OperatorParkingSection_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperatorParkingSection" ADD CONSTRAINT "OperatorParkingSection_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "ParkingSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApprovalRequest" ADD CONSTRAINT "ApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
