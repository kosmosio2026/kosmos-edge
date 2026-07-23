#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  spawnSync,
} = require('node:child_process');

const {
  ROOT_DIR,
  assertProfile,
  resolveEnvFile,
  getDatabaseName,
  parseEnvFile,
} = require('./profile-config.cjs');

const profile = process.argv[2];

const errors = [];
const warnings = [];

function fail(message) {
  errors.push(message);
  console.error(`ERROR=${message}`);
}

function warn(message) {
  warnings.push(message);
  console.log(`WARN=${message}`);
}

function parseBoolean(value) {
  return String(value).trim().toLowerCase() === 't';
}

function parseDatabaseUrl(rawValue) {
  let parsed;

  try {
    parsed = new URL(rawValue);
  } catch {
    throw new Error('DATABASE_URL is not a valid URL');
  }

  if (
    parsed.protocol !== 'postgresql:' &&
    parsed.protocol !== 'postgres:'
  ) {
    throw new Error(
      `Unsupported DATABASE_URL protocol: ${parsed.protocol}`,
    );
  }

  const database = decodeURIComponent(
    parsed.pathname.replace(/^\/+/, '').split('/')[0] ?? '',
  );

  if (!database) {
    throw new Error(
      'DATABASE_URL does not contain a database name',
    );
  }

  const username = decodeURIComponent(parsed.username);

  if (!username) {
    throw new Error(
      'DATABASE_URL does not contain a username',
    );
  }

  return {
    host: parsed.hostname || '127.0.0.1',
    port: parsed.port || '5432',
    username,
    password: decodeURIComponent(parsed.password),
    database,
    sslmode: parsed.searchParams.get('sslmode') || '',
  };
}

