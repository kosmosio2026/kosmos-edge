'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { useAuth } from '@/components/providers/auth-provider';
import { apiFetch } from '@/lib/api-client';

type Area = 'admin' | 'manager' | 'operator';
type Mode = 'invoice' | 'receipt';

type Props = {
  area: Area;
  mode: Mode;
  documentId: string;
};

function formatMoney(value: unknown) {
  const amount = Number(value ?? 0);

  if (!Number.isFinite(amount)) return '-';

  return `${amount.toLocaleString('ko-KR')}원`;
}

function formatDateTime(value: unknown) {
  if (!value) return '-';

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
  });
}

function getObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value);
    }
  }

  return '-';
}

export function InvoiceDocumentPage({ area, mode, documentId }: Props) {
  const { session } = useAuth();

  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const backHref = `/${area}/parking/history`;

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError('');

      try {
        const result = await apiFetch(`/invoices/${encodeURIComponent(documentId)}/public`, {
          accessToken: session?.accessToken,
        });

        if (alive) {
          setPayload(result);
        }
      } catch (error) {
        if (alive) {
          setError(
            error instanceof Error
              ? error.message
              : '청구서 정보를 불러오지 못했습니다.',
          );
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      alive = false;
    };
  }, [documentId, session?.accessToken]);

  const invoice = getObject(payload?.invoice ?? payload);
  const sessionInfo = getObject(payload?.session ?? invoice.session);
  const receipt = getObject(payload?.receipt ?? invoice.receipt ?? getObject(invoice.metadata).receipt);
  const metadata = getObject(invoice.metadata);

  const title = mode === 'receipt' ? '영수증' : '청구서';

  const rows = useMemo(
    () => [
      ['문서 번호', mode === 'receipt'
        ? firstText(receipt.receiptNo, receipt.receiptNumber, invoice.invoiceNo)
        : firstText(invoice.invoiceNo, invoice.id)],
      ['청구서 ID', firstText(invoice.invoiceId, invoice.id, documentId)],
      ['상태', firstText(invoice.status, invoice.paymentStatus)],
      ['차량번호', firstText(invoice.plateNumber, sessionInfo.plateNumber, metadata.plateNumber, metadata.vehicleNumber)],
      ['주차장', firstText(invoice.parkingLotName, sessionInfo.parkingLotName, metadata.parkingLotName)],
        ['구역/주차면', firstText(
          [invoice.sectionCode, invoice.parkingSpaceNumber].filter(Boolean).join(' / '),
          [sessionInfo.sectionName, sessionInfo.parkingSpaceCode].filter(Boolean).join(' / '),
          metadata.parkingSpaceCode,
        )],
      ['입차 시간', formatDateTime(invoice.entryTime ?? sessionInfo.entryTime ?? metadata.entryTime ?? metadata.billingPeriodStartAt)],
      ['출차 시간', formatDateTime(invoice.exitTime ?? sessionInfo.exitTime ?? metadata.exitTime ?? metadata.billingPeriodEndAt)],
      ['발행일', formatDateTime(invoice.issuedAt ?? invoice.createdAt)],
      ['납부일', formatDateTime(invoice.paidAt ?? receipt.paidAt ?? receipt.createdAt)],
      ['기본 금액', formatMoney(invoice.amount)],
      ['할인 금액', formatMoney(invoice.discountAmount)],
      ['납부 금액', formatMoney(invoice.paidAmount ?? receipt.amount)],
      ['미납 금액', formatMoney(invoice.unpaidAmount)],

      ...(() => {

        const taxInvoice = invoice as any;

        const totalAmountForTax = Number(

          taxInvoice.finalAmount ?? taxInvoice.amount ?? 0,

        );

        const taxType = String(taxInvoice.taxType ?? 'VAT_INCLUDED');

        const taxTypeLabel = taxType === 'TAX_EXEMPT' ? '면세' : '부가세 포함';

        const fallbackSupplyAmount =

          taxType === 'TAX_EXEMPT'

            ? totalAmountForTax

            : Math.round((totalAmountForTax * 10) / 11);

        const supplyAmount = Number(taxInvoice.supplyAmount ?? fallbackSupplyAmount);

        const vatAmount = Number(

          taxInvoice.vatAmount ??

            (taxType === 'TAX_EXEMPT'

              ? 0

              : Math.max(0, totalAmountForTax - supplyAmount)),

        );

        const taxExemptAmount = Number(

          taxInvoice.taxExemptAmount ??

            (taxType === 'TAX_EXEMPT' ? totalAmountForTax : 0),

        );



        return [

          ['과세 구분', taxTypeLabel],

          ['공급가액', formatMoney(supplyAmount)],

          ['부가세', formatMoney(vatAmount)],

          ...(taxType === 'TAX_EXEMPT'

            ? [['면세 금액', formatMoney(taxExemptAmount)]]

            : []),

        ];

      })(),

      ['총 청구금액', formatMoney(invoice.finalAmount ?? invoice.amount)],
    ],
    [documentId, invoice, metadata, mode, receipt, sessionInfo],
  );

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <section className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-500">
              Parking Billing
            </p>
            <h1 className="mt-1 text-3xl font-black text-slate-950">
              {title}
            </h1>
          </div>

          <div className="flex gap-2">
            <Link
              href={backHref}
              className="rounded-xl border bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100"
            >
              주차 이력으로
            </Link>

            {mode === 'invoice' && invoice.invoiceId && Number(invoice.unpaidAmount ?? 0) > 0 ? (
              <Link
                href={`/pay/invoice/${invoice.invoiceId}`}
                className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-bold text-white"
              >
                결제 페이지
              </Link>
            ) : null}
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl bg-white p-10 text-center text-slate-500 shadow-sm">
            {title} 정보를 불러오는 중입니다.
          </div>
        ) : null}

        {error ? (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-6 text-red-700">
            <p className="font-black">{title} 정보를 찾을 수 없습니다.</p>
            <p className="mt-2 text-sm">{error}</p>
            <p className="mt-2 text-sm text-red-600">
              주차 이력 데이터에 invoiceId가 없거나, 아직 청구서가 생성되지 않은 건일 수 있습니다.
            </p>
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="rounded-3xl bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold text-slate-500">
                    {mode === 'receipt' ? 'Receipt' : 'Invoice'}
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">
                    {mode === 'receipt'
                      ? firstText(receipt.receiptNo, receipt.receiptNumber, invoice.invoiceNo)
                      : firstText(invoice.invoiceNo, invoice.id)}
                  </h2>
                </div>

                <div className="rounded-2xl bg-slate-100 px-5 py-3 text-right">
                  <p className="text-xs font-bold text-slate-500">상태</p>
                  <p className="mt-1 text-lg font-black text-slate-950">
                    {firstText(invoice.status, invoice.paymentStatus)}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">최종 금액</p>
                  <p className="mt-1 text-2xl font-black text-slate-950">
                    {formatMoney(invoice.finalAmount ?? invoice.amount)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">납부 금액</p>
                  <p className="mt-1 text-2xl font-black text-emerald-700">
                    {formatMoney(invoice.paidAmount ?? receipt.amount)}
                  </p>
                </div>

                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="text-xs font-bold text-slate-500">미납 금액</p>
                  <p className="mt-1 text-2xl font-black text-red-700">
                    {formatMoney(invoice.unpaidAmount)}
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
              <table className="w-full text-sm">
                <tbody>
                  {rows.map(([label, value]) => (
                    <tr key={label} className="border-b last:border-b-0">
                      <th className="w-44 bg-slate-50 px-5 py-4 text-left font-black text-slate-600">
                        {label}
                      </th>
                      <td className="px-5 py-4 text-slate-900">
                        {value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {mode === 'receipt' && !receipt.receiptNo && !receipt.receiptNumber ? (
              <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">

              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </main>
  );
}
