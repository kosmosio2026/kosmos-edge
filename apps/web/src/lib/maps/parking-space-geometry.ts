export type ParkingSpaceGeometryInput = {
  lat?: number | null;
  lng?: number | null;
  widthMeter?: number | null;
  heightMeter?: number | null;
  rotationDeg?: number | null;
};

export type LatLngLiteral = {
  lat: number;
  lng: number;
};

const EARTH_METER_PER_DEGREE_LAT = 111_320;

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

function meterToLatDelta(meter: number) {
  return meter / EARTH_METER_PER_DEGREE_LAT;
}

function meterToLngDelta(meter: number, lat: number) {
  const cosLat = Math.max(Math.cos(toRad(lat)), 0.000001);
  return meter / (EARTH_METER_PER_DEGREE_LAT * cosLat);
}

export function getParkingSpacePolygonPath(
  input: ParkingSpaceGeometryInput,
): LatLngLiteral[] {
  const lat = Number(input.lat);
  const lng = Number(input.lng);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return [];
  }

  const width = Number(input.widthMeter ?? 2.5);
  const height = Number(input.heightMeter ?? 5);
  const rotation = toRad(Number(input.rotationDeg ?? 0));

  const halfWidth = width / 2;
  const halfHeight = height / 2;

  const corners = [
    { x: -halfWidth, y: -halfHeight },
    { x: halfWidth, y: -halfHeight },
    { x: halfWidth, y: halfHeight },
    { x: -halfWidth, y: halfHeight },
  ];

  return corners.map((corner) => {
    const rotatedX =
      corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation);
    const rotatedY =
      corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation);

    return {
      lat: lat + meterToLatDelta(rotatedY),
      lng: lng + meterToLngDelta(rotatedX, lat),
    };
  });
}

export function hasParkingSpaceGeometry(input: ParkingSpaceGeometryInput) {
  return (
    typeof input.lat === 'number' &&
    typeof input.lng === 'number' &&
    Number.isFinite(input.lat) &&
    Number.isFinite(input.lng)
  );
}

export function getParkingSpaceBounds(spaces: ParkingSpaceGeometryInput[]) {
  const points = spaces.flatMap((space) => getParkingSpacePolygonPath(space));

  if (points.length === 0) return null;

  return {
    minLat: Math.min(...points.map((point) => point.lat)),
    maxLat: Math.max(...points.map((point) => point.lat)),
    minLng: Math.min(...points.map((point) => point.lng)),
    maxLng: Math.max(...points.map((point) => point.lng)),
  };
}
