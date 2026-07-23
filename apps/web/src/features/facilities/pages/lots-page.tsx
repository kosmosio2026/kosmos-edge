"use client";

import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PaginationBar } from "@/components/console/pagination-bar";
import { useAuth } from "@/components/providers/auth-provider";
import { apiFetch } from "@/lib/api-client";
import {
  createPaginationMeta,
  getRowNumber,
  paginateClientSide,
  parseTableQueryFromSearchParams,
  unwrapItems,
} from "@/lib/table-query";
import { ParkingLotFormModal } from "../components/parking-lot-form-modal";

type Props = {
  role?: "admin" | "manager" | "operator";
};

type ParkingLotQr = {
  id?: string;
  qrToken: string;
  qrType?: string | null;
  isActive?: boolean;
};

type ParkingLotPhoto = {
  id?: string;
  imageUrl: string;
  sortOrder?: number;
  isPrimary?: boolean;
};

type ParkingLot = {
  id: string;
  code: string;
  name: string;
  qrCodes?: ParkingLotQr[];
  photos?: ParkingLotPhoto[];
  qrToken?: string | null;
  region?: string | null;
  district?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  representative?: string | null;
  contact?: string | null;
  isActive?: boolean;
  _count?: {
    sections?: number;
  };
};

type RequestableParkingLot = ParkingLot & {
  requestStatus?: "PENDING" | null;
  requestId?: string | null;
  requestedAt?: string | null;
};

type RequestForm = {
  region: string;
  parkingLotId: string;
};

type ValidationResult = {
  ok: boolean;
  summary?: Record<string, number>;
  errors?: Array<{ row: number; field: string; message: string }>;
  warnings?: Array<{ row: number; field: string; message: string }>;
  normalizedDefaults?: Record<string, unknown>;
};

type ImportAccessRequestState = "SAVING" | "PENDING" | "APPROVED" | "ERROR";

type ImportResult = {
  ok: boolean;
  summary?: {
    rowCount?: number;
    lotCount?: number;
    sectionCount?: number;
    spaceCount?: number;
  };
  items?: Array<{
    id: string;
    code: string;
    name: string;
    sectionCount: number;
    spaceCount: number;
    managementAccess?: boolean;
    managementAccessRequiresApproval?: boolean;
    edgeCloudSync?: {
      status?: string;
    } | null;
  }>;
};

const SPACE_TYPES = [
  "REGULAR",
  "EV",
  "HANDICAPPED",
  "PREGNANT",
  "COMPACT",
  "VIP",
  "RESERVED",
];

const SPACE_STATUSES = ["EMPTY", "OCCUPIED", "RESERVED", "DISABLED", "UNKNOWN"];

const BOOLEAN_OPTIONS = ["TRUE", "FALSE"];

function emptyRequestForm(): RequestForm {
  return {
    region: "",
    parkingLotId: "",
  };
}

function getLotQrToken(item: ParkingLot) {
  return (
    item.qrCodes?.find((qr) => qr.isActive !== false)?.qrToken ??
    item.qrToken ??
    ""
  );
}

function getLotQrUrl(item: ParkingLot) {
  const token = getLotQrToken(item);
  if (!token) return "";

  if (typeof window === "undefined") {
    return `/mobile/qr/${encodeURIComponent(token)}`;
  }

  return `${window.location.origin}/mobile/qr/${encodeURIComponent(token)}`;
}

