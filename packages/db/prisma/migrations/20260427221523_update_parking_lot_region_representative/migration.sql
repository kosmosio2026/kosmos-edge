/*
  Warnings:

  - The `region` column on the `ParkingLot` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "ParkingRegion" AS ENUM ('SEOUL', 'BUSAN', 'DAEGU', 'INCHEON', 'GWANGJU', 'DAEJEON', 'ULSAN', 'SEJONG', 'GYEONGGI', 'GANGWON', 'CHUNGBUK', 'CHUNGNAM', 'JEONBUK', 'JEONNAM', 'GYEONGBUK', 'GYEONGNAM', 'JEJU');

-- AlterTable
ALTER TABLE "ParkingLot" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "representative" TEXT,
DROP COLUMN "region",
ADD COLUMN     "region" "ParkingRegion";

-- CreateIndex
CREATE INDEX "ParkingLot_region_idx" ON "ParkingLot"("region");
