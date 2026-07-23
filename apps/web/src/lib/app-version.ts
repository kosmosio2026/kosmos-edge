function normalizeAppVersion(
  value: string | undefined | null,
): string {
  const normalized = value
    ?.trim()
    .replace(/^v/i, '');

  return normalized || '0.0.0';
}

export const APP_VERSION =
  normalizeAppVersion(
    process.env.NEXT_PUBLIC_APP_VERSION,
  );

export const APP_VERSION_LABEL =
  `v${APP_VERSION}`;
