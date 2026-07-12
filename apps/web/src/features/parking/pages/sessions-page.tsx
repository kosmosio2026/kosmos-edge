"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import type { ConsoleRole } from "@/lib/console-role";
import { formatKstDateTime } from "@/lib/datetime";
import { OperatorSessionCardList } from "./operator-session-card-list";

type Props = {
  role?: ConsoleRole;
  historyOnly?: boolean;
};

type ParkingSessionRow = {
  id: string;
  sessionNo?: string | null;
  plateNumber?: string | null;
  contactNumber?: string | null;
  status?: string | null;
  entryTime?: string | null;
  exitTime?: string | null;
  amount?: number | null;
  paidAmount?: number | null;
  unpaidAmount?: number | null;
  unpaidFee?: number | null;
  isRegistered?: boolean | null;
  registeredAt?: string | null;
  metadata?: any;
  latestSensorData?: any;
  latestInvoice?: any;
  registrationPhotos?: {
    id: string;
    imageUrl: string;
    photoType?: string | null;
    required?: boolean | null;
    capturedByUserId?: string | null;
    capturedByRole?: string | null;
    createdAt?: string | null;
  }[];
  parkingLotName?: string | null;
  sectionName?: string | null;
  parkingSpaceCode?: string | null;
  parkingSpace?: {
    code?: string | null;
    name?: string | null;
    section?:
      | string
      | {
          id?: string | null;
          name?: string | null;
          code?: string | null;
          parkingLot?: {
            id?: string | null;
            name?: string | null;
            code?: string | null;
          } | null;
        }
      | null;
    parkingLot?: string | null;
  } | null;
  ParkingSpace?: {
    id?: string | null;
    code?: string | null;
    name?: string | null;
    status?: string | null;
    section?: string | null;
    parkingLot?: string | null;
    device?: any;
  } | null;
};

type FilterKey =
  "ACTIVE" | "UNREGISTERED_OVER_10" | "REGISTERED" | "OUTSTANDING";

function getSessionParkingSpace(row: ParkingSessionRow) {
  return row.parkingSpace ?? row.ParkingSpace ?? null;
}

function getSessionParkingLotName(row: ParkingSessionRow) {
  if (row.parkingLotName) return row.parkingLotName;

  const space = getSessionParkingSpace(row);
  if (!space) return "-";

  const parkingLot = (space as any).parkingLot;
  if (typeof parkingLot === "string" && parkingLot) return parkingLot;
  if (parkingLot?.name || parkingLot?.code)
    return parkingLot.name ?? parkingLot.code;

  const section = (space as any).section;
  if (section && typeof section === "object") {
    return section.parkingLot?.name ?? section.parkingLot?.code ?? "-";
  }

  return "-";
}

function getSessionSectionName(row: ParkingSessionRow) {
  if (row.sectionName) return row.sectionName;

  const space = getSessionParkingSpace(row);
  if (!space) return "-";

  const section = (space as any).section;
  if (typeof section === "string" && section) return section;
  if (section && typeof section === "object")
    return section.name ?? section.code ?? "-";

  return "-";
}

function getSessionSpaceCode(row: ParkingSessionRow) {
  if (row.parkingSpaceCode) return row.parkingSpaceCode;

  const space = getSessionParkingSpace(row);
  return (space as any)?.code ?? (space as any)?.number ?? "-";
}

function getSessionSpaceDisplay(row: any) {
  return getSessionSpaceCode(row);
}

const sessionSortCollator = new Intl.Collator("ko-KR", {
  numeric: true,
  sensitivity: "base",
});

function compareParkingSessionRows(a: ParkingSessionRow, b: ParkingSessionRow) {
  const lotCompare = sessionSortCollator.compare(
    getSessionParkingLotName(a),
    getSessionParkingLotName(b),
  );

  if (lotCompare !== 0) return lotCompare;

  const sectionCompare = sessionSortCollator.compare(
    getSessionSectionName(a),
    getSessionSectionName(b),
  );

  if (sectionCompare !== 0) return sectionCompare;

  const spaceCompare = sessionSortCollator.compare(
    getSessionSpaceCode(a),
    getSessionSpaceCode(b),
  );

  if (spaceCompare !== 0) return spaceCompare;

  const aEntry = a.entryTime ? new Date(a.entryTime).getTime() : 0;
  const bEntry = b.entryTime ? new Date(b.entryTime).getTime() : 0;

  return bEntry - aEntry;
}

function unwrapRows(payload: unknown): ParkingSessionRow[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const obj = payload as {
      data?: unknown;
      items?: unknown;
      rows?: unknown;
    };

    if (Array.isArray(obj.data)) return obj.data as ParkingSessionRow[];
    if (Array.isArray(obj.items)) return obj.items as ParkingSessionRow[];
    if (Array.isArray(obj.rows)) return obj.rows as ParkingSessionRow[];
  }

  return [];
}

function formatTableDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
      hour12: false,
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return formatKstDateTime(date);
}

function formatKoreanPhoneNumber(value?: string | null) {
  const digits = String(value ?? '').replace(/\D/g, '');

  if (!digits) return '-';

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return String(value ?? '-');
}


function getBilledAmount(row: any) {
  return Number(
    row.billedAmount ??
      row.billingAmount ??
      row.amount ??
      row.finalAmount ??
      row.latestInvoice?.billedAmount ??
      row.latestInvoice?.amount ??
      row.latestInvoice?.finalAmount ??
      0,
  );
}

