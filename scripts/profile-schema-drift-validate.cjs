#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  ROOT_DIR,
  assertProfile,
  resolveEnvFile,
  parseEnvFile,
} = require('./profile-config.cjs');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const profile = process.argv[2];

if (!profile) {
  fail(
    'Usage: node scripts/profile-schema-drift-validate.cjs ' +
      '<profile>',
  );
}

try {
  assertProfile(profile);
} catch (error) {
  fail(error.message);
}

const envFile = resolveEnvFile(profile, 'api');

if (!fs.existsSync(envFile)) {
  fail(`Environment file not found: ${envFile}`);
}

const {
  values: profileValues,
  duplicates,
} = parseEnvFile(envFile);

if (duplicates.length > 0) {
  fail(
    `Duplicate environment keys: ${duplicates.join(', ')}`,
  );
}

if (!profileValues.DATABASE_URL) {
  fail(`DATABASE_URL is missing from ${envFile}`);
}

const dbDirectory = path.join(
  ROOT_DIR,
  'packages',
  'db',
);

const env = {
  ...process.env,
  ...profileValues,
};

const result = spawnSync(
  'pnpm',
  [
    'exec',
    'prisma',
    'migrate',
    'diff',
    '--from-schema-datasource',
    './prisma/schema.prisma',
    '--to-schema-datamodel',
    './prisma/schema.prisma',
    '--script',
    '--exit-code',
  ],
  {
    cwd: dbDirectory,
    env,
    encoding: 'utf8',
    stdio: [
      'ignore',
      'pipe',
      'pipe',
    ],
  },
);

if (result.error) {
  fail(result.error.message);
}

/*
 * Prisma migrate diff exit codes:
 *
 * 0: no difference
 * 1: execution error
 * 2: schema difference found
 */
if (
  result.status !== 0 &&
  result.status !== 2
) {
  process.stderr.write(result.stderr || '');

  fail(
    `Prisma schema diff failed with exit code ` +
      `${result.status}`,
  );
}

const normalizedStatements = (result.stdout || '')
  .split(/\r?\n/)
  .filter((line) => {
    const trimmed = line.trim();

    return (
      trimmed.length > 0 &&
      !trimmed.startsWith('--')
    );
  })
  .join('\n')
  .split(';')
  .map((statement) => {
    return statement
      .replace(/\s+/g, ' ')
      .trim();
  })
  .filter(Boolean);

/*
 * These objects intentionally remain in operational databases.
 *
 * Prisma proposes deleting or renaming them because they are not
 * represented exactly in schema.prisma. They are retained for
 * compatibility and operational safety.
 */
const allowedOperationalStatements = new Set([
  [
    'ALTER TABLE "EdgeNode"',
    'DROP CONSTRAINT "EdgeNode_tenantId_fkey"',
  ].join(' '),

  [
    'ALTER TABLE "ParkingLot"',
    'DROP CONSTRAINT "ParkingLot_tenantId_fkey"',
  ].join(' '),

  'DROP INDEX "EdgeNode_tenantId_idx"',

  'DROP INDEX "Invoice_sessionId_status_idx"',

  [
    'ALTER TABLE "EdgeNode"',
    'DROP COLUMN "tenantId"',
  ].join(' '),

  [
    'ALTER TABLE "ParkingLot"',
    'DROP COLUMN "tenantId"',
  ].join(' '),

  [
    'ALTER INDEX',
    '"MemberEligibilityDeclaration_memberProfileId_eligibilityDefinit"',
    'RENAME TO',
    '"MemberEligibilityDeclaration_memberProfileId_eligibilityDef_key"',
  ].join(' '),

  [
    'ALTER INDEX',
    '"VehicleEligibilityDeclaration_vehicleId_eligibilityDefinitionId"',
    'RENAME TO',
    '"VehicleEligibilityDeclaration_vehicleId_eligibilityDefiniti_key"',
  ].join(' '),

  /*
   * Cloud-only legacy index.
   *
   * This is an additional index, not a missing required index.
   */
  'DROP INDEX "Tenant_businessNumber_idx"',

  /*
   * Existing operational databases used PostgreSQL's default
   * timestamp precision before the Prisma schema was standardized
   * to TIMESTAMP(3). Runtime behavior is compatible.
   */
  [
    'ALTER TABLE "ControlService"',
    'ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3),',
    'ALTER COLUMN "updatedAt" DROP DEFAULT,',
    'ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3)',
  ].join(' '),

  [
    'ALTER TABLE "ParkingSession"',
    'ALTER COLUMN "manualEntryAt" SET DATA TYPE TIMESTAMP(3),',
    'ALTER COLUMN "manualExitAt" SET DATA TYPE TIMESTAMP(3)',
  ].join(' '),

  [
    'ALTER TABLE "ParkingSpaceTypeStyle"',
    'ALTER COLUMN "updatedAt" DROP DEFAULT',
  ].join(' '),

  [
    'ALTER TABLE "TenantAppCredential"',
    'ALTER COLUMN "updatedAt" DROP DEFAULT',
  ].join(' '),

  [
    'ALTER TABLE "TenantApplication"',
    'ALTER COLUMN "updatedAt" DROP DEFAULT',
  ].join(' '),
]);

