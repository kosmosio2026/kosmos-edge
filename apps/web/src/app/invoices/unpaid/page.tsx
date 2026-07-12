'use client';

import { formatKstDateTime } from '@/lib/datetime';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearTokens,
  createInvoicePaymentLink,
  createInvoicePaymentRequestMessage,
  getAccessToken,
  getUnpaidInvoices,
  mockCompletePayment,
  recordInvoiceCollectionAction,
  sendInvoiceEmail,
  sendInvoiceSms,
  type UnpaidInvoiceItem,
} from '@/lib/api';

function formatTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return formatKstDateTime(date);
}

function formatCurrency(value?: number | null, currency = 'KRW') {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
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
    throw new Error('Clipboard is not available in this environment.');
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
    throw new Error('Failed to copy payment link.');
  }
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

function additionalFeeReasonLabel(reason?: string | null) {
  switch (reason) {
    case 'EXIT_GRACE_EXPIRED_ADDITIONAL_FEE':
      return '결제 후 출차 유예 초과';
    case 'EXIT_GRACE_EXPIRED_NO_FEE_INCREASE':
      return '유예 초과 / 추가요금 없음';
    case 'WITHIN_EXIT_GRACE':
      return '결제 후 유예 내 출차';
    case 'UNPAID_BEFORE_EXIT':
      return '출차 전 미결제';
    case 'NO_ADDITIONAL_FEE':
      return '추가요금 없음';
    default:
      return reason ?? null;
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
      return 'bg-slate-100 text-slate-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

type Notice = {
  message: string;
  paymentLinkUrl?: string | null;
};

type PaymentRequestPreview = {
  invoiceId: string;
  invoiceNo: string;
  customerLabel: string;
  parkingLotLabel: string;
  usedAtText: string;
  amount: number;
  unpaidAmount: number;
  paymentLinkUrl: string;
  message: string;
};

export default function UnpaidInvoicesPage() {
  const router = useRouter();

  const [items, setItems] = useState<UnpaidInvoiceItem[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyInvoiceId, setBusyInvoiceId] = useState<string | null>(null);
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [paymentRequestPreview, setPaymentRequestPreview] =
    useState<PaymentRequestPreview | null>(null);
  const [paymentRequestCopied, setPaymentRequestCopied] = useState<
    'message' | 'link' | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  const totalUnpaidAmount = useMemo(() => {
    return items.reduce((sum, item) => sum + item.unpaidAmount, 0);
  }, [items]);

  function requireAccessToken() {
    const token = getAccessToken();

    if (!token) {
      router.replace('/login?redirect=/invoices/unpaid');
      throw new Error('Login is required. Please sign in again.');
    }

    return token;
  }

  async function load() {
    try {
      setError(null);

      const result = await getUnpaidInvoices({
        limit: 100,
      });

      setItems(result.items);
      setGeneratedAt(result.generatedAt);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load unpaid invoices',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace('/login?redirect=/invoices/unpaid');
      return;
    }

    load();

    const timer = window.setInterval(() => {
      load();
    }, 5000);

    return () => {
      window.clearInterval(timer);
    };
  }, [router]);

  async function onMockPay(item: UnpaidInvoiceItem) {
    if (!item.sessionId) {
      setError('No session found for this invoice.');
      return;
    }

    setBusyInvoiceId(item.invoiceId);

    try {
      const accessToken = requireAccessToken();

      await mockCompletePayment(
        {
          sessionId: item.sessionId,
          amount: item.unpaidAmount,
          paymentMethod: 'MOCK',
          paymentReference: `MOCK-INVOICE-${Date.now()}`,
        },
        accessToken,
      );

      setNotice({
        message: `Payment completed for ${item.invoiceNo}.`,
      });

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to complete mock payment',
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function ensurePaymentLink(item: UnpaidInvoiceItem, channel: string) {
    if (item.paymentLinkUrl) {
      return item.paymentLinkUrl;
    }

    const linkResult = await createInvoicePaymentLink(item.invoiceId, {
      channel,
      recipient: item.phone ?? undefined,
    });

    return linkResult.paymentLinkUrl;
  }

  async function onCopyPaymentLink(item: UnpaidInvoiceItem) {
    setBusyInvoiceId(item.invoiceId);

    try {
      const paymentLink = await ensurePaymentLink(item, 'WEB');

      if (!paymentLink) {
        throw new Error('No payment link was generated.');
      }

      await copyTextToClipboard(paymentLink);

      await recordInvoiceCollectionAction(item.invoiceId, {
        action: 'COPY_PAYMENT_LINK',
        channel: 'WEB',
        recipient: item.phone ?? undefined,
        note: 'Payment link copied from unpaid invoice page',
        metadata: {
          paymentLinkUrl: paymentLink,
        },
      });

      setCopiedInvoiceId(item.invoiceId);
      setNotice({
        message: `Copied payment link for ${item.invoiceNo}.`,
        paymentLinkUrl: paymentLink,
      });

      window.setTimeout(() => {
        setCopiedInvoiceId(null);
      }, 2000);

      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to copy payment link.',
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

    async function onSendSms(item: UnpaidInvoiceItem) {
    setBusyInvoiceId(item.invoiceId);

    try {
      const result = await sendInvoiceSms(item.invoiceId, {
        recipient: item.phone ?? undefined,
      });

      setNotice({
        message: `SMS sent for ${item.invoiceNo}${
          result.recipient ? ` → ${result.recipient}` : ''
        }.`,
        paymentLinkUrl: result.paymentLinkUrl,
      });

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send SMS',
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function onOpenPaymentRequestMessage(item: UnpaidInvoiceItem) {
    setBusyInvoiceId(item.invoiceId);
    setPaymentRequestCopied(null);

    try {
      const result = await createInvoicePaymentRequestMessage(item.invoiceId, {
        baseUrl:
          typeof window !== 'undefined' ? window.location.origin : undefined,
      });

      setPaymentRequestPreview({
        invoiceId: result.invoiceId,
        invoiceNo: result.invoiceNo,
        customerLabel: result.customerLabel,
        parkingLotLabel: result.parkingLotLabel,
        usedAtText: result.usedAtText,
        amount: result.amount,
        unpaidAmount: result.unpaidAmount,
        paymentLinkUrl: result.paymentLinkUrl,
        message: result.message,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '미납 청구서 메시지를 생성하지 못했습니다.',
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

  async function onCopyPaymentRequestMessage() {
    if (!paymentRequestPreview) return;

    try {
      await copyTextToClipboard(paymentRequestPreview.message);

      await recordInvoiceCollectionAction(paymentRequestPreview.invoiceId, {
        action: 'COPY_PAYMENT_LINK',
        channel: 'WEB',
        note: 'Payment request message copied from unpaid invoice page',
        metadata: {
          paymentLinkUrl: paymentRequestPreview.paymentLinkUrl,
          messageCopied: true,
        },
      });

      setPaymentRequestCopied('message');
      setNotice({
        message: `미납 안내 문구를 복사했습니다. (${paymentRequestPreview.invoiceNo})`,
        paymentLinkUrl: paymentRequestPreview.paymentLinkUrl,
      });

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '미납 안내 문구를 복사하지 못했습니다.',
      );
    }
  }

  async function onCopyPaymentRequestLink() {
    if (!paymentRequestPreview) return;

    try {
      await copyTextToClipboard(paymentRequestPreview.paymentLinkUrl);

      await recordInvoiceCollectionAction(paymentRequestPreview.invoiceId, {
        action: 'COPY_PAYMENT_LINK',
        channel: 'WEB',
        note: 'Payment request link copied from unpaid invoice page',
        metadata: {
          paymentLinkUrl: paymentRequestPreview.paymentLinkUrl,
        },
      });

      setPaymentRequestCopied('link');
      setNotice({
        message: `청구서 링크를 복사했습니다. (${paymentRequestPreview.invoiceNo})`,
        paymentLinkUrl: paymentRequestPreview.paymentLinkUrl,
      });

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '청구서 링크를 복사하지 못했습니다.',
      );
    }
  }

  async function onSendEmail(item: UnpaidInvoiceItem) {
    setBusyInvoiceId(item.invoiceId);

    try {
      const result = await sendInvoiceEmail(item.invoiceId);

      setNotice({
        message: `Email sent for ${item.invoiceNo}.`,
        paymentLinkUrl: result.paymentLinkUrl,
      });

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send email',
      );
    } finally {
      setBusyInvoiceId(null);
    }
  }

  function logout() {
    clearTokens();
    router.replace('/login');
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Kosmos Parking Console
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-950">
              Unpaid Invoices
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Collection queue · Updated {generatedAt ?? '-'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/parking-live')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Live Parking
            </button>

            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Refresh
            </button>

            <button
              onClick={logout}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 md:grid-cols-3">
          <SummaryCard
            label="Unpaid invoices"
            value={String(items.length)}
          />
          <SummaryCard
            label="Total unpaid"
            value={formatCurrency(totalUnpaidAmount)}
          />
          <SummaryCard
            label="Collection status"
            value={items.length > 0 ? 'Action required' : 'Clear'}
          />
        </section>

        {error ? (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {notice ? (
          <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
            <p>{notice.message}</p>

            {notice.paymentLinkUrl ? (
              <div className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-blue-900 ring-1 ring-blue-100">
                <p className="font-semibold">Payment Link</p>

                <a
                  href={notice.paymentLinkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 block break-all underline"
                >
                  {notice.paymentLinkUrl}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-slate-500 shadow-sm">
            Loading unpaid invoices...
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
            <p className="text-lg font-bold text-slate-950">
              No unpaid invoices
            </p>
            <p className="mt-2 text-sm text-slate-500">
              Exited unpaid sessions will appear here after an invoice is
              created.
            </p>

            <button
              onClick={() => router.push('/parking-live')}
              className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Back to Live Parking
            </button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Session</Th>
                    <Th>Vehicle / Driver</Th>
                    <Th>Parking</Th>
                    <Th>Exit</Th>
                    <Th>Amount</Th>
                    <Th>Status</Th>
                    <Th>Payment Link</Th>
                    <Th>Actions</Th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {items.map((item) => {
                    const busy = busyInvoiceId === item.invoiceId;

                    return (
                      <tr key={item.invoiceId} className="align-top">
                        <Td>
                          <p className="font-bold text-slate-950">
                            {item.invoiceNo}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.invoiceId}
                          </p>
                        </Td>

                        <Td>
                          <p className="font-semibold text-slate-900">
                            {item.sessionNo ?? '-'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.sessionStatus ?? '-'}
                          </p>
                        </Td>

                        <Td>
                          <p className="font-semibold text-slate-900">
                            {item.plateNumber ?? 'No plate'}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {item.driverName ?? 'No driver'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {item.phone ?? 'No phone'}
                          </p>
                        </Td>

                        <Td>
                          <p className="font-semibold text-slate-900">
                            {item.parkingLotName ?? '-'}
                          </p>
                          <p className="mt-1 text-slate-600">
                            {item.sectionCode ?? '-'} /{' '}
                            {item.parkingSpaceNumber ??
                              item.parkingSpaceCode ??
                              '-'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Total:{' '}
                            {item.totalMinutes != null
                              ? `${item.totalMinutes} min`
                              : '-'}
                          </p>
                        </Td>

                        <Td>
                          <p className="text-slate-700">
                            {formatTime(item.exitTime)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Entry: {formatTime(item.entryTime)}
                          </p>
                        </Td>

                        <Td>
                          <p className="font-bold text-red-700">
                            {formatCurrency(item.unpaidAmount)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Paid: {formatCurrency(item.paidAmount)}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Total: {formatCurrency(item.amount)}
                          </p>
                        </Td>

                        <Td>
                          <div className="space-y-2">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${statusClassName(
                                item.paymentStatus ?? item.status,
                              )}`}
                            >
                              {paymentStatusLabel(item.paymentStatus ?? item.status)}
                            </span>

                            <br />

                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${collectionStatusClassName(
                                item.collectionStatus,
                              )}`}
                            >
                              {item.collectionStatus}
                            </span>

                            {item.collectionLastActionAt ? (
                              <p className="text-xs text-slate-500">
                                Last:{' '}
                                {item.collectionLastAction ?? '-'} ·{' '}
                                {formatTime(item.collectionLastActionAt)}
                              </p>
                            ) : null}

                            {item.additionalFeeRequired ? (
                              <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                                <p className="font-bold">
                                  추가요금 미납:{' '}
                                  {formatCurrency(
                                    Number(item.additionalFeeAmount ?? item.unpaidAmount),
                                  )}
                                </p>
                                {item.additionalFeeReason ? (
                                  <p className="mt-1">
                                    사유:{' '}
                                    {additionalFeeReasonLabel(
                                      item.additionalFeeReason,
                                    )}
                                  </p>
                                ) : null}
                                {item.exitGraceMinutes != null ? (
                                  <p className="mt-1">
                                    결제 후 출차 유예:{' '}
                                    {item.exitGraceMinutes}분
                                  </p>
                                ) : null}
                                {item.exitGraceDeadline ? (
                                  <p className="mt-1">
                                    유예 만료:{' '}
                                    {formatTime(item.exitGraceDeadline)}
                                  </p>
                                ) : null}
                              </div>
                            ) : null}

                            {item.paymentReason ? (
                              <p className="text-xs text-slate-500">
                                {item.paymentReason}
                              </p>
                            ) : null}
                          </div>
                        </Td>

                        <Td>
                          <div className="max-w-72 text-xs">
                            {item.paymentLinkUrl ? (
                              <>
                                <a
                                  href={item.paymentLinkUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="block break-all font-semibold text-blue-700 underline"
                                >
                                  {item.paymentLinkUrl}
                                </a>

                                <button
                                  disabled={busy}
                                  onClick={() =>
                                    onCopyPaymentLink(item)
                                  }
                                  className="mt-2 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 font-bold text-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  Copy
                                </button>
                              </>
                            ) : (
                              <p className="text-slate-400">
                                No link yet
                              </p>
                            )}
                          </div>
                        </Td>

                        <Td>
                          <div className="flex min-w-44 flex-col gap-2">
                            <button
                              disabled={busy || item.unpaidAmount <= 0}
                              onClick={() => onMockPay(item)}
                              className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {busy ? 'Working...' : 'Mock Pay'}
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => onCopyPaymentLink(item)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {copiedInvoiceId === item.invoiceId
                                ? 'Copied'
                                : item.paymentLinkUrl
                                  ? 'Copy Payment Link'
                                  : 'Create & Copy Link'}
                            </button>

                            <button
                              disabled={busy || item.unpaidAmount <= 0}
                              onClick={() => onOpenPaymentRequestMessage(item)}
                              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              미납 청구서 보내기
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => onSendSms(item)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Send SMS
                            </button>

                            <button
                              disabled={busy}
                              onClick={() => onSendEmail(item)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Send Email
                            </button>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
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
                onClick={onCopyPaymentRequestMessage}
                className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700"
              >
                {paymentRequestCopied === 'message'
                  ? '문구 복사됨'
                  : '문구 복사'}
              </button>
              <button
                onClick={onCopyPaymentRequestLink}
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

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-sm font-semibold text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-4 text-slate-700">{children}</td>;
}
