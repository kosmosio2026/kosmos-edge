'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/auth-provider';
import { sendInsertAd } from '@/lib/led-api';

type LineConfig = {
  line: number;
  fontSize: number;
  effect: string;
  speed: number;
  delay: number;
  neon: number;
  fix: boolean;
  colorCode: number;
  fontCode: number;
  widthCode: number;
  attrCode: number;
  text: string;
};

export default function AdEditorPage() {
  const { session } = useAuth();
  const [idx, setIdx] = useState(1);
  const [isEvent, setIsEvent] = useState(false);
  const [resetBefore, setResetBefore] = useState(false);

  const [lines, setLines] = useState<LineConfig[]>([
    {
      line: 1,
      fontSize: 2,
      effect: '040004000400',
      speed: 2,
      delay: 1,
      neon: 0,
      fix: false,
      colorCode: 0,
      fontCode: 0,
      widthCode: 1,
      attrCode: 0,
      text: '안녕하세요',
    },
  ]);

  const buildDataString = () => {
    // 단일 라인만 예시, 실제로는 여러 라인 조합 가능
    const l = lines[0];
    const txtPrefix =
      `$c${l.colorCode.toString().padStart(2, '0')}` +
      `$f${l.fontCode.toString().padStart(2, '0')}` +
      `$w${l.widthCode.toString().padStart(2, '0')}` +
      `$a${l.attrCode.toString().padStart(2, '0')}`;

    return [
      `LNE=${l.line}`,
      `YSZ=${l.fontSize}`,
      `EFF=${l.effect}`,
      `SPD=${l.speed}`,
      `DLY=${l.delay}`,
      `NEN=${l.neon}`,
      `FIX=${l.fix ? 1 : 0}`,
      `TXT=${txtPrefix}${l.text}`,
    ].join(',');
  };

  const onApply = async () => {
    if (!session?.accessToken) return;

    const dataString = buildDataString();
    await sendInsertAd(session.accessToken, {
      dataString,
      rst: resetBefore,
      evt: isEvent,
    });
  };

  return (
    <div className="grid grid-cols-3 gap-6 p-6">
      {/* 좌측: 광고 기본 설정 */}
      <div className="space-y-4 rounded-3xl border bg-white p-4">
        <h2 className="font-semibold">Ad Settings</h2>
        <label className="block text-sm">
          IDX
          <input
            type="number"
            min={1}
            max={12}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="mt-1 w-full rounded border p-2"
          />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isEvent}
            onChange={(e) => setIsEvent(e.target.checked)}
          />
          EVT (이벤트/응급문구)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={resetBefore}
            onChange={(e) => setResetBefore(e.target.checked)}
          />
          RST (기존 광고 초기화 후 전송)
        </label>
        <button
          onClick={onApply}
          className="mt-4 w-full rounded bg-blue-600 py-2 text-white"
        >
          전광판에 적용
        </button>
      </div>

      {/* 중앙: 라인 설정 (간단 버전) */}
      <div className="space-y-4 rounded-3xl border bg-white p-4">
        <h2 className="font-semibold">Line 1</h2>
        {/* 폰트 크기, 효과, 속도, 색상 등은 seed 데이터로 드롭다운 구성 가능 */}
        {/* 여기서는 간단히 입력만 예시 */}
        <label className="block text-sm">
          Text
          <input
            className="mt-1 w-full rounded border p-2"
            value={lines[0].text}
            onChange={(e) =>
              setLines((prev) => [
                { ...prev[0], text: e.target.value },
              ])
            }
          />
        </label>
      </div>

      {/* 우측: 미리보기 (시뮬레이터와 공유) */}
      <div className="space-y-4 rounded-3xl border bg-black p-4 text-green-400">
        <h2 className="font-semibold text-white">Preview</h2>
        <div className="mt-4 rounded bg-black p-4 font-mono text-xl">
          {lines[0].text}
        </div>
      </div>
    </div>
  );
}
