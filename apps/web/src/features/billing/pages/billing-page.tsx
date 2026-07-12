'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';
import { formatKstDateTime } from '@/lib/datetime';

const BILLING_LIST_ENDPOINT = "/invoices?limit=200";

type Props = {
  role?: ConsoleRole;
};

type BillingItem = {
  id?: string | null;
  invoiceId?: string | null;
  invoiceNo?: string | null;
  sessionId?: string | null;
  sessionNo?: string | null;

  status?: string | null;
  paymentStatus?: string | null;

  amount?: number | null;
  finalAmount?: number | null;
  paidAmount?: number | null;
  unpaidAmount?: number | null;
  discountAmount?: number | null;

  issuedAt?: string | null;
  dueAt?: string | null;
  paidAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;

  parkingLotName?: string | null;
  parkingLotCode?: string | null;
  sectionCode?: string | null;
  sectionName?: string | null;
  parkingSpaceCode?: string | null;
  parkingSpaceNumber?: string | null;

  plateNumber?: string | null;
  vehicleNumber?: string | null;
  driverName?: string | null;
  customerName?: string | null;
  userName?: string | null;
  phone?: string | null;
  contactPhone?: string | null;

  entryTime?: string | null;
  exitTime?: string | null;

  invoice?: Partial<BillingItem> | null;

  session?: {
    id?: string | null;
    sessionNo?: string | null;
    plateNumber?: string | null;
    vehicleNumber?: string | null;
    entryTime?: string | null;
    exitTime?: string | null;
    user?: {
      id?: string | null;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    visitorProfile?: {
      phone?: string | null;
      phoneNumber?: string | null;
      contactPhone?: string | null;
    } | null;
    vehicle?: {
      plateNumber?: string | null;
    } | null;
    parkingSpace?: {
      code?: string | null;
      number?: string | null;
      section?: {
        code?: string | null;
        name?: string | null;
        parkingLot?: {
          name?: string | null;
          code?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

type PublicInvoiceResponse = {
  ok?: boolean;
  invoice?: Partial<BillingItem> | null;
};

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;

  if (value && typeof value === 'object') {
    const obj = value as {
      data?: unknown;
      items?: unknown;
      invoices?: unknown;
      results?: unknown;
    };

    if (Array.isArray(obj.items)) return obj.items as T[];
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.invoices)) return obj.invoices as T[];
    if (Array.isArray(obj.results)) return obj.results as T[];
  }

  return [];
}

function formatCurrency(value?: number | null) {
  return `₩${Number(value ?? 0).toLocaleString()}`;
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return formatKstDateTime(date);
}

function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case 'PAID':
      return '결제완료';
    case 'PARTIALLY_PAID':
      return '부분결제';
    case 'ISSUED':
    case 'UNPAID':
      return '미납';
    case 'OVERDUE':
      return '연체';
    case 'VOID':
      return '무효';
    case 'CANCELLED':
      return '취소';
    case 'DRAFT':
      return '작성중';
    default:
      return status ?? '-';
  }
}

function statusClassName(status?: string | null) {
  switch (status) {
    case 'PAID':
      return 'bg-green-100 text-green-700';
    case 'PARTIALLY_PAID':
      return 'bg-blue-100 text-blue-700';
    case 'OVERDUE':
      return 'bg-red-100 text-red-700';
    case 'ISSUED':
    case 'UNPAID':
      return 'bg-orange-100 text-orange-700';
    case 'VOID':
    case 'CANCELLED':
      return 'bg-slate-200 text-slate-500';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function getInvoiceId(item: BillingItem) {
  return (
    item.invoiceId ??
    item.invoice?.invoiceId ??
    item.invoice?.id ??
    item.id ??
    null
  );
}

function getInvoiceNo(item: BillingItem) {
  return item.invoiceNo ?? item.invoice?.invoiceNo ?? '-';
}

function getInvoiceHref(item: BillingItem) {
  const invoiceId = getInvoiceId(item);

  if (!invoiceId) return null;

  return `/pay/invoice/${invoiceId}`;
}

function getReceiptHref(item: BillingItem) {
  const invoiceId = getInvoiceId(item);

  if (!invoiceId || getPaidAmount(item) <= 0) return null;

  return `/pay/invoice/${invoiceId}?view=receipt`;
}

function getStatus(item: BillingItem) {
  return item.paymentStatus ?? item.status ?? item.invoice?.status ?? '-';
}

function getAmount(item: BillingItem) {
  return Number(
    item.finalAmount ??
      item.amount ??
      item.invoice?.finalAmount ??
      item.invoice?.amount ??
      0,
  );
}

function getPaidAmount(item: BillingItem) {
  return Number(item.paidAmount ?? item.invoice?.paidAmount ?? 0);
}

function getUnpaidAmount(item: BillingItem) {
  const explicit = item.unpaidAmount ?? item.invoice?.unpaidAmount;

  if (explicit != null) return Number(explicit);

  return Math.max(0, getAmount(item) - getPaidAmount(item));
}

function getParkingLotName(item: BillingItem) {
  return (
    item.parkingLotName ??
    item.parkingLotCode ??
    item.session?.parkingSpace?.section?.parkingLot?.name ??
    item.session?.parkingSpace?.section?.parkingLot?.code ??
    '-'
  );
}

function getSpaceCode(item: BillingItem) {
  const section =
    item.sectionCode ??
    item.sectionName ??
    item.session?.parkingSpace?.section?.code ??
    item.session?.parkingSpace?.section?.name ??
    null;

  const space =
    item.parkingSpaceNumber ??
    item.parkingSpaceCode ??
    item.session?.parkingSpace?.number ??
    item.session?.parkingSpace?.code ??
    null;

  if (section && space) return `${section} / ${space}`;
  return space ?? section ?? '-';
}

function getVehicleNumber(item: BillingItem) {
  return (
    item.plateNumber ??
    item.vehicleNumber ??
    item.session?.vehicle?.plateNumber ??
    item.session?.plateNumber ??
    item.session?.vehicleNumber ??
    '-'
  );
}

function getContact(item: BillingItem) {
  return (
    item.phone ??
    item.contactPhone ??
    item.session?.visitorProfile?.phone ??
    item.session?.visitorProfile?.phoneNumber ??
    item.session?.visitorProfile?.contactPhone ??
    item.session?.user?.phone ??
    '-'
  );
}

function getUserName(item: BillingItem) {
  const contact = getContact(item);

  const raw =
    item.session?.user?.name ??
    item.customerName ??
    item.userName ??
    item.driverName ??
    null;

  const normalized = raw ? String(raw).trim() : '';

  if (
    normalized &&
    normalized !== contact &&
    !normalized.toLowerCase().startsWith('visitor ')
  ) {
    return normalized;
  }

  if (contact !== '-') return contact;

  return item.session?.user?.email ?? '-';
}

function getEntryTime(item: BillingItem) {
  return item.entryTime ?? item.session?.entryTime ?? null;
}

function getExitTime(item: BillingItem) {
  return item.exitTime ?? item.session?.exitTime ?? null;
}

function getCreatedAt(item: BillingItem) {
  return item.createdAt ?? item.issuedAt ?? item.invoice?.createdAt ?? null;
}

function mergeInvoiceDetail(item: BillingItem, detail?: Partial<BillingItem> | null): BillingItem {
  if (!detail) return item;

  return {
    ...item,
    invoiceId: item.invoiceId ?? detail.invoiceId,
    invoiceNo: item.invoiceNo ?? detail.invoiceNo,
    sessionId: item.sessionId ?? detail.sessionId,
    sessionNo: item.sessionNo ?? detail.sessionNo,
    status: item.status ?? detail.status,
    paymentStatus: item.paymentStatus ?? detail.paymentStatus,
    amount: item.amount ?? detail.amount,
    finalAmount: item.finalAmount ?? detail.finalAmount,
    paidAmount: item.paidAmount ?? detail.paidAmount,
    unpaidAmount: item.unpaidAmount ?? detail.unpaidAmount,
    issuedAt: item.issuedAt ?? detail.issuedAt,
    dueAt: item.dueAt ?? detail.dueAt,
    paidAt: item.paidAt ?? detail.paidAt,
    createdAt: item.createdAt ?? detail.createdAt,
    parkingLotName: item.parkingLotName ?? detail.parkingLotName,
    parkingLotCode: item.parkingLotCode ?? detail.parkingLotCode,
    sectionCode: item.sectionCode ?? detail.sectionCode,
    sectionName: item.sectionName ?? detail.sectionName,
    parkingSpaceCode: item.parkingSpaceCode ?? detail.parkingSpaceCode,
    parkingSpaceNumber: item.parkingSpaceNumber ?? detail.parkingSpaceNumber,
    plateNumber: item.plateNumber ?? detail.plateNumber,
    vehicleNumber: item.vehicleNumber ?? detail.vehicleNumber,
    driverName: item.driverName ?? detail.driverName,
    customerName: item.customerName ?? detail.customerName,
    userName: item.userName ?? detail.userName,
    phone: item.phone ?? detail.phone,
    contactPhone: item.contactPhone ?? detail.contactPhone,
    entryTime: item.entryTime ?? detail.entryTime,
    exitTime: item.exitTime ?? detail.exitTime,
  };
}

export default function BillingPage(_props: Props) {
  const { session } = useAuth();

  const [items, setItems] = useState<BillingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [selectedDetailItem, setSelectedDetailItem] =
    useState<BillingItem | null>(null);
  const [paymentTarget, setPaymentTarget] = useState<BillingItem | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch(BILLING_LIST_ENDPOINT, {
        accessToken: session.accessToken,
      });

      const baseItems = unwrapList<BillingItem>(result);

      const enrichedItems = await Promise.all(
        baseItems.map(async (item) => {
          const invoiceId = getInvoiceId(item);

          if (!invoiceId) return item;

          try {
            const detailResult = await apiFetch<PublicInvoiceResponse>(
              `/invoices/${invoiceId}/public`,
              {
                accessToken: session.accessToken,
              },
            );

            return mergeInvoiceDetail(item, detailResult.invoice);
          } catch {
            return item;
          }
        }),
      );

      setItems(enrichedItems);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '수금 현황을 불러오지 못했습니다.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  function openPaymentModal(item: BillingItem) {
    const defaultAmount = getUnpaidAmount(item) || getAmount(item);

    setPaymentTarget(item);
    setPaymentAmount(String(defaultAmount));
    setNotice(null);
    setError(null);
  }

  async function submitPayment() {
    if (!session?.accessToken || !paymentTarget) return;

    const invoiceId = getInvoiceId(paymentTarget);
    const amount = Number(paymentAmount);

    if (!invoiceId) {
      setError('청구서 ID가 없어 결제를 등록할 수 없습니다.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError('결제 금액을 올바르게 입력해 주세요.');
      return;
    }

    setBusyInvoiceId(invoiceId);
    setError(null);

    try {
      await apiFetch(`/invoices/${invoiceId}/mock-pay`, {
        method: 'POST',
        accessToken: session.accessToken,
        body: JSON.stringify({
          amount,
          method: 'ADMIN_MANUAL',
          reference: `ADMIN-MANUAL-${Date.now()}`,
        }),
      });

      setNotice(`결제가 등록되었습니다. (${getInvoiceNo(paymentTarget)} / ${formatCurrency(amount)})`);
      setPaymentTarget(null);
      setPaymentAmount('');

      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '결제 등록에 실패했습니다.',
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">수금 현황</h1>
        <p className="mt-1 text-sm text-slate-500">
          청구서별 청구 금액, 결제 금액, 미납 금액과 결제 상태를 확인하고 수동 결제를 등록합니다.
        </p>
      </div>

      {notice ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
          {notice}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">불러오는 중...</div>
      ) : null}

      <section className="overflow-x-auto rounded-2xl border bg-white">
        <table className="w-full min-w-[1420px] text-left text-sm">
          <thead className="bg-slate-50 text-center text-slate-600">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-center">번호</th>
              <th className="whitespace-nowrap px-4 py-3 text-center">주차장</th>
              <th className="whitespace-nowrap px-4 py-3 text-center">주차면</th>
              <th className="whitespace-nowrap px-4 py-3 text-center">차량번호</th>
              <th className="whitespace-nowrap px-4 py-3 text-center">이용자</th>
              <th className="whitespace-nowrap px-4 py-3 text-center">청구 금액</th>
              <th className="whitespace-nowrap px-4 py-3 text-center">결제 금액</th>
              <th className="whitespace-nowrap px-4 py-3 text-center">미납 금액</th>
              <th className="w-28 whitespace-nowrap px-4 py-3 text-center">상태</th>
              <th className="whitespace-nowrap px-4 py-3 text-center">결제 일시</th>
              <th className="w-64 whitespace-nowrap px-4 py-3 text-center">관리</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const invoiceId = getInvoiceId(item);
              const invoiceHref = getInvoiceHref(item);
              const receiptHref = getReceiptHref(item);
              const status = getStatus(item);
              const busy = invoiceId ? busyInvoiceId === invoiceId : false;
              const rowKey = invoiceId ?? item.id ?? `${item.sessionId ?? 'row'}-${index}`;

              return (
                <tr key={rowKey} className="border-t align-middle">
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <button
                      onClick={() => setSelectedDetailItem(item)}
                      className="rounded-lg px-2 py-1 font-bold text-blue-700 hover:bg-blue-50 hover:underline"
                      title="청구서 상세 보기"
                    >
                      {index + 1}
                    </button>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    {getParkingLotName(item)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    {getSpaceCode(item)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    {getVehicleNumber(item)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    {getUserName(item)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-900">
                    {invoiceHref ? (
                      <a
                        href={invoiceHref}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-700 underline-offset-2 hover:underline"
                        title="청구서 보기"
                      >
                        {formatCurrency(getAmount(item))}
                      </a>
                    ) : (
                      formatCurrency(getAmount(item))
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-blue-700">
                    {receiptHref ? (
                      <a
                        href={receiptHref}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold underline-offset-2 hover:underline"
                        title="영수증 보기"
                      >
                        {formatCurrency(getPaidAmount(item))}
                      </a>
                    ) : (
                      <span className={getPaidAmount(item) > 0 ? 'font-semibold' : 'text-slate-500'}>
                        {formatCurrency(getPaidAmount(item))}
                      </span>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 font-semibold text-red-600">
                    {formatCurrency(getUnpaidAmount(item))}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName(
                        status,
                      )}`}
                    >
                      {paymentStatusLabel(status)}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDate(item.paidAt)}
                  </td>

                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex min-w-max items-center justify-center gap-2 whitespace-nowrap">
                      <button
                        disabled={busy || !invoiceId || getUnpaidAmount(item) <= 0}
                        onClick={() => openPaymentModal(item)}
                        className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        결제 등록
                      </button>

                      {invoiceId ? (
                        <a
                          href={`/pay/invoice/${invoiceId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-center text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          청구서 조회
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {!loading && items.length === 0 ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-10 text-center text-slate-500"
                >
                  청구 내역이 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {selectedDetailItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-blue-600">
                  청구서 상세
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {getInvoiceNo(selectedDetailItem)}
                </h2>
              </div>

              <button
                onClick={() => setSelectedDetailItem(null)}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="grid gap-3 text-sm md:grid-cols-2">
              <DetailItem label="청구서 ID" value={getInvoiceId(selectedDetailItem) ?? '-'} />
              <DetailItem label="청구서 번호" value={getInvoiceNo(selectedDetailItem)} />
              <DetailItem label="세션" value={selectedDetailItem.sessionNo ?? selectedDetailItem.sessionId ?? selectedDetailItem.session?.sessionNo ?? '-'} />
              <DetailItem label="주차장" value={getParkingLotName(selectedDetailItem)} />
              <DetailItem label="주차면" value={getSpaceCode(selectedDetailItem)} />
              <DetailItem label="차량번호" value={getVehicleNumber(selectedDetailItem)} />
              <DetailItem label="이용자" value={getUserName(selectedDetailItem)} />
              <DetailItem label="연락처" value={getContact(selectedDetailItem)} />
              <DetailItem label="청구 금액" value={formatCurrency(getAmount(selectedDetailItem))} />
              <DetailItem label="결제 금액" value={formatCurrency(getPaidAmount(selectedDetailItem))} />
              <DetailItem label="미납 금액" value={formatCurrency(getUnpaidAmount(selectedDetailItem))} />
              <DetailItem label="상태" value={paymentStatusLabel(getStatus(selectedDetailItem))} />
              <DetailItem label="입차일시" value={formatDate(getEntryTime(selectedDetailItem))} />
              <DetailItem label="출차일시" value={formatDate(getExitTime(selectedDetailItem))} />
              <DetailItem label="발행일시" value={formatDate(selectedDetailItem.issuedAt)} />
              <DetailItem label="결제 일시" value={formatDate(selectedDetailItem.paidAt)} />
            </div>

            <div className="mt-5 flex justify-end gap-2">
              {getInvoiceHref(selectedDetailItem) ? (
                <a
                  href={getInvoiceHref(selectedDetailItem) ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
                >
                  청구서 조회
                </a>
              ) : null}

              {getReceiptHref(selectedDetailItem) ? (
                <a
                  href={getReceiptHref(selectedDetailItem) ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-bold text-green-700 hover:bg-green-100"
                >
                  영수증 조회
                </a>
              ) : null}

              <button
                onClick={() => setSelectedDetailItem(null)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-blue-600">
                  결제 등록
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  {getInvoiceNo(paymentTarget)}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  고객이 현장에서 납부한 금액을 청구서에 수동 등록합니다.
                </p>
              </div>

              <button
                onClick={() => {
                  setPaymentTarget(null);
                  setPaymentAmount('');
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
              <DetailItem label="차량번호" value={getVehicleNumber(paymentTarget)} />
              <DetailItem label="이용자" value={getUserName(paymentTarget)} />
              <DetailItem label="청구 금액" value={formatCurrency(getAmount(paymentTarget))} />
              <DetailItem label="미납 금액" value={formatCurrency(getUnpaidAmount(paymentTarget))} />
            </div>

            <label className="mt-5 block text-sm font-bold text-slate-700">
              결제 금액
            </label>
            <input
              type="number"
              min="0"
              step="100"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg font-bold text-slate-900 outline-none focus:border-blue-400"
              placeholder="결제 금액을 입력하세요"
            />

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => {
                  setPaymentTarget(null);
                  setPaymentAmount('');
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                disabled={
                  busyInvoiceId === getInvoiceId(paymentTarget) ||
                  !Number.isFinite(Number(paymentAmount)) ||
                  Number(paymentAmount) <= 0
                }
                onClick={submitPayment}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busyInvoiceId === getInvoiceId(paymentTarget)
                  ? '등록 중...'
                  : '결제 등록'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <p className="text-xs font-bold text-slate-400">{label}</p>
      <p className="mt-1 break-all font-semibold text-slate-900">{value}</p>
    </div>
  );
}
