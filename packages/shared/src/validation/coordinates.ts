export type Coordinate = {
  lat: number;
  lng: number;
};

export function toFiniteNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

export function isValidLatitude(value: unknown) {
  const numberValue = toFiniteNumber(value);
  return numberValue !== null && numberValue >= -90 && numberValue <= 90;
}

export function isValidLongitude(value: unknown) {
  const numberValue = toFiniteNumber(value);
  return numberValue !== null && numberValue >= -180 && numberValue <= 180;
}

export function normalizeCoordinate(input: {
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}) {
  const lat = toFiniteNumber(input.lat ?? input.latitude);
  const lng = toFiniteNumber(input.lng ?? input.longitude);

  if (lat === null || lng === null) return null;
  if (!isValidLatitude(lat) || !isValidLongitude(lng)) return null;

  return {
    lat,
    lng,
  };
}

export function validateCoordinate(input: {
  lat?: unknown;
  lng?: unknown;
  latitude?: unknown;
  longitude?: unknown;
}) {
  const coordinate = normalizeCoordinate(input);

  if (!coordinate) {
    return {
      ok: false as const,
      coordinate,
      message: "올바른 좌표 정보가 아닙니다.",
    };
  }

  return {
    ok: true as const,
    coordinate,
  };
}
