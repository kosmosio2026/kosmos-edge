const fs = require('node:fs');
const path = require('node:path');

function normalizeAppVersion(value) {
  const normalized = value
    ?.trim()
    .replace(/^v/i, '');

  return normalized || null;
}

function readAppVersion() {
  const environmentVersion =
    normalizeAppVersion(
      process.env.APP_VERSION ??
        process.env.RELEASE_VERSION ??
        process.env.NEXT_PUBLIC_APP_VERSION,
    );

  if (environmentVersion) {
    return environmentVersion;
  }

  const versionFile = path.resolve(
    __dirname,
    '../../VERSION',
  );

  if (fs.existsSync(versionFile)) {
    const fileVersion = normalizeAppVersion(
      fs.readFileSync(versionFile, 'utf8'),
    );

    if (fileVersion) {
      return fileVersion;
    }
  }

  return '0.0.0';
}

const appVersion = readAppVersion();

const apiBaseUrl = (
  process.env.API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  'http://127.0.0.1:3000/api'
).trim().replace(/\/+$/, '');

const apiOrigin = apiBaseUrl.replace(/\/api$/, '');

/** @type {import('next').NextConfig} */
const nextConfig = {
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,

  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },

  allowedDevOrigins: [
    'http://112.171.47.68:4000',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
  ],

  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${apiOrigin}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
