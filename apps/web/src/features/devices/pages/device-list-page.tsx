'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type DeviceType =
  | 'PARKING_SENSOR'
  | 'IO_CONTROLLER'
  | 'DISPLAY_BOARD'
  | 'SMART_TRACKER'
  | 'SENSIO_CONTROLLER';

type DeviceRow = {
  id: string | number;
  name?: string | null;
  type: DeviceType | string;
  serialNumber?: string | null;
  serial?: string | null;
  devEui?: string | null;
  macAddress?: string | null;
  ipAddress?: string | null;
  installLocation?: string | null;
  dev_eui?: string | null;
  status?: string | number | null;
  battery?: string | number | null;
  batteryStatus?: string | number | null;
  battery_status?: string | number | null;
  lastSeen?: string | null;
  last_seen?: string | null;
  latestSensorData?: {
    device_status?: number | null;
    battery_status?: number | null;
    battery_voltage?: number | null;
    time?: string | null;
  } | null;
};

type ValidationResult = {
  ok: boolean;
  summary?: Record<string, number>;
  errors?: Array<{ row: number; field: string; message: string }>;
  warnings?: Array<{ row: number; field: string; message: string }>;
};

const DEVICE_TYPES: DeviceType[] = [
  'PARKING_SENSOR',
  'IO_CONTROLLER',
  'DISPLAY_BOARD',
  'SMART_TRACKER',
  'SENSIO_CONTROLLER',
];

const DEVICE_STATUSES = ['ACTIVE', 'OFFLINE', 'FAULT', 'MAINTENANCE'];

const DEVICE_TYPE_LABELS: Record<string, string> = {
  PARKING_SENSOR: '주차감지센서',
  IO_CONTROLLER: '센서 입출력 컨트롤러',
  SENSOR_CONTROLLER: '센서 입출력 컨트롤러',
  SENSIO_CONTROLLER: '센서 입출력 컨트롤러',
  DISPLAY_BOARD: '전광판',
  LED_DISPLAY: '전광판',
  SMART_TRACKER: '스마트 트래커',
  LORA_GATEWAY: 'LoRa 게이트웨이',
  GATEWAY: '게이트웨이',
  BARRIER: '차단기',
  CAMERA: '카메라',
  PAYMENT_KIOSK: '무인정산기',
  KIOSK: '키오스크',
  ENV_SENSOR: '환경센서',
  UNKNOWN: '미확인',
};

const DEVICE_STATUS_LABELS: Record<string, string> = {
  ACTIVE: '활성',
  INACTIVE: '비활성',
  ONLINE: '온라인',
  OFFLINE: '오프라인',
  FAULT: '장애',
  ERROR: '오류',
  WARNING: '주의',
  MAINTENANCE: '점검',
  UNKNOWN: '미확인',
};

function getDeviceTypeLabel(value?: string | null) {
  if (!value) return '-';
  return DEVICE_TYPE_LABELS[value] ?? value;
}

function getDeviceStatusLabel(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return '-';

  if (typeof value === 'number') {
    if (value === 0) return '정상';
    if (value === 1) return '주의';
    if (value === 2) return '장애';
    return String(value);
  }

  const normalized = String(value).trim().toUpperCase();
  return DEVICE_STATUS_LABELS[normalized] ?? String(value);
}

function getSerial(device: DeviceRow) {
  return device.serialNumber ?? device.serial ?? '-';
}

function getDeviceNameWithSerial(device: DeviceRow) {
  const name = device.name?.trim() || '-';
  const serial = getSerial(device);

  return serial && serial !== '-' ? `${name}(${serial})` : name;
}

function formatStatus(device: DeviceRow) {
  const raw = device.latestSensorData?.device_status ?? device.status ?? null;

  return getDeviceStatusLabel(raw);
}

function formatLastSeen(device: DeviceRow) {
  const raw =
    device.latestSensorData?.time ??
    device.lastSeen ??
    device.last_seen ??
    null;

  if (!raw) return '-';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
  });
}

