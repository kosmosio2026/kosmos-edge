export function parseKoreanRegion(address?: string | null) {
  const parts = String(address ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);

  return {
    sido: parts[0] ?? null,
    sigungu: parts[1] ?? null,
  };
}
