'use client';

import { Card } from '@/components/ui/card';

export function KakaoMapEditor({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <Card className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-muted">{description}</p>
      <div className="flex h-[420px] items-center justify-center rounded-2xl border bg-background text-sm text-muted">
        Kakao Map editor placeholder
      </div>
    </Card>
  );
}