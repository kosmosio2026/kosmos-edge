"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:3000/api";

type ParkingLot = {
  id?: string;
  parkingLotId?: string;
  lotId?: string;
  name?: string | null;
  parkingLotName?: string | null;
  lotName?: string | null;
  code?: string | null;
  region?: string | null;
  district?: string | null;
  sido?: string | null;
  sigungu?: string | null;
  address?: string | null;
};

type ParkingSection = {
  id?: string;
  sectionId?: string;
  parkingLotId?: string | null;
  lotId?: string | null;
  code?: string | null;
  name?: string | null;
  sectionName?: string | null;
};

type RequestItem = {
  id: string;
  status: string;
  parkingLotId?: string | null;
  requestedParkingLotId?: string | null;
  requestedParkingLotName?: string | null;
  parkingLotName?: string | null;
  lotName?: string | null;
  sectionId?: string | null;
  requestedSectionId?: string | null;
  requestedSectionName?: string | null;
  sectionName?: string | null;
  sectionCode?: string | null;
  note?: string | null;
  memo?: string | null;
  createdAt?: string | null;
  parkingLot?: {
    name?: string | null;
  } | null;
  section?: {
    code?: string | null;
    name?: string | null;
  } | null;
};

function unwrapArray(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.parkingLots)) return data.parkingLots;
  if (Array.isArray(data?.sections)) return data.sections;
  return [];
}

function getLotId(lot: ParkingLot) {
  return lot.id ?? lot.parkingLotId ?? lot.lotId ?? "";
}

function getSectionId(section: ParkingSection) {
  return section.id ?? section.sectionId ?? "";
}

function getLotName(lot: ParkingLot) {
  return (
    lot.name ??
    lot.parkingLotName ??
    lot.lotName ??
    lot.code ??
    lot.address ??
    "이름 없는 주차장"
  );
}

function getLotLabel(lot: ParkingLot) {
  const name = getLotName(lot);
  const code = lot.code;
  const region = lot.region ?? lot.sido ?? "";
  const district = lot.district ?? lot.sigungu ?? "";
  const area = [region, district].filter(Boolean).join(" ");

  return `${name}${code && code !== name ? ` (${code})` : ""}${area ? ` - ${area}` : ""}`;
}

function getSectionLabel(section: ParkingSection) {
  const code = section.code ?? "";
  const name = section.name ?? section.sectionName ?? "";
  if (code && name) return `${code} - ${name}`;
  return code || name || "이름 없는 구역";
}

function getRequestLotLabel(request: RequestItem) {
  return (
    request.parkingLot?.name ??
    request.requestedParkingLotName ??
    request.parkingLotName ??
    request.lotName ??
    request.requestedParkingLotId ??
    request.parkingLotId ??
    "-"
  );
}

function getRequestSectionLabel(request: RequestItem) {
  const relationName = request.section?.name ?? null;
  const relationCode = request.section?.code ?? null;

  if (relationCode && relationName) return `${relationCode} - ${relationName}`;

  return (
    relationName ??
    relationCode ??
    request.requestedSectionName ??
    request.sectionName ??
    request.sectionCode ??
    request.requestedSectionId ??
    request.sectionId ??
    "-"
  );
}


function getRequestStatusBadge(status?: string | null) {
  switch (status) {
    case 'APPROVED':
      return {
        label: '승인',
        className: 'bg-emerald-50 text-emerald-700',
      };
    case 'REJECTED':
      return {
        label: '반려',
        className: 'bg-red-50 text-red-700',
      };
    case 'PENDING':
    case 'REQUESTED':
      return {
        label: '대기',
        className: 'bg-amber-50 text-amber-700',
      };
    default:
      return {
        label: status ?? '-',
        className: 'bg-slate-100 text-slate-600',
      };
  }
}

function isPendingRequest(status?: string | null) {
  const normalized = String(status ?? '').toUpperCase();
  return normalized === 'PENDING' || normalized === 'REQUESTED';
}

function formatShortDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

