#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(
  cd "$(dirname "${BASH_SOURCE[0]}")/.."
  pwd
)"

PROFILE="${1:-}"

if [ -z "$PROFILE" ]; then
  echo "Usage: $0 <profile>" >&2
  exit 1
fi

# Validate the deployment manifest and the selected API/Web
# environment files before running the existing domain-specific checks.
#
# Profiles without a manifest keep the legacy validation path until their
# manifests are added.
MANIFEST_FILE="$ROOT_DIR/deploy/profiles/$PROFILE/manifest.env"

if [ -f "$MANIFEST_FILE" ]; then
  python3 \
    "$ROOT_DIR/deploy/scripts/profile-validate.py" \
    "$PROFILE"
fi

node - "$PROFILE" "$ROOT_DIR" <<'NODE'
const fs = require('node:fs');
const path = require('node:path');

const profile = process.argv[2];
const rootDirectory = process.argv[3];

const {
  assertProfile,
  resolveEnvFile,
  getAppMode,
  getWebDistDir,
  parseEnvFile,
} = require(
  path.join(
    rootDirectory,
    'scripts/profile-config.cjs',
  ),
);

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exitCode = 1;
}

function requireKeys(
  label,
  values,
  requiredKeys,
) {
  for (const key of requiredKeys) {
    if (!values[key]?.trim()) {
      fail(`${label}: missing ${key}`);
    }
  }
}

try {
  assertProfile(profile);
} catch (error) {
  fail(error.message);
  process.exit(1);
}

const apiEnvFile = resolveEnvFile(
  profile,
  'api',
);

const webEnvFile = resolveEnvFile(
  profile,
  'web',
);

for (const [label, envFile] of [
  ['API', apiEnvFile],
  ['WEB', webEnvFile],
]) {
  if (!fs.existsSync(envFile)) {
    fail(`${label}: environment file not found: ${envFile}`);
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

const api = parseEnvFile(apiEnvFile);
const web = parseEnvFile(webEnvFile);

if (api.duplicates.length > 0) {
  fail(
    `API: duplicate keys: ${api.duplicates.join(', ')}`,
  );
}

if (web.duplicates.length > 0) {
  fail(
    `WEB: duplicate keys: ${web.duplicates.join(', ')}`,
  );
}

requireKeys(
  'API',
  api.values,
  [
    'JWT_SECRET',
    'DATABASE_URL',
  ],
);

requireKeys(
  'WEB',
  web.values,
  [
    'NEXT_PUBLIC_API_BASE_URL',
    'API_BASE_URL',
  ],
);

if (
  api.values.APP_PROFILE &&
  api.values.APP_PROFILE !== profile
) {
  fail(
    `API: APP_PROFILE=${api.values.APP_PROFILE}, ` +
      `expected ${profile}`,
  );
}

const expectedMode = getAppMode(profile);

if (
  api.values.APP_MODE &&
  api.values.APP_MODE !== expectedMode
) {
  fail(
    `API: APP_MODE=${api.values.APP_MODE}, ` +
      `expected ${expectedMode}`,
  );
}

if (
  web.values.NEXT_PUBLIC_APP_PROFILE &&
  web.values.NEXT_PUBLIC_APP_PROFILE !== profile
) {
  fail(
    'WEB: NEXT_PUBLIC_APP_PROFILE=' +
      `${web.values.NEXT_PUBLIC_APP_PROFILE}, ` +
      `expected ${profile}`,
  );
}

const expectedDistDir =
  getWebDistDir(profile);

if (
  web.values.NEXT_DIST_DIR &&
  web.values.NEXT_DIST_DIR !== expectedDistDir
) {
  fail(
    `WEB: NEXT_DIST_DIR=${web.values.NEXT_DIST_DIR}, ` +
      `expected ${expectedDistDir}`,
  );
}

if (profile === 'edge-standalone') {
  const forbiddenKeys = [
    'CLOUD_API_BASE_URL',
    'PUBLIC_CLOUD_API_BASE_URL',
    'EDGE_NODE_ID',
    'EDGE_API_KEY',
    'DEV_EDGE_API_KEY',
    'SYNC_EDGE_API_KEY',
  ];

  for (const key of forbiddenKeys) {
    if (api.values[key]?.trim()) {
      fail(
        `API: ${key} must not be configured ` +
          'for edge-standalone',
      );
    }
  }

  for (const key of [
    'EDGE_SYNC_WORKER_ENABLED',
    'EDGE_CLOUD_PUSH_WORKER_ENABLED',
  ]) {
    if (
      api.values[key]?.trim().toLowerCase() !==
      'false'
    ) {
      fail(
        `API: ${key} must be false ` +
          'for edge-standalone',
      );
    }
  }
}

if (profile === 'edge') {
  requireKeys(
    'API',
    api.values,
    [
      'CLOUD_API_BASE_URL',
      'EDGE_NODE_ID',
    ],
  );

  const hasApiKey = [
    'EDGE_API_KEY',
    'DEV_EDGE_API_KEY',
    'SYNC_EDGE_API_KEY',
  ].some(
    (key) => Boolean(api.values[key]?.trim()),
  );

  if (!hasApiKey) {
    fail(
      'API: connected Edge requires an Edge API key',
    );
  }
}

if (profile === 'cloud') {
  for (const key of [
    'EDGE_SYNC_WORKER_ENABLED',
    'EDGE_CLOUD_PUSH_WORKER_ENABLED',
  ]) {
    if (
      api.values[key] &&
      api.values[key].trim().toLowerCase() !==
      'false'
    ) {
      fail(
        `API: ${key} must be false for cloud`,
      );
    }
  }
}

const versionFile = path.join(
  rootDirectory,
  'VERSION',
);

if (!fs.existsSync(versionFile)) {
  fail('VERSION file is missing');
} else {
  const version = fs
    .readFileSync(versionFile, 'utf8')
    .trim()
    .replace(/^v/i, '');

  if (!version) {
    fail('VERSION file is empty');
  }
}

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('PROFILE_VALIDATION=OK');
console.log(`PROFILE=${profile}`);
console.log(`APP_MODE=${expectedMode}`);
console.log(
  `API_ENV=${path.relative(rootDirectory, apiEnvFile)}`,
);
console.log(
  `WEB_ENV=${path.relative(rootDirectory, webEnvFile)}`,
);
console.log(`WEB_DIST_DIR=${expectedDistDir}`);
NODE