function buildQuery(params: Record<string, string>) {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }

  return query.toString();
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}


function getDeviceLastSeenAt(device: any) {
  return (
    device?.lastSeenAt ??
    device?.latestTelemetry?.last_message_time ??
    device?.latestTelemetry?.time ??
    device?.latestTelemetry?.created_at ??
    null
  );
}

function formatDeviceLastSeenAt(value: unknown) {
  if (!value) return '-';

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
  });
}

function normalizeDevEuiInput(value: string) {
  return value.replace(/[\s:-]/g, '').toUpperCase().slice(0, 16);
}

function compactMacAddress(value: string) {
  return value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().slice(0, 12);
}

function formatMacAddressInput(value: string) {
  const compact = compactMacAddress(value);
  return compact.match(/.{1,2}/g)?.join('-') ?? '';
}

function normalizeIpAddressInput(value: string) {
  return value.replace(/[^0-9.]/g, '').replace(/\.{2,}/g, '.').slice(0, 15);
}

function normalizeIpAddressForSubmit(value: string) {
  const raw = value.trim().replace(/\s+/g, '');

  if (!raw) return '';

  const parts = raw.split('.');

  if (parts.length !== 4) return null;

  const normalized = parts.map((part) => {
    if (!/^\d+$/.test(part)) return null;

    const parsed = Number(part);

    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 255) return null;

    return String(parsed);
  });

  if (normalized.some((part) => part == null)) return null;

  return normalized.join('.');
}

function formatMacAddressForDisplay(value: string | null | undefined) {
  if (!value) return '-';

  const compact = compactMacAddress(value);

  if (compact.length !== 12) return value.toUpperCase();

  return compact.match(/.{1,2}/g)?.join('-') ?? compact;
}

function formatDevEuiForDisplay(value: string | null | undefined) {
  if (!value) return '-';

  return normalizeDevEuiInput(value);
}

