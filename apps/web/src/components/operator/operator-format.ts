export function operatorSpaceTypeLabel(value?: string | null) {
  const key = String(value ?? '').toUpperCase();

  const labels: Record<string, string> = {
    REGULAR: '일반',
    NORMAL: '일반',
    DISABLED: '장애인',
    COMPACT: '경차',
    EV: '전기차',
    VIP: 'VIP',
    LOADING: '하역',
  };

  return labels[key] ?? value ?? '-';
}

export function operatorParkingStatusLabel(value?: string | null) {
  const key = String(value ?? '').toUpperCase();

  const labels: Record<string, string> = {
    EMPTY: '빈면',
    AVAILABLE: '빈면',
    OCCUPIED: '입차',
    ACTIVE: '주차 중',
    REGISTERED: '등록 완료',
    UNREGISTERED: '미등록',
    OCCUPIED_REGISTERED: '주차 등록',
    OCCUPIED_UNREGISTERED: '미등록 입차',
    EXITED: '출차',
    EXITED_UNPAID: '미납 출차',
    PAID: '결제 완료',
    UNPAID: '미납',
    PARTIALLY_PAID: '부분 납부',
    SENSOR_FAULT: '센서 오류',
    FAULT: '장애',
    MAINTENANCE: '점검',
    UNKNOWN: '알 수 없음',
  };

  return labels[key] ?? value ?? '-';
}
