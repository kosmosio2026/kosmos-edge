'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { API_BASE, apiFetch, getToken } from './watcher-utils';

type Props = {
  id: string;
};

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


async function resizeImageForOcr(file: File, maxWidth = 1280, quality = 0.78) {
  const dataUrl = await readFileAsDataUrl(file);

  return new Promise<string>((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const scale = Math.min(1, maxWidth / image.width);
      const width = Math.round(image.width * scale);
      const height = Math.round(image.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext('2d');
      if (!context) {
        reject(new Error('이미지 처리에 실패했습니다.'));
        return;
      }

      context.drawImage(image, 0, 0, width, height);

      // OCR용 축소/압축 base64.
      // 실제 OCR Provider 전환 시 이 값을 서버로 보낸다.
      resolve(canvas.toDataURL('image/jpeg', quality));
    };

    image.onerror = () => reject(new Error('이미지를 읽을 수 없습니다.'));
    image.src = dataUrl;
  });
}


async function uploadVehiclePlatePhoto(file: File) {
  const token = getToken();
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch(`${API_BASE}/files/vehicle-plate-photos`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(json?.message ?? json?.details?.message ?? '차량번호 사진 업로드에 실패했습니다.');
  }

  return json as {
    imageUrl: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
  };
}

export default function WatcherEnforcementDetailPage({ id }: Props) {
  const router = useRouter();

  const [items, setItems] = useState<any[]>([]);
  const [vehiclePlateNumber, setVehiclePlateNumber] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [vehiclePlatePhotoUrl, setVehiclePlatePhotoUrl] = useState('');
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [plateHint, setPlateHint] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [ocrMessage, setOcrMessage] = useState<string | null>(null);
  const [ocrResult, setOcrResult] = useState<any>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  const item = useMemo(() => items.find((x) => x.id === id), [items, id]);

  async function load() {
    const json = await apiFetch('/watcher/enforcement-cases');
    setItems(Array.isArray(json) ? json : []);
  }

  async function recognizePlate(file: File) {
    setRecognizing(true);
    setOcrMessage(null);
    setMessage(null);

    try {
      const preview = await readFileAsDataUrl(file);
      setPhotoPreviewUrl(preview);

      const uploaded = await uploadVehiclePlatePhoto(file);
      setVehiclePlatePhotoUrl(uploaded.imageUrl);

      const token = getToken();

      // 중요:
      // Mock OCR 단계에서는 imageBase64를 서버로 보내지 않는다.
      // 큰 원본 base64 JSON payload 때문에 500/Internal Server Error가 발생할 수 있다.
      //
      // 실제 OCR Provider 전환 시:
      // const ocrImageBase64 = await resizeImageForOcr(file, 1280, 0.78);
      // body에 imageBase64: ocrImageBase64 를 추가한다.
      //
      // DB에는 base64를 저장하지 않는다.
      // DB에는 업로드 endpoint가 반환한 imageUrl만 저장한다.
      const res = await fetch(`${API_BASE}/plate-recognition/recognize`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageUrl: uploaded.imageUrl,
          fileName: uploaded.originalName ?? file.name,
          plateHint,
        }),
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message ?? json?.details?.message ?? '차량번호 인식에 실패했습니다.');
      }

      if (json.plateNumber) {
        setVehiclePlateNumber(json.plateNumber);
      }

      setOcrResult(json);

      setOcrMessage(
        `Mock OCR: ${json.plateNumber ?? '-'} · confidence ${json.confidence ?? '-'} · ${json.provider}`,
      );
    } catch (err: any) {
      setOcrMessage(err.message ?? '차량번호 인식에 실패했습니다.');
    } finally {
      setRecognizing(false);
    }
  }

  async function submit() {
    if (submitting || completed) return;

    if (!vehiclePlateNumber) {
      setMessage('차량번호를 입력하세요.');
      return;
    }

    if (!vehiclePlatePhotoUrl) {
      setMessage('차량번호 사진을 업로드하세요.');
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      await apiFetch(`/watcher/enforcement-cases/${id}/register-proxy`, {
        method: 'POST',
        body: JSON.stringify({
          vehiclePlateNumber,
          contactPhone,
          note,
          vehiclePlatePhotoUrl,
          ocrResult: ocrResult ?? null,
        }),
      });

      setCompleted(true);
      setMessage('직권 등록이 완료되었습니다. 단속 목록으로 이동합니다.');

      setTimeout(() => {
        router.replace('/watcher/enforcement');
        router.refresh();
      }, 800);
    } catch (err: any) {
      setMessage(err.message ?? '직권 등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setMessage(err.message));
  }, [id]);

  const space =
    item?.parkingSession?.ParkingSpace ??
    item?.parkingSession?.parkingSpace ??
    null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 w-full max-w-none">
      <section className="w-full max-w-none">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">직권 등록</h1>
          <button
            onClick={() => router.push('/watcher/enforcement')}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            목록
          </button>
        </div>

        <div className="mt-5 rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">주차면</p>
          <p className="mt-1 text-2xl font-bold">{space?.code ?? item?.parkingSpaceId ?? id}</p>
          <p className="mt-2 text-sm text-slate-500">{item?.parkingLot?.name}</p>
          <p className="mt-1 text-xs text-slate-400">상태: {item?.status ?? '-'}</p>
        </div>

        {!item && !completed && (
          <div className="mt-4 rounded-3xl bg-amber-50 p-5 text-sm text-amber-700 shadow-sm">
            이 단속 건은 현재 OPEN 목록에 없습니다. 이미 처리되었거나 목록이 갱신되었을 수 있습니다.
          </div>
        )}

        <div className="mt-4 space-y-3 rounded-3xl bg-white p-5 shadow-sm">
          <div className="rounded-2xl bg-blue-50 p-4 text-sm text-blue-700">
            차량번호 사진을 업로드하면 현재는 Mock OCR로 차번을 자동 입력합니다.
            실제 국내 차번 인식 모듈은 추후 Provider 교체 방식으로 구현합니다.
          </div>

          <input
            value={plateHint}
            onChange={(event) => setPlateHint(event.target.value)}
            placeholder="Mock 테스트용 차번 힌트. 예: 33다3333"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            disabled={completed}
          />

          <label className="block">
            <span className="text-sm font-semibold">차량번호 사진</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              disabled={completed}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) recognizePlate(file);
              }}
              className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm"
            />
          </label>

          {photoPreviewUrl && (
            <img
              src={photoPreviewUrl}
              alt="차량번호 사진 미리보기"
              className="max-h-64 w-full rounded-2xl object-cover"
            />
          )}

          {ocrMessage && (
            <div className="rounded-2xl bg-slate-100 p-3 text-sm text-slate-700">
              {ocrMessage}
            </div>
          )}

          <input
            value={vehiclePlateNumber}
            onChange={(event) => setVehiclePlateNumber(event.target.value)}
            placeholder="차량번호를 입력하세요. 예: 12가3456"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            disabled={completed}
          />

          <input
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="연락처를 입력하세요. 예: 01012345678"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            disabled={completed}
          />

          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="메모를 입력하세요."
            className="min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm"
            disabled={completed}
          />

          <button
            onClick={submit}
            disabled={recognizing || submitting || completed}
            className="w-full rounded-2xl bg-blue-600 py-3 font-bold text-white disabled:bg-slate-300"
          >
            {completed
              ? '등록 완료'
              : submitting
                ? '등록 처리 중...'
                : recognizing
                  ? '차량번호 인식 중...'
                  : '직권 등록'}
          </button>

          {message && <p className="rounded-2xl bg-slate-100 p-3 text-sm">{message}</p>}

          {completed && (
            <button
              onClick={() => router.replace('/watcher/logs')}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 font-bold text-slate-700"
            >
              직권 등록 이력 보기
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
