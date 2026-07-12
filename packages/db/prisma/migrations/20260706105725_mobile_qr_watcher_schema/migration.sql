/*
  Warnings:

  - You are about to drop the column `controllerMode` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `displayProtocol` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `lastDisplayedState` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `lastIntendedState` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `manualOverrideEnabled` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `manualOverrideReason` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `manualOverrideState` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `modbusHost` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `modbusPort` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `modbusUnitId` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `mqttHeartbeatTopic` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `mqttTopic` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `parkingSectionId` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `protocolMode` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `registerProfile` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `restPath` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `wsPath` on the `DisplayBoard` table. All the data in the column will be lost.
  - You are about to drop the column `interface` on the `DisplayHeartbeatLog` table. All the data in the column will be lost.
  - You are about to drop the column `transportMode` on the `DisplayHeartbeatLog` table. All the data in the column will be lost.
  - The `region` column on the `ParkingLot` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `Ad` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AdLine` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `DisplayConfig` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[parkingLotId]` on the table `DisplayBoard` will be added. If there are existing duplicate values, this will fail.
  - Made the column `parkingLotId` on table `DisplayBoard` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "DisplayTransportType" AS ENUM ('TCP', 'RS232', 'RS485');

-- CreateEnum
CREATE TYPE "DisplayMode" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "DisplayCommandStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'ACKED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisplayLineSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('UNREGISTERED', 'REGISTERED_BY_MEMBER', 'REGISTERED_BY_VISITOR', 'REGISTERED_BY_WATCHER', 'REGISTERED_BY_OPERATOR', 'REGISTERED_BY_MANAGER', 'REGISTERED_BY_ADMIN');

-- CreateEnum
CREATE TYPE "RegistrationMethod" AS ENUM ('MEMBER_QR', 'VISITOR_QR', 'WATCHER_PROXY', 'OPERATOR_MANUAL', 'MANAGER_MANUAL', 'ADMIN_MANUAL');

-- CreateEnum
CREATE TYPE "WatcherApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EnforcementCaseStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'REGISTERED', 'PAID', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EnforcementReason" AS ENUM ('UNREGISTERED_AFTER_GRACE', 'SENSOR_ERROR', 'PAYMENT_REQUIRED', 'MANUAL_REVIEW');

-- CreateEnum
CREATE TYPE "RegistrationPhotoType" AS ENUM ('VEHICLE_PLATE', 'PARKING_SPACE', 'DISPUTE_EVIDENCE');

-- CreateEnum
CREATE TYPE "ManualPaymentMethod" AS ENUM ('CASH', 'CARD_OFFLINE', 'BANK_TRANSFER', 'OTHER');

-- DropForeignKey
ALTER TABLE "Ad" DROP CONSTRAINT "Ad_displayBoardId_fkey";

-- DropForeignKey
ALTER TABLE "AdLine" DROP CONSTRAINT "AdLine_adId_fkey";

-- DropForeignKey
ALTER TABLE "DisplayBoard" DROP CONSTRAINT "DisplayBoard_parkingLotId_fkey";

-- DropForeignKey
ALTER TABLE "DisplayBoard" DROP CONSTRAINT "DisplayBoard_parkingSectionId_fkey";

-- DropForeignKey
ALTER TABLE "DisplayConfig" DROP CONSTRAINT "DisplayConfig_displayBoardId_fkey";

-- DropIndex
DROP INDEX "DisplayBoard_parkingLotId_idx";

-- DropIndex
DROP INDEX "DisplayBoard_parkingSectionId_idx";

-- AlterTable
ALTER TABLE "DisplayBoard" DROP COLUMN "controllerMode",
DROP COLUMN "displayProtocol",
DROP COLUMN "isActive",
DROP COLUMN "lastDisplayedState",
DROP COLUMN "lastIntendedState",
DROP COLUMN "manualOverrideEnabled",
DROP COLUMN "manualOverrideReason",
DROP COLUMN "manualOverrideState",
DROP COLUMN "modbusHost",
DROP COLUMN "modbusPort",
DROP COLUMN "modbusUnitId",
DROP COLUMN "mqttHeartbeatTopic",
DROP COLUMN "mqttTopic",
DROP COLUMN "parkingSectionId",
DROP COLUMN "protocolMode",
DROP COLUMN "registerProfile",
DROP COLUMN "restPath",
DROP COLUMN "wsPath",
ADD COLUMN     "brightness" INTEGER DEFAULT 10,
ADD COLUMN     "cols" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN     "connectTimeoutMs" INTEGER NOT NULL DEFAULT 3000,
ADD COLUMN     "dataBits" INTEGER DEFAULT 8,
ADD COLUMN     "enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lastAckAt" TIMESTAMP(3),
ADD COLUMN     "lastRenderedPayload" JSONB,
ADD COLUMN     "lastResponseHex" TEXT,
ADD COLUMN     "lastSentAt" TIMESTAMP(3),
ADD COLUMN     "lastSentPayload" JSONB,
ADD COLUMN     "manualExpiresAt" TIMESTAMP(3),
ADD COLUMN     "manualReason" TEXT,
ADD COLUMN     "mode" "DisplayMode" NOT NULL DEFAULT 'AUTO',
ADD COLUMN     "moduleType" INTEGER,
ADD COLUMN     "powerOn" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "readTimeoutMs" INTEGER NOT NULL DEFAULT 3000,
ADD COLUMN     "rgbOrder" INTEGER,
ADD COLUMN     "rows" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "transport" "DisplayTransportType" NOT NULL DEFAULT 'TCP',
ALTER COLUMN "deviceId" DROP NOT NULL,
ALTER COLUMN "macAddress" DROP NOT NULL,
ALTER COLUMN "parkingLotId" SET NOT NULL,
ALTER COLUMN "baudRate" SET DEFAULT 9600,
ALTER COLUMN "parity" SET DEFAULT 'none',
ALTER COLUMN "stopBits" SET DEFAULT 1;

-- AlterTable
ALTER TABLE "DisplayHeartbeatLog" DROP COLUMN "interface",
DROP COLUMN "transportMode",
ADD COLUMN     "transport" "DisplayTransportType";

-- AlterTable
ALTER TABLE "FeePolicy" ADD COLUMN     "exitGraceMinutes" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "ManagerProfile" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OperatorProfile" ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ParkingLot" ADD COLUMN     "description" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "graceMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "operationHours" JSONB,
ADD COLUMN     "sido" TEXT,
ADD COLUMN     "sigungu" TEXT,
DROP COLUMN "region",
ADD COLUMN     "region" TEXT;

-- AlterTable
ALTER TABLE "ParkingSession" ADD COLUMN     "contactPhone" TEXT,
ADD COLUMN     "registeredByUserId" TEXT,
ADD COLUMN     "registrationMethod" "RegistrationMethod",
ADD COLUMN     "registrationStatus" "RegistrationStatus" NOT NULL DEFAULT 'UNREGISTERED',
ADD COLUMN     "visitorProfileUserId" TEXT;

-- DropTable
DROP TABLE "Ad";

-- DropTable
DROP TABLE "AdLine";

-- DropTable
DROP TABLE "DisplayConfig";

-- DropEnum
DROP TYPE "DisplayControllerMode";

-- DropEnum
DROP TYPE "DisplayProtocol";

-- CreateTable
CREATE TABLE "DisplayBoardLine" (
    "id" TEXT NOT NULL,
    "displayBoardId" TEXT NOT NULL,
    "source" "DisplayLineSource" NOT NULL,
    "lineNo" INTEGER NOT NULL,
    "textTemplate" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "fontSize" INTEGER NOT NULL DEFAULT 1,
    "effect" TEXT NOT NULL DEFAULT '090009000900',
    "speed" INTEGER NOT NULL DEFAULT 2,
    "delay" INTEGER NOT NULL DEFAULT 5,
    "neon" INTEGER NOT NULL DEFAULT 0,
    "fix" BOOLEAN NOT NULL DEFAULT false,
    "colorCode" INTEGER DEFAULT 0,
    "fontCode" INTEGER DEFAULT 0,
    "widthCode" INTEGER DEFAULT 1,
    "attributeCode" INTEGER DEFAULT 0,
    "iconCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayBoardLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisplayCommand" (
    "id" TEXT NOT NULL,
    "displayBoardId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "status" "DisplayCommandStatus" NOT NULL DEFAULT 'PENDING',
    "packetHex" TEXT,
    "responseHex" TEXT,
    "errorMessage" TEXT,
    "requestedByUserId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processingAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "ackedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayCommand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT,
    "devEui" TEXT,
    "parkingLotId" TEXT,
    "parkingSectionId" TEXT,
    "parkingSpaceId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'sensor-daemon',
    "eventType" TEXT NOT NULL,
    "parkingStatus" INTEGER,
    "deviceStatus" INTEGER,
    "batteryStatus" INTEGER,
    "batteryVoltage" DOUBLE PRECISION,
    "firmwareVersion" INTEGER,
    "gatewayId" TEXT,
    "rssi" INTEGER,
    "snr" DOUBLE PRECISION,
    "channel" INTEGER,
    "fCnt" INTEGER,
    "fPort" INTEGER,
    "dr" INTEGER,
    "rawPayload" JSONB,
    "parsedPayload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorEventLog" (
    "id" TEXT NOT NULL,
    "devEui" TEXT NOT NULL,
    "deviceId" TEXT,
    "parkingSpaceId" TEXT,
    "source" TEXT NOT NULL DEFAULT 'mqtt',
    "eventType" TEXT NOT NULL,
    "parkingStatus" INTEGER,
    "deviceStatus" INTEGER,
    "batteryStatus" INTEGER,
    "batteryVoltage" DOUBLE PRECISION,
    "firmwareVersion" INTEGER,
    "gatewayId" TEXT,
    "rssi" INTEGER,
    "snr" DOUBLE PRECISION,
    "channel" INTEGER,
    "fCnt" INTEGER,
    "fPort" INTEGER,
    "dr" INTEGER,
    "rawPayload" JSONB,
    "parsedPayload" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisplayBoardModule" (
    "id" TEXT NOT NULL,
    "displayBoardId" TEXT NOT NULL,
    "rowNo" INTEGER NOT NULL,
    "colNo" INTEGER NOT NULL,
    "parkingSectionId" TEXT,
    "label" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "charWidth" INTEGER NOT NULL DEFAULT 2,
    "padChar" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DisplayBoardModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantUser" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingLotPhoto" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingLotPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingLotQr" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "qrType" TEXT NOT NULL DEFAULT 'PARKING_LOT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkingLotQr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteParkingLot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteParkingLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkingRegistrationPhoto" (
    "id" TEXT NOT NULL,
    "parkingSessionId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "photoType" "RegistrationPhotoType" NOT NULL DEFAULT 'VEHICLE_PLATE',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "capturedByUserId" TEXT,
    "capturedByRole" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkingRegistrationPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatcherApplication" (
    "id" TEXT NOT NULL,
    "watcherUserId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "status" "WatcherApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedByUserId" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatcherApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WatcherLotBinding" (
    "id" TEXT NOT NULL,
    "watcherUserId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WatcherLotBinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnforcementCase" (
    "id" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "parkingSectionId" TEXT,
    "parkingSpaceId" TEXT NOT NULL,
    "parkingSessionId" TEXT NOT NULL,
    "reason" "EnforcementReason" NOT NULL,
    "status" "EnforcementCaseStatus" NOT NULL DEFAULT 'OPEN',
    "graceMinutes" INTEGER NOT NULL,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedToUserId" TEXT,
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnforcementCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RegistrationProxyLog" (
    "id" TEXT NOT NULL,
    "parkingSessionId" TEXT NOT NULL,
    "performedByUserId" TEXT NOT NULL,
    "performedByRole" TEXT NOT NULL,
    "vehiclePlateNumber" TEXT NOT NULL,
    "contactPhone" TEXT,
    "note" TEXT,
    "photoRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistrationProxyLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceManualPayment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "collectedByUserId" TEXT NOT NULL,
    "collectedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceManualPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DisplayBoardLine_displayBoardId_source_idx" ON "DisplayBoardLine"("displayBoardId", "source");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayBoardLine_displayBoardId_source_lineNo_key" ON "DisplayBoardLine"("displayBoardId", "source", "lineNo");

-- CreateIndex
CREATE INDEX "DisplayCommand_displayBoardId_status_idx" ON "DisplayCommand"("displayBoardId", "status");

-- CreateIndex
CREATE INDEX "DisplayCommand_status_requestedAt_idx" ON "DisplayCommand"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "DeviceEvent_deviceId_idx" ON "DeviceEvent"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceEvent_devEui_idx" ON "DeviceEvent"("devEui");

-- CreateIndex
CREATE INDEX "DeviceEvent_parkingLotId_idx" ON "DeviceEvent"("parkingLotId");

-- CreateIndex
CREATE INDEX "DeviceEvent_parkingSectionId_idx" ON "DeviceEvent"("parkingSectionId");

-- CreateIndex
CREATE INDEX "DeviceEvent_parkingSpaceId_idx" ON "DeviceEvent"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "DeviceEvent_eventType_idx" ON "DeviceEvent"("eventType");

-- CreateIndex
CREATE INDEX "DeviceEvent_parkingStatus_idx" ON "DeviceEvent"("parkingStatus");

-- CreateIndex
CREATE INDEX "DeviceEvent_occurredAt_idx" ON "DeviceEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "DeviceEvent_receivedAt_idx" ON "DeviceEvent"("receivedAt");

-- CreateIndex
CREATE INDEX "SensorEventLog_devEui_idx" ON "SensorEventLog"("devEui");

-- CreateIndex
CREATE INDEX "SensorEventLog_deviceId_idx" ON "SensorEventLog"("deviceId");

-- CreateIndex
CREATE INDEX "SensorEventLog_parkingSpaceId_idx" ON "SensorEventLog"("parkingSpaceId");

-- CreateIndex
CREATE INDEX "SensorEventLog_eventType_idx" ON "SensorEventLog"("eventType");

-- CreateIndex
CREATE INDEX "SensorEventLog_parkingStatus_idx" ON "SensorEventLog"("parkingStatus");

-- CreateIndex
CREATE INDEX "SensorEventLog_occurredAt_idx" ON "SensorEventLog"("occurredAt");

-- CreateIndex
CREATE INDEX "SensorEventLog_createdAt_idx" ON "SensorEventLog"("createdAt");

-- CreateIndex
CREATE INDEX "DisplayBoardModule_displayBoardId_idx" ON "DisplayBoardModule"("displayBoardId");

-- CreateIndex
CREATE INDEX "DisplayBoardModule_parkingSectionId_idx" ON "DisplayBoardModule"("parkingSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayBoardModule_displayBoardId_rowNo_colNo_key" ON "DisplayBoardModule"("displayBoardId", "rowNo", "colNo");

-- CreateIndex
CREATE INDEX "TenantUser_userId_idx" ON "TenantUser"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantUser_tenantId_userId_role_key" ON "TenantUser"("tenantId", "userId", "role");

-- CreateIndex
CREATE INDEX "ParkingLotPhoto_parkingLotId_idx" ON "ParkingLotPhoto"("parkingLotId");

-- CreateIndex
CREATE UNIQUE INDEX "ParkingLotQr_qrToken_key" ON "ParkingLotQr"("qrToken");

-- CreateIndex
CREATE INDEX "ParkingLotQr_parkingLotId_idx" ON "ParkingLotQr"("parkingLotId");

-- CreateIndex
CREATE INDEX "FavoriteParkingLot_parkingLotId_idx" ON "FavoriteParkingLot"("parkingLotId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteParkingLot_userId_parkingLotId_key" ON "FavoriteParkingLot"("userId", "parkingLotId");

-- CreateIndex
CREATE INDEX "ParkingRegistrationPhoto_parkingSessionId_idx" ON "ParkingRegistrationPhoto"("parkingSessionId");

-- CreateIndex
CREATE INDEX "ParkingRegistrationPhoto_capturedByUserId_idx" ON "ParkingRegistrationPhoto"("capturedByUserId");

-- CreateIndex
CREATE INDEX "WatcherApplication_watcherUserId_idx" ON "WatcherApplication"("watcherUserId");

-- CreateIndex
CREATE INDEX "WatcherApplication_parkingLotId_status_idx" ON "WatcherApplication"("parkingLotId", "status");

-- CreateIndex
CREATE INDEX "WatcherLotBinding_parkingLotId_idx" ON "WatcherLotBinding"("parkingLotId");

-- CreateIndex
CREATE UNIQUE INDEX "WatcherLotBinding_watcherUserId_parkingLotId_key" ON "WatcherLotBinding"("watcherUserId", "parkingLotId");

-- CreateIndex
CREATE INDEX "EnforcementCase_parkingLotId_status_idx" ON "EnforcementCase"("parkingLotId", "status");

-- CreateIndex
CREATE INDEX "EnforcementCase_parkingSessionId_idx" ON "EnforcementCase"("parkingSessionId");

-- CreateIndex
CREATE INDEX "RegistrationProxyLog_performedByUserId_idx" ON "RegistrationProxyLog"("performedByUserId");

-- CreateIndex
CREATE INDEX "RegistrationProxyLog_parkingSessionId_idx" ON "RegistrationProxyLog"("parkingSessionId");

-- CreateIndex
CREATE INDEX "InvoiceManualPayment_invoiceId_idx" ON "InvoiceManualPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceManualPayment_collectedByUserId_idx" ON "InvoiceManualPayment"("collectedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayBoard_parkingLotId_key" ON "DisplayBoard"("parkingLotId");

-- CreateIndex
CREATE INDEX "DisplayBoard_mode_idx" ON "DisplayBoard"("mode");

-- CreateIndex
CREATE INDEX "DisplayBoard_enabled_idx" ON "DisplayBoard"("enabled");

-- CreateIndex
CREATE INDEX "ParkingLot_region_idx" ON "ParkingLot"("region");

-- AddForeignKey
ALTER TABLE "ParkingSession" ADD CONSTRAINT "ParkingSession_visitorProfileUserId_fkey" FOREIGN KEY ("visitorProfileUserId") REFERENCES "VisitorProfile"("userId") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayBoard" ADD CONSTRAINT "DisplayBoard_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayBoardLine" ADD CONSTRAINT "DisplayBoardLine_displayBoardId_fkey" FOREIGN KEY ("displayBoardId") REFERENCES "DisplayBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayCommand" ADD CONSTRAINT "DisplayCommand_displayBoardId_fkey" FOREIGN KEY ("displayBoardId") REFERENCES "DisplayBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SensorEventLog" ADD CONSTRAINT "SensorEventLog_parkingSpaceId_fkey" FOREIGN KEY ("parkingSpaceId") REFERENCES "ParkingSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayBoardModule" ADD CONSTRAINT "DisplayBoardModule_displayBoardId_fkey" FOREIGN KEY ("displayBoardId") REFERENCES "DisplayBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayBoardModule" ADD CONSTRAINT "DisplayBoardModule_parkingSectionId_fkey" FOREIGN KEY ("parkingSectionId") REFERENCES "ParkingSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantUser" ADD CONSTRAINT "TenantUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingLotPhoto" ADD CONSTRAINT "ParkingLotPhoto_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingLotQr" ADD CONSTRAINT "ParkingLotQr_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteParkingLot" ADD CONSTRAINT "FavoriteParkingLot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteParkingLot" ADD CONSTRAINT "FavoriteParkingLot_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingRegistrationPhoto" ADD CONSTRAINT "ParkingRegistrationPhoto_parkingSessionId_fkey" FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkingRegistrationPhoto" ADD CONSTRAINT "ParkingRegistrationPhoto_capturedByUserId_fkey" FOREIGN KEY ("capturedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatcherApplication" ADD CONSTRAINT "WatcherApplication_watcherUserId_fkey" FOREIGN KEY ("watcherUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatcherApplication" ADD CONSTRAINT "WatcherApplication_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatcherApplication" ADD CONSTRAINT "WatcherApplication_rejectedByUserId_fkey" FOREIGN KEY ("rejectedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatcherApplication" ADD CONSTRAINT "WatcherApplication_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatcherLotBinding" ADD CONSTRAINT "WatcherLotBinding_watcherUserId_fkey" FOREIGN KEY ("watcherUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WatcherLotBinding" ADD CONSTRAINT "WatcherLotBinding_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementCase" ADD CONSTRAINT "EnforcementCase_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementCase" ADD CONSTRAINT "EnforcementCase_parkingSessionId_fkey" FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementCase" ADD CONSTRAINT "EnforcementCase_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnforcementCase" ADD CONSTRAINT "EnforcementCase_resolvedByUserId_fkey" FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationProxyLog" ADD CONSTRAINT "RegistrationProxyLog_parkingSessionId_fkey" FOREIGN KEY ("parkingSessionId") REFERENCES "ParkingSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RegistrationProxyLog" ADD CONSTRAINT "RegistrationProxyLog_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceManualPayment" ADD CONSTRAINT "InvoiceManualPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceManualPayment" ADD CONSTRAINT "InvoiceManualPayment_collectedByUserId_fkey" FOREIGN KEY ("collectedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
