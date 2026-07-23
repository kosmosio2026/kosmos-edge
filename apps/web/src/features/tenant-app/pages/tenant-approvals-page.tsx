'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api';

type TenantApplicationStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | string;

type TenantApplication = {
  id: string;
  status: TenantApplicationStatus;

  parkingLotId: string;
  parkingLotName: string | null;
  parkingLotCode: string | null;

  managementCompanyId: string | null;
  managementCompanyName: string | null;
  managementCompanyCode: string | null;

  tenantId: string | null;
  tenantName: string | null;
  tenantCode: string | null;

  companyName: string;
  businessNumber: string | null;
  representative: string | null;
  contact: string | null;
  billingEmail: string | null;

  applicantName: string | null;
  applicantPhone: string | null;
  applicantEmail: string | null;
  memo: string | null;

  approvedAt: string | null;
  approvedByUserId: string | null;
  rejectedAt: string | null;
  rejectedByUserId: string | null;
  rejectReason: string | null;

  createdAt: string;
  updatedAt: string;
};

type TenantApprovalsPageProps = {
  scope?: 'admin' | 'manager';
};

const STATUS_OPTIONS = [
  { value: 'PENDING', label: '승인대기' },
  { value: 'APPROVED', label: '승인완료' },
  { value: 'REJECTED', label: '거절' },
  { value: 'CANCELLED', label: '취소' },
];

function formatDateTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');

  return `${yy}.${mm}.${dd} ${hh}:${mi}:${ss}`;
}

function statusLabel(status?: string | null) {
  switch (String(status ?? '').toUpperCase()) {
    case 'PENDING':
      return '승인대기';
    case 'APPROVED':
      return '승인완료';
    case 'REJECTED':
      return '거절';
    case 'CANCELLED':
      return '취소';
    default:
      return status ?? '-';
  }
}

function statusBadgeClass(status?: string | null) {
  switch (String(status ?? '').toUpperCase()) {
    case 'PENDING':
      return 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200';
    case 'APPROVED':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200';
    case 'REJECTED':
      return 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200';
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-200';
    default:
      return 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200';
  }
}

function buildQuery(params: Record<string, string | undefined | null>) {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value);
  });

  const query = search.toString();
  return query ? `?${query}` : '';
}

