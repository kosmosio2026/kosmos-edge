'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useMemo, useState } from 'react';

const API_BASE =
  getPublicApiBaseUrl();

type Props = {
  role: 'admin' | 'manager';
};

function getToken() {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('kosmos.consoleAccessToken') ??
    localStorage.getItem('kosmos.accessToken') ??
    ''
  );
}

async function apiFetch(path: string) {
  const token = getToken();

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const text = await res.text();
  let json: any = null;

  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    if (res.status === 401) {
      throw new Error('로그인이 만료되었거나 권한이 없습니다. 다시 로그인하세요.');
    }

    throw new Error(
      json?.message ??
        json?.details?.message ??
        text ??
        '직권 등록 이력을 불러오지 못했습니다.',
    );
  }

  return json;
}

function isRenderableImageUrl(value?: string | null) {
  if (!value) return false;
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('/uploads/');
}

function safeDate(value: unknown) {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function getReviewStatusLabel(status?: string | null) {
  switch (status) {
    case 'REVIEWED':
      return '검수 완료';
    case 'NEEDS_CORRECTION':
      return '수정 필요';
    case 'REJECTED':
      return '반려';
    case 'PENDING_REVIEW':
    default:
      return '검수 대기';
  }
}

function getReviewStatusBadgeClass(status?: string | null) {
  switch (status) {
    case 'REVIEWED':
      return 'bg-emerald-50 text-emerald-700 ring-emerald-200';
    case 'NEEDS_CORRECTION':
      return 'bg-amber-50 text-amber-700 ring-amber-200';
    case 'REJECTED':
      return 'bg-rose-50 text-rose-700 ring-rose-200';
    case 'PENDING_REVIEW':
    default:
      return 'bg-slate-100 text-slate-700 ring-slate-200';
  }
}

function reviewNotePreviewClass(status?: string | null) {
  switch (status) {
    case 'REJECTED':
      return 'bg-rose-50 text-rose-800';
    case 'NEEDS_CORRECTION':
    default:
      return 'bg-amber-50 text-amber-800';
  }
}

function getLatestReviewSummary(item: any) {
  const latestHistory = Array.isArray(item?.reviewHistories)
    ? item.reviewHistories[0]
    : null;

  if (latestHistory) {
    return {
      at: latestHistory.createdAt ?? null,
      note: latestHistory.reviewNote ?? null,
      status: latestHistory.newStatus ?? item?.reviewStatus ?? null,
      reviewer:
        latestHistory?.reviewedBy?.name ??
        latestHistory?.reviewedBy?.email ??
        null,
    };
  }

  return {
    at: item?.reviewedAt ?? null,
    note: item?.reviewNote ?? null,
    status: item?.reviewStatus ?? null,
    reviewer:
      item?.reviewedBy?.name ??
      item?.reviewedBy?.email ??
      null,
  };
}

function buildStats(items: any[]) {
  const total = items.length;

  return {
    total,
    pendingReview: items.filter((item) => item?.reviewStatus === 'PENDING_REVIEW' || !item?.reviewStatus).length,
    reviewed: items.filter((item) => item?.reviewStatus === 'REVIEWED').length,
    needsCorrection: items.filter((item) => item?.reviewStatus === 'NEEDS_CORRECTION').length,
    rejected: items.filter((item) => item?.reviewStatus === 'REJECTED').length,
    ocrMismatch: items.filter((item) => item?.ocrMismatch).length,
    lowConfidence: items.filter((item) => item?.ocrLowConfidence).length,
    corrected: items.filter((item) => item?.correctedAt || item?.correctedVehiclePlateNumber).length,
  };
}


function confidenceText(value: unknown) {
  if (typeof value !== 'number') return '-';
  return `${Math.round(value * 100)}%`;
}

function todayLocalDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60 * 1000).toISOString().slice(0, 10);
}

