'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';

type DisplayModulePreview = {
  rowNo: number;
  colNo: number;
  label?: string | null;
  parkingSectionId?: string | null;
  sectionName?: string | null;
  sectionCode?: string | null;
  value?: string;
  availableSpaces?: number;
  totalSpaces?: number;
  occupiedSpaces?: number;
  charWidth?: number;
  colorCode?: number;
  fontCode?: number;
};

type DisplayLine = {
  lineNo: number;
  text: string;
  rawTemplate?: string;
  fontSize?: number;
  effect?: string;
  speed?: number;
  delay?: number;
  colorCode?: number;
  modules?: DisplayModulePreview[];
};

type DisplayPreview = {
  boardId: string;
  parkingLotId: string;
  mode: 'AUTO' | 'MANUAL';
  manualReason?: string | null;
  source: 'AUTO' | 'MANUAL' | 'AUTO_MODULE' | 'MANUAL_MODULE';
  stats: {
    lotName: string;
    totalSpaces: number;
    occupiedSpaces: number;
    availableSpaces: number;
  };
  lines: DisplayLine[];
  renderedAt: string;
};

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
  mode: 'AUTO' | 'MANUAL';
  manualReason?: string | null;
  lastStatus: 'OK' | 'WARN' | 'ERROR' | 'OFFLINE';
  lastError?: string | null;
  lastSentAt?: string | null;
  lastAckAt?: string | null;
  lastRenderedPayload?: unknown;
  lastSentPayload?: unknown;
  parkingLot?: {
    id: string;
    name: string;
    code?: string | null;
    address?: string | null;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:3001/api';

const COLOR_OPTIONS = [
  { value: 0, label: '기본' },
  { value: 1, label: '빨강' },
  { value: 2, label: '초록' },
  { value: 3, label: '파랑' },
  { value: 4, label: '노랑' },
  { value: 5, label: '청록' },
  { value: 6, label: '자홍' },
  { value: 7, label: '흰색' },
];

const FONT_OPTIONS = [
  { value: 0, label: '기본' },
  { value: 1, label: '폰트 1' },
  { value: 2, label: '폰트 2' },
  { value: 3, label: '폰트 3' },
  { value: 4, label: '폰트 4' },
];

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

    if (res.status === 401) {
      throw new Error(`로그인이 필요합니다. (${detail})`);
    }

    if (res.status === 403) {
      throw new Error(`전광판 권한이 없습니다. display.command/display.manage 권한을 확인하세요. (${detail})`);
    }

    throw new Error(`API error ${res.status}: ${detail}`);
  }

  return data as T;
}

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(value));
}

function statusLabel(status: string) {
  switch (status) {
    case 'OK':
      return '정상';
    case 'WARN':
      return '주의';
    case 'ERROR':
      return '오류';
    case 'OFFLINE':
      return '오프라인';
    default:
      return status;
  }
}

function getCharDisplayWidth(char: string) {
  if (!char) return 0;

  const code = char.codePointAt(0) ?? 0;

  if (
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0x3130 && code <= 0x318f) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    (code >= 0x2e80 && code <= 0x9fff) ||
    (code >= 0xf900 && code <= 0xfaff)
  ) {
    return 2;
  }

  return 1;
}

function getDisplayWidth(value: string) {
  return Array.from(String(value ?? '')).reduce(
    (sum, char) => sum + getCharDisplayWidth(char),
    0,
  );
}

function clipDisplayTextFromRight(value: string, maxWidth: number) {
  const chars = Array.from(String(value ?? ''));
  const result: string[] = [];
  let width = 0;

  for (let index = chars.length - 1; index >= 0; index -= 1) {
    const char = chars[index];
    const charWidth = getCharDisplayWidth(char);

    if (width + charWidth > maxWidth) continue;

    result.unshift(char);
    width += charWidth;

    if (width >= maxWidth) break;
  }

  return result.join('');
}

function rightAlignDisplayText(value: string, width = 4) {
  const safeWidth = Math.max(1, width || 4);
  const clipped = clipDisplayTextFromRight(value ?? '', safeWidth);
  const padCount = Math.max(0, safeWidth - getDisplayWidth(clipped));

  return `${' '.repeat(padCount)}${clipped}`;
}

function normalizeManualValue(value: string, width = 4) {
  return rightAlignDisplayText(String(value ?? '').trim(), width);
}

function visibleCell(value?: string | null) {
  return String(value ?? '').replace(/ /g, '\u00a0');
}