export function TenantApprovalsPage({ scope = 'manager' }: TenantApprovalsPageProps) {
  const { session } = useAuth();
  const accessToken = session?.accessToken ?? '';

  const [status, setStatus] = useState('PENDING');
  const [applications, setApplications] = useState<TenantApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<TenantApplication | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const summary = useMemo(() => {
    return applications.reduce(
      (acc, item) => {
        const key = String(item.status).toUpperCase();
        if (key === 'PENDING') acc.pending += 1;
        if (key === 'APPROVED') acc.approved += 1;
        if (key === 'REJECTED') acc.rejected += 1;
        return acc;
      },
      {
        pending: 0,
        approved: 0,
        rejected: 0,
      },
    );
  }, [applications]);

  const loadApplications = useCallback(async () => {
    if (!accessToken) {
      setError('로그인이 필요합니다. 다시 로그인해 주세요.');
      setApplications([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = buildQuery({ status });
      const data = await apiFetch<TenantApplication[]>(`/tenant-app/approvals${query}`, {
        accessToken,
      });

      setApplications(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '입주사 승인 목록을 불러오지 못했습니다.');
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, status]);

  useEffect(() => {
    if (!accessToken) return;
    void loadApplications();
  }, [accessToken, loadApplications]);

  async function approveApplication(application: TenantApplication) {
    if (!accessToken) {
      setError('로그인이 필요합니다. 다시 로그인해 주세요.');
      return;
    }

    const confirmed = window.confirm(`${application.companyName} 입주사 신청을 승인할까요?`);
    if (!confirmed) return;

    setActing(true);
    setError(null);

    try {
      await apiFetch(`/tenant-app/approvals/${application.id}/approve`, {
        accessToken,
        method: 'POST',
      });

      setSelectedApplication(null);
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : '입주사 승인에 실패했습니다.');
    } finally {
      setActing(false);
    }
  }

  async function rejectApplication(application: TenantApplication) {
    if (!accessToken) {
      setError('로그인이 필요합니다. 다시 로그인해 주세요.');
      return;
    }

    const confirmed = window.confirm(`${application.companyName} 입주사 신청을 거절할까요?`);
    if (!confirmed) return;

    setActing(true);
    setError(null);

    try {
      await apiFetch(`/tenant-app/approvals/${application.id}/reject`, {
        accessToken,
        method: 'POST',
        body: JSON.stringify({
          rejectReason: rejectReason || '입주사 신청 거절',
        }),
      });

      setSelectedApplication(null);
      setRejectReason('');
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : '입주사 거절에 실패했습니다.');
    } finally {
      setActing(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-sky-600">
                {scope === 'admin' ? 'Admin Approval' : 'Manager Approval'}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">입주사 승인</h1>
              <p className="mt-2 text-sm text-slate-500">
                Tenant 앱에서 신청한 입주사 등록 요청을 검토하고 승인 또는 거절합니다.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-slate-700">상태</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-sky-400"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={loadApplications}
                disabled={loading}
                className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                {loading ? '조회 중...' : '조회'}
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">승인대기</div>
            <div className="mt-2 text-2xl font-bold text-amber-600">{summary.pending.toLocaleString('ko-KR')}건</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">승인완료</div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{summary.approved.toLocaleString('ko-KR')}건</div>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <div className="text-sm text-slate-500">거절</div>
            <div className="mt-2 text-2xl font-bold text-red-600">{summary.rejected.toLocaleString('ko-KR')}건</div>
          </div>
        </section>

        <section className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-950">입주사 신청 목록</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">신청 입주사</th>
                  <th className="px-5 py-3">주차장</th>
                  <th className="px-5 py-3">담당자</th>
                  <th className="px-5 py-3">연락처</th>
                  <th className="px-5 py-3">신청일시</th>
                  <th className="px-5 py-3">상태</th>
                  <th className="px-5 py-3">작업</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {applications.map((application) => (
                  <tr key={application.id} className="hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <button
                        type="button"
                        onClick={() => setSelectedApplication(application)}
                        className="text-left font-semibold text-slate-950 hover:text-sky-600"
                      >
                        {application.companyName}
                      </button>
                      <div className="mt-1 text-xs text-slate-500">
                        {application.businessNumber ?? '-'}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium text-slate-800">{application.parkingLotName ?? '-'}</div>
                      <div className="mt-1 text-xs text-slate-500">{application.managementCompanyName ?? '-'}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div>{application.applicantName ?? application.representative ?? '-'}</div>
                      <div className="mt-1 text-xs text-slate-500">{application.applicantEmail ?? application.billingEmail ?? '-'}</div>
                    </td>
                    <td className="px-5 py-4">
                      {application.applicantPhone ?? application.contact ?? '-'}
                    </td>
                    <td className="px-5 py-4">{formatDateTime(application.createdAt)}</td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClass(application.status)}`}>
                        {statusLabel(application.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedApplication(application)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          상세
                        </button>

                        {String(application.status).toUpperCase() === 'PENDING' ? (
                          <button
                            type="button"
                            onClick={() => approveApplication(application)}
                            disabled={acting}
                            className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                          >
                            승인
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && applications.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      조회된 입주사 신청이 없습니다.
                    </td>
                  </tr>
                ) : null}

                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-slate-500">
                      불러오는 중입니다...
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        {selectedApplication ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="입주사 신청 상세"
          >
            <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
              <div className="shrink-0 border-b border-slate-100 px-6 py-5">
                <p className="text-sm font-semibold text-sky-600">신청 상세</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{selectedApplication.companyName}</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedApplication.parkingLotName ?? '-'} · {formatDateTime(selectedApplication.createdAt)}
                </p>
              </div>

              <div className="grid flex-1 gap-4 overflow-y-auto p-6 text-sm md:grid-cols-2">
                <Detail label="상태" value={statusLabel(selectedApplication.status)} />
                <Detail label="주차장" value={selectedApplication.parkingLotName ?? '-'} />
                <Detail label="관리회사" value={selectedApplication.managementCompanyName ?? '-'} />
                <Detail label="사업자번호" value={selectedApplication.businessNumber ?? '-'} />
                <Detail label="대표자" value={selectedApplication.representative ?? '-'} />
                <Detail label="입주사 연락처" value={selectedApplication.contact ?? '-'} />
                <Detail label="정산 이메일" value={selectedApplication.billingEmail ?? '-'} />
                <Detail label="신청자" value={selectedApplication.applicantName ?? '-'} />
                <Detail label="신청자 연락처" value={selectedApplication.applicantPhone ?? '-'} />
                <Detail label="신청자 이메일" value={selectedApplication.applicantEmail ?? '-'} />
                <div className="md:col-span-2">
                  <Detail label="메모" value={selectedApplication.memo ?? '-'} />
                </div>

                {String(selectedApplication.status).toUpperCase() === 'PENDING' ? (
                  <label className="md:col-span-2 flex flex-col gap-1">
                    <span className="font-medium text-slate-700">거절 사유</span>
                    <textarea
                      value={rejectReason}
                      onChange={(event) => setRejectReason(event.target.value)}
                      className="min-h-24 rounded-xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-400"
                      placeholder="거절 시 사유를 입력하세요."
                    />
                  </label>
                ) : null}
              </div>

              <div className="shrink-0 flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedApplication(null);
                    setRejectReason('');
                  }}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-white"
                >
                  닫기
                </button>

                {String(selectedApplication.status).toUpperCase() === 'PENDING' ? (
                  <>
                    <button
                      type="button"
                      onClick={() => rejectApplication(selectedApplication)}
                      disabled={acting}
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      거절
                    </button>
                    <button
                      type="button"
                      onClick={() => approveApplication(selectedApplication)}
                      disabled={acting}
                      className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      승인
                    </button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="text-xs font-semibold text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-medium text-slate-900">{value}</div>
    </div>
  );
}
