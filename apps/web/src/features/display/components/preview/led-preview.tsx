'use client';

import { parseTxt } from './parse-txt';

type Props = {
  raw: string; // TXT 전체 문자열
};

export function LedPreview({ raw }: Props) {
  const segments = parseTxt(raw);

  return (
    <div className="relative overflow-hidden bg-black p-4 text-xl font-mono h-20 flex items-center">
      <div className="animate-scroll whitespace-nowrap flex gap-1">
        {segments.map((seg, idx) => (
          <span
            key={idx}
            style={{
              color: mapColor(seg.colorCode),
              fontFamily: mapFont(seg.fontCode),
              animation: mapAttr(seg.attrCode),
              transform: `scaleX(${mapWidth(seg.widthCode)})`,
            }}
          >
            {seg.text}
          </span>
        ))}
      </div>

      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(100%);
          }
          100% {
            transform: translateX(-100%);
          }
        }
        .animate-scroll {
          animation: scroll 8s linear infinite;
        }
        @keyframes blink {
          0% { opacity: 1; }
          50% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function mapColor(code: number) {
  const colors = ['white', 'red', 'yellow', 'green', 'cyan', 'blue', 'pink'];
  return colors[code % colors.length];
}

function mapFont(code: number) {
  return ['Gulim', 'Gungsuh', 'Batang', 'Gothic', 'Dotum'][code] ?? 'Gulim';
}

function mapWidth(code: number) {
  return [1, 1.2, 1.4, 1.6][code - 1] ?? 1;
}

function mapAttr(code: number) {
  if (code === 1) return 'blink 1s infinite';
  return 'none';
}
