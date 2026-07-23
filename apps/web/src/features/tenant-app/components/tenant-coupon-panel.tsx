'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type Product = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  benefitType: string;
  benefitValue: number;
  salePrice: number;
  validityMonths: number;
  stackableWithAutomaticDiscount?: boolean;
  isActive: boolean;
};

type InventoryItem = {
  product: Product;
  total: number;
  available: number;
  assigned: number;
  reserved: number;
  used: number;
  expired: number;
  cancelled: number;
};

type Purchase = {
  id: string;
  purchaseNo: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paidAmount: number;
  status: string;
  requestedAt?: string | null;
  issuedAt?: string | null;
  product: Product;
  _count?: { coupons?: number };
};

type Member = {
  id: string;
  name: string;
  phoneMasked?: string | null;
  vehicles?: Array<{
    isPrimary?: boolean;
    vehicle?: {
      id: string;
      plateNumber?: string | null;
      sizeClass?: string | null;
      powertrainType?: string | null;
    };
  }>;
};

type Assignment = {
  id: string;
  codeMasked: string;
  status: string;
  assignedAt?: string | null;
  expiresAt?: string | null;
  product: Product;
  assignedMember?: {
    id: string;
    name: string;
    phone?: string | null;
  } | null;
};

function money(value?: number | null) {
  return `${Number(value ?? 0).toLocaleString('ko-KR')}원`;
}

function dateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('ko-KR');
}

function benefit(product: Product) {
  if (product.benefitType === 'PERCENT') return `${product.benefitValue}% 할인`;
  if (product.benefitType === 'FREE_MINUTES') return `${product.benefitValue}분 무료`;
  if (product.benefitType === 'FULL_WAIVER') return '주차요금 전액 할인';
  return `${money(product.benefitValue)} 할인`;
}

function purchaseStatus(status: string) {
  const labels: Record<string, string> = {
    REQUESTED: '구매 요청',
    PAYMENT_PENDING: '입금 확인 대기',
    PAYMENT_CONFIRMED: '입금 확인',
    ISSUED: '발행 완료',
    CANCELLED: '취소',
  };
  return labels[status] ?? status;
}

function couponStatus(status: string) {
  const labels: Record<string, string> = {
    AVAILABLE: '사용 가능',
    ASSIGNED: '회원 증정',
    RESERVED: '결제 예약',
    USED: '사용 완료',
    EXPIRED: '만료',
    CANCELLED: '취소',
  };
  return labels[status] ?? status;
}

export type TenantCouponView = 'purchase' | 'inventory' | 'assign' | 'assignments';

