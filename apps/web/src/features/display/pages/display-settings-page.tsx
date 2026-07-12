'use client';

import { useEffect, useState } from 'react';

type Role = 'admin' | 'manager';

type DisplayBoard = {
  id: string;
  parkingLotId: string;
  name: string;
  code?: string | null;
  enabled: boolean;
  transport: 'TCP' | 'RS232' | 'RS485';
  tcpHost?: string | null;
  tcpPort?: number | null;
  serialPort?: string | null;
  baudRate?: number | null;
  dataBits?: number | null;
  parity?: string | null;
  stopBits?: number | null;
  connectTimeoutMs?: number | null;
  readTimeoutMs?: number | null;
  rows: number;
  cols: number;
  moduleType?: number | null;
  rgbOrder?: number | null;
  brightness?: number | null;
  powerOn?: boolean | null;
  heartbeatIntervalSec?: number | null;
  retryMaxAttempts?: number | null;
  retryBackoffMs?: number | null;
  lastStatus?: string | null;
  lastError?: string | null;
  lastResponseHex?: string | null;
  lastSentAt?: string | null;
  lastAckAt?: string | null;
  parkingLot?: {
    id: string;
    name: string;
    code?: string | null;
  };
  modules?: Array<{
    id: string;
    rowNo: number;
    colNo: number;
    parkingSectionId?: string | null;
    label?: string | null;
    enabled: boolean;
    charWidth: number;
    padChar: string;
    parkingSection?: {
      id: string;
      name: string;
      code?: string | null;
    } | null;
  }>;
};

type ParkingSectionOption = {
  id: string;
  name: string;
  code?: string | null;
  parkingLotId: string;
};

type Props = {
  role: Role;
  boardId?: string;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api';

function getToken() {
  if (typeof window === 'undefined') return '';

  const directKeys = [
    'kosmos.consoleAccessToken',
    'kosmos.accessToken',
    'accessToken',
    'access_token',
    'token',
    'authToken',
    'auth_token',
    'parking.accessToken',
    'parking.token',
    'kosmos.token',
  ];

  for (const key of directKeys) {
    const value = localStorage.getItem(key);
    if (value && value.startsWith('eyJ')) return value;
  }

  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;

    const value = localStorage.getItem(key);
    if (!value) continue;

    if (value.startsWith('eyJ')) return value;

    try {
      const parsed = JSON.parse(value);
      const candidates = [
        parsed?.accessToken,
        parsed?.access_token,
        parsed?.token,
        parsed?.state?.accessToken,
        parsed?.state?.access_token,
        parsed?.state?.token,
        parsed?.state?.auth?.accessToken,
        parsed?.state?.auth?.token,
      ];

      const token = candidates.find((item) => typeof item === 'string' && item.startsWith('eyJ'));
      if (token) return token;
    } catch {
      // ignore
    }
  }

  return '';
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
    cache: 'no-store',
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const detail =
      typeof data?.message === 'string'
        ? data.message
        : Array.isArray(data?.message)
          ? data.message.join(', ')
          : data?.error || JSON.stringify(data);

    throw new Error(`API error ${res.status}: ${detail}`);
  }

  return data as T;
}

