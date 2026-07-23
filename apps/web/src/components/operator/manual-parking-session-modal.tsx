'use client';

import { useEffect, useMemo, useState } from 'react';

import { apiFetch } from '@/lib/api-client';

export type ManualParkingAction = 'entry' | 'exit';

export type ManualParkingTarget = {
  id: string;
  code: string;
  lotName?: string | null;
  sectionName?: string | null;
  operationMode?: string | null;
  activeSession?: Record<string, unknown> | null;
};

type Props = {
  open: boolean;
  action: ManualParkingAction;
  target: ManualParkingTarget | null;
  accessToken?: string | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
};

type ManualEntryResponse = {
  ok?: boolean;
  id?: string;
  item?: {
    id?: string;
    sessionId?: string;
  };
  data?: {
    id?: string;
    sessionId?: string;
  };
  session?: {
    id?: string;
    sessionId?: string;
  };
};

type UploadResponse = {
  ok?: boolean;
  url?: string;
  imageUrl?: string;
  fileUrl?: string;
  path?: string;
  data?: {
    url?: string;
    imageUrl?: string;
    fileUrl?: string;
    path?: string;
  };
  file?: {
    url?: string;
    imageUrl?: string;
    fileUrl?: string;
    path?: string;
  };
  item?: {
    url?: string;
    imageUrl?: string;
    fileUrl?: string;
    path?: string;
  };
  message?: string;
};

function text(value: unknown) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function numberOrEmpty(value: unknown) {
  if (value === null || value === undefined || value === '') return '';
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return '';
  return String(numberValue);
}

function formatDateTime(value: unknown) {
  const raw = text(value);
  if (!raw) return '-';

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '-';

  return date.toLocaleString('ko-KR');
}

function formatCurrency(value: unknown) {
  const numberValue = Number(value ?? 0);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return '-';
  return `${numberValue.toLocaleString()}원`;
}

function getSessionValue(
  session: Record<string, unknown> | null | undefined,
  ...keys: string[]
) {
  if (!session) return null;

  for (const key of keys) {
    const value = session[key];
    if (value !== null && value !== undefined && value !== '') {
      return value;
    }
  }

  return null;
}

function extractManualEntrySessionId(response: ManualEntryResponse) {
  return (
    response.item?.id ??
    response.item?.sessionId ??
    response.data?.id ??
    response.data?.sessionId ??
    response.session?.id ??
    response.session?.sessionId ??
    response.id ??
    ''
  );
}

function getUploadApiBase() {
  return (
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE ??
    '/api'
  ).replace(/\/$/, '');
}

const MANUAL_ENTRY_PHOTO_MAX_BYTES = 900 * 1024;
const MANUAL_ENTRY_PHOTO_MAX_EDGES = [1600, 1280, 1024, 800];
const MANUAL_ENTRY_PHOTO_QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.42];

function getCompressedFileName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, '') || 'manual-entry-photo';
  return `${baseName}.jpg`;
}

function loadImageElement(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('이미지를 읽지 못했습니다. JPG 또는 PNG 사진으로 다시 시도하세요.'));
    };

    image.src = objectUrl;
  });
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('이미지 압축에 실패했습니다.'));
          return;
        }

        resolve(blob);
      },
      'image/jpeg',
      quality,
    );
  });
}

async function compressImageForUpload(file: File) {
  if (!file.type.startsWith('image/')) {
    throw new Error('사진 파일만 업로드할 수 있습니다.');
  }

  if (file.size <= MANUAL_ENTRY_PHOTO_MAX_BYTES && file.type === 'image/jpeg') {
    return file;
  }

  const image = await loadImageElement(file);
  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (!originalWidth || !originalHeight) {
    throw new Error('이미지 크기를 확인하지 못했습니다.');
  }

  let fallbackFile: File | null = null;

  for (const maxEdge of MANUAL_ENTRY_PHOTO_MAX_EDGES) {
    const scale = Math.min(1, maxEdge / Math.max(originalWidth, originalHeight));
    const width = Math.max(1, Math.round(originalWidth * scale));
    const height = Math.max(1, Math.round(originalHeight * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('브라우저에서 이미지 압축을 수행하지 못했습니다.');
    }

    context.drawImage(image, 0, 0, width, height);

    for (const quality of MANUAL_ENTRY_PHOTO_QUALITIES) {
      const blob = await canvasToJpegBlob(canvas, quality);
      const compressed = new File([blob], getCompressedFileName(file.name), {
        type: 'image/jpeg',
        lastModified: Date.now(),
      });

      fallbackFile = compressed;

      if (compressed.size <= MANUAL_ENTRY_PHOTO_MAX_BYTES) {
        return compressed;
      }
    }
  }

  if (fallbackFile && fallbackFile.size < file.size) {
    return fallbackFile;
  }

  throw new Error('사진 용량을 줄이지 못했습니다. 더 낮은 해상도로 촬영해 다시 첨부하세요.');
}

function extractUploadedImageUrl(response: UploadResponse) {
  return (
    response.imageUrl ??
    response.url ??
    response.fileUrl ??
    response.path ??
    response.data?.imageUrl ??
    response.data?.url ??
    response.data?.fileUrl ??
    response.data?.path ??
    response.file?.imageUrl ??
    response.file?.url ??
    response.file?.fileUrl ??
    response.file?.path ??
    response.item?.imageUrl ??
    response.item?.url ??
    response.item?.fileUrl ??
    response.item?.path ??
    ''
  );
}

async function uploadVehiclePlatePhoto(file: File, accessToken: string) {
  const uploadFile = await compressImageForUpload(file);
  const formData = new FormData();
  formData.append('file', uploadFile);

  const response = await fetch(`${getUploadApiBase()}/files/vehicle-plate-photos`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });

  const uploaded = (await response.json().catch(() => null)) as UploadResponse | null;

  if (!response.ok || !uploaded) {
    throw new Error(uploaded?.message ?? '차량 사진 업로드에 실패했습니다.');
  }

  const imageUrl = extractUploadedImageUrl(uploaded);

  if (!imageUrl) {
    throw new Error('업로드된 차량 사진 URL을 확인하지 못했습니다.');
  }

  return imageUrl;
}

