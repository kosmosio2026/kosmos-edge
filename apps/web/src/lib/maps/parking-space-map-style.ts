export type ParkingSpaceMapStyleInput = {
  status?: string | null;
  state?: string | null;
  type?: string | null;
  selected?: boolean;
  isRegisterable?: boolean;
};

export function isRestrictedParkingSpaceType(type?: string | null) {
  return Boolean(
    type &&
      !['REGULAR', 'COMPACT'].includes(String(type).toUpperCase()),
  );
}

export function getParkingSpaceMapStatus(input: ParkingSpaceMapStyleInput) {
  const status = String(input.status ?? input.state ?? '').toUpperCase();
  const type = String(input.type ?? '').toUpperCase();

  if (input.selected) return 'SELECTED';

  if (
    input.isRegisterable ||
    status === 'OCCUPIED_UNREGISTERED' ||
    status === 'UNREGISTERED_OVERDUE'
  ) {
    if (isRestrictedParkingSpaceType(type)) return 'RESTRICTED';
    return 'REGISTERABLE';
  }

  if (status === 'EMPTY' || status === 'VACANT') return 'EMPTY';

  if (
    status === 'OCCUPIED_REGISTERED' ||
    status === 'REGISTERED' ||
    status === 'OCCUPIED'
  ) {
    return 'REGISTERED';
  }

  if (status === 'SENSOR_ERROR' || status === 'ERROR') return 'ERROR';

  if (status === 'DISABLED' || status === 'INACTIVE') return 'DISABLED';

  if (isRestrictedParkingSpaceType(type)) return 'RESTRICTED';

  return 'UNKNOWN';
}

export function getParkingSpacePolygonStyle(input: ParkingSpaceMapStyleInput) {
  const status = getParkingSpaceMapStatus(input);

  switch (status) {
    case 'SELECTED':
      return {
        fillColor: '#10b981',
        fillOpacity: 0.42,
        strokeColor: '#047857',
        strokeOpacity: 1,
        strokeWeight: 4,
      };

    case 'REGISTERABLE':
      return {
        fillColor: '#22c55e',
        fillOpacity: 0.36,
        strokeColor: '#15803d',
        strokeOpacity: 0.95,
        strokeWeight: 3,
      };

    case 'REGISTERED':
      return {
        fillColor: '#3b82f6',
        fillOpacity: 0.32,
        strokeColor: '#1d4ed8',
        strokeOpacity: 0.9,
        strokeWeight: 2,
      };

    case 'EMPTY':
      return {
        fillColor: '#cbd5e1',
        fillOpacity: 0.22,
        strokeColor: '#64748b',
        strokeOpacity: 0.75,
        strokeWeight: 2,
      };

    case 'RESTRICTED':
      return {
        fillColor: '#f59e0b',
        fillOpacity: 0.34,
        strokeColor: '#b45309',
        strokeOpacity: 0.9,
        strokeWeight: 2,
      };

    case 'ERROR':
      return {
        fillColor: '#ef4444',
        fillOpacity: 0.36,
        strokeColor: '#b91c1c',
        strokeOpacity: 0.95,
        strokeWeight: 3,
      };

    case 'DISABLED':
      return {
        fillColor: '#64748b',
        fillOpacity: 0.22,
        strokeColor: '#334155',
        strokeOpacity: 0.65,
        strokeWeight: 2,
      };

    default:
      return {
        fillColor: '#94a3b8',
        fillOpacity: 0.22,
        strokeColor: '#475569',
        strokeOpacity: 0.7,
        strokeWeight: 2,
      };
  }
}

export function getParkingSpaceMapLabel(input: {
  code?: string | null;
  number?: string | null;
  status?: string | null;
  state?: string | null;
}) {
  const code = input.code ?? input.number ?? '-';
  const status = String(input.status ?? input.state ?? '').toUpperCase();

  if (status === 'OCCUPIED_UNREGISTERED' || status === 'UNREGISTERED_OVERDUE') {
    return `${code}\n등록 가능`;
  }

  if (status === 'EMPTY' || status === 'VACANT') {
    return `${code}\n빈면`;
  }

  if (
    status === 'OCCUPIED_REGISTERED' ||
    status === 'REGISTERED' ||
    status === 'OCCUPIED'
  ) {
    return `${code}\n등록 완료`;
  }

  if (status === 'SENSOR_ERROR' || status === 'ERROR') {
    return `${code}\n센서 오류`;
  }

  return code;
}
