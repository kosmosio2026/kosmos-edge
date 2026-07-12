-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('PARKING_SENSOR', 'IO_CONTROLLER', 'DISPLAY_BOARD', 'SMART_TRACKER', 'SENSIO_CONTROLLER');

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "serialNumber" TEXT NOT NULL,
    "devEui" TEXT,
    "type" "DeviceType" NOT NULL,
    "status" TEXT DEFAULT 'ACTIVE',
    "parkingLotId" TEXT,
    "parkingSectionId" TEXT,
    "parkingSpaceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "Device"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Device_devEui_key" ON "Device"("devEui");

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_parkingSectionId_fkey" FOREIGN KEY ("parkingSectionId") REFERENCES "ParkingSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
