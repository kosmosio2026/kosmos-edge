'use client';

import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PaginationBar } from '@/components/console/pagination-bar';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import {
  createPaginationMeta,
  getRowNumber,
  paginateClientSide,
  parseTableQueryFromSearchParams,
  unwrapItems,
} from '@/lib/table-query';
import { ParkingLotFormModal } from '../components/parking-lot-form-modal';

type Props = {
  role?: 'admin' | 'manager' | 'operator';
};

type ParkingLotQr = {
  id?: string;
  qrToken: string;
  qrType?: string | null;
  isActive?: boolean;
};

type ParkingLot = {
  id: string;
  code: string;
  name: string;
  qrCodes?: ParkingLotQr[];
  qrToken?: string | null;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  representative?: string | null;
  contact?: string | null;
  isActive?: boolean;
  _count?: {
    sections?: number;
  };
};

type RequestForm = {
  region: string;
  parkingLotId: string;
};

function emptyRequestForm(): RequestForm {
  return {
    region: '',
    parkingLotId: '',
  };
}

function getLotQrToken(item: ParkingLot) {
  return item.qrCodes?.find((qr) => qr.isActive !== false)?.qrToken ?? item.qrToken ?? '';
}

function getLotQrUrl(item: ParkingLot) {
  const token = getLotQrToken(item);
  if (!token) return '';

  if (typeof window === 'undefined') {
    return `/mobile/qr/${encodeURIComponent(token)}`;
  }

  return `${window.location.origin}/mobile/qr/${encodeURIComponent(token)}`;
}

function getSafeQrFileName(item: ParkingLot) {
  const base = `${item.code || 'parking-lot'}-${item.name || 'qr'}`;
  return base
    .replace(/[^0-9a-zA-Z가-힣._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureSvgNamespace(svg: string) {
  if (!svg) return '';
  if (svg.includes('xmlns=')) return svg;
  return svg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
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

export default function LotsPage({ role = 'admin' }: Props) {
  const searchParams = useSearchParams();
  const highlightedLotId = searchParams.get('lotId') ?? '';
  const canManage = role === 'admin' || role === 'manager';
  const { session } = useAuth();

  const [items, setItems] = useState<ParkingLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ParkingLot | null>(null);
  const [detail, setDetail] = useState<ParkingLot | null>(null);
  const [qrLot, setQrLot] = useState<ParkingLot | null>(null);
  const qrSvgRef = useRef<HTMLDivElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] =
    useState<RequestForm>(emptyRequestForm());
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => parseTableQueryFromSearchParams(searchParams),
    [searchParams],
  );

  const regions = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.region).filter(Boolean) as string[]),
    ).sort();
  }, [items]);

  const requestLots = useMemo(() => {
    if (!requestForm.region) return items;
    return items.filter((item) => item.region === requestForm.region);
  }, [items, requestForm.region]);

  const filteredItems = useMemo(() => {
    const keyword = query.q.trim().toLowerCase();

    return items.filter((item) => {
      if (query.region && item.region !== query.region) return false;

      if (!keyword) return true;

      return [
        item.name,
        item.code,
        item.region,
        item.region,
        item.district,
        item.address,
        item.representative,
        item.contact,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, query.q, query.region]);

  const meta = useMemo(
    () =>
      createPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        total: filteredItems.length,
      }),
    [filteredItems.length, query.page, query.pageSize],
  );

  const pagedItems = useMemo(
    () => paginateClientSide(filteredItems, meta.page, meta.pageSize),
    [filteredItems, meta.page, meta.pageSize],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch('/facilities/lots', {
        accessToken: session.accessToken,
      });

      setItems(unwrapItems<ParkingLot>(response));
    } catch (error) {
      setError(error instanceof Error ? error.message : '주차장 목록을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlightedLotId || loading) return;

    const element = document.getElementById(`lot-row-${highlightedLotId}`);
    if (!element) return;

    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }, [highlightedLotId, loading, items.length]);



  function openCreate() {
    setSelected(null);
    setModalOpen(true);
  }

  function openEdit(item: ParkingLot) {
    setSelected(item);
    setModalOpen(true);
  }

  function openRequest() {
    setRequestForm(emptyRequestForm());
    setRequestMessage(null);
    setRequestOpen(true);
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) return;

    if (!requestForm.parkingLotId) {
      setRequestMessage('주차장을 선택해 주세요.');
      return;
    }

    setRequestSaving(true);
    setRequestMessage(null);

    try {
      await apiFetch('/approvals/manager-lots', {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          parkingLotId: requestForm.parkingLotId,
        }),
      });

      setRequestMessage('권한 요청이 제출되었습니다.');
      setRequestOpen(false);
      setRequestForm(emptyRequestForm());
    } catch (error) {
      setRequestMessage(
        error instanceof Error
          ? error.message
          : '주차장 권한 요청에 실패했습니다.',
      );
    } finally {
      setRequestSaving(false);
    }
  }

  async function remove(id: string) {
    if (!session?.accessToken) return;
    if (!confirm('이 주차장을 삭제하시겠습니까?')) return;

    await apiFetch(`/facilities/lots/${id}`, {
      method: 'DELETE',
      accessToken: session.accessToken,
    });

    await load();
  }

  function getCurrentQrSvgMarkup() {
    const svg = qrSvgRef.current?.querySelector('svg');
    return ensureSvgNamespace(svg?.outerHTML ?? '');
  }

  function printLargeQr() {
    if (!qrLot) return;

    const svg = getCurrentQrSvgMarkup();
    const url = getLotQrUrl(qrLot);

    if (!svg || !url) {
      window.print();
      return;
    }

    const title = `${qrLot.name} 주차장 QR 코드`;
    const printWindow = window.open('', '_blank', 'width=900,height=900');

    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, 'Malgun Gothic', sans-serif;
      color: #0f172a;
      text-align: center;
    }

    .sheet {
      min-height: 270mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10mm;
    }

    .title {
      font-size: 24pt;
      font-weight: 800;
    }

    .subtitle {
      font-size: 12pt;
      color: #475569;
    }

    .qr {
      padding: 10mm;
      border: 1px solid #cbd5e1;
      border-radius: 8mm;
    }

    .qr svg {
      width: 150mm !important;
      height: 150mm !important;
      display: block;
    }

    .url {
      max-width: 170mm;
      word-break: break-all;
      font-size: 10pt;
      color: #334155;
    }
  </style>