async function fetchPublicParkingLots(): Promise<ParkingLot[]> {
  const res = await fetch(`${API_BASE}/public/parking-lots`, {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("주차장 목록을 불러오지 못했습니다.");
  }

  const data = await res.json();
  return unwrapArray(data);
}

async function fetchPublicSections(
  parkingLotId: string,
): Promise<ParkingSection[]> {
  if (!parkingLotId) return [];

  const res = await fetch(
    `${API_BASE}/public/parking-lots/${parkingLotId}/sections`,
    {
      cache: "no-store",
    },
  );

  if (!res.ok) {
    throw new Error("주차 구역 목록을 불러오지 못했습니다.");
  }

  const data = await res.json();
  return unwrapArray(data);
}

export default function OperatorSectionRequestsPage() {
  const { session } = useAuth();

  const [lots, setLots] = useState<ParkingLot[]>([]);
  const [sections, setSections] = useState<ParkingSection[]>([]);
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [parkingLotId, setParkingLotId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [withdrawingId, setWithdrawingId] = useState("");

  const selectedLot = useMemo(
    () => lots.find((lot) => getLotId(lot) === parkingLotId) ?? null,
    [lots, parkingLotId],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setMessage("");

    try {
      const [lotData, requestData] = await Promise.all([
        fetchPublicParkingLots(),
        apiFetch<RequestItem[]>("/approval/operator/section-requests/my", {
          accessToken: session.accessToken,
        }),
      ]);

      setLots(Array.isArray(lotData) ? lotData : []);
      setRequests(Array.isArray(requestData) ? requestData : []);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSectionId("");
    setSections([]);

    if (!parkingLotId) return;

    let alive = true;
    setLoadingSections(true);
    setMessage("");

    fetchPublicSections(parkingLotId)
      .then((data) => {
        if (!alive) return;
        setSections(data);
      })
      .catch((error) => {
        if (!alive) return;
        setMessage(
          error instanceof Error
            ? error.message
            : "주차 구역 목록을 불러오지 못했습니다.",
        );
      })
      .finally(() => {
        if (!alive) return;
        setLoadingSections(false);
      });

    return () => {
      alive = false;
    };
  }, [parkingLotId]);

  async function withdrawRequest(requestId: string) {
    if (!session?.accessToken || !requestId) return;

    const ok = window.confirm("이 구역 권한 신청을 철회하시겠습니까?");
    if (!ok) return;

    setWithdrawingId(requestId);
    setMessage("");

    try {
      await apiFetch(`/approval/operator-section-requests/${requestId}`, {
        accessToken: session.accessToken,
        method: "DELETE",
      });

      setMessage("신청을 철회했습니다.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "신청 철회에 실패했습니다.",
      );
    } finally {
      setWithdrawingId("");
    }
  }

  async function submit() {
    if (!session?.accessToken) return;

    if (!parkingLotId || !sectionId) {
      setMessage("주차장과 주차 구역을 선택하세요.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      await apiFetch("/approval/operator-sections", {
        accessToken: session.accessToken,
        method: "POST",
        body: JSON.stringify({
          parkingLotId,
          sectionId,
          note,
        }),
      });

      setMessage("주차 구역 권한 신청이 완료되었습니다.");
      setNote("");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "신청에 실패했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-6 p-6">
      <div className="grid gap-6 xl:grid-cols-[460px_minmax(0,1fr)]">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <p className="text-sm font-medium text-blue-600">
              Operator Request
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">
              주차 구역 권한 신청
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              운영자가 담당할 주차장과 주차 구역을 선택해 권한을 신청합니다.
            </p>
          </div>

          <div className="grid gap-4">
            <label className="min-w-0 flex flex-col gap-2 text-sm font-medium text-slate-700">
              주차장
              <select
                value={parkingLotId}
                onChange={(event) => setParkingLotId(event.target.value)}
                className="w-full min-w-0 truncate rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">주차장 선택</option>
                {lots.map((lot, index) => {
                  const id = getLotId(lot);
                  return (
                    <option key={id || index} value={id}>
                      {getLotLabel(lot)}
                    </option>
                  );
                })}
              </select>
            </label>

            <label className="min-w-0 flex flex-col gap-2 text-sm font-medium text-slate-700">
              주차 구역
              <select
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
                disabled={!parkingLotId || loadingSections}
                className="w-full min-w-0 truncate rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
              >
                <option value="">
                  {loadingSections
                    ? "구역 불러오는 중..."
                    : parkingLotId
                      ? "주차 구역 선택"
                      : "주차장을 먼저 선택"}
                </option>
                {sections.map((section, index) => {
                  const id = getSectionId(section);
                  return (
                    <option key={id || index} value={id}>
                      {getSectionLabel(section)}
                    </option>
                  );
                })}
              </select>
            </label>
          </div>

          {selectedLot ? (
            <p className="mt-3 break-words text-xs text-slate-500">
              선택 주차장: {getLotLabel(selectedLot)}
            </p>
          ) : null}

          <label className="mt-4 flex flex-col gap-2 text-sm font-medium text-slate-700">
            신청 사유
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={4}
              className="w-full min-w-0 truncate rounded-xl border border-slate-300 px-3 py-2 text-sm"
              placeholder="담당하게 될 구역, 운영 목적 등을 입력하세요."
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={loading || !session?.accessToken}
            className="mt-5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "처리 중..." : "신청하기"}
          </button>

          {message ? (
            <p className="mt-4 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
              {message}
            </p>
          ) : null}
        </section>

        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">내 신청 내역</h2>

          <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-[720px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-center">주차장</th>
                    <th className="px-4 py-3 text-center">구역</th>
                    <th className="px-4 py-3 text-center">상태</th>
                    <th className="px-4 py-3 text-center">신청일</th>
                    <th className="w-[104px] px-4 py-3 text-center">작업</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {requests.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-slate-500"
                    >
                      신청 내역이 없습니다.
                    </td>
                  </tr>
                ) : (
                  requests.map((request) => (
                    <tr key={request.id}>
                      <td className="px-4 py-3">
                        {getRequestLotLabel(request)}
                      </td>
                      <td className="px-4 py-3">
                        {getRequestSectionLabel(request)}
                      </td>
                      <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-black ${getRequestStatusBadge(request.status).className}`}
                          >
                            {getRequestStatusBadge(request.status).label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          {formatShortDate(request.createdAt)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {isPendingRequest(request.status) ? (
                            <button
                              type="button"
                              onClick={() => void withdrawRequest(request.id)}
                              disabled={withdrawingId === request.id}
                              className="whitespace-nowrap rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 disabled:opacity-50"
                            >
                              {withdrawingId === request.id ? "처리 중" : "신청 철회"}
                            </button>
                          ) : (
                            <span className="text-xs font-bold text-slate-300">-</span>
                          )}
                        </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
