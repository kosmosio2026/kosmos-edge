'use client';

import { getPublicApiBaseUrl } from '@/lib/public-config';
import { useEffect, useState } from 'react';

const API_BASE =
  getPublicApiBaseUrl();

type Props = {
  role: 'admin' | 'manager';
  id: string;
};

function getToken() {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('kosmos.consoleAccessToken') ??
    localStorage.getItem('kosmos.accessToken') ??
    ''
  );
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

function confidenceText(value: unknown) {
  if (typeof value !== 'number') return '-';
  return `${Math.round(value * 100)}%`;
}

function reviewStatusLabel(status?: string | null) {
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


function buildTimelineItems(item: any) {
  const timelineItems: Array<{
    key: string;
    title: string;
    description?: string;
    at?: string | null;
  }> = [];

  if (item?.createdAt) {
    timelineItems.push({
      key: 'created',
      title: '직권 등록 생성',
      description: `${item?.performedBy?.name ?? '등록자'}가 직권 등록을 생성했습니다.`,
      at: item.createdAt,
    });
  }

  const latestOcr = item?.latestOcr ?? item?.ocrResults?.[0];

  if (latestOcr?.createdAt) {
    timelineItems.push({
      key: 'ocr',
      title: '차량번호 OCR 처리',
      description: `추천 차량번호: ${latestOcr?.suggestedPlateNumber ?? '-'} · 신뢰도: ${confidenceText(latestOcr?.confidence)}`,
      at: latestOcr.createdAt,
    });
  }

  const reviewHistories = Array.isArray(item?.reviewHistories)
    ? item.reviewHistories
    : [];

  if (reviewHistories.length) {
    for (const history of reviewHistories) {
      timelineItems.push({
        key: `review-${history.id}`,
        title: `검수 상태 변경: ${reviewStatusLabel(history?.previousStatus)} → ${reviewStatusLabel(history?.newStatus)}`,
        description: [
          history?.reviewedBy?.name || history?.reviewedBy?.email
            ? `처리자: ${history?.reviewedBy?.name ?? history?.reviewedBy?.email}`
            : null,
          history?.reviewNote ? `메모: ${history.reviewNote}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        at: history?.createdAt,
      });
    }
  } else if (item?.reviewedAt) {
    timelineItems.push({
      key: 'reviewed',
      title: `검수 상태 저장: ${reviewStatusLabel(item?.reviewStatus)}`,
      description: item?.reviewNote ? `검수 메모: ${item.reviewNote}` : undefined,
      at: item.reviewedAt,
    });
  }

  if (item?.correctedAt) {
    timelineItems.push({
      key: 'corrected',
      title: '정정 저장',
      description: [
        item?.correctedVehiclePlateNumber ? `차량번호: ${item.correctedVehiclePlateNumber}` : null,
        item?.correctedContactPhone ? `연락처: ${item.correctedContactPhone}` : null,
        item?.correctionNote ? `메모: ${item.correctionNote}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      at: item.correctedAt,
    });
  }

  for (const history of item?.correctionHistories ?? []) {
    timelineItems.push({
      key: `history-${history.id}`,
      title: '정정 이력',
      description: [
        history?.previousPlateNumber || history?.newPlateNumber
          ? `${history?.previousPlateNumber ?? '-'} → ${history?.newPlateNumber ?? '-'}`
          : null,
        history?.previousContactPhone || history?.newContactPhone
          ? `${history?.previousContactPhone ?? '-'} → ${history?.newContactPhone ?? '-'}`
          : null,
        history?.correctionNote ? `메모: ${history.correctionNote}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      at: history?.createdAt,
    });
  }

  return timelineItems.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });
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

    throw new Error(json?.message ?? text ?? '직권 등록 상세를 불러오지 못했습니다.');
  }

  return json;
}

export default function AuthorityRegistrationDetailPage({ role, id }: Props) {
  const [item, setItem] = useState<any>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [reviewStatus, setReviewStatus] = useState('PENDING_REVIEW');
  const [reviewNote, setReviewNote] = useState('');
  const [savingReview, setSavingReview] = useState(false);

  const [correctionPlateNumber, setCorrectionPlateNumber] = useState('');
  const [correctionContactPhone, setCorrectionContactPhone] = useState('');
  const [correctionNote, setCorrectionNote] = useState('');
  const [savingCorrection, setSavingCorrection] = useState(false);

  const path =
    role === 'admin'
      ? `/admin/registration-proxy-logs/${id}`
      : `/manager/registration-proxy-logs/${id}`;

  const backHref =
    role === 'admin'
      ? '/admin/authority-registrations'
      : '/manager/authority-registrations';

  async function load() {
    setLoading(true);

    try {
      const json = await apiFetch(path);

      setItem(json);
      setReviewStatus(json?.reviewStatus ?? 'PENDING_REVIEW');
      setReviewNote(json?.reviewNote ?? '');
      setCorrectionPlateNumber(
        json?.correctedVehiclePlateNumber ?? json?.vehiclePlateNumber ?? '',
      );
      setCorrectionContactPhone(
        json?.correctedContactPhone ?? json?.contactPhone ?? '',
      );
      setCorrectionNote(json?.correctionNote ?? '');
      setMessage(null);
    } catch (err: any) {
      setItem(null);
      setMessage(err?.message ?? '직권 등록 상세를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function saveReview() {
    setSavingReview(true);

    try {
      const reviewPath =
        role === 'admin'
          ? `/admin/registration-proxy-logs/${id}/review`
          : `/manager/registration-proxy-logs/${id}/review`;

      const token = getToken();

      const res = await fetch(`${API_BASE}${reviewPath}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          reviewStatus,
          reviewNote,
        }),
      });

      const text = await res.text();
      let json: any = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(json?.message ?? text ?? '검수 상태 저장에 실패했습니다.');
      }

      setItem(json);
      setReviewStatus(json?.reviewStatus ?? 'PENDING_REVIEW');
      setReviewNote(json?.reviewNote ?? '');
      setMessage('검수 상태가 저장되었습니다.');
    } catch (err: any) {
      setMessage(err?.message ?? '검수 상태 저장에 실패했습니다.');
    } finally {
      setSavingReview(false);
    }
  }

  async function saveCorrection() {
    setSavingCorrection(true);

    try {
      const correctionPath =
        role === 'admin'
          ? `/admin/registration-proxy-logs/${id}/correct`
          : `/manager/registration-proxy-logs/${id}/correct`;

      const token = getToken();

      const res = await fetch(`${API_BASE}${correctionPath}`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          vehiclePlateNumber: correctionPlateNumber,
          contactPhone: correctionContactPhone,
          correctionNote,
        }),
      });

      const text = await res.text();
      let json: any = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        throw new Error(json?.message ?? text ?? '정정 저장에 실패했습니다.');
      }

      setItem(json);
      setReviewStatus(json?.reviewStatus ?? 'REVIEWED');
      setReviewNote(json?.reviewNote ?? '');
      setCorrectionPlateNumber(
        json?.correctedVehiclePlateNumber ?? json?.vehiclePlateNumber ?? '',
      );
      setCorrectionContactPhone(
        json?.correctedContactPhone ?? json?.contactPhone ?? '',
      );
      setCorrectionNote(json?.correctionNote ?? '');
      setMessage('직권 등록 정보가 정정되었습니다.');
    } catch (err: any) {
      setMessage(err?.message ?? '정정 저장에 실패했습니다.');
    } finally {
      setSavingCorrection(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  const timelineItems = buildTimelineItems(item);
  const imageUrl = item?.imageUrl;
  const latestOcr = item?.latestOcr;
  const ocrResults = Array.isArray(item?.ocrResults) ? item.ocrResults : [];
  const photos = Array.isArray(item?.photos) ? item.photos : [];
  const correctionHistories = Array.isArray(item?.correctionHistories) ? item.correctionHistories : [];

  return (
    <main className="min-h-screen w-full max-w-none bg-slate-50 px-6 py-6">
      <section className="w-full max-w-none">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <a href={backHref} className="text-sm font-bold text-blue-600">
              ← 직권 등록 이력
            </a>
            <h1 className="mt-3 text-3xl font-bold">직권 등록 상세</h1>
            <p className="mt-2 text-sm text-slate-500">
              차량번호 사진, OCR 결과, 주차 현황, 직권 등록자, 검수/정정 상태를 확인합니다.
            </p>
          </div>

          <button
            onClick={load}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
          >
            새로고침
          </button>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">
            {message}
          </div>
        )}

        {loading && (
          <div className="mt-5 rounded-3xl bg-white p-8 text-center text-sm text-slate-500">
            불러오는 중...
          </div>
        )}

        {!loading && !item && (
          <div className="mt-5 rounded-3xl bg-white p-8 text-center text-sm text-slate-500">
            직권 등록 상세를 찾을 수 없습니다.
          </div>
        )}

        {item && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[420px_1fr]">
            <section className="space-y-4">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-sm font-bold">차량번호 사진</p>

                <div className="mt-4">
                  {isRenderableImageUrl(imageUrl) ? (
                    <a href={imageUrl} target="_blank" rel="noreferrer">
                      <img
                        src={imageUrl}
                        alt="차량번호 사진"
                        className="max-h-[520px] w-full rounded-2xl object-contain"
                      />
                    </a>
                  ) : (
                    <div className="rounded-2xl bg-slate-100 p-8 text-center text-sm text-slate-500">
                      표시 가능한 이미지가 없습니다.
                      {imageUrl && (
                        <p className="mt-3 break-all text-xs text-slate-400">
                          저장된 URL: {imageUrl}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-sm font-bold">사진 기록</p>

                <div className="mt-3 space-y-2">
                  {photos.length === 0 ? (
                    <p className="text-sm text-slate-500">사진 기록이 없습니다.</p>
                  ) : (
                    photos.map((photo: any) => (
                      <div key={photo.id} className="rounded-2xl bg-slate-50 p-3 text-sm">
                        <p className="font-semibold">{safeDate(photo.createdAt)}</p>
                        <p className="mt-1 break-all text-xs text-slate-500">
                          {photo.imageUrl}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-3xl font-bold">{item.vehiclePlateNumber ?? '-'}</h2>

                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {reviewStatusLabel(item.reviewStatus)}
                  </span>

                  {item.ocrMismatch && (
                    <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-600">
                      OCR 불일치
                    </span>
                  )}

                  {item.ocrLowConfidence && (
                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">
                      낮은 신뢰도
                    </span>
                  )}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <Info label="주차장" value={item.parkingLot?.name} />
                  <Info label="주차면" value={item.parkingSpace?.code} />
                  <Info label="구역" value={item.parkingSection?.name ?? item.parkingSection?.code} />
                  <Info label="연락처" value={item.contactPhone} />
                  <Info label="직권 등록자" value={item.performedBy?.name ?? item.performedBy?.email} />
                  <Info label="직권 등록 시간" value={safeDate(item.createdAt)} />
                  <Info label="정정 차량번호" value={item.correctedVehiclePlateNumber} />
                  <Info label="정정 시간" value={safeDate(item.correctedAt)} />
                </div>

                {item.note && (
                  <div className="mt-4 rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">
                    메모: {item.note}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-sm font-bold">검수 상태</p>
                <p className="mt-1 text-xs text-slate-500">
                  검수 완료는 최종 승인, 수정 필요은 보완 요청, 반려는 무효 처리입니다. 차량번호나 연락처만 다른 경우에는 아래 정정 저장을 사용하세요.
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">상태</span>
                    <select
                      value={reviewStatus}
                      onChange={(event) => setReviewStatus(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      <option value="PENDING_REVIEW">검수 대기</option>
                      <option value="REVIEWED">검수 완료</option>
                      <option value="NEEDS_CORRECTION">수정 필요</option>
                      <option value="REJECTED">반려</option>
                    </select>
                  </label>

                  <Info label="검수 시간" value={safeDate(item.reviewedAt)} />
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-semibold text-slate-400">검수 메모</span>
                  <textarea
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    placeholder="수정 필요 또는 반려 사유를 입력하세요. 검수 완료 시에는 내부 메모로 사용할 수 있습니다."
                  />
                </label>

                <button
                  onClick={saveReview}
                  disabled={savingReview}
                  className="mt-4 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {savingReview ? '저장 중...' : '검수 상태 저장'}
                </button>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-sm font-bold">정정 처리</p>
                <p className="mt-1 text-xs text-slate-500">
                  OCR 오인식 또는 직권 등록 오류가 있으면 최종 차량번호와 연락처를 정정합니다.
                </p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">최종 차량번호</span>
                    <input
                      value={correctionPlateNumber}
                      onChange={(event) => setCorrectionPlateNumber(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      placeholder="예: 44라4444"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-semibold text-slate-400">연락처</span>
                    <input
                      value={correctionContactPhone}
                      onChange={(event) => setCorrectionContactPhone(event.target.value)}
                      className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                      placeholder="예: 01012345678"
                    />
                  </label>
                </div>

                <label className="mt-4 block">
                  <span className="text-xs font-semibold text-slate-400">정정 메모</span>
                  <textarea
                    value={correctionNote}
                    onChange={(event) => setCorrectionNote(event.target.value)}
                    rows={3}
                    className="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
                    placeholder="정정 사유를 입력하세요."
                  />
                </label>

                <button
                  onClick={saveCorrection}
                  disabled={savingCorrection}
                  className="mt-4 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                >
                  {savingCorrection ? '저장 중...' : '정정 저장 후 검수 완료'}
                </button>

                {item.correctedAt && (
                  <div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">
                    마지막 정정 시간: {safeDate(item.correctedAt)}
                  </div>
                )}
              </div>

          <div className="rounded-3xl bg-white p-5 shadow-sm">
            <p className="text-sm font-bold">검수 상태 변경 이력</p>
            <p className="mt-1 text-xs text-slate-500">
              검수 상태가 언제, 누구에 의해, 어떤 사유로 변경됐는지 확인합니다.
            </p>

            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-100">
              {Array.isArray(item?.reviewHistories) && item.reviewHistories.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-sm">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-4 py-3 text-left">변경일시</th>
                        <th className="px-4 py-3 text-left">이전 상태</th>
                        <th className="px-4 py-3 text-left">변경 상태</th>
                        <th className="px-4 py-3 text-left">처리자</th>
                        <th className="px-4 py-3 text-left">메모</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {item.reviewHistories.map((history: any) => (
                        <tr key={history.id}>
                          <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-500">
                            {safeDate(history.createdAt)}
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                              {reviewStatusLabel(history.previousStatus)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3">
                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                              {reviewStatusLabel(history.newStatus)}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {history?.reviewedBy?.name ?? history?.reviewedBy?.email ?? '-'}
                          </td>
                          <td className="min-w-[220px] px-4 py-3 text-xs text-slate-500">
                            {history.reviewNote ?? '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="bg-slate-50 p-4 text-sm text-slate-500">
                  검수 상태 변경 이력이 없습니다.
                </div>
              )}
            </div>
          </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-sm font-bold">정정 이력</p>

                {correctionHistories.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">정정 이력이 없습니다.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {correctionHistories.map((history: any) => (
                      <div key={history.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                        <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <p className="font-bold">
                            {history.previousPlateNumber ?? '-'} → {history.newPlateNumber ?? '-'}
                          </p>
                          <p className="text-xs text-slate-400">
                            {safeDate(history.createdAt)}
                          </p>
                        </div>

                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <Info label="이전 연락처" value={history.previousContactPhone} />
                          <Info label="새 연락처" value={history.newContactPhone} />
                          <Info label="정정자" value={history.correctedBy?.name ?? history.correctedBy?.email} />
                          <Info label="정정 메모" value={history.correctionNote} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-sm font-bold">주차 현황</p>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Info label="세션 번호" value={item.parkingSession?.sessionNo} />
                  <Info label="상태" value={item.parkingSession?.status} />
                  <Info label="입차 시간" value={safeDate(item.parkingSession?.entryTime)} />
                  <Info label="출차 시간" value={safeDate(item.parkingSession?.exitTime)} />
                  <Info label="등록 상태" value={item.parkingSession?.registrationStatus} />
                  <Info label="등록 방식" value={item.parkingSession?.registrationMethod} />
                </div>
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-sm font-bold">OCR 결과</p>

                {latestOcr ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <Info label="Provider" value={latestOcr.provider} />
                    <Info label="Mode" value={latestOcr.mode} />
                    <Info label="국가" value={latestOcr.country} />
                    <Info label="Confidence" value={confidenceText(latestOcr.confidence)} />
                    <Info label="OCR 추천 차번" value={latestOcr.suggestedPlateNumber} />
                    <Info label="최종 차번" value={latestOcr.reviewedPlateNumber ?? item.vehiclePlateNumber} />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">OCR 결과가 없습니다.</p>
                )}
              </div>

              <div className="rounded-3xl bg-white p-5 shadow-sm">
                <p className="text-sm font-bold">OCR Candidates / Raw Response</p>

                {ocrResults.length === 0 ? (
                  <p className="mt-3 text-sm text-slate-500">OCR 기록이 없습니다.</p>
                ) : (
                  <div className="mt-4 space-y-3">
                    {ocrResults.map((ocr: any) => (
                      <details key={ocr.id} className="rounded-2xl bg-slate-50 p-4 text-sm">
                        <summary className="cursor-pointer font-bold">
                          {ocr.suggestedPlateNumber} · {confidenceText(ocr.confidence)} · {safeDate(ocr.createdAt)}
                        </summary>

                        <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-950 p-4 text-xs text-white">
                          {JSON.stringify(
                            {
                              candidates: ocr.candidates,
                              rawResponse: ocr.rawResponse,
                            },
                            null,
                            2,
                          )}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold">{value ?? '-'}</p>
    </div>
  );
}
