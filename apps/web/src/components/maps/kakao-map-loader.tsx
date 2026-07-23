'use client';

import { useEffect, useMemo, useState } from 'react';

declare global {
  interface Window {
    kakao: any;
  }
}

type KakaoMapLoaderState = {
  ready: boolean;
  loading: boolean;
  error: string | null;
  appKeyConfigured: boolean;
};

export function useKakaoMapLoader(): KakaoMapLoaderState {
  const appKey =
    process.env.NEXT_PUBLIC_KAKAO_JS_KEY ||
    process.env.NEXT_PUBLIC_KAKAO_MAP_KEY ||
    '';

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(Boolean(appKey));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appKey) {
      setReady(false);
      setLoading(false);
      setError('Kakao 지도 JavaScript 키가 설정되지 않았습니다.');
      return;
    }

    if (typeof window === 'undefined') return;

    if (window.kakao?.maps) {
      window.kakao.maps.load(() => {
        setReady(true);
        setLoading(false);
        setError(null);
      });
      return;
    }

    const existing = document.getElementById('kakao-map-sdk') as HTMLScriptElement | null;

    if (existing) {
      existing.addEventListener('load', () => {
        window.kakao?.maps?.load(() => {
          setReady(true);
          setLoading(false);
          setError(null);
        });
      });

      existing.addEventListener('error', () => {
        setReady(false);
        setLoading(false);
        setError('Kakao 지도 SDK를 불러오지 못했습니다.');
      });

      return;
    }

    const script = document.createElement('script');
    script.id = 'kakao-map-sdk';
    script.async = true;
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false&libraries=services`;

    script.onload = () => {
      if (!window.kakao?.maps) {
        setReady(false);
        setLoading(false);
        setError('Kakao 지도 SDK가 정상적으로 초기화되지 않았습니다.');
        return;
      }

      window.kakao.maps.load(() => {
        setReady(true);
        setLoading(false);
        setError(null);
      });
    };

    script.onerror = () => {
      setReady(false);
      setLoading(false);
      setError('Kakao 지도 SDK를 불러오지 못했습니다. 키 또는 도메인 등록 상태를 확인하세요.');
    };

    document.head.appendChild(script);
  }, [appKey]);

  return useMemo(
    () => ({
      ready,
      loading,
      error,
      appKeyConfigured: Boolean(appKey),
    }),
    [ready, loading, error, appKey],
  );
}
