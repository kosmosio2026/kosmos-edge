export type ZoneSummaryV1State = {
  overall: {
    available: number;
    total: number;
  };
  zones: Array<{
    code: string;
    available: number;
    total: number;
  }>;
  message?: string | null;
};

export type ModbusRegisterWrite = {
  address: number;
  value: number;
};

const MESSAGE_CODE_MAP: Record<string, number> = {
  NONE: 0,
  WELCOME: 1,
  FULL: 2,
  EXIT_LEFT: 3,
  MANUAL_OVERRIDE: 4,
};

export function buildZoneSummaryV1Registers(
  state: ZoneSummaryV1State,
  maxZones = 4,
): ModbusRegisterWrite[] {
  const writes: ModbusRegisterWrite[] = [
    { address: 100, value: clampU16(state.overall.available) },
    { address: 101, value: clampU16(state.overall.total) },
  ];

  for (let i = 0; i < maxZones; i += 1) {
    const zone = state.zones[i];
    const base = 110 + i * 2;

    writes.push({
      address: base,
      value: clampU16(zone?.available ?? 0),
    });
    writes.push({
      address: base + 1,
      value: clampU16(zone?.total ?? 0),
    });
  }

  const messageCode = MESSAGE_CODE_MAP[state.message ?? 'NONE'] ?? 0;
  writes.push({ address: 120, value: messageCode });

  return writes;
}

export function zoneSummaryV1Shape(input: Record<string, unknown>) {
  const overall = (input.overall ?? {}) as Record<string, unknown>;
  const zones = Array.isArray(input.zones) ? input.zones : [];

  return {
    overall: {
      available: Number(overall.available ?? 0),
      total: Number(overall.total ?? 0),
    },
    zones: zones.map((zone) => {
      const z = zone as Record<string, unknown>;
      return {
        code: String(z.code ?? ''),
        available: Number(z.available ?? 0),
        total: Number(z.total ?? 0),
      };
    }),
    message: input.message ? String(input.message) : null,
  } satisfies ZoneSummaryV1State;
}

function clampU16(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(65535, Math.round(value)));
}