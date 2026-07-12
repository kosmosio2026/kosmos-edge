'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  clearTokens,
  getAccessToken,
  getLiveParkingSpaces,
  mockCompletePayment,
  registerParkingSession,
  sendSensorEvent,
  type LiveSpace,
  type LiveSpaceState,
} from '@/lib/api';

function stateLabel(state: LiveSpaceState) {
  switch (state) {
    case 'EMPTY':
      return 'Empty';
    case 'OCCUPIED_REGISTERED':
      return 'Occupied / Registered';
    case 'OCCUPIED_UNREGISTERED':
      return 'Occupied / Unregistered';
    case 'UNREGISTERED_OVERDUE':
      return 'Unregistered Overdue';
    case 'PAYMENT_GRACE_EXPIRED':
      return 'Payment Grace Expired';
    case 'LONG_PARKING_ALERT':
      return 'Long Parking Alert';
    case 'EXITED_UNPAID':
      return 'Exited / Unpaid';
    case 'DISABLED':
      return 'Disabled';
    case 'SENSOR_ERROR':
      return 'Sensor Error';
    default:
      return 'Unknown';
  }
}

function stateClassName(state: LiveSpaceState) {
  switch (state) {
    case 'EMPTY':
      return 'bg-slate-200 text-slate-900';
    case 'OCCUPIED_REGISTERED':
      return 'bg-green-500 text-white';
    case 'OCCUPIED_UNREGISTERED':
      return 'bg-yellow-300 text-slate-950';
    case 'UNREGISTERED_OVERDUE':
      return 'bg-purple-600 text-white';
    case 'PAYMENT_GRACE_EXPIRED':
      return 'bg-red-700 text-white';
    case 'LONG_PARKING_ALERT':
      return 'bg-red-950 text-white';
    case 'EXITED_UNPAID':
      return 'bg-red-600 text-white';
    case 'SENSOR_ERROR':
      return 'bg-orange-500 text-white';
    case 'DISABLED':
      return 'bg-slate-700 text-white';
    default:
      return 'bg-slate-400 text-white';
  }
}

function canRegister(space: LiveSpace) {
  return (
    space.state === 'OCCUPIED_UNREGISTERED' ||
    space.state === 'UNREGISTERED_OVERDUE' ||
    (isLongParkingAlert(space) &&
      space.activeSession?.isRegistered === false)
  );
}

function isPaidExitGraceExpired(space: LiveSpace) {
  const value = space.activeSession?.paidExitGraceUntil;

  if (!value) return false;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.getTime() <= Date.now();
}

function isLongParkingAlert(space: LiveSpace) {
  return (
    space.state === 'LONG_PARKING_ALERT' ||
    space.color === 'dark-red' ||
    space.activeSession?.longParkingAlert === true
  );
}

function canMockPay(space: LiveSpace) {
  if (space.state === 'EXITED_UNPAID' && space.unpaidClosedSession) {
    return true;
  }

  if (
    space.activeSession &&
    space.activeSession.isRegistered === true &&
    space.activeSession.paymentStatus !== 'PAID' &&
    (space.state === 'OCCUPIED_REGISTERED' ||
      space.state === 'LONG_PARKING_ALERT')
  ) {
    return true;
  }

  if (
    space.activeSession &&
    space.activeSession.paymentStatus === 'PAID' &&
    isPaidExitGraceExpired(space)
  ) {
    return true;
  }

  if (space.state === 'PAYMENT_GRACE_EXPIRED' && space.activeSession) {
    return true;
  }

  return false;
}

function paymentButtonLabel(space: LiveSpace) {
  if (
    space.state === 'PAYMENT_GRACE_EXPIRED' ||
    isPaidExitGraceExpired(space)
  ) {
    return 'Pay Additional Fee';
  }

  if (
    space.activeSession?.isRegistered === true &&
    (space.state === 'OCCUPIED_REGISTERED' ||
      space.state === 'LONG_PARKING_ALERT')
  ) {
    return 'Pay Before Exit';
  }

  if (space.state === 'EXITED_UNPAID') {
    return 'Pay Unpaid Invoice';
  }

  return 'Mock Pay';
}

function paymentButtonClassName(space: LiveSpace) {
  if (
    space.state === 'PAYMENT_GRACE_EXPIRED' ||
    isPaidExitGraceExpired(space)
  ) {
    return 'w-full rounded-xl bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50';
  }

  if (
    space.activeSession?.isRegistered === true &&
    (space.state === 'OCCUPIED_REGISTERED' ||
      space.state === 'LONG_PARKING_ALERT')
  ) {
    return 'w-full rounded-xl bg-blue-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50';
  }

  return 'w-full rounded-xl bg-red-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50';
}

