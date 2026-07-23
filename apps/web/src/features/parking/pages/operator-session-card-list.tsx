"use client";

type Props = {
  rows: any[];
  loading: boolean;
  canRegister: boolean;
  historyOnly: boolean;
  onDetail: (row: any) => void;
  onRegister: (row: any) => void;
  onPayment: (row: any) => void;
};

type PaidWithoutExitWork = {
  minutes: number | null;
  label: string;
  description: string;
  className: string;
};

function formatCurrency(value?: number | null) {
  return `₩${Number(value ?? 0).toLocaleString("ko-KR")}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatKoreanPhoneNumber(value?: string | null) {
  const digits = String(value ?? "").replace(/\D/g, "");

  if (!digits) return "-";

  if (digits.length === 11) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return String(value ?? "-");
}

function elapsedMinutes(row: any) {
  if (!row.entryTime) return null;

  const start = new Date(row.entryTime);
  if (Number.isNaN(start.getTime())) return null;

  const end = row.exitTime ? new Date(row.exitTime) : new Date();
  if (Number.isNaN(end.getTime())) return null;

  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 60000));
}

function formatElapsed(minutes?: number | null) {
  if (minutes === null || minutes === undefined) return "-";
  if (minutes <= 0) return "0분";

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours > 0 && rest > 0) return `${hours}시간 ${rest}분`;
  if (hours > 0) return `${hours}시간`;
  return `${rest}분`;
}

function formatElapsedCell(
  elapsed: number | null,
  paidExitWork: PaidWithoutExitWork | null,
) {
  const base = formatElapsed(elapsed);

  if (!paidExitWork) return base;

  return `${base}(결제 후 ${formatElapsed(paidExitWork.minutes)})`;
}

function getSessionParkingSpace(row: any) {
  return row.parkingSpace ?? row.ParkingSpace ?? null;
}

function getSessionParkingLotName(row: any) {
  if (row.parkingLotName) return row.parkingLotName;

  const space = getSessionParkingSpace(row);
  if (!space) return "-";

  const parkingLot = space.parkingLot;
  if (typeof parkingLot === "string" && parkingLot) return parkingLot;
  if (parkingLot?.name || parkingLot?.code) {
    return parkingLot.name ?? parkingLot.code;
  }

  const section = space.section;
  if (section && typeof section === "object") {
    return section.parkingLot?.name ?? section.parkingLot?.code ?? "-";
  }

  return "-";
}

function getSessionSectionName(row: any) {
  if (row.sectionName) return row.sectionName;

  const space = getSessionParkingSpace(row);
  const section = space?.section;

  if (typeof section === "string" && section) return section;
  if (section && typeof section === "object") {
    return section.name ?? section.code ?? "-";
  }

  return "-";
}

function getSessionSpaceCode(row: any) {
  if (row.parkingSpaceCode) return row.parkingSpaceCode;

  const space = getSessionParkingSpace(row);

  return space?.code ?? space?.number ?? "-";
}

function getSessionSensorDevEui(row: any) {
  return (
    row.latestSensorData?.dev_eui ??
    row.latestSensorData?.devEui ??
    row.parkingSpace?.device?.devEui ??
    row.parkingSpace?.device?.dev_eui ??
    row.parkingSpace?.sensorDevice?.devEui ??
    row.parkingSpace?.sensorDevice?.dev_eui ??
    row.ParkingSpace?.device?.devEui ??
    row.ParkingSpace?.device?.dev_eui ??
    row.ParkingSpace?.sensorDevice?.devEui ??
    row.ParkingSpace?.sensorDevice?.dev_eui ??
    row.sensorDevice?.devEui ??
    row.sensorDevice?.dev_eui ??
    row.device?.devEui ??
    row.device?.dev_eui ??
    row.devEui ??
    row.dev_eui ??
    ""
  );
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
  const explicit =
    row.unpaidAmount ?? row.unpaidFee ?? row.latestInvoice?.unpaidAmount;

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

function isUnregisteredOver10(row: any) {
  return (
    row.status === "ACTIVE" &&
    !row.isRegistered &&
    Number(elapsedMinutes(row) ?? 0) >= 10
  );
}

function isOutstanding(row: any) {
  return getUnpaidAmount(row) > 0;
}

function getRegistrationBadge(row: any) {
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

function getPaymentBadge(row: any) {
  const unpaid = getUnpaidAmount(row);
  const paid = getPaidAmount(row);
  const invoiceStatus = row.invoiceStatus ?? row.latestInvoice?.status;

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

function getSessionPaidAt(row: any) {
  return row.paidAt ?? row.latestInvoice?.paidAt ?? null;
}

function isPaidWithoutExit(row: any) {
  const sessionStatus = String(row.status ?? "").toUpperCase();
  const invoiceStatus = String(
    row.invoiceStatus ?? row.latestInvoice?.status ?? "",
  ).toUpperCase();

  const paidAmount = Number(row.paidAmount ?? row.latestInvoice?.paidAmount ?? 0);
  const unpaidAmount = Number(
    row.unpaidAmount ?? row.unpaidFee ?? row.latestInvoice?.unpaidAmount ?? 0,
  );

  return (
    sessionStatus === "ACTIVE" &&
    !row.exitTime &&
    (invoiceStatus === "PAID" || (paidAmount > 0 && unpaidAmount <= 0))
  );
}

function paidWithoutExitMinutes(row: any) {
  const paidAt = getSessionPaidAt(row) ?? row.entryTime;
  if (!paidAt) return null;

  const paidTime = new Date(paidAt).getTime();
  if (Number.isNaN(paidTime)) return null;

  return Math.max(0, Math.floor((Date.now() - paidTime) / 60000));
}

function getPaidWithoutExitWork(row: any): PaidWithoutExitWork | null {
  if (!isPaidWithoutExit(row)) return null;

  const minutes = paidWithoutExitMinutes(row);

  if (minutes === null) {
    return {
      minutes,
      label: "결제 후 미출차",
      description: "출차 확인",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  if (minutes < 10) {
    return {
      minutes,
      label: "출차 대기",
      description: "결제 후 미출차",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  if (minutes < 20) {
    return {
      minutes,
      label: "출차 확인",
      description: "결제 후 미출차",
      className: "border-amber-200 bg-amber-50 text-amber-800",
    };
  }

  return {
    minutes,
    label: "현장 확인",
    description: "추가요금 검토",
    className: "border-red-200 bg-red-50 text-red-700",
  };
}

function getPaidWithoutExitActionLabel(work: PaidWithoutExitWork) {
  return `${work.label} · ${work.description}`;
}

function getHistoryActionLabel(row: any) {
  return getUnpaidAmount(row) > 0 ? "청구서" : "영수증";
}

export function OperatorSessionCardList({
  rows,
  loading,
  canRegister,
  historyOnly,
  onDetail,
  onRegister,
  onPayment,
}: Props) {
  if (loading) {
    return (
      <section className="rounded-3xl border bg-white p-6 text-sm font-bold text-slate-500">
        불러오는 중입니다.
      </section>
    );
  }

  if (rows.length === 0) {
    return (
      <section className="rounded-3xl border bg-white p-6 text-sm font-bold text-slate-500">
        표시할 세션이 없습니다.
      </section>
    );
  }

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {rows.map((row) => {
        const elapsed = elapsedMinutes(row);
        const needsRegistration = isUnregisteredOver10(row);
        const registrationBadge = getRegistrationBadge(row);
        const paidExitWork = getPaidWithoutExitWork(row);

        return (
          <article
            key={row.id}
            className={[
              "rounded-[2rem] border bg-white p-5 shadow-sm",
              needsRegistration ? "border-red-200 bg-red-50/30" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-xs font-black text-slate-400">
                  {getSessionParkingLotName(row)}
                </div>
                <div className="mt-1 text-3xl font-black text-slate-950">
                  {getSessionSpaceCode(row)}
                </div>
                <div className="mt-1 truncate text-xs font-bold text-slate-400">
                  {getSessionSectionName(row)}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-xs font-black text-slate-400">
                  {historyOnly ? "주차 시간" : "경과 시간"}
                </div>
                <div
                  className={[
                    "mt-1 whitespace-nowrap text-base font-black",
                    needsRegistration ? "text-red-600" : "text-slate-900",
                  ].join(" ")}
                >
                  {formatElapsedCell(elapsed, paidExitWork)}
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {!historyOnly ? (
                <span
                  className={[
                    "rounded-full px-3 py-1 text-xs font-black",
                    registrationBadge.className,
                  ].join(" ")}
                >
                  {registrationBadge.label}
                </span>
              ) : null}


              {!historyOnly && paidExitWork ? (
                <span
                  className={[
                    "whitespace-nowrap rounded-full border px-3 py-1 text-xs font-black",
                    paidExitWork.className,
                  ].join(" ")}
                >
                  {getPaidWithoutExitActionLabel(paidExitWork)}
                </span>
              ) : null}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-400">차량번호</div>
                <div className="mt-1 font-black text-slate-900">
                  {row.plateNumber ?? "-"}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-400">연락처</div>
                <div className="mt-1 font-black text-slate-900">
                  {formatKoreanPhoneNumber(row.contactNumber)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-400">센서 DevEUI</div>
                <div className="mt-1 break-all font-black text-slate-900">
                  {getSessionSensorDevEui(row) || "-"}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-400">입차 시간</div>
                <div className="mt-1 font-black text-slate-900">
                  {formatDate(row.entryTime)}
                </div>
              </div>
            </div>

            {historyOnly ? (
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-xs">
                <div>
                  <div className="font-bold text-slate-400">청구 금액</div>
                  <div className="mt-1 text-slate-700">
                    {formatCurrency(getBilledAmount(row))}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-slate-400">결제 금액</div>
                  <div className="mt-1 text-slate-700">
                    {formatCurrency(getPaidAmount(row))}
                  </div>
                </div>
                <div>
                  <div className="font-bold text-slate-400">미납 금액</div>
                  <div className="mt-1 text-slate-700">
                    {formatCurrency(getUnpaidAmount(row))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm">
                <span className="font-bold text-slate-400">예상 요금</span>
                <span className="font-black text-slate-900">
                  {formatCurrency(getExpectedFeeAmount(row))}
                </span>
              </div>
            )}

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => onDetail(row)}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
              >
                상세
              </button>

              {!historyOnly && canRegister && !row.isRegistered ? (
                <button
                  type="button"
                  onClick={() => onRegister(row)}
                  className="rounded-2xl bg-slate-900 px-4 py-2 text-xs font-black text-white"
                >
                  주차 등록
                </button>
              ) : null}

              {historyOnly ? (
                <button
                  type="button"
                  onClick={() =>
                    getUnpaidAmount(row) > 0 ? onPayment(row) : onDetail(row)
                  }
                  className={[
                    "rounded-2xl px-4 py-2 text-xs font-black text-white",
                    getUnpaidAmount(row) > 0 ? "bg-blue-600" : "bg-emerald-600",
                  ].join(" ")}
                >
                  {getHistoryActionLabel(row)}
                </button>
              ) : isOutstanding(row) ? (
                <button
                  type="button"
                  onClick={() => onPayment(row)}
                  className="rounded-2xl bg-blue-600 px-4 py-2 text-xs font-black text-white"
                >
                  결제 등록
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}