function payloadDisplayLines(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const lines = (payload as any).lines;

  if (!Array.isArray(lines)) {
    return [];
  }

  return lines
    .map((line: any) => {
      if (Array.isArray(line?.modules)) {
        const moduleText = line.modules
          .map((module: any) =>
            String(
              module?.value ??
                module?.text ??
                '',
            ),
          )
          .join('');

        if (moduleText.trim()) {
          return moduleText;
        }
      }

      return String(
        line?.text ??
          line?.textTemplate ??
          line?.rawTemplate ??
          '',
      );
    })
    .filter((line: string) => line.length > 0);
}

function moduleInputKey(boardId: string, rowNo: number, colNo: number) {
  return `${boardId}:${rowNo}:${colNo}`;
}

function moduleColorKey(boardId: string, rowNo: number, colNo: number) {
  return `${boardId}:${rowNo}:${colNo}:color`;
}

function moduleFontKey(boardId: string, rowNo: number, colNo: number) {
  return `${boardId}:${rowNo}:${colNo}:font`;
}

function moduleLabel(module: DisplayModulePreview) {
  return (
    module.label ||
    module.sectionName ||
    module.sectionCode ||
    `${module.colNo}번째 구역`
  );
}

function flattenModules(preview?: DisplayPreview) {
  if (!preview) return [];

  return preview.lines.flatMap((line) =>
    (line.modules ?? []).map((module) => ({
      ...module,
      lineNo: line.lineNo,
    })),
  );
}

function boardToCommDraft(board: DisplayBoard) {
  return {
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
  };
}

