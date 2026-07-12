'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';
import type { ConsoleRole } from '@/lib/console-role';
import { formatKstDateTime } from '@/lib/datetime';

type Props = {
  role?: ConsoleRole;
};

type OutstandingItem = {
  id: string;
  rowType?: 'INVOICE' | 'SESSION';
  invoiceId?: string | null;
  invoiceNo?: string | null;
  sessionId?: string | null;
  amount?: number | null;
  paidAmount?: number | null;
  unpaidAmount?: number | null;
  unpaidFee?: number | null;
  status?: string | null;
  createdAt?: string | null;
  paidAt?: string | null;
  paymentLinkUrl?: string | null;
  collectionStatus?: string | null;
  collectionLastAction?: string | null;
  collectionLastActionAt?: string | null;
  session?: {
    id: string;
    sessionNo?: string | null;
    plateNumber?: string | null;
    vehicleNumber?: string | null;
    unpaidAmount?: number | null;
    entryTime?: string | null;
    exitTime?: string | null;
    vehicle?: {
      id?: string | null;
      plateNumber?: string | null;
    } | null;
    user?: {
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    } | null;
    parkingSpace?: {
      id: string;
      code?: string | null;
      section?: {
        id: string;
        name?: string | null;
        parkingLot?: {
          id: string;
          name?: string | null;
          code?: string | null;
        } | null;
      } | null;
    } | null;
  } | null;
};

type PaymentRequestPreview = {
  invoiceId: string;
  invoiceNo: string;
  sessionId: string;
  customerLabel: string;
  parkingLotName: string | null;
  parkingLotLabel: string;
  usedAt: string | null;
  usedAtText: string;
  amount: number;
  unpaidAmount: number;
  paymentLinkUrl: string;
  message: string;
};

function unwrapList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value;

  if (value && typeof value === 'object') {
    const obj = value as { data?: unknown; items?: unknown };
    if (Array.isArray(obj.data)) return obj.data as T[];
    if (Array.isArray(obj.items)) return obj.items as T[];
  }

  return [];
}

function formatCurrency(value?: number | null) {
  return `₩${Number(value ?? 0).toLocaleString()}`;
}

