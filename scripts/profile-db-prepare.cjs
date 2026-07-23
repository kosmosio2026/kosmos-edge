#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
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

const args = process.argv.slice(2);
const profile = args.shift();
const apply = args.includes('--apply');

function fail(message, exitCode = 1) {
  console.error(`ERROR=${message}`);
  process.exit(exitCode);
}

function runCommand({
  label,
  command,
  commandArgs,
  cwd = ROOT_DIR,
  env = process.env,
  allowFailure = false,
  logFile = null,
}) {
  console.log('');
  console.log(`===== ${label} =====`);

  const result = spawnSync(
    command,
    commandArgs,
    {
      cwd,
      env,
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024,
    },
  );

  if (result.error) {
    fail(
      `${label}:${result.error.message}`,
    );
  }

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const output = `${stdout}${stderr}`;

  if (stdout) {
    process.stdout.write(stdout);
  }

  if (stderr) {
    process.stderr.write(stderr);
  }

  if (logFile) {
    fs.writeFileSync(
      logFile,
      output,
      'utf8',
    );
  }

  const status = result.status ?? 1;

  console.log(`${label}_RC=${status}`);

  if (status !== 0 && !allowFailure) {
    fail(`${label}_FAILED:${status}`);
  }

  return {
    status,
    stdout,
    stderr,
    output,
  };
}

function parseDatabaseUrl(rawValue) {
  let parsed;

  try {
    parsed = new URL(rawValue);
  } catch {
    fail('DATABASE_URL_INVALID');
  }

  if (
    parsed.protocol !== 'postgresql:' &&
    parsed.protocol !== 'postgres:'
  ) {
    fail(
      `DATABASE_URL_PROTOCOL_UNSUPPORTED:` +
      parsed.protocol,
    );
  }

  const database = decodeURIComponent(
    parsed.pathname
      .replace(/^\/+/, '')
      .split('/')[0] ?? '',
  );

  const username = decodeURIComponent(
    parsed.username,
  );

  if (!database) {
    fail('DATABASE_URL_DATABASE_MISSING');
  }

  if (!username) {
    fail('DATABASE_URL_USERNAME_MISSING');
  }

  return {
    host: parsed.hostname || '127.0.0.1',
    port: parsed.port || '5432',
    username,
    password: decodeURIComponent(
      parsed.password,
    ),
    database,
    sslmode:
      parsed.searchParams.get('sslmode') || '',
  };
}

function createTimestamp() {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '')
    .replace('T', '-');
}

function getGitCommit() {
  const result = spawnSync(
    'git',
    [
      'rev-parse',
      '--verify',
      'HEAD',
    ],
    {
      cwd: ROOT_DIR,
      encoding: 'utf8',
    },
  );

  if (result.status !== 0) {
    return 'UNKNOWN';
  }

  return result.stdout.trim() || 'UNKNOWN';
}

if (!profile) {
  fail(
    'Usage: pnpm profile:db:prepare ' +
    '<profile> [--apply]',
    2,
  );
}

if (args.some((arg) => arg !== '--apply')) {
  fail(
    `UNKNOWN_ARGUMENTS=${args.join(',')}`,
    2,
  );
}

try {
  assertProfile(profile);
} catch (error) {
  fail(error.message, 2);
}

const apiEnvFile = resolveEnvFile(
  profile,
  'api',
);

if (!fs.existsSync(apiEnvFile)) {
  fail(`API_ENV_MISSING=${apiEnvFile}`);
}

const parsedEnv = parseEnvFile(apiEnvFile);

if (parsedEnv.duplicates.length > 0) {
  fail(
    `API_ENV_DUPLICATE_KEYS=` +
    parsedEnv.duplicates.join(','),
  );
}

const databaseUrl =
  parsedEnv.values.DATABASE_URL?.trim();

if (!databaseUrl) {
  fail('DATABASE_URL_MISSING');
}

const connection = parseDatabaseUrl(
  databaseUrl,
);

const expectedDatabase =
  getDatabaseName(profile);

if (
  expectedDatabase &&
  connection.database !== expectedDatabase
) {
  fail(
    `DATABASE_NAME_MISMATCH:` +
    `${connection.database}!=${expectedDatabase}`,
  );
}

console.log(`PROFILE=${profile}`);
console.log(`MODE=${apply ? 'APPLY' : 'DRY_RUN'}`);
console.log(
  `API_ENV=${path.relative(ROOT_DIR, apiEnvFile)}`,
);
console.log(
  `EXPECTED_DATABASE=${expectedDatabase}`,
);
console.log(
  `DATABASE_HOST=${connection.host}`,
);
console.log(
  `DATABASE_PORT=${connection.port}`,
);
console.log(
  `DATABASE_NAME=${connection.database}`,
);

runCommand({
  label: 'PROFILE_VALIDATE',
  command: 'pnpm',
  commandArgs: [
    'profile:validate',
    profile,
  ],
});

runCommand({
  label: 'PROFILE_DB_VALIDATE_PRE',
  command: 'pnpm',
  commandArgs: [
    'profile:db:validate',
    profile,
  ],
});