function getSafeQrFileName(item: ParkingLot) {
  const base = `${item.code || "parking-lot"}-${item.name || "qr"}`;
  return base
    .replace(/[^0-9a-zA-Z가-힣._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function getPrimaryPhoto(item: ParkingLot) {
  return (
    item.photos?.find((photo) => photo.isPrimary)?.imageUrl ??
    item.photos?.[0]?.imageUrl ??
    ""
  );
}

function formatCoordinate(value: number | null | undefined) {
  if (value === null || value === undefined) return "-";

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return String(value);

  return parsed.toFixed(6);
}

function getLocationLine(item: ParkingLot) {
  return [item.region, item.district].filter(Boolean).join(" ") || "-";
}

function getCoordinateLine(item: ParkingLot) {
  if (item.lat == null || item.lng == null) return "-";

  return `${formatCoordinate(item.lat)}, ${formatCoordinate(item.lng)}`;
}

function getFacilitiesPath(role: Props["role"], path: string) {
  return `/${role ?? "admin"}/facilities/${path}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function ensureSvgNamespace(svg: string) {
  if (!svg) return "";
  if (svg.includes("xmlns=")) return svg;
  return svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

export default function LotsPage({ role = "admin" }: Props) {
  const searchParams = useSearchParams();
  const highlightedLotId = searchParams.get("lotId") ?? "";
  const canManage = role === "admin" || role === "manager";
  const { session } = useAuth();

  const [items, setItems] = useState<ParkingLot[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ParkingLot | null>(null);
  const [detail, setDetail] = useState<ParkingLot | null>(null);
  const [qrLot, setQrLot] = useState<ParkingLot | null>(null);
  const qrSvgRef = useRef<HTMLDivElement | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "active" | "inactive" | "all"
  >("active");
  const [regionFilter, setRegionFilter] = useState("");
  const [excelOpen, setExcelOpen] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validatedRows, setValidatedRows] = useState<Record<string, unknown>[]>(
    [],
  );
  const [validating, setValidating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importAccessRequests, setImportAccessRequests] = useState<
    Record<string, ImportAccessRequestState>
  >({});

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestableLots, setRequestableLots] = useState<
    RequestableParkingLot[]
  >([]);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestForm, setRequestForm] =
    useState<RequestForm>(emptyRequestForm());
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestMessage, setRequestMessage] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);

  const query = useMemo(
    () => parseTableQueryFromSearchParams(searchParams),
    [searchParams],
  );

  const regions = useMemo(() => {
    return Array.from(
      new Set(items.map((item) => item.region).filter(Boolean) as string[]),
    ).sort();
  }, [items]);

  const requestRegions = useMemo(() => {
    return Array.from(
      new Set(
        requestableLots.map((item) => item.region).filter(Boolean) as string[],
      ),
    ).sort();
  }, [requestableLots]);

  const requestLots = useMemo(() => {
    if (!requestForm.region) {
      return requestableLots;
    }

    return requestableLots.filter((item) => item.region === requestForm.region);
  }, [requestableLots, requestForm.region]);

  const filteredItems = useMemo(() => {
    const keyword = query.q.trim().toLowerCase();

    return items.filter((item) => {
      if (query.region && item.region !== query.region) return false;
      if (regionFilter && item.region !== regionFilter) return false;

      if (!keyword) return true;

      return [
        item.name,
        item.code,
        item.region,
        item.region,
        item.district,
        item.address,
        item.representative,
        item.contact,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));
    });
  }, [items, query.q, query.region, regionFilter]);

  const meta = useMemo(
    () =>
      createPaginationMeta({
        page: query.page,
        pageSize: query.pageSize,
        total: filteredItems.length,
      }),
    [filteredItems.length, query.page, query.pageSize],
  );

  const pagedItems = useMemo(
    () => paginateClientSide(filteredItems, meta.page, meta.pageSize),
    [filteredItems, meta.page, meta.pageSize],
  );

  const load = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch(
        `/facilities/lots?status=${statusFilter}`,
        {
          accessToken: session.accessToken,
        },
      );

      setItems(unwrapItems<ParkingLot>(response));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "주차장 목록을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [session?.accessToken, statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!highlightedLotId || loading) return;

    const element = document.getElementById(`lot-row-${highlightedLotId}`);
    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }, [highlightedLotId, loading, items.length]);

  function openCreate() {
    setSelected(null);
    setModalOpen(true);
  }

  function openEdit(item: ParkingLot) {
    setSelected(item);
    setModalOpen(true);
  }

  async function openRequest() {
    if (!session?.accessToken) return;

    setRequestForm(emptyRequestForm());
    setRequestableLots([]);
    setRequestMessage(null);
    setRequestOpen(true);
    setRequestLoading(true);

    try {
      const result = await apiFetch("/approvals/manager-lots/requestable", {
        accessToken: session.accessToken,
      });

      setRequestableLots(unwrapItems(result) as RequestableParkingLot[]);
    } catch (error) {
      setRequestMessage(
        error instanceof Error
          ? error.message
          : "신청 가능한 주차장을 불러오지 못했습니다.",
      );
    } finally {
      setRequestLoading(false);
    }
  }

  async function toggleStatus(item: ParkingLot) {
    if (!session?.accessToken) return;

    const nextIsActive = item.isActive === false;
    const label = nextIsActive ? "활성" : "비활성";

    if (!confirm(`${item.name} 주차장을 ${label} 상태로 변경하시겠습니까?`))
      return;

    await apiFetch(`/facilities/lots/${item.id}/status`, {
      method: "PATCH",
      accessToken: session.accessToken,
      body: JSON.stringify({
        isActive: nextIsActive,
      }),
    });

    await load();
  }

  async function downloadLotTemplate() {
    const XLSX = await import("xlsx");

    const rows = [
      {
        lotCode: "LOT-SENSOR-001",
        lotName: "센서 운영 샘플 주차장",
        operationMode: "SENSOR",
        region: "서울특별시",
        district: "강남구",
        address: "서울특별시 강남구 샘플로 1",
        timezone: "Asia/Seoul",
        lotLat: 37.4979,
        lotLng: 127.0276,
        centerLat: 37.4979,
        centerLng: 127.0276,
        representative: "홍길동",
        contact: "02-0000-0000",
        graceMinutes: 10,
        lotIsActive: "TRUE",
        sectionCode: "A",
        sectionName: "A구역",
        sectionCenterLat: 37.4979,
        sectionCenterLng: 127.0276,
        sectionIsActive: "TRUE",
        spaceCode: "A-001",
        spaceNumber: "A-001",
        spaceType: "REGULAR",
        spaceStatus: "EMPTY",
        spaceLat: 37.49791,
        spaceLng: 127.02761,
        widthMeter: 2.5,
        heightMeter: 5,
        rotationDeg: 0,
        posX: "",
        posY: "",
        spaceIsActive: "FALSE",
      },
      {
        lotCode: "LOT-SENSOR-001",
        lotName: "센서 운영 샘플 주차장",
        operationMode: "SENSOR",
        region: "서울특별시",
        district: "강남구",
        address: "서울특별시 강남구 샘플로 1",
        timezone: "Asia/Seoul",
        lotLat: 37.4979,
        lotLng: 127.0276,
        centerLat: 37.4979,
        centerLng: 127.0276,
        representative: "홍길동",
        contact: "02-0000-0000",
        graceMinutes: 10,
        lotIsActive: "TRUE",
        sectionCode: "A",
        sectionName: "A구역",
        sectionCenterLat: 37.4979,
        sectionCenterLng: 127.0276,
        sectionIsActive: "TRUE",
        spaceCode: "A-002",
        spaceNumber: "A-002",
        spaceType: "EV",
        spaceStatus: "EMPTY",
        spaceLat: 37.49792,
        spaceLng: 127.02762,
        widthMeter: 2.5,
        heightMeter: 5,
        rotationDeg: 0,
        posX: "",
        posY: "",
        spaceIsActive: "FALSE",
      },
      {
        lotCode: "LOT-MANUAL-001",
        lotName: "수동 운영 샘플 주차장",
        operationMode: "MANUAL",
        region: "전라남도",
        district: "화순군",
        address: "전라남도 화순군 화순읍 샘플길 1",
        timezone: "Asia/Seoul",
        lotLat: "",
        lotLng: "",
        centerLat: "",
        centerLng: "",
        representative: "김관리",
        contact: "061-000-0000",
        graceMinutes: 10,
        lotIsActive: "TRUE",
        sectionCode: "M",
        sectionName: "수동 운영 구역",
        sectionCenterLat: "",
        sectionCenterLng: "",
        sectionIsActive: "TRUE",
        spaceCode: "M-001",
        spaceNumber: "M-001",
        spaceType: "REGULAR",
        spaceStatus: "EMPTY",
        spaceLat: "",
        spaceLng: "",
        widthMeter: 2.5,
        heightMeter: 5,
        rotationDeg: 0,
        posX: 100,
        posY: 100,
        spaceIsActive: "FALSE",
      },
      {
        lotCode: "LOT-MANUAL-001",
        lotName: "수동 운영 샘플 주차장",
        operationMode: "MANUAL",
        region: "전라남도",
        district: "화순군",
        address: "전라남도 화순군 화순읍 샘플길 1",
        timezone: "Asia/Seoul",
        lotLat: "",
        lotLng: "",
        centerLat: "",
        centerLng: "",
        representative: "김관리",
        contact: "061-000-0000",
        graceMinutes: 10,
        lotIsActive: "TRUE",
        sectionCode: "M",
        sectionName: "수동 운영 구역",
        sectionCenterLat: "",
        sectionCenterLng: "",
        sectionIsActive: "TRUE",
        spaceCode: "M-002",
        spaceNumber: "M-002",
        spaceType: "HANDICAPPED",
        spaceStatus: "EMPTY",
        spaceLat: "",
        spaceLng: "",
        widthMeter: 3.3,
        heightMeter: 5,
        rotationDeg: 0,
        posX: 180,
        posY: 100,
        spaceIsActive: "FALSE",
      },
    ];

    const wb = XLSX.utils.book_new();

    const inputSheet = XLSX.utils.json_to_sheet(rows);

    const ruleSheet = XLSX.utils.aoa_to_sheet([
      ["구분", "항목", "설명"],
      [
        "중요",
        "샘플 행",
        "현재 입력된 SENSOR 및 MANUAL 샘플 행은 실제 등록 전에 삭제하거나 실제 현장 정보로 변경해야 합니다.",
      ],
      [
        "중요",
        "헤더",
        "첫 번째 행의 영문 헤더는 서버가 직접 읽으므로 이름을 변경하거나 삭제하지 마세요.",
      ],
      ["필수", "lotCode", "주차장 코드. 전체 시스템에서 고유해야 합니다."],
      ["필수", "lotName", "주차장 이름입니다."],
      [
        "필수",
        "operationMode",
        "SENSOR 또는 MANUAL. 같은 lotCode의 모든 행은 동일해야 합니다.",
      ],
      ["필수", "region", "시·도 이름입니다. 예: 서울특별시, 전라남도"],
      ["필수", "district", "시·군·구 이름입니다."],
      ["필수", "address", "주차장 주소입니다."],
      ["선택", "timezone", "비어 있으면 Asia/Seoul이 적용됩니다."],
      [
        "선택",
        "lotLat / lotLng",
        "주차장 위도와 경도입니다. 좌표가 없으면 비워둘 수 있습니다.",
      ],
      [
        "선택",
        "centerLat / centerLng",
        "지도 중심 좌표입니다. 비어 있으면 주차장 좌표가 사용됩니다.",
      ],
      [
        "필수",
        "graceMinutes",
        "무료 또는 유예 시간(분)이며 숫자로 입력합니다.",
      ],
      ["선택", "lotIsActive", "TRUE 또는 FALSE. 비어 있으면 TRUE입니다."],
      ["필수", "sectionCode", "구역 코드. 같은 주차장 안에서 고유해야 합니다."],
      ["필수", "sectionName", "구역 이름입니다."],
      ["선택", "sectionIsActive", "TRUE 또는 FALSE. 비어 있으면 TRUE입니다."],
      ["필수", "spaceCode", "주차면 코드. 같은 구역 안에서 고유해야 합니다."],
      ["필수", "spaceNumber", "화면에 표시할 주차면 번호입니다."],
      [
        "선택",
        "spaceType",
        `비어 있으면 REGULAR. 허용값: ${SPACE_TYPES.join(", ")}`,
      ],
      [
        "선택",
        "spaceStatus",
        `비어 있으면 EMPTY. 허용값: ${SPACE_STATUSES.join(", ")}`,
      ],
      [
        "선택",
        "spaceIsActive",
        "비어 있으면 FALSE입니다. Excel 등록 주차면은 현장 확인 전까지 비활성으로 시작하는 것을 권장합니다.",
      ],
      [
        "규칙",
        "같은 lotCode",
        "lotName, operationMode, 지역, 주소 등 주차장 공통값은 모든 행에서 동일하게 입력하세요.",
      ],
      [
        "규칙",
        "등록 권한",
        "Cloud와 Connected Edge에서 매니저가 등록한 주차장은 별도 관리 권한 승인이 필요합니다.",
      ],
      [
        "규칙",
        "일괄 처리",
        "한 행이라도 검증 오류가 있거나 등록 중 오류가 발생하면 전체 파일이 등록되지 않습니다.",
      ],
    ]);

    const codeSheet = XLSX.utils.aoa_to_sheet([
      ["항목", "허용값"],
      ["operationMode", "SENSOR", "MANUAL"],
      ["spaceType", ...SPACE_TYPES],
      ["spaceStatus", ...SPACE_STATUSES],
      ["boolean", ...BOOLEAN_OPTIONS],
      ["timezone", "Asia/Seoul"],
    ]);

    const inputHeaders = Object.keys(rows[0]);

    const headerWidths: Record<string, number> = {
      lotCode: 20,
      lotName: 26,
      operationMode: 18,
      region: 16,
      district: 16,
      address: 38,
      timezone: 18,
      lotLat: 14,
      lotLng: 14,
      centerLat: 14,
      centerLng: 14,
      representative: 16,
      contact: 18,
      graceMinutes: 16,
      lotIsActive: 15,
      sectionCode: 16,
      sectionName: 22,
      sectionCenterLat: 18,
      sectionCenterLng: 18,
      sectionIsActive: 18,
      spaceCode: 16,
      spaceNumber: 16,
      spaceType: 18,
      spaceStatus: 18,
      spaceLat: 14,
      spaceLng: 14,
      widthMeter: 15,
      heightMeter: 15,
      rotationDeg: 15,
      posX: 12,
      posY: 12,
      spaceIsActive: 18,
    };

    inputSheet["!cols"] = inputHeaders.map((header) => ({
      wch: headerWidths[header] ?? Math.max(12, header.length + 2),
    }));

    inputSheet["!rows"] = [
      {
        hpt: 24,
      },
    ];

    inputSheet["!autofilter"] = {
      ref: `A1:${XLSX.utils.encode_col(
        inputHeaders.length - 1,
      )}${rows.length + 1}`,
    };

    ruleSheet["!cols"] = [
      {
        wch: 12,
      },
      {
        wch: 28,
      },
      {
        wch: 100,
      },
    ];

    ruleSheet["!rows"] = [
      {
        hpt: 24,
      },
    ];

    codeSheet["!cols"] = [
      {
        wch: 22,
      },
      ...Array.from(
        {
          length: 8,
        },
        () => ({
          wch: 22,
        }),
      ),
    ];

    codeSheet["!rows"] = [
      {
        hpt: 24,
      },
    ];

    XLSX.utils.book_append_sheet(wb, inputSheet, "주차장_구역_주차면");

    XLSX.utils.book_append_sheet(wb, ruleSheet, "작성가이드");

    XLSX.utils.book_append_sheet(wb, codeSheet, "코드값");

    const buffer = XLSX.write(wb, {
      type: "array",
      bookType: "xlsx",
    });

    downloadBlob(
      "kosmos_parking_lot_bulk_import_template.xlsx",
      new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
  }

  async function validateLotExcelFile(file: File) {
    if (!session?.accessToken) return;

    setValidating(true);
    setValidation(null);
    setValidatedRows([]);
    setImportResult(null);
    setImportAccessRequests({});
    setError(null);

    try {
      const XLSX = await import("xlsx");
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const sheet =
        wb.Sheets["주차장_구역_주차면"] ?? wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: "",
      });

      const result = await apiFetch("/facilities/lots/validate-import", {
        method: "POST",
        accessToken: session.accessToken,
        body: JSON.stringify({ rows }),
      });

      const validationResult = result as ValidationResult;

      setValidation(validationResult);

      if (validationResult.ok) {
        setValidatedRows(rows);
      }
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Excel 검증에 실패했습니다.",
      );
    } finally {
      setValidating(false);
    }
  }

  async function requestImportedLotAccess(
    item: NonNullable<ImportResult["items"]>[number],
  ) {
    if (
      !session?.accessToken ||
      role !== "manager" ||
      !item.managementAccessRequiresApproval
    ) {
      return;
    }

    setImportAccessRequests((previous) => ({
      ...previous,
      [item.id]: "SAVING",
    }));

    setError(null);

    try {
      const result = (await apiFetch("/approvals/manager-lots", {
        method: "POST",
        accessToken: session.accessToken,
        body: JSON.stringify({
          parkingLotId: item.id,
        }),
      })) as {
        alreadyApproved?: boolean;
        duplicated?: boolean;
        item?: {
          status?: string;
        } | null;
      };

      const nextStatus: ImportAccessRequestState = result.alreadyApproved
        ? "APPROVED"
        : "PENDING";

      setImportAccessRequests((previous) => ({
        ...previous,
        [item.id]: nextStatus,
      }));
    } catch (error) {
      setImportAccessRequests((previous) => ({
        ...previous,
        [item.id]: "ERROR",
      }));

      setError(
        error instanceof Error
          ? error.message
          : `${item.name} 주차장의 관리 권한 요청에 실패했습니다.`,
      );
    }
  }

  async function submitLotExcelImport() {
    if (
      !session?.accessToken ||
      !validation?.ok ||
      validatedRows.length === 0
    ) {
      return;
    }

    if (!confirm("검증된 주차장, 구역, 주차면을 실제 등록하시겠습니까?")) {
      return;
    }

    setImporting(true);
    setImportResult(null);
    setError(null);

    try {
      const result = await apiFetch("/facilities/lots/import", {
        method: "POST",
        accessToken: session.accessToken,
        body: JSON.stringify({
          rows: validatedRows,
        }),
      });

      setImportResult(result as ImportResult);
      setImportAccessRequests({});

      setValidatedRows([]);
      setValidation(null);

      await load();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Excel 실제 등록에 실패했습니다.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function submitRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!session?.accessToken) return;

    if (!requestForm.parkingLotId) {
      setRequestMessage("주차장을 선택해 주세요.");
      return;
    }

    setRequestSaving(true);
    setRequestMessage(null);

    try {
      await apiFetch("/approvals/manager-lots", {
        method: "POST",
        accessToken: session.accessToken,
        body: JSON.stringify({
          parkingLotId: requestForm.parkingLotId,
        }),
      });

      setRequestMessage("권한 요청이 제출되었습니다.");
      setRequestOpen(false);
      setRequestForm(emptyRequestForm());
    } catch (error) {
      setRequestMessage(
        error instanceof Error
          ? error.message
          : "주차장 권한 요청에 실패했습니다.",
      );
    } finally {
      setRequestSaving(false);
    }
  }

  async function remove(id: string) {
    if (!session?.accessToken) return;
    if (!confirm("이 주차장을 삭제하시겠습니까?")) return;

    await apiFetch(`/facilities/lots/${id}`, {
      method: "DELETE",
      accessToken: session.accessToken,
    });

    await load();
  }

  function getCurrentQrSvgMarkup() {
    const svg = qrSvgRef.current?.querySelector("svg");
    return ensureSvgNamespace(svg?.outerHTML ?? "");
  }

  function printLargeQr() {
    if (!qrLot) return;

    const svg = getCurrentQrSvgMarkup();
    const url = getLotQrUrl(qrLot);

    if (!svg || !url) {
      window.print();
      return;
    }

    const title = `${qrLot.name} 주차장 QR 코드`;
    const printWindow = window.open("", "_blank", "width=900,height=900");

    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      font-family: Arial, 'Malgun Gothic', sans-serif;
      color: #0f172a;
      text-align: center;
    }

    .sheet {
      min-height: 270mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10mm;
    }

    .title {
      font-size: 24pt;
      font-weight: 800;
    }

    .subtitle {
      font-size: 12pt;
      color: #475569;
    }

    .qr {
      padding: 10mm;
      border: 1px solid #cbd5e1;
      border-radius: 8mm;
    }

    .qr svg {
      width: 150mm !important;
      height: 150mm !important;
      display: block;
    }

    .url {
      max-width: 170mm;
      word-break: break-all;
      font-size: 10pt;
      color: #334155;
    }
  </style>
</head>
<body>
  <main class="sheet">
    <div>
      <div class="title">${escapeHtml(qrLot.name)}</div>
      <div class="subtitle">주차 등록 QR 코드</div>
    </div>
    <div class="qr">${svg}</div>
    <div class="url">${escapeHtml(url)}</div>
  </main>
  <script>
    window.addEventListener('load', () => {
      window.setTimeout(() => window.print(), 300);
    });
  </script>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
  }

  function downloadQrSvg() {
    if (!qrLot) return;

    const svg = getCurrentQrSvgMarkup();
    if (!svg) return;

    const blob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });

    downloadBlob(`${getSafeQrFileName(qrLot)}.svg`, blob);
  }

  async function downloadQrPng() {
    if (!qrLot) return;

    const svg = getCurrentQrSvgMarkup();
    if (!svg) return;

    const svgBlob = new Blob([svg], {
      type: "image/svg+xml;charset=utf-8",
    });
    const objectUrl = URL.createObjectURL(svgBlob);

    try {
      await new Promise<void>((resolve, reject) => {
        const image = new Image();

        image.onload = () => {
          const size = 1600;
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");

          if (!context) {
            URL.revokeObjectURL(objectUrl);
            reject(new Error("Canvas context is not available."));
            return;
          }

          canvas.width = size;
          canvas.height = size;

          context.fillStyle = "#ffffff";
          context.fillRect(0, 0, size, size);
          context.imageSmoothingEnabled = false;
          context.drawImage(image, 0, 0, size, size);

          canvas.toBlob((blob) => {
            URL.revokeObjectURL(objectUrl);

            if (!blob) {
              reject(new Error("PNG file could not be created."));
              return;
            }

            downloadBlob(`${getSafeQrFileName(qrLot)}.png`, blob);
            resolve();
          }, "image/png");
        };

        image.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error("QR image could not be loaded."));
        };

        image.src = objectUrl;
      });
    } catch (error) {
      alert(
        error instanceof Error
          ? error.message
          : "QR PNG 다운로드에 실패했습니다.",
      );
    }
  }

  return (
    <main className="space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">주차장 관리</h1>
          <p className="text-sm text-slate-500">
            {role === "admin"
              ? "전체 주차장을 관리합니다."
              : role === "manager"
                ? "주차장을 생성하고, 승인된 주차장을 관리합니다."
                : "권한이 있는 주차장을 조회합니다."}
          </p>
        </div>

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            {role === "manager" ? (
              <button
                type="button"
                onClick={() => void openRequest()}
                className="rounded-xl border border-blue-200 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                권한 요청
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setExcelOpen(true)}
              className="rounded-xl border px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Excel 등록
            </button>

            <button
              type="button"
              onClick={openCreate}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              추가
            </button>
          </div>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
            조회 전용
          </span>
        )}
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {requestMessage ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
          {requestMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="text-sm text-slate-500">불러오는 중...</div>
      ) : null}

      <section className="rounded-2xl border bg-white p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">
              주차장 상태
            </span>
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as "active" | "inactive" | "all",
                )
              }
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="active">활성 주차장</option>
              <option value="inactive">비활성 주차장</option>
              <option value="all">전체</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-semibold text-slate-500">
              지역 필터
            </span>
            <select
              value={regionFilter}
              onChange={(event) => setRegionFilter(event.target.value)}
              className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
            >
              <option value="">전체 지역</option>
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="whitespace-nowrap px-4 py-3">번호</th>
                <th className="whitespace-nowrap px-4 py-3">주차장</th>
                <th className="whitespace-nowrap px-4 py-3">위치 / 좌표</th>
                <th className="whitespace-nowrap px-4 py-3">구역</th>
                <th className="whitespace-nowrap px-4 py-3">운영정보</th>
                <th className="whitespace-nowrap px-4 py-3">상태</th>
                <th className="whitespace-nowrap px-4 py-3">QR</th>
                {role !== "operator" ? (
                  <th className="whitespace-nowrap px-4 py-3">관리</th>
                ) : null}
              </tr>
            </thead>

            <tbody>
              {pagedItems.map((item, index) => (
                <tr
                  key={item.id}
                  id={`lot-row-${item.id}`}
                  className={`border-t align-top ${
                    highlightedLotId === item.id
                      ? "bg-blue-50 ring-1 ring-inset ring-blue-200"
                      : ""
                  }`}
                >
                  <td className="whitespace-nowrap px-4 py-4 text-slate-500">
                    {getRowNumber({
                      page: meta.page,
                      pageSize: meta.pageSize,
                      index,
                    })}
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex min-w-[280px] gap-3">
                      {getPrimaryPhoto(item) ? (
                        <img
                          src={getPrimaryPhoto(item)}
                          alt={`${item.name} 대표 사진`}
                          className="h-16 w-20 shrink-0 rounded-xl border object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-20 shrink-0 items-center justify-center rounded-xl border border-dashed bg-slate-50 text-[11px] font-semibold text-slate-400">
                          사진 없음
                        </div>
                      )}

                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setDetail(item)}
                          className="max-w-[220px] truncate text-left font-semibold text-blue-600 hover:underline"
                          title={item.name}
                        >
                          {item.name}
                        </button>
                        <div className="mt-1 text-xs font-semibold text-slate-500">
                          {item.code || "-"}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.photos?.length
                            ? `사진 ${item.photos.length}장`
                            : "사진 미등록"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <div className="min-w-[280px] space-y-1">
                      <div className="font-semibold text-slate-700">
                        {getLocationLine(item)}
                      </div>
                      <div className="break-words text-xs text-slate-500">
                        주소: {item.address || "-"}
                      </div>
                      <div className="font-mono text-xs text-slate-500">
                        좌표: {getCoordinateLine(item)}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <Link
                      href={`${getFacilitiesPath(role, "sections")}?lotId=${item.id}`}
                      className="inline-flex whitespace-nowrap rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 underline-offset-2 hover:underline"
                    >
                      {(item._count?.sections ?? 0).toLocaleString()}개
                    </Link>
                  </td>

                  <td className="px-4 py-4">
                    <div className="min-w-[140px] space-y-1 text-xs">
                      <div>
                        <span className="font-semibold text-slate-500">
                          대표자
                        </span>{" "}
                        <span className="text-slate-700">
                          {item.representative || "-"}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-slate-500">
                          연락처
                        </span>{" "}
                        <span className="text-slate-700">
                          {item.contact || "-"}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-4">
                    <span
                      className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold ${
                        item.isActive === false
                          ? "bg-slate-100 text-slate-600"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {item.isActive === false ? "비활성" : "활성"}
                    </span>
                  </td>

                  <td className="px-4 py-4">
                    <div className="min-w-[100px] space-y-2">
                      <div
                        className={`text-xs font-semibold ${
                          getLotQrToken(item)
                            ? "text-emerald-700"
                            : "text-red-600"
                        }`}
                      >
                        {getLotQrToken(item) ? "토큰 있음" : "토큰 없음"}
                      </div>
                      <button
                        type="button"
                        onClick={() => setQrLot(item)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        QR 보기
                      </button>
                    </div>
                  </td>

                  {role !== "operator" ? (
                    <td className="px-4 py-4">
                      {role === "admin" ? (
                        <div className="flex min-w-[120px] flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-50"
                          >
                            수정
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleStatus(item)}
                            className={`rounded-lg border px-3 py-1 text-xs ${
                              item.isActive === false
                                ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                : "border-amber-200 text-amber-700 hover:bg-amber-50"
                            }`}
                          >
                            {item.isActive === false ? "활성" : "비활성"}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRequestForm({
                              region: item.region ?? "",
                              parkingLotId: item.id,
                            });
                            setRequestOpen(true);
                          }}
                          className="rounded-lg border px-3 py-1 text-xs hover:bg-slate-50"
                        >
                          권한 요청
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}

              {!loading && filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={role !== "operator" ? 8 : 7}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    표시할 주차장이 없습니다.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <PaginationBar meta={meta} />

      {qrLot ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">주차장 QR 코드</h2>
                <p className="mt-1 text-sm text-slate-500">
                  {qrLot.name} 주차장에 부착할 QR 코드입니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrLot(null)}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div
              ref={qrSvgRef}
              className="mt-6 flex max-w-full justify-center overflow-auto rounded-2xl border bg-white p-8"
            >
              {getLotQrToken(qrLot) ? (
                <QRCodeSVG
                  value={getLotQrUrl(qrLot)}
                  size={340}
                  level="M"
                  includeMargin
                />
              ) : (
                <div className="text-sm text-red-600">QR 토큰이 없습니다.</div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              <div className="text-xs font-semibold text-slate-500">
                QR 접속 URL
              </div>
              <div className="break-all rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                {getLotQrUrl(qrLot) || "-"}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = getLotQrUrl(qrLot);
                  if (url) void navigator.clipboard?.writeText(url);
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                URL 복사
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = getLotQrUrl(qrLot);
                  if (url) window.open(url, "_blank", "noopener,noreferrer");
                }}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                새 창 열기
              </button>
              <button
                type="button"
                onClick={downloadQrSvg}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                SVG 다운로드
              </button>
              <button
                type="button"
                onClick={() => void downloadQrPng()}
                className="rounded-lg border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                PNG 다운로드
              </button>
              <button
                type="button"
                onClick={printLargeQr}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                큰 QR 인쇄
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {excelOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">주차장 Excel 등록</h2>
                <p className="mt-1 text-sm text-slate-500">
                  주차장, 주차구역, 주차면을 한 번에 입력하는 Excel 파일을
                  검증한 뒤 실제 등록할 수 있습니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setExcelOpen(false)}
                className="rounded-lg border px-3 py-1 text-sm hover:bg-slate-50"
              >
                닫기
              </button>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void downloadLotTemplate()}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                샘플 Excel 다운로드
              </button>

              <label className="cursor-pointer rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Excel 업로드 검증
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void validateLotExcelFile(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>

              <button
                type="button"
                onClick={() => void submitLotExcelImport()}
                disabled={
                  importing || !validation?.ok || validatedRows.length === 0
                }
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {importing ? "등록 중..." : "검증된 내용 등록"}
              </button>
            </div>

            <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">기본 검증 기준</p>
              <p className="mt-1">
                필수값: lotCode, lotName, operationMode, region, district,
                address, graceMinutes, sectionCode, sectionName, spaceCode,
                spaceNumber
              </p>
              <p className="mt-1">
                enum: operationMode, spaceType, spaceStatus는 코드값 시트의 값만
                허용합니다.
              </p>
              <p className="mt-1">
                operationMode: SENSOR는 센서 방식, MANUAL은 수동 방식입니다.
                같은 lotCode의 모든 행에 동일한 값을 입력해야 합니다.
              </p>
              <p className="mt-1">
                Excel 등록 주차면은 기본적으로
                비활성(spaceIsActive=FALSE)입니다.
              </p>
            </div>

            {validating ? (
              <p className="mt-4 text-sm text-slate-500">검증 중...</p>
            ) : null}

            {importResult ? (
              <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
                <p className="font-semibold">Excel 등록이 완료되었습니다.</p>

                <p className="mt-1">
                  주차장 {importResult.summary?.lotCount ?? 0}
                  개, 구역 {importResult.summary?.sectionCount ?? 0}
                  개, 주차면 {importResult.summary?.spaceCount ?? 0}
                  개가 등록되었습니다.
                </p>

                {(importResult.items ?? []).some(
                  (item) => item.managementAccessRequiresApproval,
                ) ? (
                  <p className="mt-2 text-amber-700">
                    매니저 관리 권한은 자동 부여되지 않습니다. 등록된 주차장에
                    대해 별도로 관리 권한을 신청해야 합니다.
                  </p>
                ) : null}

                {(importResult.items ?? []).length > 0 ? (
                  <ul className="mt-3 space-y-2">
                    {(importResult.items ?? []).map((item) => {
                      const requestState = importAccessRequests[item.id];

                      const requiresRequest =
                        role === "manager" &&
                        item.managementAccessRequiresApproval;

                      const requestLabel =
                        requestState === "SAVING"
                          ? "요청 중..."
                          : requestState === "PENDING"
                            ? "승인 대기"
                            : requestState === "APPROVED"
                              ? "권한 있음"
                              : requestState === "ERROR"
                                ? "다시 요청"
                                : "관리 권한 요청";

                      const requestDisabled =
                        requestState === "SAVING" ||
                        requestState === "PENDING" ||
                        requestState === "APPROVED";

                      return (
                        <li
                          key={item.id}
                          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-white px-3 py-2"
                        >
                          <span>
                            {item.name} ({item.code}) · 구역 {item.sectionCount}
                            개 · 주차면 {item.spaceCount}개
                            {item.edgeCloudSync ? " · Cloud 전송 대기" : ""}
                          </span>

                          {requiresRequest ? (
                            <button
                              type="button"
                              disabled={requestDisabled}
                              onClick={() =>
                                void requestImportedLotAccess(item)
                              }
                              className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                            >
                              {requestLabel}
                            </button>
                          ) : item.managementAccess ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                              관리 가능
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {validation ? (
              <div className="mt-5 space-y-4">
                <div
                  className={`rounded-2xl border p-4 text-sm ${
                    validation.ok
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-red-200 bg-red-50 text-red-700"
                  }`}
                >
                  {validation.ok
                    ? "검증을 통과했습니다. 상단의 ‘검증된 내용 등록’ 버튼으로 실제 등록할 수 있습니다."
                    : "검증 오류가 있습니다. 오류 목록을 확인해 주세요."}
                </div>

                <pre className="overflow-auto rounded-2xl bg-slate-50 p-4 text-xs">
                  {JSON.stringify(validation.summary ?? {}, null, 2)}
                </pre>

                {(validation.errors ?? []).length > 0 ? (
                  <div>
                    <h3 className="mb-2 font-semibold text-red-700">오류</h3>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-red-50">
                        <tr>
                          <th className="px-3 py-2">행</th>
                          <th className="px-3 py-2">필드</th>
                          <th className="px-3 py-2">내용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(validation.errors ?? []).map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2">{item.row || "-"}</td>
                            <td className="px-3 py-2">{item.field}</td>
                            <td className="px-3 py-2">{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}

                {(validation.warnings ?? []).length > 0 ? (
                  <div>
                    <h3 className="mb-2 font-semibold text-amber-700">경고</h3>
                    <table className="w-full text-left text-xs">
                      <thead className="bg-amber-50">
                        <tr>
                          <th className="px-3 py-2">행</th>
                          <th className="px-3 py-2">필드</th>
                          <th className="px-3 py-2">내용</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(validation.warnings ?? []).map((item, index) => (
                          <tr key={index} className="border-t">
                            <td className="px-3 py-2">{item.row || "-"}</td>
                            <td className="px-3 py-2">{item.field}</td>
                            <td className="px-3 py-2">{item.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <ParkingLotFormModal
        open={canManage && modalOpen}
        value={selected}
        accessToken={session?.accessToken}
        onClose={() => setModalOpen(false)}
        onSaved={() => {
          setModalOpen(false);
          void load();
        }}
      />

      {requestOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={submitRequest}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold">주차장 권한 요청</h2>
            <p className="mt-1 text-sm text-slate-500">
              관리 권한을 요청할 지역과 주차장을 선택하세요.
            </p>

            <div className="mt-5 space-y-4">
              {requestLoading ? (
                <p className="text-sm text-slate-500">
                  신청 가능한 주차장을 불러오는 중...
                </p>
              ) : null}

              <label className="block">
                <span className="text-sm font-medium text-slate-700">지역</span>
                <select
                  value={requestForm.region}
                  onChange={(event) =>
                    setRequestForm({
                      region: event.target.value,
                      parkingLotId: "",
                    })
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">전체 지역</option>
                  {requestRegions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  주차장
                </span>
                <select
                  value={requestForm.parkingLotId}
                  onChange={(event) =>
                    setRequestForm((prev) => ({
                      ...prev,
                      parkingLotId: event.target.value,
                    }))
                  }
                  className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:border-blue-500"
                >
                  <option value="">주차장 선택</option>
                  {requestLots.map((lot) => (
                    <option
                      key={lot.id}
                      value={lot.id}
                      disabled={lot.requestStatus === "PENDING"}
                    >
                      {lot.region ? `[${lot.region}] ` : ""}
                      {lot.name} {lot.code ? `(${lot.code})` : ""}
                      {lot.requestStatus === "PENDING" ? " - 승인 대기" : ""}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={requestSaving}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {requestSaving ? "제출 중..." : "제출"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-xl font-bold">{detail.name}</h2>

            {detail.photos?.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {detail.photos.map((photo, index) => (
                  <img
                    key={photo.id ?? `${photo.imageUrl.slice(0, 30)}-${index}`}
                    src={photo.imageUrl}
                    alt={`주차장 사진 ${index + 1}`}
                    className="h-48 w-full rounded-2xl border object-cover"
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-dashed bg-slate-50 p-6 text-center text-sm text-slate-500">
                등록된 주차장 사진이 없습니다.
              </div>
            )}

            <div className="mt-4 space-y-2 text-sm">
              <Row label="주차장 코드" value={detail.code} />
              <Row label="주차장명" value={detail.name} />
              <Row label="시/도" value={detail.region} />
              <Row label="시/군/구" value={detail.district} />
              <Row label="주소" value={detail.address} />
              <Row label="위도" value={detail.lat} />
              <Row label="경도" value={detail.lng} />
              <Row label="대표자" value={detail.representative} />
              <Row label="연락처" value={detail.contact} />
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setDetail(null)}
                className="rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Row({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid grid-cols-3 gap-3 rounded-xl bg-slate-50 px-4 py-2">
      <div className="font-medium text-slate-500">{label}</div>
      <div className="col-span-2 break-all">
        {value == null ? "-" : String(value)}
      </div>
    </div>
  );
}
