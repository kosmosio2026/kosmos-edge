#!/usr/bin/env node

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  ROOT_DIR,
  assertProfile,
  assertTarget,
  resolveEnvFile,
  getAppMode,
  getWebDistDir,
  parseEnvFile,
} = require('./profile-config.cjs');

function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = process.argv.slice(2);
const profile = args.shift();
const target = args.shift();

if (!profile || !target) {
  fail(
    'Usage: profile-env.sh <profile> <api|web> ' +
      '[--cwd <path>] -- <command> [arguments...]',
  );
}

try {
  assertProfile(profile);
  assertTarget(target);
} catch (error) {
  fail(error.message);
}

let cwd = ROOT_DIR;

while (args.length > 0 && args[0] !== '--') {
  const option = args.shift();

  if (option === '--cwd') {
    const cwdValue = args.shift();

    if (!cwdValue) {
      fail('--cwd requires a path');
    }

    cwd = path.isAbsolute(cwdValue)
      ? cwdValue
      : path.resolve(ROOT_DIR, cwdValue);

    continue;
  }

  fail(`Unknown option: ${option}`);
}

if (args[0] !== '--') {
  fail('Missing -- before command');
}

args.shift();

const command = args.shift();

if (!command) {
  fail('Command is required');
}

const envFile = resolveEnvFile(profile, target);

if (!require('node:fs').existsSync(envFile)) {
  fail(`Environment file not found: ${envFile}`);
}

const {
  values: fileValues,
} = parseEnvFile(envFile);

/*
 * Start with the process environment so system values such as PATH,
 * HOME and the pnpm executable location remain available.
 *
 * Profile-sensitive variables are removed before loading the selected
 * environment file. This prevents values exported for another profile
 * from leaking into the child process.
 */
const env = {
  ...process.env,
};

/*
 * Ambient PORT/API_PORT values must not leak between profiles.
 * Only start-profile.sh may explicitly override the selected
 * profile port through KOSMOS_PROFILE_PORT_OVERRIDE.
 */
const portOverride =
  process.env.KOSMOS_PROFILE_PORT_OVERRIDE;


const apiManagedKeys = [
  'NODE_ENV',
  'PORT',
  'API_PORT',
  'KOSMOS_PROFILE_PORT_OVERRIDE',
  'APP_PROFILE',
  'APP_MODE',
  'PAYMENT_AUTHORITY',
  'DATABASE_URL',
  'JWT_SECRET',
  'EDGE_SYNC_WORKER_ENABLED',
  'EDGE_CLOUD_PUSH_WORKER_ENABLED',
  'CLOUD_API_BASE_URL',
  'PUBLIC_CLOUD_API_BASE_URL',
  'EDGE_NODE_ID',
  'EDGE_API_KEY',
  'DEV_EDGE_API_KEY',
  'SYNC_EDGE_API_KEY',
];

const webManagedKeys = [
  'NODE_ENV',
  'PORT',
  'KOSMOS_PROFILE_PORT_OVERRIDE',
  'NEXT_PUBLIC_APP_PROFILE',
  'NEXT_DIST_DIR',
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_APP_URL',
  'API_BASE_URL',
];

const managedKeys =
  target === 'api'
    ? apiManagedKeys
    : webManagedKeys;

for (const key of managedKeys) {
  delete env[key];
}

Object.assign(env, fileValues);

if (target === 'api') {
  env.APP_PROFILE = profile;
  env.APP_MODE = getAppMode(profile);

  /*
   * Runtime port override is accepted only from
   * start-profile.sh.
   */
  if (portOverride !== undefined) {
    env.PORT = portOverride;
    env.API_PORT = portOverride;
  }

  if (profile !== 'edge') {
    env.EDGE_SYNC_WORKER_ENABLED = 'false';
    env.EDGE_CLOUD_PUSH_WORKER_ENABLED = 'false';
  }

  if (profile === 'edge-standalone') {
    for (const key of [
      'CLOUD_API_BASE_URL',
      'PUBLIC_CLOUD_API_BASE_URL',
      'EDGE_NODE_ID',
      'EDGE_API_KEY',
      'DEV_EDGE_API_KEY',
      'SYNC_EDGE_API_KEY',
    ]) {
      delete env[key];
    }
  }
} else {
  env.NEXT_PUBLIC_APP_PROFILE = profile;
  env.NEXT_DIST_DIR =
    fileValues.NEXT_DIST_DIR ||
    getWebDistDir(profile);

  if (portOverride !== undefined) {
    env.PORT = portOverride;
  }
}

const result = spawnSync(
  command,
  args,
  {
    cwd,
    env,
    stdio: 'inherit',
    shell: false,
  },
);

if (result.error) {
  fail(result.error.message);
}

process.exit(result.status ?? 1);