const migrationStatus = runCommand({
  label: 'PRISMA_MIGRATE_STATUS_PRE',
  command: 'pnpm',
  commandArgs: [
    'profile:env',
    profile,
    'api',
    '--cwd',
    'packages/db',
    '--',
    'pnpm',
    'exec',
    'prisma',
    'migrate',
    'status',
    '--schema=./prisma/schema.prisma',
  ],
  allowFailure: true,
});

const migrationStatusNeedsReview =
  migrationStatus.status !== 0;

if (!apply) {
  console.log('');
  console.log(
    `MIGRATE_STATUS_PRE_RC=${migrationStatus.status}`,
  );

  if (migrationStatusNeedsReview) {
    console.log(
      `PROFILE_DB_PREPARE_REVIEW_REQUIRED=${profile}`,
    );
    console.log(
      'APPLY_BLOCKED_REASON=' +
      'PRISMA_MIGRATION_STATUS_NOT_CLEAN',
    );
  } else {
    console.log(
      `PROFILE_DB_PREPARE_DRY_RUN_OK=${profile}`,
    );
    console.log(
      `NEXT_COMMAND=pnpm profile:db:prepare ` +
      `${profile} --apply`,
    );
  }

  process.exit(0);
}

if (migrationStatusNeedsReview) {
  fail(
    'MIGRATION_STATUS_REVIEW_REQUIRED:' +
    `${profile}`,
  );
}

const timestamp = createTimestamp();

const backupRoot =
  process.env.KOSMOS_DB_BACKUP_ROOT ||
  path.join(
    os.homedir(),
    'kosmos-edge_backup',
    'db',
  );

const reportDir = path.join(
  backupRoot,
  profile,
  timestamp,
);

fs.mkdirSync(
  reportDir,
  {
    recursive: true,
    mode: 0o700,
  },
);

const backupFile = path.join(
  reportDir,
  `${connection.database}-${timestamp}.dump`,
);

const backupEnv = {
  ...process.env,
  PGAPPNAME:
    `kosmos-profile-db-prepare-${profile}`,
};

if (connection.password) {
  backupEnv.PGPASSWORD =
    connection.password;
} else {
  delete backupEnv.PGPASSWORD;
}

if (connection.sslmode) {
  backupEnv.PGSSLMODE =
    connection.sslmode;
}

runCommand({
  label: 'PG_DUMP',
  command: 'pg_dump',
  commandArgs: [
    '--host',
    connection.host,
    '--port',
    connection.port,
    '--username',
    connection.username,
    '--dbname',
    connection.database,
    '--format=custom',
    '--compress=6',
    '--no-owner',
    '--no-privileges',
    '--file',
    backupFile,
  ],
  env: backupEnv,
  logFile: path.join(
    reportDir,
    'pg-dump.log',
  ),
});

const backupStat = fs.statSync(backupFile);

if (backupStat.size <= 0) {
  fail('DATABASE_BACKUP_EMPTY');
}

const checksum = runCommand({
  label: 'BACKUP_SHA256',
  command: 'sha256sum',
  commandArgs: [
    backupFile,
  ],
  logFile: path.join(
    reportDir,
    'backup.sha256',
  ),
});

runCommand({
  label: 'PRISMA_MIGRATE_DEPLOY',
  command: 'pnpm',
  commandArgs: [
    'profile:env',
    profile,
    'api',
    '--cwd',
    'packages/db',
    '--',
    'pnpm',
    'exec',
    'prisma',
    'migrate',
    'deploy',
    '--schema=./prisma/schema.prisma',
  ],
  logFile: path.join(
    reportDir,
    'prisma-migrate-deploy.log',
  ),
});

runCommand({
  label: 'PRISMA_MIGRATE_STATUS_POST',
  command: 'pnpm',
  commandArgs: [
    'profile:env',
    profile,
    'api',
    '--cwd',
    'packages/db',
    '--',
    'pnpm',
    'exec',
    'prisma',
    'migrate',
    'status',
    '--schema=./prisma/schema.prisma',
  ],
  logFile: path.join(
    reportDir,
    'prisma-migrate-status-post.log',
  ),
});

const postValidation = runCommand({
  label: 'PROFILE_DB_VALIDATE_POST',
  command: 'pnpm',
  commandArgs: [
    'profile:db:validate',
    profile,
  ],
  logFile: path.join(
    reportDir,
    'profile-db-validate-post.log',
  ),
});

const metadata = {
  profile,
  preparedAt: new Date().toISOString(),
  gitCommit: getGitCommit(),
  expectedDatabase,
  database: {
    host: connection.host,
    port: connection.port,
    name: connection.database,
    username: connection.username,
  },
  backup: {
    file: backupFile,
    sizeBytes: backupStat.size,
    sha256:
      checksum.stdout.trim().split(/\s+/)[0] ?? '',
  },
  migrationStatusPreRc:
    migrationStatus.status,
  postValidationRc:
    postValidation.status,
};

fs.writeFileSync(
  path.join(
    reportDir,
    'prepare-metadata.json',
  ),
  JSON.stringify(
    metadata,
    null,
    2,
  ) + '\n',
  {
    encoding: 'utf8',
    mode: 0o600,
  },
);

console.log('');
console.log(`BACKUP_FILE=${backupFile}`);
console.log(`BACKUP_SIZE_BYTES=${backupStat.size}`);
console.log(`REPORT_DIR=${reportDir}`);
console.log(`PROFILE_DB_PREPARE_OK=${profile}`);