function numberOrNull(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function actionButtonStyle(active: boolean, dark = false): React.CSSProperties {
  if (active) {
    return {
      padding: '10px 14px',
      borderRadius: 10,
      border: '1px solid #111',
      background: '#111',
      color: 'white',
      cursor: 'pointer',
      fontWeight: 800,
      boxShadow: '0 0 0 3px rgba(17,17,17,0.12)',
    };
  }

  return {
    padding: '10px 14px',
    borderRadius: 10,
    border: '1px solid #ddd',
    background: dark ? '#f8f8f8' : '#fff',
    color: '#111',
    cursor: 'pointer',
    fontWeight: 700,
  };
}

export default function OperatorDisplayPage() {
  const pathname = usePathname();
  const displayRole = pathname.startsWith('/admin')
    ? 'admin'
    : pathname.startsWith('/manager')
      ? 'manager'
      : 'operator';

  const [boards, setBoards] = useState<DisplayBoard[]>([]);
  const [selectedParkingLotId, setSelectedParkingLotId] = useState('');
  const [previews, setPreviews] = useState<Record<string, DisplayPreview>>({});
  const [manualValues, setManualValues] = useState<Record<string, string>>({});
  const [manualColors, setManualColors] = useState<Record<string, number>>({});
  const [manualFonts, setManualFonts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [commDrafts, setCommDrafts] = useState<Record<string, any>>({});
  const [activeActions, setActiveActions] = useState<Record<string, 'publish' | 'manual' | 'auto'>>({});
  const [pendingActions, setPendingActions] = useState<Record<string, 'publish' | 'manual' | 'auto' | null>>({});

  const visibleBoards = useMemo(
    () =>
      selectedParkingLotId
        ? boards.filter(
            (board) =>
              board.parkingLotId === selectedParkingLotId,
          )
        : boards.slice(0, 1),
    [boards, selectedParkingLotId],
  );

  function selectParkingLot(parkingLotId: string) {
    setSelectedParkingLotId(parkingLotId);

    const url = new URL(window.location.href);

    if (parkingLotId) {
      url.searchParams.set('parkingLotId', parkingLotId);
    } else {
      url.searchParams.delete('parkingLotId');
    }

    window.history.replaceState(
      null,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }

  async function load() {
    setLoading(true);
    setMessage('');

    try {
      const nextBoards = await apiFetch<DisplayBoard[]>('/display/boards');
      setBoards(nextBoards);

      const requestedParkingLotId =
        new URLSearchParams(window.location.search).get(
          'parkingLotId',
        );

      setSelectedParkingLotId((current) => {
        if (
          current &&
          nextBoards.some(
            (board) => board.parkingLotId === current,
          )
        ) {
          return current;
        }

        if (
          requestedParkingLotId &&
          nextBoards.some(
            (board) =>
              board.parkingLotId === requestedParkingLotId,
          )
        ) {
          return requestedParkingLotId;
        }

        return nextBoards[0]?.parkingLotId ?? '';
      });

      const previewPairs = await Promise.all(
        nextBoards.map(async (board) => {
          const preview = await apiFetch<DisplayPreview>(`/display/boards/${board.id}/preview`);
          return [board.id, preview] as const;
        }),
      );

      const nextPreviews = Object.fromEntries(previewPairs);
      setPreviews(nextPreviews);

      setManualValues((prev) => {
        const next = { ...prev };

        for (const [boardId, preview] of previewPairs) {
          for (const module of flattenModules(preview)) {
            const key = moduleInputKey(boardId, module.rowNo, module.colNo);

            if (next[key] === undefined) {
              next[key] = module.value ?? normalizeManualValue(
                String(module.availableSpaces ?? ''),
                module.charWidth ?? 4,
              );
            }
          }
        }

        return next;
      });

      setManualColors((prev) => {
        const next = { ...prev };

        for (const [boardId, preview] of previewPairs) {
          for (const module of flattenModules(preview)) {
            const key = moduleColorKey(boardId, module.rowNo, module.colNo);

            if (next[key] === undefined) {
              next[key] = module.colorCode ?? 0;
            }
          }
        }

        return next;
      });

      setManualFonts((prev) => {
        const next = { ...prev };

        for (const [boardId, preview] of previewPairs) {
          for (const module of flattenModules(preview)) {
            const key = moduleFontKey(boardId, module.rowNo, module.colNo);

            if (next[key] === undefined) {
              next[key] = module.fontCode ?? 0;
            }
          }
        }

        return next;
      });

      setCommDrafts((prev) => {
        const next = { ...prev };

        for (const board of nextBoards) {
          if (next[board.id] === undefined) {
            next[board.id] = boardToCommDraft(board);
          }
        }

        return next;
      });

      setActiveActions((prev) => {
        const next = { ...prev };

        for (const board of nextBoards) {
          if (!next[board.id]) {
            next[board.id] = board.mode === 'MANUAL' ? 'manual' : 'auto';
          }
        }

        return next;
      });
    } catch (err: any) {
      setMessage(err?.message ?? '전광판 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function publish(boardId: string) {
    const board = boards.find(
      (item) => item.id === boardId,
    );

    if (!board?.enabled) {
      setMessage(
        '비활성 상태의 전광판에는 송출할 수 없습니다.',
      );
      return;
    }

    setActiveActions((prev) => ({ ...prev, [boardId]: 'publish' }));
    setPendingActions((prev) => ({ ...prev, [boardId]: 'publish' }));
    setMessage('현재 문구 송신 명령을 요청하는 중입니다...');

    try {
      console.log('[display] publish clicked', boardId);

      const result = await apiFetch<any>(`/display/boards/${boardId}/commands/publish`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      console.log('[display] publish result', result);

      setMessage(`현재 문구 송신 명령을 생성했습니다. commandId=${result?.id ?? '-'}`);
      await load();
    } catch (err: any) {
      console.error('[display] publish failed', err);
      setMessage(err?.message ?? '송신 명령 생성 실패');
    } finally {
      setPendingActions((prev) => ({ ...prev, [boardId]: null }));
    }
  }

  async function setAutoMode(boardId: string) {
    const board = boards.find(
      (item) => item.id === boardId,
    );

    if (!board?.enabled) {
      setMessage(
        '비활성 상태의 전광판은 자동 모드로 전환할 수 없습니다.',
      );
      return;
    }

    setActiveActions((prev) => ({ ...prev, [boardId]: 'auto' }));
    setPendingActions((prev) => ({ ...prev, [boardId]: 'auto' }));
    setMessage('자동 모드 복귀 명령을 요청하는 중입니다...');

    try {
      console.log('[display] auto-mode clicked', boardId);

      const result = await apiFetch<any>(`/display/boards/${boardId}/commands/auto-mode`, {
        method: 'POST',
        body: JSON.stringify({}),
      });

      console.log('[display] auto-mode result', result);

      setMessage(`자동 모드 복귀 명령을 생성했습니다. commandId=${result?.id ?? '-'}`);
      await load();
    } catch (err: any) {
      console.error('[display] auto-mode failed', err);
      setMessage(err?.message ?? '자동 모드 복귀 실패');
    } finally {
      setPendingActions((prev) => ({ ...prev, [boardId]: null }));
    }
  }

  async function saveCommSettings(board: DisplayBoard) {
    const draft = commDrafts[board.id] ?? boardToCommDraft(board);

    setMessage('');

    try {
      await apiFetch(`/display/boards/${board.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          transport: draft.transport,
          tcpHost: draft.transport === 'TCP' ? draft.tcpHost : null,
          tcpPort: draft.transport === 'TCP' ? numberOrNull(draft.tcpPort) : null,
          serialPort: draft.transport === 'RS232' || draft.transport === 'RS485'
            ? draft.serialPort
            : null,
          baudRate: draft.transport === 'RS232' || draft.transport === 'RS485'
            ? numberOrNull(draft.baudRate)
            : null,
          dataBits: draft.transport === 'RS232' || draft.transport === 'RS485'
            ? numberOrNull(draft.dataBits)
            : null,
          parity: draft.transport === 'RS232' || draft.transport === 'RS485'
            ? draft.parity
            : null,
          stopBits: draft.transport === 'RS232' || draft.transport === 'RS485'
            ? numberOrNull(draft.stopBits)
            : null,
          connectTimeoutMs: numberOrNull(draft.connectTimeoutMs),
          readTimeoutMs: numberOrNull(draft.readTimeoutMs),
        }),
      });

      setMessage('통신 설정을 저장했습니다.');
      await load();
    } catch (err: any) {
      setMessage(err?.message ?? '통신 설정 저장 실패');
    }
  }

  async function setManualMode(board: DisplayBoard) {
    if (!board.enabled) {
      setMessage(
        '비활성 상태의 전광판에는 수동 송출할 수 없습니다.',
      );
      return;
    }

    const preview = previews[board.id];

    if (!preview) {
      setMessage('미리보기 데이터가 없어 수동 송신을 할 수 없습니다. 새로고침 후 다시 시도하세요.');
      return;
    }

    const lines = preview.lines.map((line) => {
      const modules = line.modules ?? [];

      const modulePayload = modules.map((module) => {
        const inputKey = moduleInputKey(board.id, module.rowNo, module.colNo);
        const colorKey = moduleColorKey(board.id, module.rowNo, module.colNo);
        const fontKey = moduleFontKey(board.id, module.rowNo, module.colNo);
        const value = normalizeManualValue(manualValues[inputKey] ?? '', module.charWidth ?? 4);

        return {
          rowNo: module.rowNo,
          colNo: module.colNo,
          value,
          charWidth: module.charWidth ?? 4,
          colorCode: manualColors[colorKey] ?? 0,
          fontCode: manualFonts[fontKey] ?? 0,
        };
      });

      const textTemplate = modulePayload.map((module) => module.value).join('');

      return {
        lineNo: line.lineNo,
        textTemplate,
        enabled: true,
        fontSize: 1,
        effect: '090009000900',
        speed: 2,
        delay: 5,
        colorCode: modulePayload[0]?.colorCode ?? 0,
        fontCode: modulePayload[0]?.fontCode ?? 0,
        modules: modulePayload,
      };
    });

    setActiveActions((prev) => ({ ...prev, [board.id]: 'manual' }));
    setPendingActions((prev) => ({ ...prev, [board.id]: 'manual' }));
    setMessage('수동 값 송신 명령을 요청하는 중입니다...');

    try {
      console.log('[display] manual-mode clicked', board.id, lines);

      const result = await apiFetch<any>(`/display/boards/${board.id}/commands/manual-mode`, {
        method: 'POST',
        body: JSON.stringify({
          reason: '수동 모듈 값 입력',
          lines,
        }),
      });

      console.log('[display] manual-mode result', result);

      setMessage(`수동 모드 송신 명령을 생성했습니다. commandId=${result?.id ?? '-'}`);
      await load();
    } catch (err: any) {
      console.error('[display] manual-mode failed', err);
      setMessage(err?.message ?? '수동 모드 전환 실패');
    } finally {
      setPendingActions((prev) => ({ ...prev, [board.id]: null }));
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28 }}>전광판 운영</h1>
          <p style={{ marginTop: 8, color: '#666' }}>
            왼쪽은 현재 계산 내용, 오른쪽은 수동 송신값입니다. 라벨은 화면 표시용이며 전광판에는 전송되지 않습니다.
          </p>
          <p style={{ marginTop: 4, color: '#999', fontSize: 12 }}>
            DISPLAY_UI_VERSION_20260706_BUTTON_FIX
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={`${
              displayRole === 'admin'
                ? '/admin/display/settings'
                : '/manager/display/settings'
            }${
              selectedParkingLotId
                ? `?parkingLotId=${encodeURIComponent(
                    selectedParkingLotId,
                  )}`
                : ''
            }`}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #ddd',
              background: 'white',
              color: '#111',
              textDecoration: 'none',
              fontWeight: 700,
            }}
          >
            전광판 설정
          </a>

          <button
            onClick={load}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid #ddd',
              background: 'white',
              cursor: 'pointer',
            }}
          >
            새로고침
          </button>
        </div>
      </div>


      {boards.length > 0 ? (
        <section
          style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 16,
            border: '1px solid #e5e7eb',
            background: '#fff',
          }}
        >
          <label
            htmlFor="display-parking-lot"
            style={{
              display: 'block',
              marginBottom: 8,
              fontSize: 13,
              fontWeight: 800,
              color: '#475569',
            }}
          >
            주차장 선택
          </label>

          <select
            id="display-parking-lot"
            name="parkingLotId"
            value={selectedParkingLotId}
            onChange={(event) =>
              selectParkingLot(event.target.value)
            }
            style={{
              width: '100%',
              minHeight: 46,
              borderRadius: 12,
              border: '1px solid #cbd5e1',
              background: '#fff',
              padding: '0 14px',
              fontWeight: 700,
            }}
          >
            {boards.map((board) => (
              <option
                key={board.parkingLotId}
                value={board.parkingLotId}
              >
                {board.parkingLot?.name ?? board.name}
                {' · '}
                {board.enabled ? '활성' : '비활성'}
              </option>
            ))}
          </select>

          {visibleBoards[0] ? (
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                fontSize: 13,
                color: '#64748b',
              }}
            >
              <span>
                Controller ID: {visibleBoards[0].id}
              </span>
              <span>
                운영 상태:{' '}
                {visibleBoards[0].enabled
                  ? '활성'
                  : '비활성'}
              </span>
            </div>
          ) : null}
        </section>
      ) : null}

      {message && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 10,
            background: '#f5f5f5',
            border: '1px solid #e5e5e5',
          }}
        >
          {message}
        </div>
      )}

      {loading ? (
        <div style={{ marginTop: 32 }}>불러오는 중...</div>
      ) : visibleBoards.length === 0 ? (
        <div style={{ marginTop: 32 }}>등록된 전광판이 없습니다.</div>
      ) : (
        <div style={{ display: 'grid', gap: 20, marginTop: 24 }}>
          {visibleBoards.map((board) => {
            const preview = previews[board.id];
            const modules = flattenModules(preview);
            const lastSentLines = payloadDisplayLines(
              board.lastSentPayload,
            );

            return (
              <section
                key={board.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: 18,
                  padding: 20,
                  background: 'white',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 16,
                  }}
                >
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22 }}>
                      {board.parkingLot?.name ?? board.name}
                    </h2>
                    <p style={{ margin: '6px 0 0', color: '#666' }}>
                      {board.name} · {board.code ?? '-'}
                    </p>
                    <p style={{ margin: '6px 0 0', color: '#888' }}>
                      구성: {board.rows}단 × {board.cols}열 ·{' '}
                      {board.transport === 'TCP'
                        ? `TCP ${board.tcpHost ?? '-'}:${board.tcpPort ?? '-'}`
                        : `${board.transport} ${board.serialPort ?? '-'}`}
                    </p>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        display: 'inline-block',
                        padding: '6px 10px',
                        borderRadius: 999,
                        background: board.mode === 'AUTO' ? '#eef7ff' : '#fff5e6',
                        border: '1px solid #ddd',
                        fontWeight: 700,
                      }}
                    >
                      {board.mode === 'AUTO' ? '자동 모드' : '수동 모드'}
                    </div>
                    <div style={{ marginTop: 8, color: '#666' }}>
                      상태: {statusLabel(board.lastStatus)}
                    </div>
                  </div>
                </div>

                {!board.enabled ? (
                  <div
                    style={{
                      marginTop: 18,
                      padding: 14,
                      borderRadius: 14,
                      border: '1px solid #fecaca',
                      background: '#fef2f2',
                      color: '#b91c1c',
                      fontWeight: 700,
                    }}
                  >
                    이 주차장의 전광판은 비활성 상태입니다.
                    설정 조회는 가능하지만 송출 명령은 실행되지 않습니다.
                  </div>
                ) : null}

                <div
                  style={{
                    marginTop: 18,
                    padding: 16,
                    borderRadius: 16,
                    border: '1px solid #dbeafe',
                    background: '#f8fbff',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 18,
                        fontWeight: 800,
                      }}
                    >
                      마지막 실제 송출 내용
                    </div>

                    <div
                      style={{
                        fontSize: 12,
                        color: '#64748b',
                        textAlign: 'right',
                      }}
                    >
                      <div>
                        송출: {formatDateTime(board.lastSentAt)}
                      </div>
                      <div>
                        응답: {formatDateTime(board.lastAckAt)}
                      </div>
                    </div>
                  </div>

                  {lastSentLines.length > 0 ? (
                    <div
                      style={{
                        display: 'grid',
                        gap: 8,
                        marginTop: 12,
                      }}
                    >
                      {lastSentLines.map((line, index) => (
                        <div
                          key={`${board.id}-last-sent-${index}`}
                          style={{
                            borderRadius: 10,
                            background: '#111827',
                            padding: '10px 14px',
                            color: '#facc15',
                            fontFamily: 'monospace',
                            fontSize: 18,
                            fontWeight: 800,
                            letterSpacing: 2,
                            whiteSpace: 'pre-wrap',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {visibleCell(line)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div
                      style={{
                        marginTop: 12,
                        color: '#64748b',
                        fontSize: 14,
                      }}
                    >
                      아직 ACK가 완료된 실제 송출 이력이 없습니다.
                    </div>
                  )}
                </div>

                {preview && (
                  <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                        gap: 12,
                        marginTop: 20,
                      }}
                    >
                      <div style={{ padding: 14, borderRadius: 14, background: '#f7f7f7' }}>
                        <div style={{ color: '#777' }}>전체면</div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.stats.totalSpaces}</div>
                      </div>
                      <div style={{ padding: 14, borderRadius: 14, background: '#f7f7f7' }}>
                        <div style={{ color: '#777' }}>사용중</div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.stats.occupiedSpaces}</div>
                      </div>
                      <div style={{ padding: 14, borderRadius: 14, background: '#f7f7f7' }}>
                        <div style={{ color: '#777' }}>가능면</div>
                        <div style={{ fontSize: 24, fontWeight: 800 }}>{preview.stats.availableSpaces}</div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
                        gap: 20,
                        marginTop: 22,
                        alignItems: 'start',
                      }}
                    >
                      <div
                        style={{
                          border: '1px solid #e5e5e5',
                          borderRadius: 16,
                          padding: 16,
                          background: '#fafafa',
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                          현재 송신값
                        </div>

                        <div
                          style={{
                            display: 'grid',
                            gap: 10,
                          }}
                        >
                          {modules.map((module) => (
                            <div
                              key={`${module.rowNo}-${module.colNo}-preview`}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '110px minmax(0, 1fr)',
                                gap: 10,
                                alignItems: 'center',
                              }}
                            >
                              <div
                                style={{
                                  color: '#555',
                                  fontWeight: 700,
                                  textAlign: 'right',
                                }}
                              >
                                {moduleLabel(module)}
                              </div>

                              <div
                                style={{
                                  background: '#090909',
                                  color: '#00ff66',
                                  borderRadius: 10,
                                  border: '1px solid #222',
                                  padding: '10px 14px',
                                  minHeight: 48,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'flex-end',
                                  fontFamily: 'monospace',
                                  fontSize: 30,
                                  lineHeight: 1,
                                  letterSpacing: 3,
                                  boxShadow: 'inset 0 0 18px rgba(0,255,102,0.12)',
                                  whiteSpace: 'pre',
                                }}
                              >
                                {visibleCell(module.value ?? '')}
                              </div>
                            </div>
                          ))}
                        </div>

                        <div
                          style={{
                            marginTop: 14,
                            padding: 12,
                            borderRadius: 12,
                            background: '#111',
                            color: '#00ff66',
                            fontFamily: 'monospace',
                            fontSize: 20,
                            whiteSpace: 'pre',
                            overflowX: 'auto',
                          }}
                        >
                          실제 송신 문자열: {visibleCell(preview.lines.map((line) => line.text).join(''))}
                        </div>
                      </div>

                      <div
                        style={{
                          border: '1px solid #e5e5e5',
                          borderRadius: 16,
                          padding: 16,
                          background: '#fff',
                        }}
                      >
                        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                          수동 송신값
                        </div>

                        <div style={{ display: 'grid', gap: 10 }}>
                          {modules.map((module) => {
                            const inputKey = moduleInputKey(board.id, module.rowNo, module.colNo);
                            const colorKey = moduleColorKey(board.id, module.rowNo, module.colNo);
                            const fontKey = moduleFontKey(board.id, module.rowNo, module.colNo);
                            const width = module.charWidth ?? 4;

                            return (
                              <div
                                key={`${module.rowNo}-${module.colNo}-manual`}
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: '90px minmax(0, 1fr) 100px 100px',
                                  gap: 10,
                                  alignItems: 'center',
                                  padding: 10,
                                  border: '1px solid #eee',
                                  borderRadius: 12,
                                  background: '#fafafa',
                                }}
                              >
                                <div>
                                  <div style={{ fontWeight: 800 }}>
                                    {module.rowNo}단 {module.colNo}열
                                  </div>
                                  <div style={{ fontSize: 12, color: '#777' }}>
                                    {moduleLabel(module)}
                                  </div>
                                </div>

                                <input
                                  value={manualValues[inputKey] ?? ''}
                                  onChange={(event) => {
                                    const nextValue = clipDisplayTextFromRight(event.target.value, width);

                                    setManualValues((prev) => ({
                                      ...prev,
                                      [inputKey]: nextValue,
                                    }));
                                  }}
                                  placeholder={`${width}칸`}
                                  inputMode="text"
                                  style={{
                                    width: '100%',
                                    padding: 12,
                                    borderRadius: 10,
                                    border: '1px solid #ddd',
                                    fontSize: 22,
                                    fontWeight: 800,
                                    textAlign: 'right',
                                    fontFamily: 'monospace',
                                    letterSpacing: 2,
                                  }}
                                />

                                <select
                                  value={manualColors[colorKey] ?? 0}
                                  onChange={(event) => {
                                    setManualColors((prev) => ({
                                      ...prev,
                                      [colorKey]: Number(event.target.value),
                                    }));
                                  }}
                                  style={{
                                    padding: 11,
                                    borderRadius: 10,
                                    border: '1px solid #ddd',
                                    background: 'white',
                                  }}
                                >
                                  {COLOR_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  value={manualFonts[fontKey] ?? 0}
                                  onChange={(event) => {
                                    setManualFonts((prev) => ({
                                      ...prev,
                                      [fontKey]: Number(event.target.value),
                                    }));
                                  }}
                                  style={{
                                    padding: 11,
                                    borderRadius: 10,
                                    border: '1px solid #ddd',
                                    background: 'white',
                                  }}
                                >
                                  {FONT_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            );
                          })}
                        </div>

                        <div
                          style={{
                            marginTop: 14,
                            padding: 12,
                            borderRadius: 12,
                            background: '#f6f6f6',
                            border: '1px solid #e5e5e5',
                            fontFamily: 'monospace',
                            whiteSpace: 'pre',
                            overflowX: 'auto',
                          }}
                        >
                          수동 전송 문자열:{' '}
                          {visibleCell(
                            modules
                              .map((module) => {
                                const key = moduleInputKey(board.id, module.rowNo, module.colNo);
                                return normalizeManualValue(manualValues[key] ?? '', module.charWidth ?? 4);
                              })
                              .join(''),
                          )}
                        </div>
                      </div>
                    </div>

                    <p style={{ color: '#888', marginTop: 10 }}>
                      렌더링: {formatDateTime(preview.renderedAt)}
                    </p>
                  </>
                )}

                <div
                  style={{
                    marginTop: 20,
                    padding: 16,
                    border: '1px solid #e5e5e5',
                    borderRadius: 16,
                    background: '#fafafa',
                  }}
                >
                  <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 12 }}>
                    통신 설정
                  </div>

                  {(() => {
                    const draft = commDrafts[board.id] ?? boardToCommDraft(board);

                    return (
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '140px minmax(0, 1fr)',
                            gap: 10,
                            alignItems: 'center',
                          }}
                        >
                          <label style={{ fontWeight: 700 }}>통신 모드</label>
                          <select
                            value={draft.transport}
                            onChange={(event) => {
                              const transport = event.target.value;

                              setCommDrafts((prev) => ({
                                ...prev,
                                [board.id]: {
                                  ...draft,
                                  transport,
                                },
                              }));
                            }}
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              border: '1px solid #ddd',
                              background: 'white',
                            }}
                          >
                            <option value="TCP">TCP/IP</option>
                            <option value="RS485">RS-485</option>
                            <option value="RS232">RS-232</option>
                          </select>
                        </div>

                        {draft.transport === 'TCP' ? (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '140px minmax(0, 1fr) 140px minmax(0, 1fr)',
                              gap: 10,
                              alignItems: 'center',
                            }}
                          >
                            <label style={{ fontWeight: 700 }}>IP 주소</label>
                            <input
                              value={draft.tcpHost ?? ''}
                              onChange={(event) => {
                                setCommDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: {
                                    ...draft,
                                    tcpHost: event.target.value,
                                  },
                                }));
                              }}
                              placeholder="192.168.0.100"
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid #ddd',
                              }}
                            />

                            <label style={{ fontWeight: 700 }}>Port</label>
                            <input
                              value={draft.tcpPort ?? ''}
                              onChange={(event) => {
                                setCommDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: {
                                    ...draft,
                                    tcpPort: event.target.value,
                                  },
                                }));
                              }}
                              placeholder="5000"
                              inputMode="numeric"
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid #ddd',
                              }}
                            />
                          </div>
                        ) : (
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '140px minmax(0, 1fr) 140px minmax(0, 1fr)',
                              gap: 10,
                              alignItems: 'center',
                            }}
                          >
                            <label style={{ fontWeight: 700 }}>Serial Port</label>
                            <input
                              value={draft.serialPort ?? ''}
                              onChange={(event) => {
                                setCommDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: {
                                    ...draft,
                                    serialPort: event.target.value,
                                  },
                                }));
                              }}
                              placeholder="/dev/ttyUSB0"
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid #ddd',
                              }}
                            />

                            <label style={{ fontWeight: 700 }}>Baud Rate</label>
                            <select
                              value={draft.baudRate ?? 9600}
                              onChange={(event) => {
                                setCommDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: {
                                    ...draft,
                                    baudRate: Number(event.target.value),
                                  },
                                }));
                              }}
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid #ddd',
                                background: 'white',
                              }}
                            >
                              {[1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map((rate) => (
                                <option key={rate} value={rate}>
                                  {rate}
                                </option>
                              ))}
                            </select>

                            <label style={{ fontWeight: 700 }}>Data Bits</label>
                            <select
                              value={draft.dataBits ?? 8}
                              onChange={(event) => {
                                setCommDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: {
                                    ...draft,
                                    dataBits: Number(event.target.value),
                                  },
                                }));
                              }}
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid #ddd',
                                background: 'white',
                              }}
                            >
                              {[7, 8].map((bits) => (
                                <option key={bits} value={bits}>
                                  {bits}
                                </option>
                              ))}
                            </select>

                            <label style={{ fontWeight: 700 }}>Parity</label>
                            <select
                              value={draft.parity ?? 'none'}
                              onChange={(event) => {
                                setCommDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: {
                                    ...draft,
                                    parity: event.target.value,
                                  },
                                }));
                              }}
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid #ddd',
                                background: 'white',
                              }}
                            >
                              <option value="none">None</option>
                              <option value="even">Even</option>
                              <option value="odd">Odd</option>
                            </select>

                            <label style={{ fontWeight: 700 }}>Stop Bits</label>
                            <select
                              value={draft.stopBits ?? 1}
                              onChange={(event) => {
                                setCommDrafts((prev) => ({
                                  ...prev,
                                  [board.id]: {
                                    ...draft,
                                    stopBits: Number(event.target.value),
                                  },
                                }));
                              }}
                              style={{
                                padding: 10,
                                borderRadius: 10,
                                border: '1px solid #ddd',
                                background: 'white',
                              }}
                            >
                              {[1, 2].map((bits) => (
                                <option key={bits} value={bits}>
                                  {bits}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '140px minmax(0, 1fr) 140px minmax(0, 1fr)',
                            gap: 10,
                            alignItems: 'center',
                          }}
                        >
                          <label style={{ fontWeight: 700 }}>연결 Timeout</label>
                          <input
                            value={draft.connectTimeoutMs ?? 3000}
                            onChange={(event) => {
                              setCommDrafts((prev) => ({
                                ...prev,
                                [board.id]: {
                                  ...draft,
                                  connectTimeoutMs: event.target.value,
                                },
                              }));
                            }}
                            inputMode="numeric"
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              border: '1px solid #ddd',
                            }}
                          />

                          <label style={{ fontWeight: 700 }}>읽기 Timeout</label>
                          <input
                            value={draft.readTimeoutMs ?? 3000}
                            onChange={(event) => {
                              setCommDrafts((prev) => ({
                                ...prev,
                                [board.id]: {
                                  ...draft,
                                  readTimeoutMs: event.target.value,
                                },
                              }));
                            }}
                            inputMode="numeric"
                            style={{
                              padding: 10,
                              borderRadius: 10,
                              border: '1px solid #ddd',
                            }}
                          />
                        </div>

                        <div>
                          <button
                            type="button"
                            onClick={() => saveCommSettings(board)}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 10,
                              border: '1px solid #ddd',
                              background: '#111',
                              color: 'white',
                              cursor: 'pointer',
                            }}
                          >
                            통신 설정 저장
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ marginTop: 18, fontSize: 13, color: '#666' }}>
                  선택된 작업:{' '}
                  <strong>
                    {activeActions[board.id] === 'manual'
                      ? '수동 값으로 송신'
                      : activeActions[board.id] === 'publish'
                        ? '현재 문구 송신'
                        : '자동 모드 복귀'}
                  </strong>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginTop: 20,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => publish(board.id)}
                    disabled={pendingActions[board.id] === 'publish'}
                    style={actionButtonStyle(activeActions[board.id] === 'publish')}
                  >
                    {pendingActions[board.id] === 'publish' ? '현재 문구 송신 중...' : '현재 문구 송신'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setManualMode(board)}
                    disabled={pendingActions[board.id] === 'manual'}
                    style={actionButtonStyle(activeActions[board.id] === 'manual')}
                  >
                    {pendingActions[board.id] === 'manual' ? '수동 값 송신 중...' : '수동 값으로 송신'}
                  </button>

                  <button
                    type="button"
                    onClick={() => setAutoMode(board.id)}
                    disabled={pendingActions[board.id] === 'auto'}
                    style={actionButtonStyle(activeActions[board.id] === 'auto')}
                  >
                    {pendingActions[board.id] === 'auto' ? '자동 모드 복귀 중...' : '자동 모드 복귀'}
                  </button>
                </div>

                <div style={{ marginTop: 14, color: '#888', fontSize: 13 }}>
                  마지막 송신: {formatDateTime(board.lastSentAt)} · 마지막 ACK:{' '}
                  {formatDateTime(board.lastAckAt)}
                  {board.lastError ? ` · 오류: ${board.lastError}` : ''}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
