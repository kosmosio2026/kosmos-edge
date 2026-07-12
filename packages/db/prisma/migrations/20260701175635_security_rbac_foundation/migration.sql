/*
  Warnings:

  - A unique constraint covering the columns `[roleId,menuPolicyId]` on the table `RoleMenuPolicy` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ScopeType" ADD VALUE 'TENANT';
ALTER TYPE "ScopeType" ADD VALUE 'EDGE';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserStatus" ADD VALUE 'PENDING_EMAIL_VERIFICATION';
ALTER TYPE "UserStatus" ADD VALUE 'PENDING_APPROVAL';
ALTER TYPE "UserStatus" ADD VALUE 'LOCKED';

-- AlterTable
ALTER TABLE "DisplayBoard" ADD COLUMN     "protocolMode" TEXT NOT NULL DEFAULT 'ethernet',
ALTER COLUMN "tcpPort" SET DEFAULT 5000;

-- AlterTable
ALTER TABLE "RoleMenuPolicy" ADD COLUMN     "menuPolicyId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "lockedUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "MenuPolicy" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "href" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "scopeLevel" TEXT,
    "description" TEXT,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DisplayConfig" (
    "id" TEXT NOT NULL,
    "displayBoardId" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "cols" INTEGER NOT NULL,
    "moduleType" INTEGER,
    "rgbOrder" INTEGER,

    CONSTRAINT "DisplayConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ad" (
    "id" TEXT NOT NULL,
    "displayBoardId" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "isEvent" BOOLEAN NOT NULL DEFAULT false,
    "resetBefore" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ad_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdLine" (
    "id" TEXT NOT NULL,
    "adId" TEXT NOT NULL,
    "line" INTEGER NOT NULL,
    "fontSize" INTEGER NOT NULL,
    "effect" TEXT NOT NULL,
    "speed" INTEGER NOT NULL,
    "delay" INTEGER NOT NULL,
    "neon" INTEGER NOT NULL,
    "fix" BOOLEAN NOT NULL DEFAULT false,
    "textRaw" TEXT NOT NULL,

    CONSTRAINT "AdLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColorPreset" (
    "id" INTEGER NOT NULL,
    "code" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "ColorPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TextAttribute" (
    "id" INTEGER NOT NULL,
    "code" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "TextAttribute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FontPreset" (
    "id" INTEGER NOT NULL,
    "code" INTEGER NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "FontPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WidthPreset" (
    "id" INTEGER NOT NULL,
    "code" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "WidthPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IconPreset" (
    "id" INTEGER NOT NULL,
    "code" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "IconPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EffectPreset" (
    "id" SERIAL NOT NULL,
    "xx" INTEGER NOT NULL,
    "yy" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "EffectPreset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailVerificationToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoginAttempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApiKey" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "name" TEXT,
    "scopes" JSONB,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdgeNode" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "appVersion" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastConnectedAt" TIMESTAMP(3),
    "lastSyncAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdgeNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdgeNodeKey" (
    "id" TEXT NOT NULL,
    "edgeNodeId" TEXT NOT NULL,
    "keyId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "publicKey" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EdgeNodeKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EdgeParkingLot" (
    "id" TEXT NOT NULL,
    "edgeNodeId" TEXT NOT NULL,
    "parkingLotId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EdgeParkingLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncInbox" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventVersion" INTEGER NOT NULL DEFAULT 1,
    "aggregateType" TEXT,
    "aggregateId" TEXT,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,

    CONSTRAINT "SyncInbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncCursor" (
    "id" TEXT NOT NULL,
    "edgeNodeId" TEXT,
    "direction" TEXT NOT NULL,
    "stream" TEXT NOT NULL,
    "lastSequence" BIGINT NOT NULL DEFAULT 0,
    "lastMessageId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncCursor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncConflict" (
    "id" TEXT NOT NULL,
    "messageId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "conflictType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "localPayload" JSONB,
    "remotePayload" JSONB,
    "resolution" JSONB,
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,

    CONSTRAINT "SyncConflict_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MenuPolicy_key_key" ON "MenuPolicy"("key");

-- CreateIndex
CREATE UNIQUE INDEX "DisplayConfig_displayBoardId_key" ON "DisplayConfig"("displayBoardId");

-- CreateIndex
CREATE UNIQUE INDEX "EffectPreset_xx_yy_key" ON "EffectPreset"("xx", "yy");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_email_idx" ON "EmailVerificationToken"("email");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_expiresAt_idx" ON "EmailVerificationToken"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailVerificationToken_usedAt_idx" ON "EmailVerificationToken"("usedAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "PasswordResetToken_email_idx" ON "PasswordResetToken"("email");

-- CreateIndex
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

-- CreateIndex
CREATE INDEX "PasswordResetToken_usedAt_idx" ON "PasswordResetToken"("usedAt");

-- CreateIndex
CREATE INDEX "PasswordHistory_userId_idx" ON "PasswordHistory"("userId");

-- CreateIndex
CREATE INDEX "PasswordHistory_createdAt_idx" ON "PasswordHistory"("createdAt");

-- CreateIndex
CREATE INDEX "LoginAttempt_userId_idx" ON "LoginAttempt"("userId");

-- CreateIndex
CREATE INDEX "LoginAttempt_email_idx" ON "LoginAttempt"("email");

-- CreateIndex
CREATE INDEX "LoginAttempt_success_idx" ON "LoginAttempt"("success");

-- CreateIndex
CREATE INDEX "LoginAttempt_createdAt_idx" ON "LoginAttempt"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApiKey_keyId_key" ON "ApiKey"("keyId");

-- CreateIndex
CREATE INDEX "ApiKey_ownerType_ownerId_idx" ON "ApiKey"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "ApiKey_keyId_idx" ON "ApiKey"("keyId");

-- CreateIndex
CREATE INDEX "ApiKey_expiresAt_idx" ON "ApiKey"("expiresAt");

-- CreateIndex
CREATE INDEX "ApiKey_revokedAt_idx" ON "ApiKey"("revokedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EdgeNode_code_key" ON "EdgeNode"("code");

-- CreateIndex
CREATE INDEX "EdgeNode_tenantId_idx" ON "EdgeNode"("tenantId");

-- CreateIndex
CREATE INDEX "EdgeNode_status_idx" ON "EdgeNode"("status");

-- CreateIndex
CREATE INDEX "EdgeNode_lastSeenAt_idx" ON "EdgeNode"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "EdgeNodeKey_keyId_key" ON "EdgeNodeKey"("keyId");

-- CreateIndex
CREATE INDEX "EdgeNodeKey_edgeNodeId_idx" ON "EdgeNodeKey"("edgeNodeId");

-- CreateIndex
CREATE INDEX "EdgeNodeKey_keyId_idx" ON "EdgeNodeKey"("keyId");

-- CreateIndex
CREATE INDEX "EdgeNodeKey_isActive_idx" ON "EdgeNodeKey"("isActive");

-- CreateIndex
CREATE INDEX "EdgeNodeKey_expiresAt_idx" ON "EdgeNodeKey"("expiresAt");

-- CreateIndex
CREATE INDEX "EdgeNodeKey_revokedAt_idx" ON "EdgeNodeKey"("revokedAt");

-- CreateIndex
CREATE INDEX "EdgeParkingLot_parkingLotId_idx" ON "EdgeParkingLot"("parkingLotId");

-- CreateIndex
CREATE INDEX "EdgeParkingLot_isPrimary_idx" ON "EdgeParkingLot"("isPrimary");

-- CreateIndex
CREATE UNIQUE INDEX "EdgeParkingLot_edgeNodeId_parkingLotId_key" ON "EdgeParkingLot"("edgeNodeId", "parkingLotId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncInbox_messageId_key" ON "SyncInbox"("messageId");

-- CreateIndex
CREATE INDEX "SyncInbox_source_idx" ON "SyncInbox"("source");

-- CreateIndex
CREATE INDEX "SyncInbox_eventType_idx" ON "SyncInbox"("eventType");

-- CreateIndex
CREATE INDEX "SyncInbox_status_idx" ON "SyncInbox"("status");

-- CreateIndex
CREATE INDEX "SyncInbox_receivedAt_idx" ON "SyncInbox"("receivedAt");

-- CreateIndex
CREATE INDEX "SyncCursor_direction_idx" ON "SyncCursor"("direction");

-- CreateIndex
CREATE INDEX "SyncCursor_stream_idx" ON "SyncCursor"("stream");

-- CreateIndex
CREATE UNIQUE INDEX "SyncCursor_edgeNodeId_direction_stream_key" ON "SyncCursor"("edgeNodeId", "direction", "stream");

-- CreateIndex
CREATE INDEX "SyncConflict_aggregateType_aggregateId_idx" ON "SyncConflict"("aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "SyncConflict_status_idx" ON "SyncConflict"("status");

-- CreateIndex
CREATE INDEX "SyncConflict_detectedAt_idx" ON "SyncConflict"("detectedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RoleMenuPolicy_roleId_menuPolicyId_key" ON "RoleMenuPolicy"("roleId", "menuPolicyId");

-- AddForeignKey
ALTER TABLE "RoleMenuPolicy" ADD CONSTRAINT "RoleMenuPolicy_menuPolicyId_fkey" FOREIGN KEY ("menuPolicyId") REFERENCES "MenuPolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DisplayConfig" ADD CONSTRAINT "DisplayConfig_displayBoardId_fkey" FOREIGN KEY ("displayBoardId") REFERENCES "DisplayBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ad" ADD CONSTRAINT "Ad_displayBoardId_fkey" FOREIGN KEY ("displayBoardId") REFERENCES "DisplayBoard"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdLine" ADD CONSTRAINT "AdLine_adId_fkey" FOREIGN KEY ("adId") REFERENCES "Ad"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailVerificationToken" ADD CONSTRAINT "EmailVerificationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordHistory" ADD CONSTRAINT "PasswordHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoginAttempt" ADD CONSTRAINT "LoginAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdgeNode" ADD CONSTRAINT "EdgeNode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdgeNodeKey" ADD CONSTRAINT "EdgeNodeKey_edgeNodeId_fkey" FOREIGN KEY ("edgeNodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdgeParkingLot" ADD CONSTRAINT "EdgeParkingLot_edgeNodeId_fkey" FOREIGN KEY ("edgeNodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EdgeParkingLot" ADD CONSTRAINT "EdgeParkingLot_parkingLotId_fkey" FOREIGN KEY ("parkingLotId") REFERENCES "ParkingLot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncCursor" ADD CONSTRAINT "SyncCursor_edgeNodeId_fkey" FOREIGN KEY ("edgeNodeId") REFERENCES "EdgeNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
