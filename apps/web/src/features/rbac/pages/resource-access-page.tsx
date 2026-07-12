'use client';

export default function ResourceAccessPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Resource Access</h1>
        <p className="text-sm text-slate-500">
          주차장, 구역, 주차면 단위 접근 권한을 관리합니다.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        Resource access matrix
      </div>
    </div>
  );
}