function runPsql(connection, sql) {
  const args = [
    '--no-psqlrc',
    '-X',
    '-h',
    connection.host,
    '-p',
    connection.port,
    '-U',
    connection.username,
    '-d',
    connection.database,
    '-v',
    'ON_ERROR_STOP=1',
    '-A',
    '-t',
    '-F',
    '\t',
    '-c',
    sql,
  ];

  const env = {
    ...process.env,
    PGAPPNAME: `kosmos-profile-db-validate-${profile}`,
  };

  if (connection.password) {
    env.PGPASSWORD = connection.password;
  } else {
    delete env.PGPASSWORD;
  }

  if (connection.sslmode) {
    env.PGSSLMODE = connection.sslmode;
  }

  const result = spawnSync(
    'psql',
    args,
    {
      cwd: ROOT_DIR,
      env,
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    },
  );

  if (result.error) {
    throw new Error(
      `Unable to execute psql: ${result.error.message}`,
    );
  }

  if (result.status !== 0) {
    const message = (
      result.stderr ||
      result.stdout ||
      `psql exited with status ${result.status}`
    ).trim();

    throw new Error(message);
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function runScalar(connection, sql) {
  const lines = runPsql(connection, sql);

  return lines[0] ?? '';
}

function checkCriticalObjects(connection) {
  const sql = `
WITH required(kind, name) AS (
  VALUES
    ('table', 'Tenant'),
    ('table', 'TenantAppCredential'),
    ('table', 'TenantApplication'),
    ('table', 'TenantCharge'),
    ('table', 'TenantCoupon'),
    ('table', 'TenantCouponEvent'),
    ('table', 'TenantCouponProduct'),
    ('table', 'TenantCouponPurchase'),
    ('table', 'TenantMonthlyStatement'),
    ('table', 'TenantUser'),
    ('table', 'TenantVisitConfirmation'),
    ('table', 'ParkingSession'),
    ('type', 'TenantApplicationStatus')
)
SELECT
  kind,
  name,
  CASE
    WHEN kind = 'table'
      THEN to_regclass(
        format('public.%I', name)
      ) IS NOT NULL
    WHEN kind = 'type'
      THEN to_regtype(
        format('public.%I', name)
      ) IS NOT NULL
    ELSE false
  END AS object_exists
FROM required
ORDER BY kind, name;
`;

  const lines = runPsql(connection, sql);

  for (const line of lines) {
    const [
      kind,
      name,
      existsValue,
    ] = line.split('\t');

    if (parseBoolean(existsValue)) {
      console.log(
        `OBJECT_OK=${kind}:${name}`,
      );
    } else {
      fail(
        `OBJECT_MISSING:${kind}:${name}`,
      );
    }
  }
}

function checkMigrations(connection) {
  const exists = parseBoolean(
    runScalar(
      connection,
      `
SELECT
  to_regclass(
    'public."_prisma_migrations"'
  ) IS NOT NULL;
`,
    ),
  );

  if (!exists) {
    fail('PRISMA_MIGRATION_TABLE_MISSING');
    return;
  }

  console.log('PRISMA_MIGRATION_TABLE=OK');

  const failedCount = Number.parseInt(
    runScalar(
      connection,
      `
SELECT count(*)
FROM "_prisma_migrations"
WHERE finished_at IS NULL
  AND rolled_back_at IS NULL;
`,
    ),
    10,
  );

  const rolledBackCount = Number.parseInt(
    runScalar(
      connection,
      `
SELECT count(*)
FROM "_prisma_migrations"
WHERE rolled_back_at IS NOT NULL;
`,
    ),
    10,
  );

  const latestMigration = runScalar(
    connection,
    `
SELECT migration_name
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL
  AND rolled_back_at IS NULL
ORDER BY finished_at DESC
LIMIT 1;
`,
  );

  console.log(
    `MIGRATION_FAILED_COUNT=${failedCount}`,
  );
  console.log(
    `MIGRATION_ROLLED_BACK_COUNT=${rolledBackCount}`,
  );
  console.log(
    `LATEST_APPLIED_MIGRATION=${latestMigration || 'NONE'}`,
  );

  if (failedCount > 0) {
    fail(
      `PRISMA_FAILED_MIGRATIONS:${failedCount}`,
    );
  }

  if (rolledBackCount > 0) {
    warn(
      `PRISMA_ROLLED_BACK_MIGRATIONS:${rolledBackCount}`,
    );
  }
}

function checkTenantCoveredAmount(connection) {
  const tableExists = parseBoolean(
    runScalar(
      connection,
      `
SELECT
  to_regclass(
    'public."ParkingSession"'
  ) IS NOT NULL;
`,
    ),
  );

  if (!tableExists) {
    return;
  }

  const columnLines = runPsql(
    connection,
    `
SELECT
  data_type,
  is_nullable,
  COALESCE(column_default, '')
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'ParkingSession'
  AND column_name = 'tenantCoveredAmount';
`,
  );

  if (columnLines.length === 0) {
    fail(
      'COLUMN_MISSING:ParkingSession.tenantCoveredAmount',
    );
    return;
  }

  const [
    dataType,
    nullable,
    defaultValue,
  ] = columnLines[0].split('\t');

  console.log(
    `TENANT_COVERED_AMOUNT_DATA_TYPE=${dataType}`,
  );
  console.log(
    `TENANT_COVERED_AMOUNT_NULLABLE=${nullable}`,
  );
  console.log(
    `TENANT_COVERED_AMOUNT_DEFAULT=${defaultValue || 'NONE'}`,
  );

  if (dataType !== 'integer') {
    fail(
      `COLUMN_TYPE_MISMATCH:` +
      `ParkingSession.tenantCoveredAmount:${dataType}`,
    );
  }

  if (nullable !== 'NO') {
    fail(
      'COLUMN_NULLABLE:' +
      'ParkingSession.tenantCoveredAmount',
    );
  }

  if (!/(^|\D)0(\D|$)/.test(defaultValue)) {
    fail(
      'COLUMN_DEFAULT_MISMATCH:' +
      'ParkingSession.tenantCoveredAmount',
    );
  }

  const nullCount = Number.parseInt(
    runScalar(
      connection,
      `
SELECT count(*)
FROM "ParkingSession"
WHERE "tenantCoveredAmount" IS NULL;
`,
    ),
    10,
  );

  console.log(
    `TENANT_COVERED_AMOUNT_NULL_ROWS=${nullCount}`,
  );

  if (nullCount > 0) {
    fail(
      `COLUMN_NULL_DATA:` +
      `ParkingSession.tenantCoveredAmount:${nullCount}`,
    );
  }
}


function checkLocalMigrationHistory(connection) {
  const migrationsDir = path.join(
    ROOT_DIR,
    'packages',
    'db',
    'prisma',
    'migrations',
  );

  if (!fs.existsSync(migrationsDir)) {
    fail(
      `LOCAL_MIGRATION_DIRECTORY_MISSING:` +
      migrationsDir,
    );
    return;
  }

  const localMigrations = fs
    .readdirSync(
      migrationsDir,
      {
        withFileTypes: true,
      },
    )
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const appliedMigrations = runPsql(
    connection,
    `
SELECT DISTINCT migration_name
FROM "_prisma_migrations"
WHERE finished_at IS NOT NULL
  AND rolled_back_at IS NULL
ORDER BY migration_name;
`,
  );

  const localSet = new Set(localMigrations);
  const appliedSet = new Set(appliedMigrations);

  const pendingMigrations = localMigrations.filter(
    (migration) => !appliedSet.has(migration),
  );

  const databaseOnlyMigrations =
    appliedMigrations.filter(
      (migration) => !localSet.has(migration),
    );

  console.log(
    `LOCAL_MIGRATION_COUNT=${localMigrations.length}`,
  );
  console.log(
    `APPLIED_MIGRATION_COUNT=${appliedMigrations.length}`,
  );
  console.log(
    `PENDING_LOCAL_MIGRATION_COUNT=` +
    pendingMigrations.length,
  );
  console.log(
    `DATABASE_ONLY_MIGRATION_COUNT=` +
    databaseOnlyMigrations.length,
  );

  for (const migration of pendingMigrations) {
    fail(
      `PRISMA_LOCAL_MIGRATION_NOT_APPLIED:` +
      migration,
    );
  }

  for (const migration of databaseOnlyMigrations) {
    fail(
      `PRISMA_DATABASE_MIGRATION_NOT_LOCAL:` +
      migration,
    );
  }
}


function checkPrimaryInvoiceConsistency(connection) {
  const requiredTables = runPsql(
    connection,
    `
SELECT
  to_regclass(
    'public."ParkingSession"'
  ) IS NOT NULL,
  to_regclass(
    'public."Invoice"'
  ) IS NOT NULL;
`,
  );

  if (requiredTables.length === 0) {
    return;
  }

  const [
    parkingSessionExists,
    invoiceExists,
  ] = requiredTables[0].split('\t');

  if (
    !parseBoolean(parkingSessionExists) ||
    !parseBoolean(invoiceExists)
  ) {
    return;
  }

  const lines = runPsql(
    connection,
    `
WITH expected_primary AS (
  SELECT
    s.id,
    s."primaryInvoiceId" AS actual_invoice_id,
    (
      SELECT i.id
      FROM "Invoice" i
      WHERE i."sessionId" = s.id
        AND COALESCE(
          i.metadata ->> 'invoiceKind',
          'PARKING_FEE'
        ) <> 'ADDITIONAL_FEE'
      ORDER BY
        i."createdAt" ASC,
        i.id ASC
      LIMIT 1
    ) AS expected_invoice_id
  FROM "ParkingSession" s
),
primary_state AS (
  SELECT
    count(*) FILTER (
      WHERE expected_invoice_id IS NOT NULL
        AND actual_invoice_id IS NULL
    ) AS missing_count,
    count(*) FILTER (
      WHERE expected_invoice_id IS NOT NULL
        AND actual_invoice_id
          IS DISTINCT FROM expected_invoice_id
    ) AS mismatch_count,
    count(*) FILTER (
      WHERE actual_invoice_id IS NOT NULL
        AND expected_invoice_id IS NULL
    ) AS unexpected_count
  FROM expected_primary
),
reference_state AS (
  SELECT
    count(*) AS invalid_reference_count
  FROM "ParkingSession" s
  LEFT JOIN "Invoice" i
    ON i.id = s."primaryInvoiceId"
  WHERE s."primaryInvoiceId" IS NOT NULL
    AND i.id IS NULL
),
session_state AS (
  SELECT
    count(*) AS session_mismatch_count
  FROM "ParkingSession" s
  JOIN "Invoice" i
    ON i.id = s."primaryInvoiceId"
  WHERE i."sessionId" IS DISTINCT FROM s.id
)
SELECT
  p.missing_count,
  p.mismatch_count,
  p.unexpected_count,
  r.invalid_reference_count,
  s.session_mismatch_count
FROM primary_state p
CROSS JOIN reference_state r
CROSS JOIN session_state s;
`,
  );

  if (lines.length === 0) {
    fail(
      'PRIMARY_INVOICE_VALIDATION_NO_RESULT',
    );
    return;
  }

  const [
    missingValue,
    mismatchValue,
    unexpectedValue,
    invalidReferenceValue,
    sessionMismatchValue,
  ] = lines[0].split('\t');

  const missingCount =
    Number.parseInt(missingValue, 10) || 0;

  const mismatchCount =
    Number.parseInt(mismatchValue, 10) || 0;

  const unexpectedCount =
    Number.parseInt(unexpectedValue, 10) || 0;

  const invalidReferenceCount =
    Number.parseInt(
      invalidReferenceValue,
      10,
    ) || 0;

  const sessionMismatchCount =
    Number.parseInt(
      sessionMismatchValue,
      10,
    ) || 0;

  console.log(
    `PRIMARY_INVOICE_MISSING_COUNT=${missingCount}`,
  );
  console.log(
    `PRIMARY_INVOICE_MISMATCH_COUNT=${mismatchCount}`,
  );
  console.log(
    `PRIMARY_INVOICE_UNEXPECTED_COUNT=${unexpectedCount}`,
  );
  console.log(
    `PRIMARY_INVOICE_INVALID_REFERENCE_COUNT=` +
    invalidReferenceCount,
  );
  console.log(
    `PRIMARY_INVOICE_SESSION_MISMATCH_COUNT=` +
    sessionMismatchCount,
  );

  if (missingCount > 0) {
    fail(
      `PRIMARY_INVOICE_MISSING:${missingCount}`,
    );
  }

  if (mismatchCount > 0) {
    fail(
      `PRIMARY_INVOICE_MISMATCH:${mismatchCount}`,
    );
  }

  if (unexpectedCount > 0) {
    fail(
      `PRIMARY_INVOICE_UNEXPECTED:` +
      unexpectedCount,
    );
  }

  if (invalidReferenceCount > 0) {
    fail(
      `PRIMARY_INVOICE_INVALID_REFERENCE:` +
      invalidReferenceCount,
    );
  }

  if (sessionMismatchCount > 0) {
    fail(
      `PRIMARY_INVOICE_SESSION_MISMATCH:` +
      sessionMismatchCount,
    );
  }
}

function main() {
  if (!profile) {
    console.error(
      'Usage: profile-db-validate.cjs <profile>',
    );
    return 2;
  }

  try {
    assertProfile(profile);
  } catch (error) {
    console.error(`ERROR=${error.message}`);
    return 2;
  }

  const apiEnvFile = resolveEnvFile(
    profile,
    'api',
  );

  if (!fs.existsSync(apiEnvFile)) {
    console.error(
      `ERROR=API_ENV_MISSING:${apiEnvFile}`,
    );
    return 1;
  }

  const parsedEnv = parseEnvFile(apiEnvFile);

  if (parsedEnv.duplicates.length > 0) {
    fail(
      `API_ENV_DUPLICATE_KEYS:` +
      parsedEnv.duplicates.join(','),
    );
  }

  const databaseUrl =
    parsedEnv.values.DATABASE_URL?.trim();

  if (!databaseUrl) {
    fail('API_ENV_MISSING_KEY:DATABASE_URL');
  }

  if (errors.length > 0) {
    console.log(
      `PROFILE_DB_VALIDATE_FAILED=${profile}`,
    );
    return 1;
  }

  let connection;

  try {
    connection = parseDatabaseUrl(databaseUrl);
  } catch (error) {
    fail(error.message);
    console.log(
      `PROFILE_DB_VALIDATE_FAILED=${profile}`,
    );
    return 1;
  }

  const expectedDatabase =
    getDatabaseName(profile);

  console.log(`PROFILE=${profile}`);
  console.log(
    `API_ENV=${path.relative(ROOT_DIR, apiEnvFile)}`,
  );
  console.log(
    `EXPECTED_DATABASE=${expectedDatabase}`,
  );
  console.log(
    `URL_DATABASE=${connection.database}`,
  );
  console.log(
    `DATABASE_HOST=${connection.host}`,
  );
  console.log(
    `DATABASE_PORT=${connection.port}`,
  );

  if (
    expectedDatabase &&
    connection.database !== expectedDatabase
  ) {
    fail(
      `DATABASE_URL_NAME_MISMATCH:` +
      `${connection.database}!=${expectedDatabase}`,
    );
  }

  try {
    const currentDatabase = runScalar(
      connection,
      'SELECT current_database();',
    );

    console.log(
      `CURRENT_DATABASE=${currentDatabase}`,
    );

    if (
      expectedDatabase &&
      currentDatabase !== expectedDatabase
    ) {
      fail(
        `CONNECTED_DATABASE_NAME_MISMATCH:` +
        `${currentDatabase}!=${expectedDatabase}`,
      );
    }

    checkMigrations(connection);
    checkLocalMigrationHistory(connection);
    checkCriticalObjects(connection);
    checkTenantCoveredAmount(connection);
    checkPrimaryInvoiceConsistency(connection);
  } catch (error) {
    fail(
      `DATABASE_QUERY_FAILED:${error.message}`,
    );
  }

  console.log(
    `WARNING_COUNT=${warnings.length}`,
  );
  console.log(
    `ERROR_COUNT=${errors.length}`,
  );

  if (errors.length > 0) {
    console.log(
      `PROFILE_DB_VALIDATE_FAILED=${profile}`,
    );
    return 1;
  }

  console.log(
    `PROFILE_DB_VALIDATE_OK=${profile}`,
  );

  return 0;
}

process.exitCode = main();