export default function DeviceListPage() {
  const { session, isReady } = useAuth();

  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);

  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [name, setName] = useState('');
  const [type, setType] = useState<DeviceType>('PARKING_SENSOR');
  const [serialNumber, setSerialNumber] = useState('');
  const [devEui, setDevEui] = useState('');
  const [macAddress, setMacAddress] = useState('');
  const [ipAddress, setIpAddress] = useState('');
  const [installLocation, setInstallLocation] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const accessToken = session?.accessToken;

  async function loadDevices() {
    if (!accessToken) {
      setLoading(false);
      setError('로그인 세션이 없습니다. 다시 로그인해 주세요.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const query = buildQuery({
        type: typeFilter,
        status: statusFilter,
      });

      const result = await apiFetch(query ? `/devices?${query}` : '/devices', {
        accessToken,
      });

      const rows = Array.isArray(result)
        ? result
        : result?.data ?? result?.items ?? result?.devices ?? [];

      setDevices(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : '장치 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!isReady) return;
    void loadDevices();
  }, [isReady, accessToken, typeFilter, statusFilter]);

  const canSubmit = useMemo(() => {
    return Boolean(
      name.trim() &&
        type &&
        serialNumber.trim() &&
        (type !== 'PARKING_SENSOR' || devEui.trim()),
    );
  }, [name, type, serialNumber, devEui]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canSubmit || !accessToken) {
      setError('필수값을 입력하거나 다시 로그인해 주세요.');
      return;
    }

    const normalizedDevEui = normalizeDevEuiInput(devEui);
    const normalizedMacAddress = compactMacAddress(macAddress);
    const normalizedIpAddress = normalizeIpAddressForSubmit(ipAddress);

    if (type === 'PARKING_SENSOR' && normalizedDevEui.length !== 16) {
      setError('PARKING_SENSOR의 DevEUI는 16자리 HEX 값으로 입력하세요.');
      return;
    }

    if (macAddress.trim() && normalizedMacAddress.length !== 12) {
      setError('MAC 주소는 12자리 HEX 값으로 입력하세요.');
      return;
    }

    if (normalizedIpAddress === null) {
      setError('IP 주소는 올바른 IPv4 형식으로 입력하세요.');
      return;
    }

    setSaving(true);
    setError('');

    try {
      await apiFetch('/devices', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({
          name: name.trim(),
          type,
          serialNumber: serialNumber.trim(),
          devEui: normalizedDevEui || null,
          macAddress: normalizedMacAddress || null,
          ipAddress: normalizedIpAddress || null,
          installLocation: installLocation.trim() || null,
        }),
      });

      setModalOpen(false);
      setName('');
      setType('PARKING_SENSOR');
      setSerialNumber('');
      setDevEui('');
      setMacAddress('');
      setIpAddress('');
      setInstallLocation('');
      await loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : '장치 추가에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteDevice(device: DeviceRow) {
    if (!accessToken) return;
    if (!confirm(`${device.name ?? getSerial(device)} 장치를 삭제하시겠습니까?`)) return;

    await apiFetch(`/devices/sensors/${device.id}`, {
      method: 'DELETE',
      accessToken,
    });

    await loadDevices();
  }

  async function downloadTemplate() {
    const XLSX = await import('xlsx');

    const rows = [
      {
        deviceName: 'A-001 표면설치형 센서',
        deviceType: 'PARKING_SENSOR',
        serialNumber: 'PS-000001',
        devEui: 'AC1F09FFFE000001',
        macAddress: '',
        ipAddress: '',
        installLocation: 'A구역 A-001',
        parkingLotCode: 'LOT-DEV-001',
        sectionCode: 'A',
        spaceCode: 'A-001',
        firmwareVersion: '1.0.0',
        status: 'ACTIVE',
        memo: '샘플 행입니다. 실제 등록 전 삭제하거나 수정하세요.',
      },
      {
        deviceName: 'A구역 입구 컨트롤러',
        deviceType: 'IO_CONTROLLER',
        serialNumber: 'IO-000001',
        devEui: '',
        macAddress: 'AA-BB-CC-DD-EE-01',
        ipAddress: '192.168.0.10',
        installLocation: 'A구역 입구',
        parkingLotCode: 'LOT-DEV-001',
        sectionCode: 'A',
        spaceCode: '',
        firmwareVersion: '1.0.0',
        status: 'ACTIVE',
        memo: '',
      },
    ];

    const wb = XLSX.utils.book_new();
    const inputSheet = XLSX.utils.json_to_sheet(rows);
    const codeSheet = XLSX.utils.aoa_to_sheet([
      ['deviceType', ...DEVICE_TYPES],
      ['status', ...DEVICE_STATUSES],
    ]);
    const ruleSheet = XLSX.utils.aoa_to_sheet([
      ['항목', '설명'],
      ['deviceName', '필수'],
      ['deviceType', `필수, ${DEVICE_TYPES.join(', ')} 중 선택`],
      ['serialNumber', '필수, DB 내 고유'],
      ['devEui', 'PARKING_SENSOR는 필수, DB 내 고유'],
      ['status', `기본 ACTIVE, ${DEVICE_STATUSES.join(', ')} 중 선택`],
    ]);

    XLSX.utils.book_append_sheet(wb, inputSheet, '장치_입력');
    XLSX.utils.book_append_sheet(wb, ruleSheet, '검증규칙');
    XLSX.utils.book_append_sheet(wb, codeSheet, '코드값');

    const buffer = XLSX.write(wb, {
      type: 'array',
      bookType: 'xlsx',
    });

    downloadBlob(
      'kosmos_device_bulk_import_template.xlsx',
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
    );
  }

  async function validateExcelFile(file: File) {
    if (!accessToken) return;

    setValidating(true);
    setValidation(null);
    setError('');

    try {
      const XLSX = await import('xlsx');
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = wb.Sheets['장치_입력'] ?? wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      });

      const result = await apiFetch('/devices/validate-import', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ rows }),
      });

      setValidation(result as ValidationResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Excel 검증에 실패했습니다.');
    } finally {
      setValidating(false);
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">장치</h1>
          <p className="mt-1 text-sm text-slate-500">
            센서/장치 목록, 등록, 수정, 삭제, Excel 검증을 관리합니다.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setExcelOpen(true)}
            className="rounded-2xl border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Excel 등록
          </button>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            장치 추가
          </button>
        </div>
      </div>

      <section className="rounded-3xl border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">장치 유형</span>
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {DEVICE_TYPES.map((item) => (
                <option key={item} value={item}>
                  {getDeviceTypeLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium text-slate-500">상태</span>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              {DEVICE_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {getDeviceStatusLabel(item)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {error ? (
        <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-slate-500">불러오는 중...</div> : null}

      <div className="overflow-x-auto rounded-3xl border bg-white">
        <table className="w-full min-w-[980px] text-left text-xs">
          <thead className="bg-slate-50 text-left text-xs text-slate-600">
            <tr>
              <th className="whitespace-nowrap px-3 py-2">번호</th>
              <th className="whitespace-nowrap px-3 py-2">장치명(일련번호)</th>
              <th className="whitespace-nowrap px-3 py-2">장치 유형</th>
              <th className="whitespace-nowrap px-3 py-2">DevEUI</th>
              <th className="whitespace-nowrap px-3 py-2">설치 위치</th>
              <th className="whitespace-nowrap px-3 py-2">상태</th>
              <th className="whitespace-nowrap px-3 py-2">최근 수신</th>
              <th className="whitespace-nowrap px-3 py-2 text-right">관리</th>
            </tr>
          </thead>

          <tbody>
            {devices.length === 0 ? (
              <tr>
                <td className="whitespace-nowrap px-3 py-6 text-center text-slate-500" colSpan={8}>
                  등록된 장치가 없습니다.
                </td>
              </tr>
            ) : (
              devices.map((device, index) => (
                <tr key={device.id} className="border-t">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-500">{index + 1}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelectedDevice(device)}
                      className="font-medium text-slate-900 underline-offset-2 hover:underline"
                    >
                      {getDeviceNameWithSerial(device)}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {getDeviceTypeLabel(device.type)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono">
                    {formatDevEuiForDisplay(device.devEui ?? device.dev_eui)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">{device.installLocation ?? '-'}</td>
                  <td className="whitespace-nowrap px-3 py-2">{formatStatus(device)}</td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {formatDeviceLastSeenAt(getDeviceLastSeenAt(device))}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        className="rounded-xl border px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteDevice(device)}
                        className="rounded-xl border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {excelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">장치 Excel 등록</h2>
                <p className="mt-1 text-sm text-slate-500">
                  샘플 Excel을 내려받아 작성한 뒤 업로드하면 필수값, enum, 중복 여부를 검증합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExcelOpen(false)}
                className="rounded-xl border px-3 py-1 text-sm hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void downloadTemplate()}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                샘플 Excel 다운로드
              </button>

              <label className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Excel 업로드 검증
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void validateExcelFile(file);
                    event.currentTarget.value = '';
                  }}
                />
              </label>
            </div>

            {validating ? (
              <p className="mt-4 text-sm text-slate-500">검증 중...</p>
            ) : null}

            {validation ? (
              <div className="mt-5 space-y-4">
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    validation.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {validation.ok
                    ? '검증을 통과했습니다. 다음 단계에서 실제 등록 기능을 연결할 수 있습니다.'
                    : '검증 오류가 있습니다. 오류 목록을 확인해 주세요.'}
                </div>

                <pre className="overflow-auto rounded-2xl bg-slate-50 p-4 text-xs">
                  {JSON.stringify(validation.summary ?? {}, null, 2)}
                </pre>

                {(validation.errors ?? []).length > 0 ? (
                  <div>
                    <h3 className="mb-2 font-semibold text-red-700">오류</h3>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-3 py-2">행</th>
                          <th className="px-3 py-2">필드</th>
                          <th className="px-3 py-2">내용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(validation.errors ?? []).map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2">{item.row || '-'}</td>
                            <td className="px-3 py-2">{item.field}</td>
                            <td className="px-3 py-2">{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {(validation.warnings ?? []).length > 0 ? (
                  <div>
                    <h3 className="mb-2 font-semibold text-amber-700">경고</h3>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="px-3 py-2">행</th>
                          <th className="px-3 py-2">필드</th>
                          <th className="px-3 py-2">내용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(validation.warnings ?? []).map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2">{item.row || '-'}</td>
                            <td className="px-3 py-2">{item.field}</td>
                            <td className="px-3 py-2">{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selectedDevice ? (
        <DeviceDetailModal
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      ) : null}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  장치 추가
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  장치명, 장치 유형, 일련번호, DevEUI를 입력하고 필요 시 MAC 주소, IP 주소, 설치 위치를 함께 등록합니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-xl px-2 py-1 text-slate-500 hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form className="space-y-4" onSubmit={onSubmit}>
              <div>
                <label className="mb-2 block text-sm font-medium">장치명</label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Sensor-A1"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">장치 유형</label>
                <select
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={type}
                  onChange={(e) => setType(e.target.value as DeviceType)}
                >
                  {DEVICE_TYPES.map((item) => (
                    <option key={item} value={item}>
                      {getDeviceTypeLabel(item)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">일련번호</label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  placeholder="SN-000001"
                  required
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">
                  DevEUI {type === 'PARKING_SENSOR' ? '(필수)' : '(선택)'}
                </label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm uppercase outline-none"
                  value={devEui}
                  onChange={(e) => setDevEui(normalizeDevEuiInput(e.target.value))}
                  placeholder="AC1F09FFFE000001"
                  required={type === 'PARKING_SENSOR'}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">MAC 주소</label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={macAddress}
                  onChange={(e) => setMacAddress(formatMacAddressInput(e.target.value))}
                  placeholder="AA-BB-CC-DD-EE-FF"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">IP 주소</label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(normalizeIpAddressInput(e.target.value))}
                  placeholder="192.168.0.10"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium">설치 위치</label>
                <input
                  className="w-full rounded-2xl border px-4 py-3 text-sm outline-none"
                  value={installLocation}
                  onChange={(e) => setInstallLocation(e.target.value)}
                  placeholder="예: A구역 입구, B-01 주차면"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-2xl border px-4 py-2 text-sm font-medium"
                >
                  취소
                </button>

                <button
                  type="submit"
                  disabled={!canSubmit || saving}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DeviceDetailModal({
  device,
  onClose,
}: {
  device: DeviceRow;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900">장치 상세정보</h2>
            <p className="mt-1 text-sm text-slate-500">
              {getDeviceNameWithSerial(device)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <dl className="mt-5 grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 rounded-2xl border bg-slate-50 p-4 text-sm">
          <DetailRow label="장치명" value={device.name ?? '-'} />
          <DetailRow label="일련번호" value={getSerial(device)} />
          <DetailRow label="장치 유형" value={getDeviceTypeLabel(device.type)} />
          <DetailRow
            label="DevEUI"
            value={formatDevEuiForDisplay(device.devEui ?? device.dev_eui)}
          />
          <DetailRow
            label="MAC 주소"
            value={formatMacAddressForDisplay(device.macAddress)}
            mono
          />
          <DetailRow label="IP 주소" value={device.ipAddress ?? '-'} mono />
          <DetailRow label="설치 위치" value={device.installLocation ?? '-'} />
          <DetailRow label="상태" value={formatStatus(device)} />
          <DetailRow
            label="최근 수신"
            value={formatDeviceLastSeenAt(getDeviceLastSeenAt(device))}
          />
        </dl>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <>
      <dt className="text-slate-500">{label}</dt>
      <dd className={mono ? 'font-mono text-slate-900' : 'text-slate-900'}>
        {value}
      </dd>
    </>
  );
}
