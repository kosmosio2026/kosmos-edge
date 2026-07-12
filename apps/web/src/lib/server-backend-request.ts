const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000/api';

export async function tryBackendCandidates<T = unknown>(params: {
  accessToken: string;
  candidates: readonly string[];
  body: Record<string, unknown>;
}): Promise<T> {
  const errors: Array<{ path: string; status?: number; body?: string }> = [];

  for (const path of params.candidates) {
    try {
      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.accessToken}`,
        },
        body: JSON.stringify(params.body),
        cache: 'no-store',
      });

      if (response.ok) {
        return response.json();
      }

      const text = await response.text();
      errors.push({
        path,
        status: response.status,
        body: text,
      });
    } catch (error) {
      errors.push({
        path,
        body: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  throw new Error(
    `No backend quick-action endpoint matched. Tried: ${errors
      .map((e) => `${e.path}${e.status ? ` (${e.status})` : ''}`)
      .join(', ')}`,
  );
}