export function TenantCouponPanel({
  accessToken,
  view,
}: {
  accessToken: string;
  view: TenantCouponView;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(10);
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [assignProductId, setAssignProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [purchaseSaving, setPurchaseSaving] = useState(false);
  const [memberSearching, setMemberSearching] = useState(false);
  const [assignSaving, setAssignSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const availableInventory = useMemo(
    () => inventory.filter((item) => item.available > 0),
    [inventory],
  );

  async function loadAll() {
    setLoading(true);
    setError('');
    try {
      const [productRows, purchaseRows, inventoryRows, assignmentRows] =
        await Promise.all([
          apiFetch<Product[]>('/tenant-app/coupon-products', { accessToken }),
          apiFetch<Purchase[]>('/tenant-app/coupon-purchases', { accessToken }),
          apiFetch<InventoryItem[]>('/tenant-app/coupon-inventory', { accessToken }),
          apiFetch<Assignment[]>('/tenant-app/coupon-assignments', { accessToken }),
        ]);
      setProducts(productRows);
      setPurchases(purchaseRows);
      setInventory(inventoryRows);
      setAssignments(assignmentRows);
      if (!selectedProductId && productRows[0]) setSelectedProductId(productRows[0].id);
      if (!assignProductId) {
        const firstAvailable = inventoryRows.find((item) => item.available > 0);
        if (firstAvailable) setAssignProductId(firstAvailable.product.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '할인권 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function createPurchase() {
    if (!selectedProductId) {
      setError('구매할 할인권 상품을 선택해 주세요.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      setError('구매 수량은 1~10,000장으로 입력해 주세요.');
      return;
    }

    setPurchaseSaving(true);
    setError('');
    setMessage('');
    try {
      await apiFetch('/tenant-app/coupon-purchases', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({ productId: selectedProductId, quantity }),
      });
      setMessage('구매 신청이 접수되었습니다. 매니저가 입금을 확인하면 할인권이 발행됩니다.');
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '구매 신청에 실패했습니다.');
    } finally {
      setPurchaseSaving(false);
    }
  }

  async function searchMembers() {
    if (memberQuery.trim().length < 2) {
      setError('전화번호 또는 차량번호를 2자 이상 입력해 주세요.');
      return;
    }

    setMemberSearching(true);
    setError('');
    setMessage('');
    try {
      const rows = await apiFetch<Member[]>(
        `/tenant-app/coupon-members/search?q=${encodeURIComponent(memberQuery.trim())}`,
        { accessToken },
      );
      setMembers(rows);
      setSelectedMemberId(rows[0]?.id ?? '');
      if (rows.length === 0) setMessage('검색된 등록 회원이 없습니다.');
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원 검색에 실패했습니다.');
    } finally {
      setMemberSearching(false);
    }
  }

  async function assignCoupon() {
    if (!assignProductId || !selectedMemberId) {
      setError('증정할 상품과 회원을 선택해 주세요.');
      return;
    }

    setAssignSaving(true);
    setError('');
    setMessage('');
    try {
      const assigned = await apiFetch<Assignment>('/tenant-app/coupons/assign', {
        method: 'POST',
        accessToken,
        body: JSON.stringify({
          productId: assignProductId,
          memberUserId: selectedMemberId,
        }),
      });
      setMessage(`${assigned.assignedMember?.name ?? '회원'}에게 할인권을 증정했습니다.`);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : '할인권 증정에 실패했습니다.');
    } finally {
      setAssignSaving(false);
    }
  }

  useEffect(() => {
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <div className="grid gap-4">
      {error ? <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700">{error}</div> : null}
      {message ? <div className="rounded-2xl bg-sky-50 p-4 text-sm font-bold text-sky-700">{message}</div> : null}

      {view === 'purchase' ? (
      <section className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-950">구매 신청</h3>
            <p className="mt-1 text-xs leading-5 text-slate-500">선불 구매 신청 후 입금이 확인되면 개별 할인권이 발행됩니다.</p>
          </div>
          <button type="button" onClick={() => void loadAll()} disabled={loading} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50">새로고침</button>
        </div>

        <div className="mt-4 grid gap-3">
          <select value={selectedProductId} onChange={(event) => setSelectedProductId(event.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none">
            <option value="">상품 선택</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {benefit(product)} · 장당 {money(product.salePrice)}</option>)}
          </select>
          <input type="number" min={1} max={10000} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none" />
          <button type="button" onClick={createPurchase} disabled={purchaseSaving || loading} className="h-12 rounded-2xl bg-sky-600 text-sm font-bold text-white disabled:opacity-50">{purchaseSaving ? '신청 중...' : '구매 신청'}</button>
        </div>
      </section>
      ) : null}

      {view === 'inventory' ? (
      <section className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-950">보유 할인권 현황</h3>
          <button type="button" onClick={() => void loadAll()} disabled={loading} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50">새로고침</button>
        </div>
        <div className="mt-3 grid gap-3">
          {inventory.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">발행된 할인권이 없습니다.</p> : inventory.map((item) => (
            <div key={item.product.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
              <div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-950">{item.product.name}</p><p className="mt-1 text-xs text-slate-500">{benefit(item.product)} · 장당 {money(item.product.salePrice)}</p></div><span className="rounded-full bg-sky-50 px-3 py-1 text-xs font-bold text-sky-700">총 {item.total}장</span></div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs"><Stock label="사용 가능" value={item.available} /><Stock label="회원 증정" value={item.assigned} /><Stock label="예약" value={item.reserved} /><Stock label="사용" value={item.used} /><Stock label="만료" value={item.expired} /><Stock label="취소" value={item.cancelled} /></div>
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {view === 'assign' ? (
      <section className="rounded-2xl bg-slate-50 p-4">
        <h3 className="font-bold text-slate-950">회원 조회 및 할인권 증정</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500">등록 회원의 전화번호 또는 차량번호로 검색합니다. 방문객에게는 증정할 수 없습니다.</p>
        <div className="mt-3 flex gap-2"><input value={memberQuery} onChange={(event) => setMemberQuery(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void searchMembers(); }} placeholder="01012345678 또는 12가3456" className="h-12 min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm outline-none" /><button type="button" onClick={searchMembers} disabled={memberSearching} className="rounded-2xl bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-50">{memberSearching ? '검색 중' : '검색'}</button></div>
        <div className="mt-3 grid gap-2">{members.map((member) => { const plates = member.vehicles?.map((item) => item.vehicle?.plateNumber).filter(Boolean).join(', ') || '-'; return <button key={member.id} type="button" onClick={() => setSelectedMemberId(member.id)} className={`rounded-2xl p-4 text-left ring-1 ${selectedMemberId === member.id ? 'bg-sky-50 ring-sky-300' : 'bg-white ring-slate-200'}`}><p className="font-bold text-slate-950">{member.name}</p><p className="mt-1 text-xs text-slate-500">{member.phoneMasked ?? '-'} · {plates}</p></button>; })}</div>
        <div className="mt-3 grid gap-3"><select value={assignProductId} onChange={(event) => setAssignProductId(event.target.value)} className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold outline-none"><option value="">증정 상품 선택</option>{availableInventory.map((item) => <option key={item.product.id} value={item.product.id}>{item.product.name} · 사용 가능 {item.available}장</option>)}</select><button type="button" onClick={assignCoupon} disabled={assignSaving || !selectedMemberId || !assignProductId} className="h-12 rounded-2xl bg-emerald-600 text-sm font-bold text-white disabled:opacity-50">{assignSaving ? '증정 중...' : '선택 회원에게 1장 증정'}</button></div>
      </section>
      ) : null}

      {view === 'purchase' ? (
      <section className="rounded-2xl bg-slate-50 p-4">
        <h3 className="font-bold text-slate-950">구매 신청 이력</h3>
        <div className="mt-3 grid gap-2">{purchases.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">구매 신청 이력이 없습니다.</p> : purchases.map((purchase) => <div key={purchase.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="flex justify-between gap-3"><div><p className="font-bold text-slate-950">{purchase.product.name}</p><p className="mt-1 text-xs text-slate-500">{purchase.purchaseNo} · {dateTime(purchase.requestedAt)}</p></div><span className="text-xs font-bold text-sky-700">{purchaseStatus(purchase.status)}</span></div><div className="mt-2 flex justify-between text-sm"><span>{purchase.quantity}장</span><span className="font-bold">{money(purchase.totalAmount)}</span></div></div>)}</div>
      </section>
      ) : null}

      {view === 'assignments' ? (
      <section className="rounded-2xl bg-slate-50 p-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold text-slate-950">증정 이력</h3>
          <button type="button" onClick={() => void loadAll()} disabled={loading} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-700 ring-1 ring-slate-200 disabled:opacity-50">새로고침</button>
        </div>
        <div className="mt-3 grid gap-2">{assignments.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-slate-500">증정 이력이 없습니다.</p> : assignments.map((assignment) => <div key={assignment.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200"><div className="flex justify-between gap-3"><div><p className="font-bold text-slate-950">{assignment.assignedMember?.name ?? '-'}</p><p className="mt-1 text-xs text-slate-500">{assignment.product.name} · {assignment.codeMasked}</p></div><span className="text-xs font-bold text-slate-600">{couponStatus(assignment.status)}</span></div><p className="mt-2 text-xs text-slate-500">증정 {dateTime(assignment.assignedAt)} · 만료 {dateTime(assignment.expiresAt)}</p></div>)}</div>
      </section>
      ) : null}
    </div>
  );
}

function Stock({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-slate-50 px-2 py-3"><p className="text-slate-400">{label}</p><p className="mt-1 text-base font-black text-slate-900">{value}</p></div>;
}