function numberOrNull(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function boardToDraft(board: DisplayBoard) {
  return {
    name: board.name ?? '',
    code: board.code ?? '',
    enabled: board.enabled ?? true,

    transport: board.transport ?? 'TCP',
    tcpHost: board.tcpHost ?? '127.0.0.1',
    tcpPort: board.tcpPort ?? 5000,

    serialPort: board.serialPort ?? '/dev/ttyUSB0',
    baudRate: board.baudRate ?? 9600,
    dataBits: board.dataBits ?? 8,
    parity: board.parity ?? 'none',
    stopBits: board.stopBits ?? 1,

    connectTimeoutMs: board.connectTimeoutMs ?? 3000,
    readTimeoutMs: board.readTimeoutMs ?? 3000,

    rows: board.rows ?? 1,
    cols: board.cols ?? 4,
    moduleType: board.moduleType ?? '',
    rgbOrder: board.rgbOrder ?? '',

    brightness: board.brightness ?? 10,
    powerOn: board.powerOn ?? true,

    heartbeatIntervalSec: board.heartbeatIntervalSec ?? 15,
    retryMaxAttempts: board.retryMaxAttempts ?? 3,
    retryBackoffMs: board.retryBackoffMs ?? 2000,
  };
}

export default function DisplaySettingsPage({ role, boardId }: Props) {
  const [boards, setBoards] = useState<DisplayBoard[]>([]);
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const [moduleDrafts, setModuleDrafts] = useState<Record<string, any[]>>({});
  const [sections, setSections] = useState<ParkingSectionOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function load() {
    setLoading(true);
    setMessage('');

    try {
      const allBoards = await apiFetch<DisplayBoard[]>('/display/boards');
      const nextBoards = boardId
        ? allBoards.filter((board) => board.id === boardId)
        : allBoards;

      setBoards(nextBoards);

      try {
        const nextSections = await apiFetch<ParkingSectionOption[]>('/parking/sections');
        setSections(nextSections);
      } catch {
        setSections([]);
      }

      setDrafts((prev) => {
        const next = { ...prev };

        for (const board of nextBoards) {
          if (!next[board.id]) {
            next[board.id] = boardToDraft(board);
          }
        }

        return next;
      });

      setModuleDrafts((prev) => {
        const next = { ...prev };

        for (const board of nextBoards) {
          if (!next[board.id]) {
            next[board.id] = (board.modules ?? []).map((module) => ({
              rowNo: module.rowNo,
              colNo: module.colNo,
              parkingSectionId: module.parkingSectionId ?? '',
              label: module.label ?? '',
              enabled: module.enabled ?? true,
              charWidth: module.charWidth ?? 4,
              padChar: module.padChar ?? ' ',
            }));
          }
        }

        return next;
      });
    } catch (err: any) {
      setMessage(err?.message ?? '전광판 설정을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function saveBoard(board: DisplayBoard) {
    const draft = drafts[board.id] ?? boardToDraft(board);

    setMessage('전광판 설정을 저장하는 중입니다...');

    try {
      await apiFetch(`/display/boards/${board.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: draft.name,
          code: draft.code || null,
          enabled: Boolean(draft.enabled),

          transport: draft.transport,

          tcpHost: draft.transport === 'TCP' ? draft.tcpHost : null,
          tcpPort: draft.transport === 'TCP' ? numberOrNull(draft.tcpPort) : null,

          serialPort:
            draft.transport === 'RS232' || draft.transport === 'RS485'
              ? draft.serialPort
              : null,
          baudRate:
            draft.transport === 'RS232' || draft.transport === 'RS485'
              ? numberOrNull(draft.baudRate)
              : null,
          dataBits:
            draft.transport === 'RS232' || draft.transport === 'RS485'
              ? numberOrNull(draft.dataBits)
              : null,
          parity:
            draft.transport === 'RS232' || draft.transport === 'RS485'
              ? draft.parity
              : null,
          stopBits:
            draft.transport === 'RS232' || draft.transport === 'RS485'
              ? numberOrNull(draft.stopBits)
              : null,

          connectTimeoutMs: numberOrNull(draft.connectTimeoutMs),
          readTimeoutMs: numberOrNull(draft.readTimeoutMs),

          rows: numberOrNull(draft.rows),
          cols: numberOrNull(draft.cols),
          moduleType: draft.moduleType === '' ? null : numberOrNull(draft.moduleType),
          rgbOrder: draft.rgbOrder === '' ? null : numberOrNull(draft.rgbOrder),

          brightness: numberOrNull(draft.brightness),
          powerOn: Boolean(draft.powerOn),

          heartbeatIntervalSec: numberOrNull(draft.heartbeatIntervalSec),
          retryMaxAttempts: numberOrNull(draft.retryMaxAttempts),
          retryBackoffMs: numberOrNull(draft.retryBackoffMs),
        }),
      });

      setMessage('전광판 설정을 저장했습니다.');
      await load();
    } catch (err: any) {
      setMessage(err?.message ?? '전광판 설정 저장 실패');
    }
  }

  async function saveModules(board: DisplayBoard) {
    const modules = moduleDrafts[board.id] ?? [];

    setMessage('전광판 모듈 설정을 저장하는 중입니다...');

    try {
      await apiFetch(`/display/boards/${board.id}/modules`, {
        method: 'PATCH',
        body: JSON.stringify({
          modules: modules.map((module) => ({
            rowNo: Number(module.rowNo),
            colNo: Number(module.colNo),
            parkingSectionId: module.parkingSectionId || null,
            label: module.label || null,
            enabled: Boolean(module.enabled),
            charWidth: numberOrNull(module.charWidth) ?? 4,
            padChar: module.padChar || ' ',
          })),
        }),
      });

      setMessage('전광판 모듈 설정을 저장했습니다.');
      await load();
    } catch (err: any) {
      setMessage(err?.message ?? '전광판 모듈 설정 저장 실패');
    }
  }

  async function sendDeviceCommand(
    board: DisplayBoard,
    command: 'brightness' | 'power' | 'save' | 'test',
    payload: Record<string, unknown> = {},
  ) {
    const labelMap = {
      brightness: '밝기',
      power: '전원',
      save: '설정 저장',
      test: '통신 테스트',
    };

    setMessage(`${labelMap[command]} 명령을 전송하는 중입니다...`);

    try {
      const result = await apiFetch<any>(`/display/boards/${board.id}/commands/${command}`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      setMessage(`${labelMap[command]} 명령을 생성했습니다. commandId=${result?.id ?? '-'}`);
      await load();
    } catch (err: any) {
      setMessage(err?.message ?? `${labelMap[command]} 명령 실패`);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">전광판 설정</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            통신 모드, 포트, 행/열, 밝기, 재시도 정책을 관리합니다.
          </p>
          <p className="mt-1 text-xs text-slate-400">
            role: {role}
          </p>
        </div>

        <a
          href={`/${role}/display`}
          className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          운영 화면으로
        </a>
      </div>

      {message && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {message}
        </div>
      )}

      {loading ? (
        <div className="mt-8">불러오는 중...</div>
      ) : (
        <div className="mt-6 grid gap-6">
          {boards.map((board) => {
            const draft = drafts[board.id] ?? boardToDraft(board);

            return (
              <section
                key={board.id}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-bold">
                      {board.parkingLot?.name ?? board.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {board.id}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => saveBoard(board)}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                  >
                    설정 저장
                  </button>
                </div>

                <div className="mt-6 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 p-5 dark:border-slate-800">
                    <h3 className="font-bold">기본 정보</h3>

                    <div className="mt-4 grid gap-4">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">전광판 이름</span>
                        <input
                          value={draft.name}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, name: event.target.value },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">코드</span>
                        <input
                          value={draft.code}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, code: event.target.value },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>

                      <label className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                        <span className="text-sm font-medium">사용 여부</span>
                        <input
                          type="checkbox"
                          checked={Boolean(draft.enabled)}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, enabled: event.target.checked },
                            }));
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-5 dark:border-slate-800">
                    <h3 className="font-bold">통신 설정</h3>

                    <div className="mt-4 grid gap-4">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">통신 모드</span>
                        <select
                          value={draft.transport}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, transport: event.target.value },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        >
                          <option value="TCP">TCP/IP</option>
                          <option value="RS485">RS-485</option>
                          <option value="RS232">RS-232</option>
                        </select>
                      </label>

                      {draft.transport === 'TCP' ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="text-sm font-medium">IP 주소</span>
                            <input
                              value={draft.tcpHost}
                              onChange={(event) => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: { ...draft, tcpHost: event.target.value },
                                }));
                              }}
                              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-sm font-medium">Port</span>
                            <input
                              value={draft.tcpPort}
                              onChange={(event) => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: { ...draft, tcpPort: event.target.value },
                                }));
                              }}
                              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          <label className="grid gap-2">
                            <span className="text-sm font-medium">Serial Port</span>
                            <input
                              value={draft.serialPort}
                              onChange={(event) => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: { ...draft, serialPort: event.target.value },
                                }));
                              }}
                              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                            />
                          </label>

                          <label className="grid gap-2">
                            <span className="text-sm font-medium">Baud Rate</span>
                            <select
                              value={draft.baudRate}
                              onChange={(event) => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: { ...draft, baudRate: Number(event.target.value) },
                                }));
                              }}
                              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                            >
                              {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map((rate) => (
                                <option key={rate} value={rate}>
                                  {rate}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="grid gap-2">
                            <span className="text-sm font-medium">Data Bits</span>
                            <select
                              value={draft.dataBits}
                              onChange={(event) => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: { ...draft, dataBits: Number(event.target.value) },
                                }));
                              }}
                              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                            >
                              {[7, 8].map((bits) => (
                                <option key={bits} value={bits}>
                                  {bits}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="grid gap-2">
                            <span className="text-sm font-medium">Parity</span>
                            <select
                              value={draft.parity}
                              onChange={(event) => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: { ...draft, parity: event.target.value },
                                }));
                              }}
                              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                            >
                              <option value="none">None</option>
                              <option value="even">Even</option>
                              <option value="odd">Odd</option>
                            </select>
                          </label>

                          <label className="grid gap-2">
                            <span className="text-sm font-medium">Stop Bits</span>
                            <select
                              value={draft.stopBits}
                              onChange={(event) => {
                                setDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: { ...draft, stopBits: Number(event.target.value) },
                                }));
                              }}
                              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                            >
                              {[1, 2].map((bits) => (
                                <option key={bits} value={bits}>
                                  {bits}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                      )}

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="grid gap-2">
                          <span className="text-sm font-medium">Connect Timeout ms</span>
                          <input
                            value={draft.connectTimeoutMs}
                            onChange={(event) => {
                              setDrafts((prev) => ({
                                ...prev,
                                [board.id]: {
                                  ...draft,
                                  connectTimeoutMs: event.target.value,
                                },
                              }));
                            }}
                            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>

                        <label className="grid gap-2">
                          <span className="text-sm font-medium">Read Timeout ms</span>
                          <input
                            value={draft.readTimeoutMs}
                            onChange={(event) => {
                              setDrafts((prev) => ({
                                ...prev,
                                [board.id]: {
                                  ...draft,
                                  readTimeoutMs: event.target.value,
                                },
                              }));
                            }}
                            className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                          />
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-5 dark:border-slate-800">
                    <h3 className="font-bold">전광판 구성</h3>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">단</span>
                        <input
                          value={draft.rows}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, rows: event.target.value },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">열</span>
                        <input
                          value={draft.cols}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, cols: event.target.value },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Module Type</span>
                        <input
                          value={draft.moduleType}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, moduleType: event.target.value },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">RGB Order</span>
                        <input
                          value={draft.rgbOrder}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, rgbOrder: event.target.value },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 p-5 dark:border-slate-800">
                    <h3 className="font-bold">장치 동작</h3>

                    <div className="mt-4 grid gap-4 md:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="text-sm font-medium">밝기</span>
                        <input
                          value={draft.brightness}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, brightness: event.target.value },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>

                      <label className="flex items-center justify-between rounded-2xl border border-slate-100 p-4 dark:border-slate-800">
                        <span className="text-sm font-medium">전원 ON</span>
                        <input
                          type="checkbox"
                          checked={Boolean(draft.powerOn)}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: { ...draft, powerOn: event.target.checked },
                            }));
                          }}
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Heartbeat sec</span>
                        <input
                          value={draft.heartbeatIntervalSec}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: {
                                ...draft,
                                heartbeatIntervalSec: event.target.value,
                              },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>

                      <label className="grid gap-2">
                        <span className="text-sm font-medium">Retry Attempts</span>
                        <input
                          value={draft.retryMaxAttempts}
                          onChange={(event) => {
                            setDrafts((prev) => ({
                              ...prev,
                              [board.id]: {
                                ...draft,
                                retryMaxAttempts: event.target.value,
                              },
                            }));
                          }}
                          className="h-11 rounded-2xl border border-slate-200 bg-white px-4 dark:border-slate-700 dark:bg-slate-950"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-slate-100 p-5 dark:border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="font-bold">모듈 매핑 설정</h3>
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        각 단/열별 라벨, 주차구역, 표시 폭, 사용 여부를 설정합니다.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => saveModules(board)}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                    >
                      모듈 설정 저장
                    </button>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {(moduleDrafts[board.id] ?? []).map((module, index) => {
                      const lotSections = sections.filter(
                        (section) => section.parkingLotId === board.parkingLotId,
                      );

                      return (
                        <div
                          key={`${module.rowNo}:${module.colNo}`}
                          className="grid gap-3 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950 md:grid-cols-7"
                        >
                          <div className="font-bold">
                            {module.rowNo}단 {module.colNo}열
                          </div>

                          <label className="grid gap-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">라벨</span>
                            <input
                              value={module.label}
                              onChange={(event) => {
                              setModuleDrafts((prev) => {
                                const next = [...(prev[board.id] ?? [])];
                                next[index] = { ...module, label: event.target.value };
                                return { ...prev, [board.id]: next };
                              });
                            }}
                            placeholder="라벨"
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                            />
                          </label>

                          <label className="grid gap-1 md:col-span-2">
                            <span className="text-xs text-slate-500 dark:text-slate-400">주차구역</span>
                            <select
                              value={module.parkingSectionId}
                              onChange={(event) => {
                              setModuleDrafts((prev) => {
                                const next = [...(prev[board.id] ?? [])];
                                next[index] = {
                                  ...module,
                                  parkingSectionId: event.target.value,
                                };
                                return { ...prev, [board.id]: next };
                              });
                            }}
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                            >
                            <option value="">미지정</option>
                            {lotSections.map((section) => (
                              <option key={section.id} value={section.id}>
                                {section.code ? `${section.code} - ` : ''}
                                {section.name}
                              </option>
                            ))}
                            </select>
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">표시폭</span>
                            <input
                              value={module.charWidth}
                            onChange={(event) => {
                              setModuleDrafts((prev) => {
                                const next = [...(prev[board.id] ?? [])];
                                next[index] = { ...module, charWidth: event.target.value };
                                return { ...prev, [board.id]: next };
                              });
                            }}
                            placeholder="폭"
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                            />
                          </label>

                          <label className="grid gap-1">
                            <span className="text-xs text-slate-500 dark:text-slate-400">채움문자</span>
                            <input
                              value={module.padChar}
                            onChange={(event) => {
                              setModuleDrafts((prev) => {
                                const next = [...(prev[board.id] ?? [])];
                                next[index] = {
                                  ...module,
                                  padChar: event.target.value.slice(0, 1) || ' ',
                                };
                                return { ...prev, [board.id]: next };
                              });
                            }}
                            placeholder="패딩"
                              className="h-10 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                            />
                          </label>

                          <label className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={Boolean(module.enabled)}
                              onChange={(event) => {
                                setModuleDrafts((prev) => {
                                  const next = [...(prev[board.id] ?? [])];
                                  next[index] = {
                                    ...module,
                                    enabled: event.target.checked,
                                  };
                                  return { ...prev, [board.id]: next };
                                });
                              }}
                            />
                            사용
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