export function ManualParkingSessionModal({
  open,
  action,
  target,
  accessToken,
  onClose,
  onSaved,
}: Props) {
  const session = target?.activeSession ?? null;

  const [plateNumber, setPlateNumber] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [collectedAmount, setCollectedAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CARD');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const title = action === 'entry' ? '입차 등록' : '출차 등록';

  const suggestedAmount = useMemo(() => {
    return numberOrEmpty(
      getSessionValue(
        session,
        'unpaidAmount',
        'unpaidFee',
        'accruedFeeAmount',
        'accruedAmount',
        'amount',
      ),
    );
  }, [session]);

  useEffect(() => {
    if (!open || !target) return;

    setMessage('');
    setSaving(false);

    if (action === 'entry') {
      setPlateNumber('');
      setContactNumber('');
      setPhotoFiles([]);
      setCollectedAmount('');
      setPaymentMethod('CARD');
      setNote('');
      return;
    }

    setPlateNumber(text(getSessionValue(session, 'plateNumber', 'vehiclePlate')));
    setContactNumber(text(getSessionValue(session, 'contactPhone', 'contactNumber', 'phone')));
    setPhotoFiles([]);
    setCollectedAmount(suggestedAmount);
    setPaymentMethod('CARD');
    setNote('');
  }, [action, open, session, suggestedAmount, target]);

  if (!open || !target) return null;

  async function submit() {
    if (!accessToken || !target) {
      setMessage('로그인 정보가 없습니다. 다시 로그인 후 시도하세요.');
      return;
    }

    setMessage('');

    if (action === 'entry') {
      const plate = plateNumber.trim();
      const contact = contactNumber.trim();

      if (!plate && !contact) {
        setMessage('차량번호 또는 연락처를 입력하세요.');
        return;
      }

      if (photoFiles.length === 0) {
        setMessage('민원 대응을 위해 입차 사진을 1장 이상 첨부하세요.');
        return;
      }

      setSaving(true);

      try {
        const created = await apiFetch<ManualEntryResponse>('/parking-sessions/manual-entry', {
          method: 'POST',
          accessToken,
          body: JSON.stringify({
            parkingSpaceId: target.id,
            plateNumber: plate || null,
            contactNumber: contact || null,
          }),
        });

        const sessionId = extractManualEntrySessionId(created);

        if (!sessionId) {
          throw new Error('생성된 수동 입차 세션 ID를 확인하지 못했습니다.');
        }

        for (const [index, file] of photoFiles.entries()) {
          const imageUrl = await uploadVehiclePlatePhoto(file, accessToken);

          await apiFetch(`/parking-sessions/${sessionId}/registration-photo`, {
            method: 'POST',
            accessToken,
            body: JSON.stringify({
              imageUrl,
              photoType: index === 0 ? 'VEHICLE_PLATE' : 'PARKING_SPACE',
              required: true,
            }),
          });
        }

        await onSaved();
        onClose();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : '입차 등록에 실패했습니다.');
      } finally {
        setSaving(false);
      }

      return;
    }

    const amountText = collectedAmount.trim();
    const amount = amountText.length > 0 ? Number(amountText.replaceAll(',', '')) : null;

    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      setMessage('수금 금액은 0 이상의 숫자로 입력하세요.');
      return;
    }

    const sessionId = text(getSessionValue(session, 'id'));

    if (!sessionId) {
      setMessage('출차 처리할 세션을 찾지 못했습니다.');
      return;
    }

    setSaving(true);

    try {
      await apiFetch(`/parking-sessions/${sessionId}/manual-exit`, {
        method: 'POST',
        accessToken,
        body: JSON.stringify({
          collectedAmount: amount,
          paymentMethod: amount && amount > 0 ? paymentMethod : null,
          note: note.trim() || null,
        }),
      });

      await onSaved();
      onClose();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '출차 등록에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-blue-600">수동 운영 주차장</p>
            <h2 className="mt-1 text-2xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">
              {target.lotName ?? '-'} · {target.sectionName ?? '-'} · {target.code}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            닫기
          </button>
        </div>

        <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-3">
          <div>
            <div className="text-xs font-black text-slate-400">주차장</div>
            <div className="mt-1 font-bold text-slate-900">{target.lotName ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs font-black text-slate-400">구역</div>
            <div className="mt-1 font-bold text-slate-900">{target.sectionName ?? '-'}</div>
          </div>
          <div>
            <div className="text-xs font-black text-slate-400">주차면</div>
            <div className="mt-1 font-bold text-slate-900">{target.code}</div>
          </div>
        </div>

        {action === 'entry' ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-sm font-black text-slate-700">차량번호</span>
              <input
                value={plateNumber}
                onChange={(event) => setPlateNumber(event.target.value)}
                placeholder="예: 12가3456"
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block">
              <span className="text-sm font-black text-slate-700">연락처</span>
              <input
                value={contactNumber}
                onChange={(event) => setContactNumber(event.target.value)}
                placeholder="예: 010-1234-5678"
                className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <label className="block md:col-span-2">
              <span className="text-sm font-black text-slate-700">입차 사진</span>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                onChange={(event) => {
                  setPhotoFiles(Array.from(event.target.files ?? []));
                }}
                className="mt-2 block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
              />
              <span className="mt-2 block text-xs text-slate-500">
                차량번호, 차량 위치, 주차면이 확인되도록 촬영하세요. 민원 대응 증빙으로 저장됩니다.
              </span>
              {photoFiles.length > 0 ? (
                <span className="mt-2 block text-xs font-black text-blue-600">
                  선택된 사진 {photoFiles.length}장 · 원본 총 {(photoFiles.reduce((sum, file) => sum + file.size, 0) / 1024 / 1024).toFixed(1)}MB
                </span>
              ) : null}
            </label>

            <p className="rounded-2xl bg-blue-50 px-4 py-3 text-sm text-blue-700 md:col-span-2">
              차량번호 또는 연락처 중 하나 이상과 입차 사진을 저장하면 수동 입차 세션이 생성됩니다.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <div className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-4">
              <div>
                <div className="text-xs font-black text-slate-400">세션번호</div>
                <div className="mt-1 font-bold text-slate-900">
                  {text(getSessionValue(session, 'sessionNo')) || '-'}
                </div>
              </div>
              <div>
                <div className="text-xs font-black text-slate-400">차량번호</div>
                <div className="mt-1 font-bold text-slate-900">{plateNumber || '-'}</div>
              </div>
              <div>
                <div className="text-xs font-black text-slate-400">입차시각</div>
                <div className="mt-1 font-bold text-slate-900">
                  {formatDateTime(getSessionValue(session, 'entryTime'))}
                </div>
              </div>
              <div>
                <div className="text-xs font-black text-slate-400">예상/누적 요금</div>
                <div className="mt-1 font-bold text-slate-900">
                  {formatCurrency(suggestedAmount)}
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="text-sm font-black text-slate-700">수금 금액</span>
                <input
                  value={collectedAmount}
                  onChange={(event) => setCollectedAmount(event.target.value)}
                  inputMode="numeric"
                  placeholder="수금하지 않았으면 비워두세요"
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-black text-slate-700">결제수단</span>
                <select
                  value={paymentMethod}
                  onChange={(event) => setPaymentMethod(event.target.value)}
                  className="mt-2 h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm outline-none focus:border-blue-500"
                >
                  <option value="CARD">카드</option>
                  <option value="CASH">현금</option>
                  <option value="TRANSFER">계좌이체</option>
                  <option value="ETC">기타</option>
                </select>
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-black text-slate-700">메모</span>
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="예: 현장 수금, 관리자 확인 등"
                className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-500"
              />
            </label>

            <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-700">
              출차 등록 시 현재 시각으로 세션이 종료됩니다. 수금 금액을 입력하면 수동 출차 기록에 함께 저장됩니다.
            </p>
          </div>
        )}

        {message ? (
          <div className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {message}
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            취소
          </button>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={saving}
            className="rounded-2xl bg-blue-600 px-5 py-3 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving
              ? action === 'entry'
                ? '입차 등록 중...'
                : '출차 등록 중...'
              : action === 'entry'
                ? '입차 등록 저장'
                : '출차 등록 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ManualParkingSessionModal;
