export type NormalizedRealtimeEvent = {
  type: 'parking.entry' | 'parking.exit' | 'device.fault' | 'unknown';
  parkingSpaceId?: string;
  parkingSpaceCode?: string;
  lotId?: string;
  sectionId?: string;
  deviceCode?: string;
  message: string;
  raw: unknown;
};

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return undefined;
}

function nested(obj: any, path: string[]) {
  let current = obj;
  for (const key of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[key];
  }
  return current;
}

export function normalizeRealtimeEvent(
  eventName: string,
  payload: any,
): NormalizedRealtimeEvent {
  const parkingSpaceId = firstString(
    payload?.parkingSpaceId,
    payload?.spaceId,
    nested(payload, ['parkingSpace', 'id']),
    nested(payload, ['space', 'id']),
  );

  const parkingSpaceCode = firstString(
    payload?.parkingSpaceCode,
    payload?.spaceCode,
    payload?.code,
    nested(payload, ['parkingSpace', 'code']),
    nested(payload, ['space', 'code']),
  );

  const lotId = firstString(
    payload?.lotId,
    nested(payload, ['parkingLot', 'id']),
    nested(payload, ['lot', 'id']),
  );

  const sectionId = firstString(
    payload?.sectionId,
    nested(payload, ['parkingSection', 'id']),
    nested(payload, ['section', 'id']),
  );

  const deviceCode = firstString(
    payload?.deviceCode,
    payload?.sensorCode,
    nested(payload, ['device', 'code']),
    nested(payload, ['sensorDevice', 'code']),
  );

  switch (eventName) {
    case 'parking.entry':
      return {
        type: 'parking.entry',
        parkingSpaceId,
        parkingSpaceCode,
        lotId,
        sectionId,
        message: `입차 이벤트${parkingSpaceCode ? ` · ${parkingSpaceCode}` : ''}`,
        raw: payload,
      };

    case 'parking.exit':
      return {
        type: 'parking.exit',
        parkingSpaceId,
        parkingSpaceCode,
        lotId,
        sectionId,
        message: `출차 이벤트${parkingSpaceCode ? ` · ${parkingSpaceCode}` : ''}`,
        raw: payload,
      };

    case 'device.fault':
      return {
        type: 'device.fault',
        parkingSpaceId,
        parkingSpaceCode,
        lotId,
        sectionId,
        deviceCode,
        message: `장애 이벤트${deviceCode ? ` · ${deviceCode}` : ''}`,
        raw: payload,
      };

    default:
      return {
        type: 'unknown',
        parkingSpaceId,
        parkingSpaceCode,
        lotId,
        sectionId,
        deviceCode,
        message: `알 수 없는 이벤트: ${eventName}`,
        raw: payload,
      };
  }
}