function getPaidAmount(row: any) {
  return Number(
    row.paidAmount ??
      row.paymentAmount ??
      row.latestInvoice?.paidAmount ??
      row.latestInvoice?.paymentAmount ??
      0,
  );
}

function getUnpaidAmount(row: any) {
  const explicit = row.unpaidAmount ?? row.unpaidFee ?? row.latestInvoice?.unpaidAmount;

  if (explicit !== null && explicit !== undefined) {
    return Number(explicit);
  }

  return Math.max(0, getBilledAmount(row) - getPaidAmount(row));
}

function getExpectedFeeAmount(row: any) {
  return Number(
    row.accruedFeeAmount ??
      row.expectedFee ??
      row.estimatedFee ??
      row.accruedAmount ??
      row.currentFee ??
      row.unpaidAmount ??
      row.unpaidFee ??
      0,
  );
}

function getHistoryActionLabel(row: ParkingSessionRow) {
  return getUnpaidAmount(row) > 0 ? "청구서" : "영수증";
}

function getHistoryActionModal(row: ParkingSessionRow): "detail" | "payment" {
  return getUnpaidAmount(row) > 0 ? "payment" : "detail";
}

function formatCurrency(value?: number | null) {
  return `₩${Number(value ?? 0).toLocaleString()}`;
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("이미지를 읽을 수 없습니다."));
    reader.readAsDataURL(file);
  });
}

async function compressImageFile(file: File, maxSide = 1280, quality = 0.72) {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 업로드할 수 있습니다.");
  }

  if (file.size > 8 * 1024 * 1024) {
    throw new Error("원본 이미지는 8MB 이하만 선택할 수 있습니다.");
  }

  const dataUrl = await readFileAsDataUrl(file);

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("이미지를 불러올 수 없습니다."));
    img.src = dataUrl;
  });

  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("이미지를 처리할 수 없습니다.");
  }

  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", quality);
  });

  if (!blob) {
    throw new Error("이미지 압축에 실패했습니다.");
  }

  return new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + "-compressed.jpg",
    { type: "image/jpeg" },
  );
}

function elapsedMinutes(row: ParkingSessionRow) {
  if (!row.entryTime) return null;

  const entry = new Date(row.entryTime);
  if (Number.isNaN(entry.getTime())) return null;

  const end = row.exitTime ? new Date(row.exitTime) : new Date();
  if (Number.isNaN(end.getTime())) return null;

  return Math.max(0, Math.floor((end.getTime() - entry.getTime()) / 60000));
}

function formatElapsed(minutes?: number | null) {
  const value = Number(minutes ?? 0);
  if (!Number.isFinite(value) || value <= 0) return "0분";

  const hours = Math.floor(value / 60);
  const mins = value % 60;

  if (hours > 0 && mins > 0) return `${hours}시간 ${mins}분`;
  if (hours > 0) return `${hours}시간`;
  return `${mins}분`;
}

function isUnregisteredOver10(row: ParkingSessionRow) {
  return (
    row.status === "ACTIVE" &&
    !row.isRegistered &&
    Number(elapsedMinutes(row) ?? 0) >= 10
  );
}

function isOutstanding(row: ParkingSessionRow) {
  return Number(row.unpaidFee ?? row.unpaidAmount ?? 0) > 0;
}