const allowedOperationalPatterns = [
  /*
   * Retained operational backup tables.
   *
   * Only tables whose complete name starts with "_backup_" are
   * accepted. Other unexpected DROP TABLE statements still fail.
   */
  /^DROP TABLE "_backup_[A-Za-z0-9_]+"$/,
];

/*
 * The Cloud TenantVisitConfirmation foreign key differs only in
 * referential-action metadata.
 *
 * It is accepted only when Prisma proposes both the drop and the
 * matching recreation in the same diff. A lone ADD or DROP remains
 * an error so that a genuinely missing constraint is not hidden.
 */
const pairedOperationalStatementGroups = [
  [
    [
      'ALTER TABLE "TenantVisitConfirmation"',
      'DROP CONSTRAINT',
      '"TenantVisitConfirmation_confirmedByUserId_fkey"',
    ].join(' '),

    [
      'ALTER TABLE "TenantVisitConfirmation"',
      'ADD CONSTRAINT',
      '"TenantVisitConfirmation_confirmedByUserId_fkey"',
      'FOREIGN KEY ("confirmedByUserId")',
      'REFERENCES "User"("id")',
      'ON DELETE SET NULL',
      'ON UPDATE CASCADE',
    ].join(' '),
  ],
];

const presentStatements = new Set(
  normalizedStatements,
);

const allowedPairedStatements = new Set();

for (
  const statementGroup
  of pairedOperationalStatementGroups
) {
  const completeGroup = statementGroup.every(
    (statement) => {
      return presentStatements.has(statement);
    },
  );

  if (!completeGroup) {
    continue;
  }

  for (const statement of statementGroup) {
    allowedPairedStatements.add(statement);
  }
}

function isAllowedOperationalStatement(statement) {
  if (
    allowedOperationalStatements.has(statement) ||
    allowedPairedStatements.has(statement)
  ) {
    return true;
  }

  return allowedOperationalPatterns.some(
    (pattern) => pattern.test(statement),
  );
}

const allowedOperational = [];
const unapproved = [];

for (const statement of normalizedStatements) {
  if (isAllowedOperationalStatement(statement)) {
    allowedOperational.push(statement);
  } else {
    unapproved.push(statement);
  }
}

console.log(`PROFILE=${profile}`);

console.log(
  `API_ENV=${path.relative(ROOT_DIR, envFile)}`,
);

console.log(
  `SCHEMA_DIFF_STATEMENT_COUNT=` +
    `${normalizedStatements.length}`,
);

for (const statement of allowedOperational) {
  console.log(
    `WARN=ALLOWED_OPERATIONAL_SCHEMA_DRIFT:` +
      `${statement}`,
  );
}

for (const statement of unapproved) {
  console.log(
    `ERROR=UNAPPROVED_SCHEMA_DRIFT:${statement}`,
  );
}

console.log(
  `ALLOWED_OPERATIONAL_DRIFT_COUNT=` +
    `${allowedOperational.length}`,
);

console.log(
  `UNAPPROVED_SCHEMA_DRIFT_COUNT=` +
    `${unapproved.length}`,
);

if (unapproved.length > 0) {
  console.log(
    `PROFILE_SCHEMA_DRIFT_VALIDATE_FAILED=${profile}`,
  );

  process.exit(1);
}

console.log(
  `PROFILE_SCHEMA_DRIFT_VALIDATE_OK=${profile}`,
);
