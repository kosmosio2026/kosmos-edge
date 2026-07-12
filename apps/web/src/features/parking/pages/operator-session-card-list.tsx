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

function elapsedMinutes(row: any) {
  if (!row.entryTime) return null;

  const date = new Date(row.entryTime);
  if (Number.isNaN(date.getTime())) return null;

  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
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

function getSessionParkingSpace(row: any) {
  return row.parkingSpace ?? row.ParkingSpace ?? null;
}

function getSessionParkingLotName(row: any) {
  if (row.parkingLotName) return row.parkingLotName;

  const space = getSessionParkingSpace(row);
  if (!space) return "-";

  const parkingLot = space.parkingLot;
  if (typeof parkingLot === "string" && parkingLot) return parkingLot;
  if (parkingLot?.name || parkingLot?.code) return parkingLot.name ?? parkingLot.code;

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
  if (section && typeof section === "object") return section.name ?? section.code ?? "-";

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

function isUnregisteredOver10(row: any) {
  return row.status === "ACTIVE" && !row.isRegistered && Number(elapsedMinutes(row) ?? 0) >= 10;
}

function isOutstanding(row: any) {
  return Number(row.unpaidFee ?? row.unpaidAmount ?? 0) > 0;
}

function getUnpaidAmount(row: any) {
  const explicit = row.unpaidAmount ?? row.unpaidFee ?? row.latestInvoice?.unpaidAmount;

  if (explicit !== null && explicit !== undefined) {
    return Number(explicit);
  }

  return Math.max(0, getBilledAmount(row) - getPaidAmount(row));
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
        Loading...
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
        const paymentBadge = getPaymentBadge(row);

        return (
          <article
            key={row.id}
            className={[
              "rounded-[2rem] border bg-white p-5 shadow-sm",
              needsRegistration ? "border-red-200 bg-red-50/30" : "",
            ].join(" ")}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-slate-400">
                  {getSessionParkingLotName(row)}
                </div>
                <div className="mt-1 text-3xl font-black text-slate-950">
                  {getSessionSpaceCode(row)}
                </div>
                <div className="mt-1 text-xs font-bold text-slate-400">
                  {getSessionSectionName(row)}
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs font-black text-slate-400">
                  {historyOnly ? "주차 시간" : "경과 시간"}
                </div>
                <div
                  className={[
                    "mt-1 text-xl font-black",
                    needsRegistration ? "text-red-600" : "text-slate-900",
                  ].join(" ")}
                >
                  {formatElapsed(elapsed)}
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

              <span
                className={[
                  "rounded-full px-3 py-1 text-xs font-black",
                  paymentBadge.className,
                ].join(" ")}
              >
                {paymentBadge.label}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-400">차량번호</div>
                <div className="mt-1 font-black text-slate-900">{row.plateNumber ?? "-"}</div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3">
                <div className="text-xs font-black text-slate-400">연락처</div>
                <div className="mt-1 font-black text-slate-900">
                  {row.contactNumber ?? "-"}
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
                <div className="mt-1 font-black text-slate-900">{formatDate(row.entryTime)}</div>
              </div>
            </div>

            {historyOnly ? (
              <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-xs">
                <div>
                  <div className="font-bold text-slate-400">청구 금액</div>
                  <div className="mt-1 text-slate-700">{formatCurrency(getBilledAmount(row))}</div>
                </div>
                <div>
                  <div className="font-bold text-slate-400">결제 금액</div>
                  <div className="mt-1 text-slate-700">{formatCurrency(getPaidAmount(row))}</div>
                </div>
                <div>
                  <div className="font-bold text-slate-400">미납 금액</div>
                  <div className="mt-1 text-slate-700">{formatCurrency(getUnpaidAmount(row))}</div>
                </div>
              </div>
            ) : (
              <div className="mt-4 flex items-center justify-between rounded-2xl bg-slate-50 p-3 text-sm">
                <span className="font-bold text-slate-400">예상 요금</span>
                <span className="text-slate-700">{formatCurrency(getExpectedFeeAmount(row))}</span>
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {!historyOnly && canRegister && !row.isRegistered ? (
                <button
                  type="button"
                  onClick={() => onRegister(row)}
                  className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-black text-white"
                >
                  주차 등록
                </button>
              ) : historyOnly ? (
                <button
                  type="button"
                  onClick={() => (getUnpaidAmount(row) > 0 ? onPayment(row) : onDetail(row))}
                  className={[
                    "rounded-lg px-3 py-2 text-xs font-black text-white",
                    getUnpaidAmount(row) > 0 ? "bg-blue-600" : "bg-emerald-600",
                  ].join(" ")}
                >
                  {getUnpaidAmount(row) > 0 ? "청구서" : "영수증"}
                </button>
              ) : isOutstanding(row) ? (
                <button
                  type="button"
                  onClick={() => onPayment(row)}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-black text-white"
                >
                  청구서
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => onDetail(row)}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                >
                  영수증
                </button>
              )}

              {getSensorDetailHref(row) ? (
                <a
                  href={getSensorDetailHref(row)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
                >
                  센서
                </a>
              ) : null}
            </div>

            <div className="mt-4 border-t border-slate-100 pt-4 text-xs font-bold text-slate-400">
              세션: {row.sessionNo ?? row.id}
            </div>
          </article>
        );
      })}
    </section>
  );
}
