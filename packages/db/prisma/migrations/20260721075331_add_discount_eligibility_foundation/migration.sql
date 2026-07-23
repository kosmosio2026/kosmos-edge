BEGIN;

CREATE TYPE "DiscountEligibilityScope" AS ENUM (
  'MEMBER',
  'VEHICLE'
);

CREATE TYPE "DiscountBenefitType" AS ENUM (
  'PERCENT',
  'FIXED_AMOUNT',
  'FREE_MINUTES',
  'FULL_WAIVER'
);

CREATE TYPE "EligibilityDeclarationSource" AS ENUM (
  'MEMBER_SIGNUP',
  'MEMBER_PROFILE',
  'MANAGER_ENTRY',
  'OPERATOR_ENTRY'
);

CREATE TYPE "DiscountApplicationSource" AS ENUM (
  'AUTOMATIC_ELIGIBILITY',
  'TENANT_COUPON',
  'MANUAL_ADJUSTMENT'
);

ALTER TABLE "Vehicle"
  ADD COLUMN "sizeClass" TEXT,
  ADD COLUMN "powertrainType" TEXT;

CREATE TABLE "DiscountEligibilityDefinition" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "scope" "DiscountEligibilityScope" NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "displayOrder" INTEGER NOT NULL DEFAULT 100,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DiscountEligibilityDefinition_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "MemberEligibilityDeclaration" (
  "id" TEXT NOT NULL,
  "memberProfileId" TEXT NOT NULL,
  "eligibilityDefinitionId" TEXT NOT NULL,
  "isDeclared" BOOLEAN NOT NULL DEFAULT true,
  "source" "EligibilityDeclarationSource"
    NOT NULL DEFAULT 'MEMBER_PROFILE',
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "MemberEligibilityDeclaration_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "VehicleEligibilityDeclaration" (
  "id" TEXT NOT NULL,
  "vehicleId" TEXT NOT NULL,
  "eligibilityDefinitionId" TEXT NOT NULL,
  "isDeclared" BOOLEAN NOT NULL DEFAULT true,
  "source" "EligibilityDeclarationSource"
    NOT NULL DEFAULT 'MEMBER_PROFILE',
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "declaredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "VehicleEligibilityDeclaration_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "ParkingDiscountProgram" (
  "id" TEXT NOT NULL,
  "parkingLotId" TEXT NOT NULL,
  "eligibilityDefinitionId" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "benefitType" "DiscountBenefitType" NOT NULL,
  "benefitValue" INTEGER NOT NULL,
  "priority" INTEGER NOT NULL DEFAULT 100,
  "stackable" BOOLEAN NOT NULL DEFAULT true,
  "stackableWithCoupon" BOOLEAN NOT NULL DEFAULT true,
  "maxDiscountAmount" INTEGER,
  "minimumPayableAmount" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ParkingDiscountProgram_pkey"
    PRIMARY KEY ("id")
);

CREATE TABLE "ParkingSessionDiscount" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "invoiceId" TEXT,
  "programId" TEXT,
  "source" "DiscountApplicationSource" NOT NULL,
  "eligibilityCodeSnapshot" TEXT,
  "programCodeSnapshot" TEXT,
  "programNameSnapshot" TEXT NOT NULL,
  "benefitTypeSnapshot" TEXT NOT NULL,
  "benefitValueSnapshot" INTEGER NOT NULL,
  "baseAmount" INTEGER NOT NULL,
  "discountAmount" INTEGER NOT NULL,
  "appliedOrder" INTEGER NOT NULL DEFAULT 1,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ParkingSessionDiscount_pkey"
    PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX
  "DiscountEligibilityDefinition_code_key"
ON "DiscountEligibilityDefinition"("code");

CREATE INDEX
  "DiscountEligibilityDefinition_scope_idx"
ON "DiscountEligibilityDefinition"("scope");

CREATE INDEX
  "DiscountEligibilityDefinition_isActive_displayOrder_idx"
ON "DiscountEligibilityDefinition"("isActive", "displayOrder");

CREATE UNIQUE INDEX
  "MemberEligibilityDeclaration_memberProfileId_eligibilityDefinitionId_key"
ON "MemberEligibilityDeclaration"(
  "memberProfileId",
  "eligibilityDefinitionId"
);

CREATE INDEX
  "MemberEligibilityDeclaration_eligibilityDefinitionId_idx"
ON "MemberEligibilityDeclaration"("eligibilityDefinitionId");

CREATE INDEX
  "MemberEligibilityDeclaration_isDeclared_idx"
ON "MemberEligibilityDeclaration"("isDeclared");

CREATE INDEX
  "MemberEligibilityDeclaration_validUntil_idx"
ON "MemberEligibilityDeclaration"("validUntil");

CREATE UNIQUE INDEX
  "VehicleEligibilityDeclaration_vehicleId_eligibilityDefinitionId_key"
ON "VehicleEligibilityDeclaration"(
  "vehicleId",
  "eligibilityDefinitionId"
);

CREATE INDEX
  "VehicleEligibilityDeclaration_eligibilityDefinitionId_idx"
ON "VehicleEligibilityDeclaration"("eligibilityDefinitionId");

CREATE INDEX
  "VehicleEligibilityDeclaration_isDeclared_idx"
ON "VehicleEligibilityDeclaration"("isDeclared");

CREATE INDEX
  "VehicleEligibilityDeclaration_validUntil_idx"
ON "VehicleEligibilityDeclaration"("validUntil");

CREATE UNIQUE INDEX
  "ParkingDiscountProgram_parkingLotId_code_key"
ON "ParkingDiscountProgram"("parkingLotId", "code");

CREATE INDEX
  "ParkingDiscountProgram_parkingLotId_isActive_idx"
ON "ParkingDiscountProgram"("parkingLotId", "isActive");

CREATE INDEX
  "ParkingDiscountProgram_eligibilityDefinitionId_idx"
ON "ParkingDiscountProgram"("eligibilityDefinitionId");

CREATE INDEX
  "ParkingDiscountProgram_priority_idx"
ON "ParkingDiscountProgram"("priority");

CREATE INDEX
  "ParkingDiscountProgram_validFrom_validUntil_idx"
ON "ParkingDiscountProgram"("validFrom", "validUntil");

CREATE UNIQUE INDEX
  "ParkingSessionDiscount_sessionId_programId_key"
ON "ParkingSessionDiscount"("sessionId", "programId");

CREATE INDEX
  "ParkingSessionDiscount_sessionId_appliedOrder_idx"
ON "ParkingSessionDiscount"("sessionId", "appliedOrder");

CREATE INDEX
  "ParkingSessionDiscount_invoiceId_idx"
ON "ParkingSessionDiscount"("invoiceId");

CREATE INDEX
  "ParkingSessionDiscount_programId_idx"
ON "ParkingSessionDiscount"("programId");

CREATE INDEX
  "ParkingSessionDiscount_source_idx"
ON "ParkingSessionDiscount"("source");

CREATE INDEX
  "ParkingSessionDiscount_createdAt_idx"
ON "ParkingSessionDiscount"("createdAt");

ALTER TABLE "MemberEligibilityDeclaration"
  ADD CONSTRAINT "MemberEligibilityDeclaration_memberProfileId_fkey"
  FOREIGN KEY ("memberProfileId")
  REFERENCES "MemberProfile"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "MemberEligibilityDeclaration"
  ADD CONSTRAINT "MemberEligibilityDeclaration_eligibilityDefinitionId_fkey"
  FOREIGN KEY ("eligibilityDefinitionId")
  REFERENCES "DiscountEligibilityDefinition"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "VehicleEligibilityDeclaration"
  ADD CONSTRAINT "VehicleEligibilityDeclaration_vehicleId_fkey"
  FOREIGN KEY ("vehicleId")
  REFERENCES "Vehicle"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "VehicleEligibilityDeclaration"
  ADD CONSTRAINT "VehicleEligibilityDeclaration_eligibilityDefinitionId_fkey"
  FOREIGN KEY ("eligibilityDefinitionId")
  REFERENCES "DiscountEligibilityDefinition"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ParkingDiscountProgram"
  ADD CONSTRAINT "ParkingDiscountProgram_parkingLotId_fkey"
  FOREIGN KEY ("parkingLotId")
  REFERENCES "ParkingLot"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ParkingDiscountProgram"
  ADD CONSTRAINT "ParkingDiscountProgram_eligibilityDefinitionId_fkey"
  FOREIGN KEY ("eligibilityDefinitionId")
  REFERENCES "DiscountEligibilityDefinition"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

ALTER TABLE "ParkingSessionDiscount"
  ADD CONSTRAINT "ParkingSessionDiscount_sessionId_fkey"
  FOREIGN KEY ("sessionId")
  REFERENCES "ParkingSession"("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "ParkingSessionDiscount"
  ADD CONSTRAINT "ParkingSessionDiscount_invoiceId_fkey"
  FOREIGN KEY ("invoiceId")
  REFERENCES "Invoice"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

ALTER TABLE "ParkingSessionDiscount"
  ADD CONSTRAINT "ParkingSessionDiscount_programId_fkey"
  FOREIGN KEY ("programId")
  REFERENCES "ParkingDiscountProgram"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

/*
 * Current policy:
 * Eligibility is based on member-declared information.
 * No government or public-network verification is performed.
 *
 * TODO:
 * Add optional external verification when an approved integration
 * and customer requirement become available.
 */
INSERT INTO "DiscountEligibilityDefinition" (
  "id",
  "code",
  "name",
  "scope",
  "description",
  "isActive",
  "displayOrder",
  "createdAt",
  "updatedAt"
)
VALUES
  (
    'elig_light_car',
    'LIGHT_CAR',
    '경차',
    'VEHICLE',
    '회원이 등록한 차량 분류를 기준으로 판단',
    true,
    10,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'elig_ev',
    'EV',
    '전기차',
    'VEHICLE',
    '회원이 등록한 차량 동력원을 기준으로 판단',
    true,
    20,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'elig_disabled',
    'DISABLED',
    '장애인',
    'MEMBER',
    '회원이 직접 선택한 자기신고 정보를 기준으로 판단',
    true,
    30,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'elig_pregnant',
    'PREGNANT',
    '임산부',
    'MEMBER',
    '회원이 직접 선택한 자기신고 정보를 기준으로 판단',
    true,
    40,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'elig_veteran',
    'VETERAN',
    '국가유공자',
    'MEMBER',
    '회원이 직접 선택한 자기신고 정보를 기준으로 판단',
    true,
    50,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  )
ON CONFLICT ("code") DO UPDATE
SET
  "name" = EXCLUDED."name",
  "scope" = EXCLUDED."scope",
  "description" = EXCLUDED."description",
  "isActive" = EXCLUDED."isActive",
  "displayOrder" = EXCLUDED."displayOrder",
  "updatedAt" = CURRENT_TIMESTAMP;

/*
 * Repair legacy sessions whose Invoice exists through Invoice.sessionId
 * but whose ParkingSession.primaryInvoiceId was not populated.
 *
 * This avoids the invalid correlated FROM reference used by the old
 * invoice_primary_bridge migration.
 */
WITH ranked_invoice AS (
  SELECT
    i."id",
    i."sessionId",
    ROW_NUMBER() OVER (
      PARTITION BY i."sessionId"
      ORDER BY
        CASE
          WHEN COALESCE(i."metadata" ->> 'invoiceKind', 'PARKING_FEE')
            = 'ADDITIONAL_FEE'
          THEN 1
          ELSE 0
        END,
        CASE i."status"
          WHEN 'PAID' THEN 0
          WHEN 'PARTIALLY_PAID' THEN 1
          WHEN 'ISSUED' THEN 2
          WHEN 'OVERDUE' THEN 3
          WHEN 'DRAFT' THEN 4
          ELSE 5
        END,
        i."createdAt" ASC
    ) AS rn
  FROM "Invoice" i
  WHERE i."status" NOT IN ('VOID', 'CANCELLED')
)
UPDATE "ParkingSession" AS s
SET "primaryInvoiceId" = r."id"
FROM ranked_invoice AS r
WHERE r."rn" = 1
  AND r."sessionId" = s."id"
  AND s."primaryInvoiceId" IS NULL;

COMMIT;
