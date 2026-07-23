const fs = require('node:fs');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

const SUPPORTED_PROFILES = [
  'cloud',
  'edge',
  'edge-standalone',
  'demo',
  'development',
];

function assertProfile(profile) {
  if (!SUPPORTED_PROFILES.includes(profile)) {
    throw new Error(
      `Unsupported profile: ${profile}\n` +
        `Supported profiles: ${SUPPORTED_PROFILES.join(', ')}`,
    );
  }
}

function assertTarget(target) {
  if (target !== 'api' && target !== 'web') {
    throw new Error(
      `Unsupported target: ${target}\n` +
        'Supported targets: api, web',
    );
  }
}

function getTargetDirectory(target) {
  assertTarget(target);

  return path.join(
    ROOT_DIR,
    target === 'api' ? 'apps/api' : 'apps/web',
  );
}

function resolveEnvFile(profile, target) {
  assertProfile(profile);
  assertTarget(target);

  return path.join(
    getTargetDirectory(target),
    `.env.${profile}`,
  );
}

function getAppMode(profile) {
  assertProfile(profile);

  return profile === 'edge' ||
    profile === 'edge-standalone'
    ? 'edge'
    : 'cloud';
}

const FALLBACK_PROFILE_CONFIG = {
  cloud: {
    API_PORT: '3000',
    WEB_PORT: '4000',
    DATABASE_NAME: 'parking_cloud',
    API_DIST_DIR: 'dist-cloud',
    WEB_DIST_DIR: '.next-cloud',
  },
  edge: {
    API_PORT: '3001',
    WEB_PORT: '4001',
    DATABASE_NAME: 'parking_edge',
    API_DIST_DIR: 'dist-edge',
    WEB_DIST_DIR: '.next-edge',
  },
  'edge-standalone': {
    API_PORT: '3002',
    WEB_PORT: '4002',
    DATABASE_NAME: 'parking_edge_standalone',
    API_DIST_DIR: 'dist-edge-standalone',
    WEB_DIST_DIR: '.next-edge-standalone',
  },
  demo: {
    API_PORT: '3003',
    WEB_PORT: '4003',
    DATABASE_NAME: 'parking_demo',
    API_DIST_DIR: 'dist-demo',
    WEB_DIST_DIR: '.next-demo',
  },
  development: {
    API_PORT: '3004',
    WEB_PORT: '4004',
    DATABASE_NAME: 'parking_development',
    API_DIST_DIR: 'dist-development',
    WEB_DIST_DIR: '.next-development',
  },
};

function resolveManifestFile(profile) {
  assertProfile(profile);

  return path.join(
    ROOT_DIR,
    'deploy',
    'profiles',
    profile,
    'manifest.env',
  );
}

function getProfileManifest(profile) {
  assertProfile(profile);

  const manifestFile = resolveManifestFile(profile);

  if (!fs.existsSync(manifestFile)) {
    return null;
  }

  const parsed = parseEnvFile(manifestFile);

  if (parsed.duplicates.length > 0) {
    throw new Error(
      `Duplicate deployment manifest keys for ${profile}: ` +
        parsed.duplicates.join(', '),
    );
  }

  if (
    parsed.values.APP_PROFILE &&
    parsed.values.APP_PROFILE !== profile
  ) {
    throw new Error(
      `Deployment manifest profile mismatch: ` +
        `${parsed.values.APP_PROFILE} != ${profile}`,
    );
  }

  return {
    file: manifestFile,
    values: parsed.values,
  };
}

function getProfileValue(profile, key) {
  assertProfile(profile);

  const manifest = getProfileManifest(profile);
  const manifestValue = manifest?.values[key]?.trim();

  if (manifestValue) {
    return manifestValue;
  }

  return FALLBACK_PROFILE_CONFIG[profile]?.[key] ?? '';
}

function getProfilePort(profile, key) {
  const rawValue = getProfileValue(profile, key);
  const port = Number.parseInt(rawValue, 10);

  if (
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error(
      `Invalid ${key} for profile ${profile}: ${rawValue}`,
    );
  }

  return port;
}

function getApiPort(profile) {
  return getProfilePort(profile, 'API_PORT');
}

function getWebPort(profile) {
  return getProfilePort(profile, 'WEB_PORT');
}

function getWebDistDir(profile) {
  return getProfileValue(profile, 'WEB_DIST_DIR');
}

function getApiDistDir(profile) {
  return getProfileValue(profile, 'API_DIST_DIR');
}

function getDatabaseName(profile) {
  return getProfileValue(profile, 'DATABASE_NAME');
}


function parseEnvFile(envFile) {
  const values = {};
  const counts = new Map();

  const content = fs.readFileSync(envFile, 'utf8');

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (
      !line ||
      line.startsWith('#') ||
      !line.includes('=')
    ) {
      continue;
    }

    const match = line.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/,
    );

    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    counts.set(key, (counts.get(key) ?? 0) + 1);

    if (
      value.length >= 2 &&
      value.startsWith("'") &&
      value.endsWith("'")
    ) {
      value = value.slice(1, -1);
    } else if (
      value.length >= 2 &&
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value
        .slice(1, -1)
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    } else {
      // Remove comments only when separated by whitespace.
      value = value.replace(/\s+#.*$/, '').trim();
    }

    // Match standard dotenv behavior: the final value wins.
    values[key] = value;
  }

  const duplicates = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key]) => key);

  return {
    values,
    duplicates,
  };
}

module.exports = {
  ROOT_DIR,
  SUPPORTED_PROFILES,
  assertProfile,
  assertTarget,
  getTargetDirectory,
  resolveEnvFile,
  resolveManifestFile,
  getProfileManifest,
  getProfileValue,
  getAppMode,
  getApiPort,
  getWebPort,
  getWebDistDir,
  getApiDistDir,
  getDatabaseName,
  parseEnvFile,
};
