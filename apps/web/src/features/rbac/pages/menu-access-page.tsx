'use client';

export default function MenuAccessPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Menu Access</h1>
        <p className="text-sm text-slate-500">
          역할별 메뉴 접근 권한을 관리합니다.
        </p>
      </div>

      <div className="rounded-2xl bg-white p-6 shadow-sm">
        Menu access matrix
      </div>
    </div>
  );
}