</head>
<body>
  <main class="sheet">
    <div>
      <div class="title">${escapeHtml(qrLot.name)}</div>
      <div class="subtitle">주차 등록 QR 코드</div>
    </div>
    <div class="qr">${svg}</div>
    <div class="url">${escapeHtml(url)}</div>
  </main>
  <script>
    window.addEventListener('load', () => {
      window.setTimeout(() => window.print(), 300);
    });
  </script>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  }

  function downloadQrSvg() {
    if (!qrLot) return;

    const svg = getCurrentQrSvgMarkup();
    if (!svg) return;

    const blob = new Blob([svg], {
      type: 'image/svg+xml;charset=utf-8',
    });

    downloadBlob(`${getSafeQrFileName(qrLot)}.svg`, blob);
  }

  async function downloadQrPng() {
    if (!qrLot) return;

    const svg = getCurrentQrSvgMarkup();
    if (!svg) return;

    const svgBlob = new Blob([svg], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const objectUrl = URL.createObjectURL(svgBlob);

    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
          const size = 1600;
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');

          if (!context) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Canvas context is not available.'));
            return;
          }

          canvas.width = size;
          canvas.height = size;

          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, size, size);
          context.imageSmoothingEnabled = false;
          context.drawImage(image, 0, 0, size, size);

          canvas.toBlob((blob) => {
            URL.revokeObjectURL(objectUrl);

            if (!blob) {
              reject(new Error('PNG file could not be created.'));
              return;
            }

            downloadBlob(`${getSafeQrFileName(qrLot)}.png`, blob);
            resolve();
          }, 'image/png');
        };

        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('QR image could not be loaded.'));
        };

        image.src = objectUrl;
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'QR PNG 다운로드에 실패했습니다.');
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">주차장 관리</h1>
          <p className="text-sm text-slate-500">
            {role === 'admin' ? '전체 주차장을 관리합니다.' : '권한이 있는 주차장을 관리합니다.'}
          </p>
        </div>

        {role === 'manager' ? (
          <button
            type="button"
            onClick={openRequest}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            권한 요청
          </button>
        ) : role === 'admin' ? (
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            추가
          </button>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            조회 전용
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {requestMessage ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          {requestMessage}
        </div>
      ) : null}

      {loading ? <div className="text-sm text-slate-500">불러오는 중...</div> : null}

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">지역</th>
              <th className="px-4 py-3">코드</th>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">구역</th>
              <th className="px-4 py-3">대표자</th>
              <th className="px-4 py-3">연락처</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">QR 생성/보기</th>
              {role !== 'operator' ? (
                <th className="px-4 py-3">관리</th>
              ) : null}
            </tr>
          </thead>

          <tbody>
            {pagedItems.map((item, index) => (
              <tr
                  key={item.id}
                  id={`lot-row-${item.id}`}
                  className={`border-t ${
                    highlightedLotId === item.id
                      ? 'bg-blue-50 ring-1 ring-inset ring-blue-200'
                      : ''
                  }`}
                >
                <td className="px-4 py-3">
                  {getRowNumber({
                    page: meta.page,
                    pageSize: meta.pageSize,
                    index,
                  })}
                </td>
                <td className="px-4 py-3">{item.region ?? '-'}</td>
                <td className="px-4 py-3">{item.code}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setDetail(item)}
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    {item.name}
                  </button>
                </td>
                <td className="px-4 py-3">
                    <Link
                      href={`/admin/facilities/sections?lotId=${item.id}`}
                      className="font-semibold text-blue-700 underline-offset-2 hover:underline"
                    >
                      {(item._count?.sections ?? 0).toLocaleString()}
                    </Link>
                  </td>
                <td className="px-4 py-3">{item.representative ?? '-'}</td>
                <td className="px-4 py-3">{item.contact ?? '-'}</td>
                <td className="px-4 py-3">
                  {item.isActive === false ? '비활성' : '활성'}
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => setQrLot(item)}
                    className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    QR 보기
                  </button>
                </td>
                {role !== 'operator' ? (
                  <td className="px-4 py-3">
                    {role === 'admin' ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(item)}
                          className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-50"
                        >
                            수정
                          </button>
                        <button
                          type="button"
                          onClick={() => void remove(item.id)}
                          className="rounded-lg border border-red-200 px-3 py-1 text-xs text-red-600 hover:bg-red-50"
                        >
                            삭제
                          </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setRequestForm({
                            region: item.region ?? '',
                            parkingLotId: item.id,
                          });
                          setRequestOpen(true);
                        }}
                        className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-50"
                      >
                        권한 요청
                      </button>
                    )}
                  </td>
                ) : null}
              </tr>
            ))}

            {!loading && filteredItems.length === 0 ? (
              <tr>
                <td
                  colSpan={role !== 'operator' ? 10 : 9}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  번호 parking lots.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <PaginationBar meta={meta} />

      {qrLot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">주차장 QR 코드</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {qrLot.name} 주차장에 부착할 QR 코드입니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrLot(null)}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div ref={qrSvgRef} className="mt-6 flex max-w-full justify-center overflow-auto rounded-2xl border bg-white p-8">
              {getLotQrToken(qrLot) ? (
                <QRCodeSVG value={getLotQrUrl(qrLot)} size={340} level="M" includeMargin />
              ) : (
                <div className="text-sm text-red-600">QR 토큰이 없습니다.</div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-slate-500">QR 접속 URL</div>
              <div className="break-all rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                {getLotQrUrl(qrLot) || '-'}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = getLotQrUrl(qrLot);
                  if (url) void navigator.clipboard?.writeText(url);
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                URL 복사
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = getLotQrUrl(qrLot);
                  if (url) window.open(url, '_blank', 'noopener,noreferrer');
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                새 창 열기
              </button>
              <button
                type="button"
                onClick={downloadQrSvg}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                SVG 다운로드
              </button>
              <button
                type="button"
                onClick={() => void downloadQrPng()}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                PNG 다운로드
              </button>
              <button
                type="button"
                onClick={printLargeQr}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                큰 QR 인쇄
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ParkingLotFormModal
        open={role === 'admin' && modalOpen}
        value={selected}
        accessToken={session?.accessToken}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          void load();
        }}
      />

      {requestOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitRequest}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold">주차장 권한 요청</h2>
            <p className="mt-1 text-sm text-slate-500">
              Select the region and parking lot you want to manage.
            </p>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-slate-700">지역</span>
                <select
                  value={requestForm.region}
                  onChange={(event) =>
                    setRequestForm({
                      region: event.target.value,
                      parkingLotId: '',
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">All regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Parking Lot
                </span>
                <select
                  value={requestForm.parkingLotId}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      parkingLotId: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">Select parking lot</option>
                  {requestLots.map((lot) => (
                    <option key={lot.id} value={lot.id}>
                      {lot.region ? `[${lot.region}] ` : ''}
                      {lot.name} {lot.code ? `(${lot.code})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={requestSaving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {requestSaving ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">{detail.name}</h2>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="코드" value={detail.code} />
              <Row label="지역" value={detail.region} />
              <Row label="지역" value={detail.region} />
              <Row label="District" value={detail.district} />
              <Row label="추가ress" value={detail.address} />
              <Row label="Lat" value={detail.lat} />
              <Row label="Lng" value={detail.lng} />
              <Row label="대표자" value={detail.representative} />
              <Row label="연락처" value={detail.contact} />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-xl border px-4 py-2 text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-4 py-2">
      <div className="font-medium text-slate-500">{label}</div>
      <div className="col-span-2 break-all">{value == null ? '-' : String(value)}</div>
    </div>
  );
}