export default function RegistrationProxyLogsPage({ role }: Props) {
  const [items, setItems] = useState<any[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [keyword, setKeyword] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [plate, setPlate] = useState('');
  const [registrar, setRegistrar] = useState('');
  const [parkingLotId, setParkingLotId] = useState('');
  const [reviewStatus, setReviewStatus] = useState('');
  const [lowConfidenceOnly, setLowConfidenceOnly] = useState(false);
  const [mismatchOnly, setMismatchOnly] = useState(false);

  const apiPath =
    role === 'admin'
      ? '/admin/registration-proxy-logs'
      : '/manager/registration-proxy-logs';



  function buildParams() {
    const params = new URLSearchParams();

    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (plate) params.set('plate', plate);
    if (parkingLotId) params.set('parkingLotId', parkingLotId);
    if (registrar) params.set('registrar', registrar);
    if (reviewStatus) params.set('reviewStatus', reviewStatus);
    if (lowConfidenceOnly) params.set('lowConfidenceOnly', 'true');
    if (mismatchOnly) params.set('mismatchOnly', 'true');

    return params;
  }

  async function downloadCsv() {
    try {
      const params = buildParams();

      const path =
        role === 'admin'
          ? `/admin/registration-proxy-logs/export.csv?${params.toString()}`
          : `/manager/registration-proxy-logs/export.csv?${params.toString()}`;

      const token = getToken();

      const res = await fetch(`${API_BASE}${path}`, {
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'CSV 다운로드에 실패했습니다.');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const stamp = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0'),
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0'),
      ].join('');

      const link = document.createElement('a');
      link.href = url;
      link.download = `authority-registrations-${role}-${stamp}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err?.message ?? 'CSV 다운로드에 실패했습니다.');
    }
  }

  async function load() {
    setLoading(true);

    try {
      const params = new URLSearchParams();

      if (from) params.set('from', `${from}T00:00:00.000Z`);
      if (to) params.set('to', `${to}T23:59:59.999Z`);
      if (plate) params.set('plate', plate);
    if (parkingLotId) params.set('parkingLotId', parkingLotId);
      if (registrar) params.set('registrar', registrar);
      if (reviewStatus) params.set('reviewStatus', reviewStatus);
      if (lowConfidenceOnly) params.set('lowConfidenceOnly', 'true');
      if (mismatchOnly) params.set('mismatchOnly', 'true');

      const suffix = params.toString() ? `?${params.toString()}` : '';
      const json = await apiFetch(`${apiPath}${suffix}`);

      setItems(Array.isArray(json) ? json : []);
      setMessage(null);
    } catch (err: any) {
      setItems([]);
      setMessage(err?.message ?? '직권 등록 이력을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiPath]);

  const filtered = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return items;

    return items.filter((item) => {
      const haystack = [
        item?.vehiclePlateNumber,
        item?.contactPhone,
        item?.parkingLot?.name,
        item?.parkingSpace?.code,
        item?.performedBy?.email,
        item?.performedBy?.name,
        item?.ocr?.suggestedPlateNumber,
        item?.ocr?.reviewedPlateNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [items, keyword]);

  function setToday() {
    const today = todayLocalDate();
    setFrom(today);
    setTo(today);
  }

  function clearFilters() {
    setKeyword('');
    setFrom('');
    setTo('');
    setPlate('');
    setRegistrar('');
    setParkingLotId('');
    setReviewStatus('');
    setLowConfidenceOnly(false);
    setMismatchOnly(false);
  }

  const parkingLotOptions = Array.from(
    new Map(
      items
        .map((item) => item?.parkingLot)
        .filter((lot) => lot?.id)
        .map((lot) => [lot.id, lot]),
    ).values(),
  );

  const stats = buildStats(filtered);

  return (
    <main className="min-h-screen w-full max-w-none bg-slate-50 px-6 py-6">
      <section className="w-full max-w-none">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">
              {role === 'admin' ? 'ADMIN' : 'MANAGER'}
            </p>
            <h1 className="mt-2 text-3xl font-bold">직권 등록 이력</h1>
            <p className="mt-2 text-sm text-slate-500">
              Watcher가 직권으로 등록한 차량, 차량번호 사진, OCR 결과를 확인합니다.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={load}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
            >
              조회
            </button>

            <button
              onClick={downloadCsv}
              className="rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white"
            >
              CSV 다운로드
            </button>
          </div>
        </div>

        <div className="mt-5 rounded-3xl bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-5">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="화면 내 빠른 검색"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <input
              value={plate}
              onChange={(event) => setPlate(event.target.value)}
              placeholder="차량번호"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <input
              value={registrar}
              onChange={(event) => setRegistrar(event.target.value)}
              placeholder="등록자 이름/이메일/전화"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
            />

            <select
              value={parkingLotId}
              onChange={(event) => setParkingLotId(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-500"
            >
              <option value="">전체 주차장</option>
              {parkingLotOptions.map((lot: any) => (
                <option key={lot.id} value={lot.id}>
                  {lot.name ?? lot.code ?? lot.id}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={setToday}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"
              >
                오늘
              </button>
              <button
                onClick={clearFilters}
                className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold"
              >
                초기화
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-5">
            <label className="block">
              <span className="text-xs font-semibold text-slate-400">검수 상태</span>
              <select
                value={reviewStatus}
                onChange={(event) => setReviewStatus(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
              >
                <option value="">전체 검수 상태</option>
                <option value="PENDING_REVIEW">검수 대기</option>
                <option value="REVIEWED">검수 완료</option>
                <option value="NEEDS_CORRECTION">수정 필요</option>
                <option value="REJECTED">반려</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-400">시작일</span>
              <input
                type="date"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold text-slate-400">종료일</span>
              <input
                type="date"
                value={to}
                onChange={(event) => setTo(event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
              />
            </label>

            <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={lowConfidenceOnly}
                onChange={(event) => setLowConfidenceOnly(event.target.checked)}
              />
              OCR 신뢰도 낮음
            </label>

            <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={mismatchOnly}
                onChange={(event) => setMismatchOnly(event.target.checked)}
              />
              OCR/최종 차번 다름
            </label>
          </div>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-600">
            {message}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
          <p>{loading ? '불러오는 중...' : `총 ${filtered.length}건`}</p>
          <p>직권 등록 결과를 조회합니다.</p>
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold">검수/정정 요약</p>
              <p className="mt-1 text-xs text-slate-500">
                현재 조회 조건에 해당하는 직권 등록 이력 기준입니다.
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="총 직권 등록" value={stats.total} />
            <StatCard label="검수 대기" value={stats.pendingReview} />
            <StatCard label="검수 완료" value={stats.reviewed} />
            <StatCard label="수정 필요" value={stats.needsCorrection} />
            <StatCard label="반려" value={stats.rejected} />
            <StatCard label="OCR 불일치" value={stats.ocrMismatch} />
            <StatCard label="낮은 신뢰도" value={stats.lowConfidence} />
            <StatCard label="정정 처리" value={stats.corrected} />
          </div>
        </div>

        <div className="mt-5 space-y-4">
          {!loading && filtered.length === 0 ? (
            <div className="rounded-3xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              직권 등록 이력이 없습니다.
            </div>
          ) : null}

          {filtered.map((item, index) => {
            const imageUrl = item?.imageUrl;
            const ocr = item?.ocr;
            const detailHref =
              role === 'admin'
                ? `/admin/authority-registrations/${item?.id}`
                : `/manager/authority-registrations/${item?.id}`;

            return (
              <article key={item?.id ?? index} className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="grid gap-5 md:grid-cols-[180px_1fr]">
                  <div>
                    {isRenderableImageUrl(imageUrl) ? (
                      <a href={imageUrl} target="_blank" rel="noreferrer">
                        <img
                          src={imageUrl}
                          alt="차량번호 사진"
                          className="h-36 w-full rounded-2xl object-cover"
                        />
                      </a>
                    ) : (
                      <div className="flex h-36 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
                        사진 없음
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-2xl font-bold">{item?.vehiclePlateNumber ?? '-'}</p>
                          {item?.ocrMismatch && (
                            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
                              OCR 불일치
                            </span>
                          )}
                          {item?.ocrLowConfidence && (
                            <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                              낮은 신뢰도
                            </span>
                          )}
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ring-1 ${getReviewStatusBadgeClass(
                              item?.reviewStatus,
                            )}`}
                          >
                            {getReviewStatusLabel(item?.reviewStatus)}
                          </span>
                        </div>

                        <p className="mt-1 text-sm text-slate-500">
                          {item?.parkingLot?.name ?? '-'} · {item?.parkingSpace?.code ?? '-'}
                        </p>

                        {['NEEDS_CORRECTION', 'REJECTED'].includes(item?.reviewStatus) && item?.reviewNote ? (
                          <p className={`mt-2 line-clamp-2 rounded-2xl px-3 py-2 text-xs font-semibold ${reviewNotePreviewClass(item?.reviewStatus)}`}>
                            검수 사유: {item.reviewNote}
                          </p>
                        ) : null}

                        {(() => {
                          const latestReview = getLatestReviewSummary(item);
                          return latestReview.at || latestReview.note ? (
                            <div className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                              {latestReview.at ? (
                                <p>
                                  <span className="font-bold text-slate-600">최근 검수:</span>{' '}
                                  {safeDate(latestReview.at)}
                                  {latestReview.reviewer ? ` · ${latestReview.reviewer}` : ''}
                                </p>
                              ) : null}
                              {latestReview.note ? (
                                <p className="mt-1 line-clamp-2">
                                  <span className="font-bold text-slate-600">메모:</span>{' '}
                                  {latestReview.note}
                                </p>
                              ) : null}
                            </div>
                          ) : null;
                        })()}

                        <a
                          href={detailHref}
                          className="mt-2 inline-block text-sm font-bold text-blue-600"
                        >
                          상세 보기
                        </a>
                        <p className="mt-1 text-xs text-slate-400">
                          {safeDate(item?.createdAt)}
                        </p>
                      </div>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                        {item?.performedByRole ?? '-'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">직권 등록자</p>
                        <p className="mt-1 text-sm font-semibold">
                          {item?.performedBy?.name ?? item?.performedBy?.email ?? '-'}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">연락처</p>
                        <p className="mt-1 text-sm font-semibold">{item?.contactPhone ?? '-'}</p>
                      </div>

                      <div className="rounded-2xl bg-slate-50 p-3">
                        <p className="text-xs text-slate-400">세션</p>
                        <p className="mt-1 text-sm font-semibold">
                          {item?.parkingSession?.sessionNo ?? '-'}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-100 p-4">
                      <p className="text-sm font-bold">OCR 결과</p>

                      {ocr ? (
                        <div className="mt-3 grid gap-3 md:grid-cols-4">
                          <div>
                            <p className="text-xs text-slate-400">Provider</p>
                            <p className="text-sm font-semibold">{ocr?.provider ?? '-'}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">추천 차번</p>
                            <p className="text-sm font-semibold">
                              {ocr?.suggestedPlateNumber ?? '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">최종 차번</p>
                            <p className="text-sm font-semibold">
                              {ocr?.reviewedPlateNumber ?? item?.vehiclePlateNumber ?? '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Confidence</p>
                            <p className="text-sm font-semibold">
                              {confidenceText(ocr?.confidence)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          OCR 결과가 없습니다. 사진 업로드 없이 수동 등록되었거나 이전 데이터입니다.
                        </p>
                      )}
                    </div>

                    {item?.note && (
                      <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">
                        메모: {item.note}
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