function getRegistrationBadge(row: ParkingSessionRow) {
  if (row.isRegistered) {
    return {
      label: "등록 완료",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (isUnregisteredOver10(row)) {
    return {
      label: "등록 필요",
      className: "bg-red-50 text-red-700",
    };
  }

  return {
    label: "미등록 대기",
    className: "bg-slate-100 text-slate-600",
  };
}



function getPaymentBadge(row: ParkingSessionRow) {
  const unpaid = Number(row.unpaidFee ?? row.unpaidAmount ?? 0);
  const paid = Number(row.paidAmount ?? 0);
  const invoiceStatus = row.latestInvoice?.status;

  if (invoiceStatus === "PAID" || (paid > 0 && unpaid <= 0)) {
    return {
      label: "결제 완료",
      className: "bg-emerald-50 text-emerald-700",
    };
  }

  if (invoiceStatus === "PARTIALLY_PAID" || (paid > 0 && unpaid > 0)) {
    return {
      label: "부분 결제",
      className: "bg-amber-50 text-amber-700",
    };
  }

  if (unpaid > 0) {
    return {
      label: "미결제",
      className: "bg-red-50 text-red-700",
    };
  }

  if (invoiceStatus === "ISSUED") {
    return {
      label: "청구 완료",
      className: "bg-blue-50 text-blue-700",
    };
  }

  return {
    label: "청구 전",
    className: "bg-slate-100 text-slate-600",
  };
}

function getSessionSensorDevEui(row: any) {
  return (
    row.latestSensorData?.dev_eui ??
    row.latestSensorData?.devEui ??
    row.parkingSpace?.device?.devEui ??
    row.parkingSpace?.device?.dev_eui ??
    row.parkingSpace?.sensorDevice?.devEui ??
    row.parkingSpace?.sensorDevice?.dev_eui ??
    row.sensorDevice?.devEui ??
    row.sensorDevice?.dev_eui ??
    row.device?.devEui ??
    row.device?.dev_eui ??
    row.devEui ??
    row.dev_eui ??
    ""
  );
}

function getSensorDetailHref(row: any) {
  const devEui = getSessionSensorDevEui(row);
  if (!devEui) return "";
  return `/operator/devices/sensors?devEui=${encodeURIComponent(devEui)}`;
}

function getSensorStatus(row: ParkingSessionRow) {
  const deviceStatus = row.latestSensorData?.device_status;
  const parkingStatus = row.latestSensorData?.parking_status;

  if (deviceStatus === 2) return "Fault";
  if (deviceStatus === 1) return "Warning";
  if (parkingStatus === 1) return "Occupied";
  if (parkingStatus === 0) return "Empty";

  return "-";
}

export default function ParkingSessionsPage({ role = "admin", historyOnly = false }: Props) {
  const isOperatorView = role === "operator";
  const { session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<ParkingSessionRow[]>([]);
  const [filter, setFilter] = useState<FilterKey>("ACTIVE");
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [registeringId, setRegisteringId] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState<Record<string, string>>({});
  const [contactNumber, setContactNumber] = useState<Record<string, string>>(
    {},
  );
  const [selectedRow, setSelectedRow] = useState<ParkingSessionRow | null>(
    null,
  );
  const [actionModal, setActionModal] = useState<
    "detail" | "register" | "payment" | null
  >(null);
  const [dismissedActionKey, setDismissedActionKey] = useState("");
  const [manualPaymentSavingId, setManualPaymentSavingId] = useState<
    string | null
  >(null);
  const [manualPaymentMethod, setManualPaymentMethod] = useState<
    Record<string, string>
  >({});
  const [manualPaymentAmount, setManualPaymentAmount] = useState<
    Record<string, string>
  >({});
  const [manualPaymentCollectedAt, setManualPaymentCollectedAt] = useState<
    Record<string, string>
  >({});
  const [manualPaymentNote, setManualPaymentNote] = useState<
    Record<string, string>
  >({});
  const [registrationPhotoFile, setRegistrationPhotoFile] = useState<
    Record<string, File | null>
  >({});
  const [registrationPhotoPreview, setRegistrationPhotoPreview] = useState<
    Record<string, string>
  >({});
  const [registrationPhotoUploadingId, setRegistrationPhotoUploadingId] =
    useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const canRegister =
    role === "admin" || role === "manager" || role === "operator";

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    setLoading(true);
    setError(null);

    try {
      const status = historyOnly ? "HISTORY" : "ACTIVE";
      const result = await apiFetch(`/parking-sessions?status=${status}`, {
        accessToken: session.accessToken,
      });

      setRows(unwrapRows(result));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load parking sessions.",
      );
    } finally {
      setLoading(false);
    }
  }, [historyOnly, session?.accessToken]);

  useEffect(() => {
    const queryFilter = searchParams.get("filter") as FilterKey | null;
    const querySpace = searchParams.get("space");

    if (querySpace) {
      setSearchText(querySpace);
    }

    if (
      queryFilter === "ACTIVE" ||
      queryFilter === "UNREGISTERED_OVER_10" ||
      queryFilter === "REGISTERED" ||
      queryFilter === "OUTSTANDING"
    ) {
      setFilter(queryFilter);
    }
  }, [searchParams]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const active = rows.filter((row) => row.status === "ACTIVE");
    const unregisteredOver10 = rows.filter(isUnregisteredOver10);
    const registered = rows.filter((row) => Boolean(row.isRegistered));
    const outstandingTotal = rows.reduce(
      (sum, row) => sum + Number(row.unpaidFee ?? row.unpaidAmount ?? 0),
      0,
    );

    return {
      active: active.length,
      unregisteredOver10: unregisteredOver10.length,
      registered: registered.length,
      outstandingTotal,
    };
  }, [rows]);

  function changeFilter(nextFilter: FilterKey) {
    setFilter(nextFilter);

    const params = new URLSearchParams(searchParams.toString());

    if (nextFilter === "ACTIVE") {
      params.delete("filter");
    } else {
      params.set("filter", nextFilter);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }

  function closeActionModal() {
    const params = new URLSearchParams(searchParams.toString());
    const currentSpace = params.get("space") ?? "";
    const currentSessionId = params.get("sessionId") ?? "";
    const currentAction = params.get("action") ?? "";
    const currentTarget = currentSessionId || currentSpace;

    if (currentAction) {
      setDismissedActionKey(`${currentTarget}:${currentAction}`);
    }

    params.delete("action");
    params.delete("sessionId");

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });

    setSelectedRow(null);
    setActionModal(null);
  }

  const filteredRows = useMemo(() => {
    let result = historyOnly ? rows.filter((row) => Boolean(row.exitTime)) : rows;

    if (filter === "UNREGISTERED_OVER_10") {
      result = result.filter(isUnregisteredOver10);
    } else if (filter === "REGISTERED") {
      result = result.filter((row) => Boolean(row.isRegistered));
    } else if (filter === "OUTSTANDING") {
      result = result.filter(isOutstanding);
    }

    const keyword = searchText.trim().toLowerCase();

    if (keyword) {
      result = result.filter((row) => {
        const haystack = [
          row.sessionNo,
          row.plateNumber,
          row.contactNumber,
          getSessionParkingLotName(row),
          getSessionSectionName(row),
          getSessionSpaceCode(row),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(keyword);
      });
    }

    return [...result].sort(compareParkingSessionRows);
  }, [filter, historyOnly, rows, searchText]);

  useEffect(() => {
    const queryAction = searchParams.get("action");
    const querySpace = searchParams.get("space");
    const querySessionId = searchParams.get("sessionId");

    if (!queryAction) {
      if (dismissedActionKey) {
        setDismissedActionKey("");
      }
      return;
    }

    const queryTarget = querySessionId || querySpace || "";
    const actionKey = `${queryTarget}:${queryAction}`;

    if (
      actionModal ||
      dismissedActionKey === actionKey ||
      !queryTarget ||
      !(
        queryAction === "detail" ||
        queryAction === "register" ||
        queryAction === "payment"
      )
    ) {
      return;
    }

    const matchedBySessionId = querySessionId
      ? filteredRows.find((row) => {
          return (
            String(row.id) === querySessionId ||
            String(row.sessionNo ?? "") === querySessionId
          );
        })
      : null;

    const matchedBySpace = querySpace
      ? filteredRows.find((row) => getSessionSpaceCode(row) === querySpace)
      : null;

    const matchedRow =
      matchedBySessionId ??
      matchedBySpace ??
      filteredRows[0] ??
      null;

    if (!matchedRow) return;

    setSelectedRow(matchedRow);
    setActionModal(queryAction);
  }, [actionModal, dismissedActionKey, filteredRows, searchParams]);

  async function registerSession(row: ParkingSessionRow) {
    if (!session?.accessToken || !canRegister) return;

    const plate = plateNumber[row.id]?.trim() ?? "";
    const contact = contactNumber[row.id]?.trim() ?? "";

    if (!plate && !contact) {
      setError("Plate number or contact number is required.");
      return;
    }

    setRegisteringId(row.id);
    setError(null);
    setNotice(null);

    try {
      await apiFetch(`/parking-sessions/${row.id}/register`, {
        method: "PATCH",
        accessToken: session.accessToken,
        body: JSON.stringify({
          plateNumber: plate || null,
          contactNumber: contact || null,
        }),
      });

      const uploaded = await uploadRegistrationPhoto(row);

      setNotice(
        uploaded
          ? `Session ${row.sessionNo ?? row.id} registered with photo.`
          : `Session ${row.sessionNo ?? row.id} registered.`,
      );
      setPlateNumber((prev) => ({ ...prev, [row.id]: "" }));
      setContactNumber((prev) => ({ ...prev, [row.id]: "" }));
      setRegistrationPhotoFile((prev) => ({ ...prev, [row.id]: null }));
      setRegistrationPhotoPreview((prev) => ({ ...prev, [row.id]: "" }));
      await load();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to register session.",
      );
    } finally {
      setRegisteringId(null);
    }
  }

  async function uploadRegistrationPhoto(row: ParkingSessionRow) {
    if (!session?.accessToken) return null;

    const file = registrationPhotoFile[row.id];
    if (!file) return null;

    setRegistrationPhotoUploadingId(row.id);

    try {
      const compressed = await compressImageFile(file);
      const formData = new FormData();
      formData.append("file", compressed);

      const uploadedResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api"}/files/vehicle-plate-photos`,
        {
          method: "POST",
          headers: {
            authorization: `Bearer ${session.accessToken}`,
          },
          body: formData,
        },
      );

      const uploaded = await uploadedResponse.json().catch(() => null);

      if (!uploadedResponse.ok) {
        throw new Error(
          uploaded?.message ?? "차량 사진 업로드에 실패했습니다.",
        );
      }

      await apiFetch(`/parking-sessions/${row.id}/registration-photo`, {
        method: "POST",
        accessToken: session.accessToken,
        body: JSON.stringify({
          imageUrl: uploaded.imageUrl,
          photoType: "VEHICLE_PLATE",
          required: false,
        }),
      });

      return uploaded;
    } finally {
      setRegistrationPhotoUploadingId(null);
    }
  }

  async function recordManualPayment(row: ParkingSessionRow) {
    if (!session?.accessToken) return;

    const amount = Number(
      manualPaymentAmount[row.id] ?? row.unpaidFee ?? row.unpaidAmount ?? 0,
    );
    const paymentMethod = manualPaymentMethod[row.id] ?? "CARD";
    const collectedAt =
      manualPaymentCollectedAt[row.id] || new Date().toISOString();
    const note = manualPaymentNote[row.id] ?? "";

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("수금 금액을 입력하세요.");
      return;
    }

    setManualPaymentSavingId(row.id);
    setError(null);
    setNotice(null);

    try {
      await apiFetch(`/parking-sessions/${row.id}/manual-payment`, {
        method: "POST",
        accessToken: session.accessToken,
        body: JSON.stringify({
          amount,
          paymentMethod,
          collectedAt,
          note,
        }),
      });

      setNotice(`수동 결제가 등록되었습니다. (${formatCurrency(amount)})`);
      setManualPaymentAmount((prev) => ({ ...prev, [row.id]: "" }));
      setManualPaymentNote((prev) => ({ ...prev, [row.id]: "" }));
      closeActionModal();
      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "수동 결제 등록에 실패했습니다.",
      );
    } finally {
      setManualPaymentSavingId(null);
    }
  }


  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStartIndex = (safePage - 1) * pageSize;
  const pageEndIndex = Math.min(pageStartIndex + pageSize, filteredRows.length);

  const pagedRows = useMemo(() => {
    return filteredRows.slice(pageStartIndex, pageEndIndex);
  }, [filteredRows, pageStartIndex, pageEndIndex]);

  useEffect(() => {
    setPage(1);
  }, [filter, searchText, viewMode, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const filterItems: { key: FilterKey; label: string; count?: number }[] = [
    { key: "ACTIVE", label: "활성 세션", count: summary.active },
    {
      key: "UNREGISTERED_OVER_10",
      label: "등록 필요",
      count: summary.unregisteredOver10,
    },
    { key: "REGISTERED", label: "등록 완료", count: summary.registered },
    {
      key: "OUTSTANDING",
      label: "미결제",
      count: rows.filter(isOutstanding).length,
    },
  ];

  return (
    <main className="w-full max-w-none space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">
            주차 현황
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            실시간 주차 현황, 미등록 10분 초과 차량, 수동 등록 업무를 통합
            관리합니다.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void load()}
          className="rounded-2xl border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
          {notice}
        </div>
      ) : null}

      <section className="grid max-w-6xl grid-cols-2 gap-3 xl:grid-cols-4">
        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">Active Sessions</div>
          <div className="mt-2 text-3xl font-semibold">{summary.active}</div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">Unregistered &gt; 10m</div>
          <div className="mt-2 text-3xl font-semibold text-red-600">
            {summary.unregisteredOver10}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">Registered</div>
          <div className="mt-2 text-3xl font-semibold">
            {summary.registered}
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-4">
          <div className="text-sm text-slate-500">Outstanding Total</div>
          <div className="mt-2 text-xl font-semibold">
            {formatCurrency(summary.outstandingTotal)}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {filterItems.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => changeFilter(item.key)}
              className={[
                "rounded-2xl border px-4 py-2 text-sm font-medium",
                filter === item.key
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50",
              ].join(" ")}
            >
              {item.label}
              {typeof item.count === "number" ? (
                <span className="ml-2 opacity-70">{item.count}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border bg-white p-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row md:items-center">
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="주차면/차량번호/연락처 검색"
              className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm text-slate-700 outline-none focus:border-blue-500 md:max-w-md xl:max-w-lg"
            />

            {searchText ? (
              <button
                type="button"
                onClick={() => setSearchText("")}
                className="h-11 shrink-0 whitespace-nowrap rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                검색 초기화
              </button>
            ) : null}
          </div>

          <div className="grid shrink-0 grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1 sm:w-[240px]">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={[
                "h-10 whitespace-nowrap rounded-xl px-4 text-sm font-black",
                viewMode === "table"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white",
              ].join(" ")}
            >
              테이블 보기
            </button>
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={[
                "h-10 whitespace-nowrap rounded-xl px-4 text-sm font-black",
                viewMode === "card"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-white",
              ].join(" ")}
            >
              카드 보기
            </button>
          </div>
        </div>
      </section>

      {viewMode === "table" ? (
        <section className="overflow-x-auto rounded-3xl border bg-white">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-[56px] whitespace-nowrap px-1.5 py-3 text-center">번호</th>
                  <th className="px-2 py-3 text-center">주차장</th>
                  <th className="px-2 py-3 text-center">주차면</th>
                  <th className="px-2 py-3 text-center">입차 시간</th>
                  {historyOnly ? (
                    <th className="px-2 py-3 text-center">출차 시간</th>
                  ) : null}
                  <th className="px-2 py-3 text-center">{historyOnly ? "주차 시간" : "경과 시간"}</th>
                  {!historyOnly ? (
                    <th className="w-[92px] px-2 py-3 text-center">등록 상태</th>
                  ) : null}
                  <th className="w-[92px] px-2 py-3 text-center">결제 상태</th>
                  <th className="min-w-[120px] px-2 py-3 text-center">차량번호</th>
                  <th className="min-w-[132px] px-2 py-3 text-center">연락처</th>
                  {historyOnly ? (
                    <>
                      <th className="whitespace-nowrap px-1 py-3 text-right">청구 금액</th>
                      <th className="whitespace-nowrap px-1 py-3 text-right">결제 금액</th>
                    </>
                  ) : null}
                  <th className="whitespace-nowrap px-1 py-3 text-right">{historyOnly ? "미납 금액" : "예상 요금"}</th>
                  <th className="w-[92px] px-2 py-3 text-center">작업</th>
                </tr>
              </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={historyOnly ? 13 : 11} className="px-4 py-8 text-slate-500">
                    Loading...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No parking sessions found.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, index) => {
                  const elapsed = elapsedMinutes(row);
                  const needsRegistration = isUnregisteredOver10(row);
                  const registrationBadge = getRegistrationBadge(row);
                  const paymentBadge = getPaymentBadge(row);

                  return (
                    <tr
                      key={row.id}
                      className={[
                        "border-t align-top",
                        needsRegistration ? "bg-red-50/40" : "",
                      ].join(" ")}
                    >
                      <td className="px-2 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRow(row);
                            setActionModal("detail");
                          }}
                          className="font-black text-blue-600 hover:underline"
                        >
                          {pageStartIndex + index + 1}
                        </button>
                      </td>
                      <td className="max-w-[160px] truncate px-2 py-3 text-slate-700">
                        {getSessionParkingLotName(row)}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-3 font-black text-slate-950">
                        {getSessionSpaceDisplay(row)}
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-3 text-slate-700">
                        {formatTableDate(row.entryTime)}
                      </td>
                        {historyOnly ? (
                          <td className="whitespace-nowrap px-1.5 py-3 text-slate-700">
                            {formatTableDate(row.exitTime)}
                          </td>
                        ) : null}
                      <td
                        className={[
                          "whitespace-nowrap px-1.5 py-3 font-semibold",
                          needsRegistration ? "text-red-600" : "",
                        ].join(" ")}
                      >
                        {formatElapsed(elapsed)}
                      </td>
                      {!historyOnly ? (
                          <td className="px-2 py-3 text-center">
                            <span
                              className={[
                                "mx-auto inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-black leading-none",
                                registrationBadge.className,
                              ].join(" ")}
                            >
                              {registrationBadge.label}
                            </span>
                          </td>
                        ) : null}
                      <td className="px-2 py-3 text-center">
                          <span
                            className={[
                              "mx-auto inline-flex items-center justify-center whitespace-nowrap rounded-full px-3 py-1 text-xs font-black leading-none",
                            paymentBadge.className,
                          ].join(" ")}
                        >
                          {paymentBadge.label}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-1.5 py-3 text-center text-slate-700">
                          {row.plateNumber ?? "-"}
                        </td>
                      <td className="whitespace-nowrap px-1.5 py-3 text-center text-slate-700">
                          {formatKoreanPhoneNumber(row.contactNumber)}
                        </td>
                      {historyOnly ? (
                          <>
                            <td className="whitespace-nowrap px-1 py-3 text-right text-slate-700">
                              {formatCurrency(getBilledAmount(row))}
                            </td>
                            <td className="whitespace-nowrap px-1 py-3 text-right text-slate-700">
                              {formatCurrency(getPaidAmount(row))}
                            </td>
                          </>
                        ) : null}
                        <td className="whitespace-nowrap px-1 py-3 text-right text-slate-700">
                            {formatCurrency(historyOnly ? getUnpaidAmount(row) : getExpectedFeeAmount(row))}
                          </td>
                        <td className="px-2 py-3 text-center">
                          <div className="flex max-w-[92px] flex-col gap-2">
                          {!historyOnly && canRegister && !row.isRegistered ? (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRow(row);
                                setActionModal("register");
                              }}
                              className="whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white"
                            >
                              주차 등록
                            </button>
                          ) : null}
                            {historyOnly ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRow(row);
                                  setActionModal(getHistoryActionModal(row));
                                }}
                                className={[
                                  "whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-black text-white",
                                  getUnpaidAmount(row) > 0 ? "bg-blue-600" : "bg-emerald-600",
                                ].join(" ")}
                              >
                                {getHistoryActionLabel(row)}
                              </button>
                            ) : isOutstanding(row) ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedRow(row);
                                  setActionModal("payment");
                                }}
                                className="whitespace-nowrap rounded-xl bg-blue-600 px-3 py-2 text-xs font-black text-white"
                              >
                                결제 등록
                              </button>
                            ) : null}

                            {!historyOnly &&
                            (!canRegister || row.isRegistered) &&
                            !isOutstanding(row) ? (
                              <span className="px-2 py-2 text-xs font-bold text-slate-400">
                                -
                              </span>
                            ) : null}
                        </div>


                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </section>
      ) : null}

      {viewMode === "card" ? (
        <OperatorSessionCardList
          rows={pagedRows}
          loading={loading}
          canRegister={canRegister}
          historyOnly={historyOnly}
          onDetail={(row) => {
            setSelectedRow(row);
            setActionModal("detail");
          }}
          onRegister={(row) => {
            setSelectedRow(row);
            setActionModal("register");
          }}
          onPayment={(row) => {
            setSelectedRow(row);
            setActionModal("payment");
          }}
        />
      ) : null}

      {!loading && filteredRows.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-3xl border bg-white px-2 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-bold text-slate-500">
            전체 {filteredRows.length.toLocaleString("ko-KR")}건 중{" "}
            {pageStartIndex + 1}–{pageEndIndex}건 표시
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={pageSize}
              onChange={(event) => setPageSize(Number(event.target.value))}
              className="h-10 rounded-2xl border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700"
            >
              <option value={10}>10개씩</option>
              <option value={20}>20개씩</option>
              <option value={50}>50개씩</option>
            </select>

            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={safePage <= 1}
              className="h-10 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              이전
            </button>

            <div className="min-w-20 text-center text-sm font-black text-slate-700">
              {safePage} / {totalPages}
            </div>

            <button
              type="button"
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              disabled={safePage >= totalPages}
              className="h-10 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 disabled:opacity-40"
            >
              다음
            </button>
          </div>
        </section>
      ) : null}

      {selectedRow && actionModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div
            className={[
              "w-full rounded-[2rem] bg-white p-5 shadow-2xl",
              actionModal === "detail"
                ? "max-h-[90vh] max-w-5xl overflow-y-auto"
                : "max-w-lg",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-blue-600">
                  현장 처리
                </p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  {actionModal === "detail"
                    ? "세션 상세"
                    : actionModal === "register"
                      ? "주차 등록"
                      : "결제 등록"}
                </h2>
                <p className="mt-1 text-sm font-bold text-slate-500">
                  {selectedRow.sessionNo ?? selectedRow.id}
                </p>
              </div>

              <button
                type="button"
                onClick={closeActionModal}
                className="rounded-full bg-slate-100 px-3 py-2 text-xs font-black text-slate-600"
              >
                닫기
              </button>
            </div>

            {actionModal === "detail" ? (
              <>
                <div className="mt-5 space-y-3 rounded-3xl bg-slate-50 p-4 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-slate-400">주차장</span>
                    <span className="text-slate-700">
                      {getSessionParkingLotName(selectedRow)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-slate-400">
                      구역/주차면
                    </span>
                    <span className="text-slate-700">
                      {getSessionSectionName(selectedRow)} ·{" "}
                      {getSessionSpaceCode(selectedRow)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-slate-400">차량번호</span>
                    <span className="text-slate-700">
                      {selectedRow.plateNumber ?? "-"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-slate-400">연락처</span>
                    <span className="text-slate-700">
                      {formatKoreanPhoneNumber(selectedRow.contactNumber)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="font-bold text-slate-400">입차</span>
                    <span className="text-slate-700">
                      {formatDate(selectedRow.entryTime)}
                    </span>
                  </div>
                  {historyOnly ? (
                      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white p-3 text-xs">
                        <div>
                          <div className="font-bold text-slate-400">청구 금액</div>
                          <div className="mt-1 text-slate-700">
                            {formatCurrency(getBilledAmount(selectedRow))}
                          </div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-400">결제 금액</div>
                          <div className="mt-1 text-slate-700">
                            {formatCurrency(getPaidAmount(selectedRow))}
                          </div>
                        </div>
                        <div>
                          <div className="font-bold text-slate-400">미납 금액</div>
                          <div className="mt-1 text-slate-700">
                            {formatCurrency(getUnpaidAmount(selectedRow))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-between gap-4">
                        <span className="font-bold text-slate-400">예상 요금</span>
                        <span className="text-slate-700">
                          {formatCurrency(getExpectedFeeAmount(selectedRow))}
                        </span>
                      </div>
                    )}
                </div>

                <div className="mt-4 rounded-3xl border bg-white p-4">
                  <div className="text-sm text-slate-700">
                    차량 사진
                  </div>
                  {selectedRow.registrationPhotos?.length ? (
                    <div className="mt-3 grid gap-4 md:grid-cols-2">
                      {selectedRow.registrationPhotos
                        .slice(0, 4)
                        .map((photo) => (
                          <a
                            key={photo.id}
                            href={photo.imageUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="block overflow-hidden rounded-2xl border bg-slate-50"
                          >
                            <div className="flex max-h-[520px] min-h-72 items-center justify-center bg-slate-950">
                              <img
                                src={photo.imageUrl}
                                alt="등록 차량 사진"
                                className="max-h-[520px] w-full object-contain"
                              />
                            </div>
                            <div className="px-3 py-2 text-xs font-bold text-slate-500">
                              {photo.photoType ?? "VEHICLE_PLATE"} ·{" "}
                              {formatDate(photo.createdAt)}
                            </div>
                          </a>
                        ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl bg-slate-50 px-2 py-3 text-sm font-bold text-slate-400">
                      등록된 차량 사진이 없습니다.
                    </div>
                  )}
                </div>

                <div className="mt-4 rounded-3xl border bg-white p-4">
                  <div className="text-sm text-slate-700">
                    수동 결제 이력
                  </div>
                  {selectedRow.latestInvoice?.manualPayments?.length ? (
                    <div className="mt-3 space-y-2">
                      {selectedRow.latestInvoice.manualPayments.map(
                        (payment: any) => (
                          <div
                            key={payment.id}
                            className="rounded-2xl bg-slate-50 px-2 py-3 text-sm"
                          >
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-700">
                                {payment.paymentMethod === "CARD"
                                  ? "카드"
                                  : payment.paymentMethod === "CASH"
                                    ? "현금"
                                    : payment.paymentMethod === "TRANSFER"
                                      ? "이체"
                                      : payment.paymentMethod}
                              </span>
                              <span className="font-black text-blue-700">
                                {formatCurrency(payment.amount)}
                              </span>
                            </div>
                            <div className="mt-1 text-xs font-bold text-slate-500">
                              수금 일시: {formatDate(payment.collectedAt)}
                            </div>
                            <div className="mt-1 text-xs font-bold text-slate-500">
                              담당자:{" "}
                              {payment.collectedBy?.name ??
                                payment.collectedBy?.email ??
                                "-"}
                            </div>
                            {payment.note ? (
                              <div className="mt-1 text-xs font-bold text-slate-500">
                                메모: {payment.note}
                              </div>
                            ) : null}
                          </div>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl bg-slate-50 px-2 py-3 text-sm font-bold text-slate-400">
                      수동 결제 이력이 없습니다.
                    </div>
                  )}
                </div>
              </>
            ) : null}

            {actionModal === "register" ? (
              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    차량번호
                  </span>
                  <input
                    className="mt-1 w-full rounded-2xl border px-2 py-3 text-sm font-bold outline-none"
                    value={
                      plateNumber[selectedRow.id] ??
                      selectedRow.plateNumber ??
                      ""
                    }
                    onChange={(event) =>
                      setPlateNumber((prev) => ({
                        ...prev,
                        [selectedRow.id]: event.target.value,
                      }))
                    }
                    placeholder="예: 35두4792"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    연락처
                  </span>
                  <input
                    className="mt-1 w-full rounded-2xl border px-2 py-3 text-sm font-bold outline-none"
                    value={
                      contactNumber[selectedRow.id] ??
                      selectedRow.contactNumber ??
                      ""
                    }
                    onChange={(event) =>
                      setContactNumber((prev) => ({
                        ...prev,
                        [selectedRow.id]: event.target.value,
                      }))
                    }
                    placeholder="예: 010-2983-1136"
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    차량 사진
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="mt-1 w-full rounded-2xl border px-2 py-3 text-sm font-bold outline-none"
                    onChange={async (event) => {
                      const file = event.target.files?.[0] ?? null;

                      if (!file) {
                        setRegistrationPhotoFile((prev) => ({
                          ...prev,
                          [selectedRow.id]: null,
                        }));
                        setRegistrationPhotoPreview((prev) => ({
                          ...prev,
                          [selectedRow.id]: "",
                        }));
                        return;
                      }

                      if (!file.type.startsWith("image/")) {
                        setError("이미지 파일만 선택할 수 있습니다.");
                        event.target.value = "";
                        return;
                      }

                      if (file.size > 8 * 1024 * 1024) {
                        setError(
                          "원본 이미지는 8MB 이하만 선택할 수 있습니다.",
                        );
                        event.target.value = "";
                        return;
                      }

                      setError(null);
                      setRegistrationPhotoFile((prev) => ({
                        ...prev,
                        [selectedRow.id]: file,
                      }));
                      setRegistrationPhotoPreview((prev) => ({
                        ...prev,
                        [selectedRow.id]: URL.createObjectURL(file),
                      }));
                    }}
                  />
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    원본은 8MB 이하만 선택 가능합니다. 저장 시 긴 변 1280px
                    JPEG로 압축해 업로드합니다.
                  </p>
                </label>

                {registrationPhotoPreview[selectedRow.id] ? (
                  <img
                    src={registrationPhotoPreview[selectedRow.id]}
                    alt="차량 사진 미리보기"
                    className="max-h-48 w-full rounded-2xl border object-cover"
                  />
                ) : null}

                <button
                  type="button"
                  disabled={
                    registeringId === selectedRow.id ||
                    registrationPhotoUploadingId === selectedRow.id
                  }
                  onClick={() => void registerSession(selectedRow)}
                  className="w-full rounded-2xl bg-slate-900 px-5 py-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {registrationPhotoUploadingId === selectedRow.id
                    ? "사진 업로드 중..."
                    : registeringId === selectedRow.id
                      ? "등록 중..."
                      : "주차 등록 저장"}
                </button>
              </div>
            ) : null}

            {actionModal === "payment" ? (
              <div className="mt-5 space-y-3">
                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    결제 종류
                  </span>
                  <select
                    className="mt-1 w-full rounded-2xl border px-2 py-3 text-sm font-bold outline-none"
                    value={manualPaymentMethod[selectedRow.id] ?? "CARD"}
                    onChange={(event) =>
                      setManualPaymentMethod((prev) => ({
                        ...prev,
                        [selectedRow.id]: event.target.value,
                      }))
                    }
                  >
                    <option value="CARD">카드</option>
                    <option value="CASH">현금</option>
                    <option value="TRANSFER">이체</option>
                  </select>
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    수금 금액
                  </span>
                  <input
                    type="number"
                    className="mt-1 w-full rounded-2xl border px-2 py-3 text-sm font-bold outline-none"
                    value={
                      manualPaymentAmount[selectedRow.id] ??
                      String(
                        Number(
                          selectedRow.unpaidFee ??
                            selectedRow.unpaidAmount ??
                            0,
                        ),
                      )
                    }
                    onChange={(event) =>
                      setManualPaymentAmount((prev) => ({
                        ...prev,
                        [selectedRow.id]: event.target.value,
                      }))
                    }
                  />
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    수금 일시
                  </span>
                  <input
                    type="datetime-local"
                    className="mt-1 w-full rounded-2xl border px-2 py-3 text-sm font-bold outline-none"
                    value={manualPaymentCollectedAt[selectedRow.id] ?? ""}
                    onChange={(event) =>
                      setManualPaymentCollectedAt((prev) => ({
                        ...prev,
                        [selectedRow.id]: event.target.value,
                      }))
                    }
                  />
                  <p className="mt-1 text-xs font-bold text-slate-400">
                    비워두면 현재 시각으로 저장됩니다.
                  </p>
                </label>

                <label className="block">
                  <span className="text-xs font-black text-slate-500">
                    승인번호/메모
                  </span>
                  <input
                    className="mt-1 w-full rounded-2xl border px-2 py-3 text-sm font-bold outline-none"
                    value={manualPaymentNote[selectedRow.id] ?? ""}
                    onChange={(event) =>
                      setManualPaymentNote((prev) => ({
                        ...prev,
                        [selectedRow.id]: event.target.value,
                      }))
                    }
                    placeholder="카드 승인번호 또는 현장 메모"
                  />
                </label>

                <button
                  type="button"
                  disabled={manualPaymentSavingId === selectedRow.id}
                  onClick={() => void recordManualPayment(selectedRow)}
                  className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-black text-white disabled:opacity-50"
                >
                  {manualPaymentSavingId === selectedRow.id
                    ? "결제 등록 중..."
                    : "결제 등록 저장"}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