function paymentStatusLabel(status?: string | null) {
  switch (status) {
    case 'PAID':
      return '결제완료';
    case 'PARTIALLY_PAID':
      return '부분결제';
    case 'UNPAID':
    case 'ISSUED':
      return '미납';
    case 'OVERDUE':
      return '연체';
    case 'VOID':
      return '무효';
    case 'CANCELLED':
      return '취소';
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
    case 'UNPAID':
    case 'ISSUED':
      return 'bg-orange-100 text-orange-700';
    case 'UNPAID_SESSION':
      return 'bg-amber-100 text-amber-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function collectionStatusClassName(status?: string | null) {
  switch (status) {
    case 'SMS_SENT':
    case 'EMAIL_SENT':
    case 'LINK_CREATED':
    case 'LINK_COPIED':
    case 'CONTACTED':
    case 'CALLED':
      return 'bg-blue-100 text-blue-700';
    case 'FAILED':
      return 'bg-red-100 text-red-700';
    case 'READY':
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

function formatDate(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return formatKstDateTime(date);
}

function getOutstandingAmount(item: OutstandingItem) {
  return Number(
    item.unpaidFee ??
      item.unpaidAmount ??
      item.session?.unpaidAmount ??
      0,
  );
}

function getInvoiceId(item: OutstandingItem) {
  if (item.invoiceId) return item.invoiceId;

  if (item.rowType === 'INVOICE' && item.id) {
    return item.id;
  }

  return null;
}

function getVehicleNumber(item: OutstandingItem) {
  return (
    item.session?.vehicle?.plateNumber ??
    item.session?.plateNumber ??
    item.session?.vehicleNumber ??
    '-'
  );
}

function getParkingLotName(item: OutstandingItem) {
  return (
    item.session?.parkingSpace?.section?.parkingLot?.name ??
    item.session?.parkingSpace?.section?.parkingLot?.code ??
    '-'
  );
}

function getSpaceCode(item: OutstandingItem) {
  return item.session?.parkingSpace?.code ?? '-';
}

function getUserName(item: OutstandingItem) {
  return (
    item.session?.user?.name ??
    item.session?.user?.email ??
    item.session?.user?.phone ??
    '-'
  );
}

function getDisplayNo(item: OutstandingItem) {
  if (item.invoiceNo) return item.invoiceNo;

  if (item.session?.sessionNo) {
    return `SESSION-${item.session.sessionNo}`;
  }

  if (item.sessionId) {
    return `SESSION-${item.sessionId}`;
  }

  if (item.session?.id) {
    return `SESSION-${item.session.id}`;
  }

  return item.id;
}

function getDisplayStatus(item: OutstandingItem) {
  if (item.rowType === 'SESSION') return 'UNPAID_SESSION';

  return paymentStatusLabel(item.status);
}

function getCreatedAt(item: OutstandingItem) {
  return item.createdAt ?? item.session?.entryTime ?? null;
}

async function copyTextToClipboard(text: string) {
  if (
    typeof window !== 'undefined' &&
    window.navigator?.clipboard?.writeText
  ) {
    await window.navigator.clipboard.writeText(text);
    return;
  }

  if (typeof document === 'undefined') {
    throw new Error('Clipboard is not available.');
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '-9999px';

  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand('copy');

  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('복사하지 못했습니다.');
  }
}

export default function OutstandingPage({ role = 'admin' }: Props) {
  const { session } = useAuth();

  const [items, setItems] = useState<OutstandingItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [paymentRequestPreview, setPaymentRequestPreview] =
    useState<PaymentRequestPreview | null>(null);
  const [paymentRequestCopied, setPaymentRequestCopied] = useState<
    'message' | 'link' | null
  >(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const result = await apiFetch('/billing/outstanding', {
        accessToken: session.accessToken,
      });

      setItems(unwrapList<OutstandingItem>(result));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to load outstanding invoices.',
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function openPaymentRequestMessage(item: OutstandingItem) {
    if (!session?.accessToken) return;

    const invoiceId = getInvoiceId(item);

    if (!invoiceId) {
      setError('이 항목은 청구서 ID가 없어 발송 문구를 생성할 수 없습니다.');
      return;
    }

    setBusyInvoiceId(invoiceId);
    setPaymentRequestCopied(null);
    setNotice(null);
    setError(null);

    try {
      const result = await apiFetch<PaymentRequestPreview>(
        `/invoices/${invoiceId}/payment-request-message`,
        {
          method: 'POST',
          accessToken: session.accessToken,
          body: {
            baseUrl:
              typeof window !== 'undefined'
                ? window.location.origin
                : undefined,
          },
        },
      );

      setPaymentRequestPreview(result);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '미납 청구서 메시지를 생성하지 못했습니다.',
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function recordCopyAction(
    preview: PaymentRequestPreview,
    type: 'message' | 'link',
  ) {
    if (!session?.accessToken) return;

    await apiFetch(`/invoices/${preview.invoiceId}/collection-action`, {
      method: 'POST',
      accessToken: session.accessToken,
      body: {
        action: 'COPY_PAYMENT_LINK',
        channel: 'WEB',
        note:
          type === 'message'
            ? 'Payment request message copied from console outstanding page'
            : 'Payment request link copied from console outstanding page',
        metadata: {
          paymentLinkUrl: preview.paymentLinkUrl,
          messageCopied: type === 'message',
        },
      },
    });
  }

  async function copyPaymentRequestMessage() {
    if (!paymentRequestPreview) return;

    try {
      await copyTextToClipboard(paymentRequestPreview.message);
      await recordCopyAction(paymentRequestPreview, 'message');

      setPaymentRequestCopied('message');
      setNotice(`미납 안내 문구를 복사했습니다. (${paymentRequestPreview.invoiceNo})`);

      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '미납 안내 문구를 복사하지 못했습니다.',
      );
    }
  }

  async function copyPaymentRequestLink() {
    if (!paymentRequestPreview) return;

    try {
      await copyTextToClipboard(paymentRequestPreview.paymentLinkUrl);
      await recordCopyAction(paymentRequestPreview, 'link');

      setPaymentRequestCopied('link');
      setNotice(`청구서 링크를 복사했습니다. (${paymentRequestPreview.invoiceNo})`);

      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : '청구서 링크를 복사하지 못했습니다.',
      );
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">미납</h1>
          <p className="text-sm text-slate-500">
            출차 후 미납된 청구서와 미수금을 확인하고 고객에게 납부 링크를 안내합니다.
          </p>
        </div>

        {role === 'operator' ? (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            Operator
          </span>
        ) : null}
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
        <table className="w-full min-w-[1240px] text-left text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3">번호</th>
              <th className="px-4 py-3">Invoice / Session</th>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">주차장</th>
              <th className="px-4 py-3">주차면</th>
              <th className="px-4 py-3">Unpaid Fee</th>
              <th className="px-4 py-3">상태</th>
              <th className="px-4 py-3">입차일시</th>
              <th className="px-4 py-3">생성일시</th>
              <th className="px-4 py-3">작업</th>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const invoiceId = getInvoiceId(item);
              const busy = invoiceId ? busyInvoiceId === invoiceId : false;
              const outstandingAmount = getOutstandingAmount(item);
              const collectionStatus = item.collectionStatus ?? 'READY';

              return (
                <tr key={`${item.rowType ?? 'ROW'}-${item.id}`} className="border-t align-top">
                  <td className="px-4 py-3">{index + 1}</td>

                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">
                      {getDisplayNo(item)}
                    </p>
                    {invoiceId ? (
                      <p className="mt-1 text-xs text-slate-400">
                        {invoiceId}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-3">
                    {getVehicleNumber(item)}
                  </td>

                  <td className="px-4 py-3">
                    {getUserName(item)}
                  </td>

                  <td className="px-4 py-3">
                    {getParkingLotName(item)}
                  </td>

                  <td className="px-4 py-3">
                    {getSpaceCode(item)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-red-600">
                    {formatCurrency(outstandingAmount)}
                  </td>

                  <td className="px-4 py-3">
                    <div className="space-y-2">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${statusClassName(
                          item.rowType === 'SESSION'
                            ? 'UNPAID_SESSION'
                            : item.status,
                        )}`}
                      >
                        {getDisplayStatus(item)}
                      </span>

                      <br />

                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${collectionStatusClassName(
                          collectionStatus,
                        )}`}
                      >
                        {collectionStatus}
                      </span>

                      {item.collectionLastActionAt ? (
                        <p className="text-xs text-slate-500">
                          {item.collectionLastAction ?? '-'} ·{' '}
                          {formatDate(item.collectionLastActionAt)}
                        </p>
                      ) : null}
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {formatDate(item.session?.entryTime)}
                  </td>

                  <td className="px-4 py-3">
                    {formatDate(getCreatedAt(item))}
                  </td>

                  <td className="px-4 py-3">
                    {invoiceId ? (
                      <div className="flex min-w-40 flex-col gap-2">
                        <button
                          disabled={busy || outstandingAmount <= 0}
                          onClick={() => openPaymentRequestMessage(item)}
                          className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy ? '생성 중...' : '미납 청구서 보내기'}
                        </button>

                        <a
                          href={`/pay/invoice/${invoiceId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-center text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          청구서 열기
                        </a>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        청구서 없음
                      </span>
                    )}
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
                  미납 청구서가 없습니다.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      {paymentRequestPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-amber-600">
                  미납 청구서 보내기
                </p>
                <h2 className="mt-1 text-2xl font-black text-slate-950">
                  안내 문구 확인
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  아래 문구를 복사해 문자메시지 또는 메신저로 고객에게 전달할 수 있습니다.
                  이메일 발송 기능은 추후 제공됩니다.
                </p>
              </div>

              <button
                onClick={() => {
                  setPaymentRequestPreview(null);
                  setPaymentRequestCopied(null);
                }}
                className="rounded-full border border-slate-200 px-3 py-1 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm md:grid-cols-2">
              <div>
                <p className="text-xs font-bold text-slate-400">청구서</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {paymentRequestPreview.invoiceNo}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">고객</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {paymentRequestPreview.customerLabel}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">이용 주차장</p>
                <p className="mt-1 font-semibold text-slate-900">
                  {paymentRequestPreview.parkingLotLabel}
                </p>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">미납 금액</p>
                <p className="mt-1 font-semibold text-red-700">
                  {formatCurrency(paymentRequestPreview.unpaidAmount)}
                </p>
              </div>
            </div>

            <label className="mt-5 block text-sm font-bold text-slate-700">
              발송 문구
            </label>
            <textarea
              readOnly
              value={paymentRequestPreview.message}
              className="mt-2 h-56 w-full rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-900 outline-none"
            />

            <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm">
              <p className="font-bold text-blue-800">청구서 링크</p>
              <a
                href={paymentRequestPreview.paymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-1 block break-all text-blue-700 underline"
              >
                {paymentRequestPreview.paymentLinkUrl}
              </a>
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                onClick={copyPaymentRequestMessage}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
              >
                {paymentRequestCopied === 'message'
                  ? '문구 복사됨'
                  : '문구 복사'}
              </button>
              <button
                onClick={copyPaymentRequestLink}
                className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100"
              >
                {paymentRequestCopied === 'link'
                  ? '링크 복사됨'
                  : '링크 복사'}
              </button>
              <button
                onClick={() => {
                  setPaymentRequestPreview(null);
                  setPaymentRequestCopied(null);
                }}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
