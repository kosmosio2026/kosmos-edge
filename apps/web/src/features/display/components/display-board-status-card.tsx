import Link from 'next/link';

export function DisplayBoardStatusCard({ board }: { board: any }) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{board.name}</h2>
          <div className="text-sm text-slate-500">{board.code}</div>
        </div>

        <Link
          href={`/display/settings/${board.id}`}
          className="rounded bg-blue-600 px-3 py-1 text-white text-sm"
        >
          설정
        </Link>
      </div>

      <div className="mt-4 text-sm">
        <div>IP: {board.ipAddress ?? '-'}</div>
        <div>Mode: {board.protocolMode}</div>
        <div>Last Sync: {board.lastSyncAt ?? '-'}</div>
      </div>
    </div>
  );
}
