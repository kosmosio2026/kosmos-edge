export type AppProfile =
  | 'cloud'
  | 'edge'
  | 'edge-standalone'
  | 'demo'
  | 'development';

export type AppMode = 'cloud' | 'edge';

const APP_PROFILES: readonly AppProfile[] = [
  'cloud',
  'edge',
  'edge-standalone',
  'demo',
  'development',
];

function normalizeAppProfile(
  raw: string | undefined | null,
): AppProfile | null {
  const value = raw?.trim().toLowerCase();

  if (!value) {
    return null;
  }

  if ((APP_PROFILES as readonly string[]).includes(value)) {
    return value as AppProfile;
  }

  // Backward compatibility for the previous local profile name.
  if (value === 'parking') {
    return 'development';
  }

  return null;
}

export function getAppProfile(): AppProfile {
  return (
    normalizeAppProfile(process.env.APP_PROFILE) ??
    normalizeAppProfile(process.env.APP_MODE) ??
    'cloud'
  );
}

/**
 * Backward-compatible cloud/edge mode.
 *
 * Both connected Edge and standalone Edge are local Edge runtimes.
 * Existing guards and services using AppMode can therefore continue
 * treating edge-standalone as edge.
 */
export function getAppMode(): AppMode {
  const profile = getAppProfile();

  if (
    profile === 'edge' ||
    profile === 'edge-standalone'
  ) {
    return 'edge';
  }

  return 'cloud';
}

export function isCloudProfile(): boolean {
  return getAppProfile() === 'cloud';
}

/**
 * Connected Edge profile with Cloud synchronization.
 */
export function isConnectedEdgeProfile(): boolean {
  return getAppProfile() === 'edge';
}

/**
 * Standalone Edge profile without Cloud synchronization.
 */
export function isEdgeStandaloneProfile(): boolean {
  return getAppProfile() === 'edge-standalone';
}

/**
 * Any runtime operating locally as an Edge system.
 */
export function isEdgeRuntimeProfile(): boolean {
  return (
    isConnectedEdgeProfile() ||
    isEdgeStandaloneProfile()
  );
}

/**
 * Backward-compatible alias.
 *
 * This keeps the previous exact meaning of APP_PROFILE=edge.
 * New code should use isConnectedEdgeProfile() or
 * isEdgeRuntimeProfile() to make its intent explicit.
 */
export function isEdgeProfile(): boolean {
  return isConnectedEdgeProfile();
}

export function isDemoProfile(): boolean {
  return getAppProfile() === 'demo';
}

export function isDevelopmentProfile(): boolean {
  return getAppProfile() === 'development';
}

export function isCloudMode(): boolean {
  return getAppMode() === 'cloud';
}

export function isEdgeMode(): boolean {
  return getAppMode() === 'edge';
}

export function assertAppProfile(
  expected: AppProfile,
): void {
  const actual = getAppProfile();

  if (actual !== expected) {
    throw new Error(
      `Invalid APP_PROFILE. Expected ${expected}, got ${actual}`,
    );
  }
}

export function assertAppMode(
  expected: AppMode,
): void {
  const actual = getAppMode();

  if (actual !== expected) {
    throw new Error(
      `Invalid APP_MODE/APP_PROFILE. Expected ${expected}, got ${actual}`,
    );
  }
}
