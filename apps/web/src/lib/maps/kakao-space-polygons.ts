import {
  getParkingSpacePolygonPath,
  type ParkingSpaceGeometryInput,
} from './parking-space-geometry';

type KakaoMap = any;
type KakaoPolygon = any;

export type KakaoSpacePolygonInput = ParkingSpaceGeometryInput & {
  id: string;
  status?: string | null;
  type?: string | null;
  fillColor?: string;
  strokeColor?: string;
};

export function createKakaoSpacePolygon(
  kakao: any,
  map: KakaoMap,
  space: KakaoSpacePolygonInput,
): KakaoPolygon | null {
  const path = getParkingSpacePolygonPath(space);

  if (path.length === 0) return null;

  const polygon = new kakao.maps.Polygon({
    map,
    path: path.map((point) => new kakao.maps.LatLng(point.lat, point.lng)),
    strokeWeight: 2,
    strokeColor: space.strokeColor ?? '#047857',
    strokeOpacity: 0.95,
    fillColor: space.fillColor ?? '#34d399',
    fillOpacity: 0.55,
    zIndex: 10,
  });

  return polygon;
}

export function clearKakaoPolygons(polygons: KakaoPolygon[]) {
  polygons.forEach((polygon) => polygon.setMap(null));
}