function formatTime(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return date.toLocaleTimeString();
}

function formatCurrency(value?: number | null, currency = 'KRW') {
  if (value == null || !Number.isFinite(value)) {
    return '-';
  }

  try {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${value.toLocaleString()} ${currency}`;
  }
}

function formatPaymentStatus(value?: string | null) {
  switch (value) {
    case 'ACCRUING':
      return 'ACCRUING';
    case 'PENDING_REGISTRATION':
      return 'PENDING REGISTRATION';
    case 'UNPAID':
      return 'UNPAID';
    case 'PAID':
      return 'PAID';
    case 'PARTIALLY_PAID':
      return 'PARTIALLY PAID';
    default:
      return value ?? '-';
  }
}

function formatDuration(ms: number) {
  const safeMs = Math.max(0, ms);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }

  return `${seconds}s`;
}

function elapsedSince(value?: string | null) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '-';
  }

  return formatDuration(Date.now() - date.getTime());
}

function graceText(value?: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diff = date.getTime() - Date.now();

  if (diff >= 0) {
    return {
      label: 'Grace remaining',
      value: formatDuration(diff),
      expired: false,
    };
  }

  return {
    label: 'Grace overdue',
    value: formatDuration(Math.abs(diff)),
    expired: true,
  };
}

function longParkingThresholdText(space: LiveSpace) {
  const threshold = space.activeSession?.longParkingAlertThresholdHours;

  if (threshold == null || !Number.isFinite(threshold)) {
    return 'configured threshold';
  }

  if (threshold < 1) {
    const minutes = Math.round(threshold * 60);
    return `${minutes} min`;
  }

  return `${threshold}h`;
}

export default function ParkingLivePage() {
  const router = useRouter();

  const [spaces, setSpaces] = useState<LiveSpace[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busySpaceId, setBusySpaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [, setNowTick] = useState(0);

  const lotName = useMemo(() => {
    return spaces[0]?.parkingLotName ?? 'Development Parking Lot';
  }, [spaces]);

  function requireAccessToken() {
    const token = getAccessToken();

    if (!token) {
      router.replace('/login?redirect=/parking-live');
      throw new Error('Login is required. Please sign in again.');
    }

    return token;
  }

  async function load() {
    try {
      setError(null);

      const result = await getLiveParkingSpaces();

      setSpaces(result.spaces);
      setGeneratedAt(result.generatedAt);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to load live parking spaces',
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = getAccessToken();

    if (!token) {
      router.replace('/login?redirect=/parking-live');
      return;
    }

    load();

    const refreshTimer = window.setInterval(() => {
      load();
    }, 3000);

    const clockTimer = window.setInterval(() => {
      setNowTick((value) => value + 1);
    }, 1000);

    return () => {
      window.clearInterval(refreshTimer);
      window.clearInterval(clockTimer);
    };
  }, [router]);

  async function onOccupied(space: LiveSpace) {
    if (!space.sensor?.devEui) {
      setError('This space has no sensor devEui.');
      return;
    }

    setBusySpaceId(space.spaceId);

    try {
      await sendSensorEvent(space.sensor.devEui, 'OCCUPIED');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send OCCUPIED event',
      );
    } finally {
      setBusySpaceId(null);
    }
  }

  async function onEmpty(space: LiveSpace) {
    if (!space.sensor?.devEui) {
      setError('This space has no sensor devEui.');
      return;
    }

    setBusySpaceId(space.spaceId);

    try {
      await sendSensorEvent(space.sensor.devEui, 'EMPTY');
      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send EMPTY event',
      );
    } finally {
      setBusySpaceId(null);
    }
  }

  async function onRegister(space: LiveSpace) {
    setBusySpaceId(space.spaceId);

    try {
      const accessToken = requireAccessToken();

      await registerParkingSession(
        {
          parkingSpaceId: space.spaceId,
          plateNumber: '12가3456',
          driverName: 'Daniel Yoon',
          phone: '010-1234-5678',
          registrationSource: 'CLOUD_ADMIN',
        },
        accessToken,
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to register parking session',
      );
    } finally {
      setBusySpaceId(null);
    }
  }

  async function onMockPay(space: LiveSpace) {
    const payableSessionId =
      space.unpaidClosedSession?.id ?? space.activeSession?.id ?? null;

    if (!payableSessionId) {
      setError('No payable session found.');
      return;
    }

    setBusySpaceId(space.spaceId);

    try {
      const accessToken = requireAccessToken();

      await mockCompletePayment(
        {
          sessionId: payableSessionId,
          amount: 1000,
          paymentMethod: 'MOCK',
          paymentReference: `MOCK-WEB-${Date.now()}`,
        },
        accessToken,
      );

      await load();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to complete mock payment',
      );
    } finally {
      setBusySpaceId(null);
    }
  }

  function logout() {
    clearTokens();
    router.replace('/login');
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-blue-600">
              Kosmos Parking Console
            </p>

            <h1 className="mt-1 text-3xl font-bold text-slate-950">
              Live Parking
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              {lotName} · Updated {generatedAt ?? '-'}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => router.push('/invoices/unpaid')}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Unpaid Invoices
            </button>

            <button
              onClick={load}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Refresh
            </button>

            <button
              onClick={logout}
              className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
            >
              Logout
            </button>
          </div>
        </header>

        <section className="mb-6 grid gap-3 md:grid-cols-7">
          <Legend label="Empty" className="bg-slate-200 text-slate-900" />
          <Legend label="Registered" className="bg-green-500 text-white" />
          <Legend
            label="Unregistered"
            className="bg-yellow-300 text-slate-950"
          />
          <Legend label="Overdue" className="bg-purple-600 text-white" />
          <Legend
            label="Grace Expired"
            className="bg-red-700 text-white"
          />
          <Legend
            label="Long Parking"
            className="bg-red-950 text-white"
          />
          <Legend label="Exited Unpaid" className="bg-red-600 text-white" />
        </section>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-slate-500 shadow-sm">
            Loading live parking spaces...
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {spaces.map((space) => {
              const busy = busySpaceId === space.spaceId;
              const activeGrace = graceText(
                space.activeSession?.paidExitGraceUntil,
              );
              const activeGraceExpired = isPaidExitGraceExpired(space);
              const longParkingAlert = isLongParkingAlert(space);
              const showGraceExpiredNotice =
                space.state === 'PAYMENT_GRACE_EXPIRED' ||
                activeGraceExpired;
              const showLongParkingNotice =
                longParkingAlert && !showGraceExpiredNotice;

              return (
                <article
                  key={space.spaceId}
                  className="overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200"
                >
                  <div
                    className={`p-5 ${
                      showGraceExpiredNotice
                        ? stateClassName('PAYMENT_GRACE_EXPIRED')
                        : showLongParkingNotice
                          ? stateClassName('LONG_PARKING_ALERT')
                          : stateClassName(space.state)
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm opacity-80">
                          {space.sectionCode ?? 'Section'} / {space.spaceCode}
                        </p>

                        <h2 className="mt-1 text-3xl font-black">
                          {space.spaceNumber ?? space.spaceCode}
                        </h2>
                      </div>

                      <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">
                        {showGraceExpiredNotice
                          ? 'Payment Grace Expired'
                          : showLongParkingNotice
                            ? 'Long Parking Alert'
                            : stateLabel(space.state)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3 p-5">
                    <InfoRow label="Raw status" value={space.rawSpaceStatus} />
                    <InfoRow
                      label="Sensor"
                      value={space.sensor?.devEui ?? 'No sensor'}
                    />
                    <InfoRow
                      label="Sensor status"
                      value={space.sensor?.status ?? '-'}
                    />

                    {space.activeSession ? (
                      <div className="rounded-2xl bg-slate-50 p-3 text-sm">
                        <p className="font-semibold text-slate-900">
                          Active Session
                        </p>

                        <p className="mt-1 text-slate-600">
                          {space.activeSession.sessionNo}
                        </p>

                        <p className="text-slate-500">
                          Elapsed:{' '}
                          {elapsedSince(space.activeSession.entryTime)}
                        </p>

                        <p className="text-slate-500">
                          Registered:{' '}
                          {space.activeSession.isRegistered ? 'Yes' : 'No'}
                        </p>

                        <p className="text-slate-500">
                          Payment:{' '}
                          {formatPaymentStatus(
                            space.activeSession.paymentStatus,
                          )}
                        </p>

                        {space.activeSession.accruedFeeAmount != null ? (
                          <>
                            <p className="font-semibold text-slate-900">
                              Accrued fee:{' '}
                              {formatCurrency(
                                space.activeSession.accruedFeeAmount,
                                space.activeSession.accruedFeeCurrency ??
                                  'KRW',
                              )}
                            </p>

                            <p className="text-slate-500">
                              Billable time:{' '}
                              {space.activeSession
                                .accruedFeeTotalMinutes != null
                                ? `${space.activeSession.accruedFeeTotalMinutes} min`
                                : '-'}
                            </p>
                          </>
                        ) : null}

                        {space.activeSession.paidExitGraceUntil ? (
                          <>
                            <p className="text-slate-500">
                              Leave by:{' '}
                              {formatTime(
                                space.activeSession.paidExitGraceUntil,
                              )}
                            </p>

                            {activeGrace ? (
                              <p
                                className={
                                  activeGrace.expired
                                    ? 'font-semibold text-red-600'
                                    : 'font-semibold text-green-600'
                                }
                              >
                                {activeGrace.label}: {activeGrace.value}
                              </p>
                            ) : null}
                          </>
                        ) : null}

                        {space.activeSession.additionalFeeRequired ||
                        activeGraceExpired ? (
                          <p className="font-semibold text-red-600">
                            Additional fee required
                          </p>
                        ) : null}

                        {showGraceExpiredNotice ? (
                          <div className="rounded-xl bg-red-100 px-3 py-2 text-red-700">
                            <p className="font-semibold">
                              Additional fee is accruing.
                            </p>
                            <p className="mt-1 text-xs">
                              The driver can pay the additional fee before
                              exiting. If the vehicle exits unpaid, an unpaid
                              invoice should be sent by SMS/email.
                            </p>
                          </div>
                        ) : null}

                        {showLongParkingNotice ? (
                          <div className="rounded-xl bg-red-100 px-3 py-2 text-red-800">
                            <p className="font-semibold">
                              Long parking alert
                            </p>
                            <p className="mt-1 text-xs">
                              This vehicle has been parked longer than{' '}
                              {longParkingThresholdText(space)}. Management
                              review is required.
                            </p>

                            {space.activeSession.longParkingAlertAt ? (
                              <p className="mt-1 text-xs">
                                Detected:{' '}
                                {formatTime(
                                  space.activeSession.longParkingAlertAt,
                                )}
                              </p>
                            ) : null}

                            {!space.activeSession.isRegistered ? (
                              <p className="mt-1 text-xs font-semibold">
                                Fees are accruing. Register the session before
                                taking payment.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {space.unpaidClosedSession ? (
                      <div className="rounded-2xl bg-red-50 p-3 text-sm text-red-900">
                        <p className="font-semibold">Unpaid Closed Session</p>

                        <p className="mt-1">
                          {space.unpaidClosedSession.sessionNo}
                        </p>

                        <p>
                          Entry:{' '}
                          {formatTime(space.unpaidClosedSession.entryTime)}
                        </p>

                        <p>
                          Exit:{' '}
                          {formatTime(space.unpaidClosedSession.exitTime)}
                        </p>

                        <p>
                          Total parked:{' '}
                          {space.unpaidClosedSession.totalMinutes != null
                            ? `${space.unpaidClosedSession.totalMinutes} min`
                            : '-'}
                        </p>

                        <p>
                          Payment:{' '}
                          {space.unpaidClosedSession.paymentStatus ?? '-'}
                        </p>

                        {space.unpaidClosedSession.additionalFeeRequired ? (
                          <p className="font-semibold">
                            Additional fee required
                          </p>
                        ) : null}

                        {space.unpaidClosedSession.paymentReason ? (
                          <p>
                            Reason:{' '}
                            {space.unpaidClosedSession.paymentReason}
                          </p>
                        ) : null}

                        <div className="mt-2 rounded-xl bg-white/70 px-3 py-2 text-xs text-red-800">
                          This vehicle already exited. Collection should happen
                          through the unpaid invoice/payment link.
                        </div>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <button
                        disabled={busy || !space.sensor}
                        onClick={() => onOccupied(space)}
                        className="rounded-xl bg-yellow-300 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Occupied
                      </button>

                      <button
                        disabled={busy || !space.sensor}
                        onClick={() => onEmpty(space)}
                        className="rounded-xl bg-slate-200 px-3 py-2 text-sm font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Empty
                      </button>
                    </div>

                    {canRegister(space) ? (
                      <button
                        disabled={busy}
                        onClick={() => onRegister(space)}
                        className="w-full rounded-xl bg-green-600 px-3 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Register
                      </button>
                    ) : null}

                    {canMockPay(space) ? (
                      <button
                        disabled={busy}
                        onClick={() => onMockPay(space)}
                        className={paymentButtonClassName(space)}
                      >
                        {paymentButtonLabel(space)}
                      </button>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function Legend({
  label,
  className,
}: {
  label: string;
  className: string;
}) {
  return (
    <div className={`rounded-2xl px-4 py-3 text-sm font-bold ${className}`}>
      {label}
    </div>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-semibold text-slate-900">{value}</span>
    </div>
  );
}