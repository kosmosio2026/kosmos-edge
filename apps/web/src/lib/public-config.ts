function trimTrailingSlashes(value: string) {
  return value.trim().replace(/\/+$/, '');
}

export function getPublicApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

  if (configured) {
    return trimTrailingSlashes(configured);
  }

  if (typeof window !== 'undefined') {
    return `${trimTrailingSlashes(window.location.origin)}/api`;
  }

  return '/api';
}
