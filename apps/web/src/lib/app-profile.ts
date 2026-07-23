export type AppProfile =
  | 'cloud'
  | 'edge'
  | 'edge-standalone'
  | 'demo'
  | 'development';

export function getWebAppProfile(): AppProfile {
  const raw =
    process.env.NEXT_PUBLIC_APP_PROFILE
      ?.trim()
      .toLowerCase();

  if (
    raw === 'cloud' ||
    raw === 'edge' ||
    raw === 'edge-standalone' ||
    raw === 'demo' ||
    raw === 'development'
  ) {
    return raw;
  }

  return 'cloud';
}

export function isCloudWeb(): boolean {
  return getWebAppProfile() === 'cloud';
}

export function isConnectedEdgeWeb(): boolean {
  return getWebAppProfile() === 'edge';
}

export function isEdgeStandaloneWeb(): boolean {
  return getWebAppProfile() === 'edge-standalone';
}

export function isEdgeRuntimeWeb(): boolean {
  return (
    isConnectedEdgeWeb() ||
    isEdgeStandaloneWeb()
  );
}

/**
 * Backward-compatible Edge UI helper.
 *
 * Existing callers use this to select the local manager-style UI,
 * which applies to both connected and standalone Edge deployments.
 */
export function isEdgeWeb(): boolean {
  return isEdgeRuntimeWeb();
}
