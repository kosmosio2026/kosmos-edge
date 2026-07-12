const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

function resolvePath(template: string, params?: Record<string, string>) {
  let path = template;
  for (const [key, value] of Object.entries(params ?? {})) {
    path = path.replaceAll(`{${key}}`, value);
  }
  return path;
}

export async function tryCandidateRequest<T = unknown>(params: {
  accessToken: string;
  candidates: readonly string[];
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  pathParams?: Record<string, string>;
  query?: Record<string, string | undefined>;
  body?: unknown;
}): Promise<T> {
  const errors: string[] = [];

  for (const template of params.candidates) {
    const resolved = resolvePath(template, params.pathParams);

    const url = new URL(`${API_BASE_URL}${resolved}`);
    Object.entries(params.query ?? {}).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    try {
      const response = await fetch(url.toString(), {
        method: params.method ?? 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.accessToken}`,
        },
        body:
          params.method && params.method !== 'GET' && params.body !== undefined
            ? JSON.stringify(params.body)
            : undefined,
        cache: 'no-store',
      });

      if (response.ok) {
        if (response.status === 204) return {} as T;
        return response.json();
      }

      const text = await response.text();
      errors.push(`${resolved} (${response.status}) ${text}`);
    } catch (error) {
      errors.push(
        `${resolved} ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  throw new Error(
    `No backend endpoint matched. Tried: ${errors.join(' | ')}`,
  );
}