import type {
  OperatorMapResponse,
  SessionPayload,
  SpaceRegisterPayload,
} from '@/types/operator';

function resolveApiBaseUrl() {
  const configured =
    typeof window === 'undefined'
      ? process.env.API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        'http://127.0.0.1:3000/api'
      : process.env.NEXT_PUBLIC_API_BASE_URL ??
        process.env.NEXT_PUBLIC_API_URL ??
        '/api';

  return configured.trim().replace(/\/+$/, '');
}


export type ApiErrorPayload = {
  ok?: false;
  code?: string;
  message?: string;
  details?: unknown;
  timestamp?: string;
};

export type UnpaidInvoiceItem = {
  invoiceId: string;
  invoiceNo: string;
  sessionId: string;
  sessionNo: string | null;
  status: string;
  amount: number;
  discountAmount: number;
  paidAmount: number;
  unpaidAmount: number;
  issuedAt: string | null;
  dueAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;

  parkingLotId: string | null;
  parkingLotName: string | null;
  sectionId: string | null;
  sectionCode: string | null;
  parkingSpaceId: string | null;
  parkingSpaceCode: string | null;
  parkingSpaceNumber: string | null;

  plateNumber: string | null;
  driverName: string | null;
  phone: string | null;

  entryTime: string | null;
  exitTime: string | null;
  totalMinutes: number | null;
  sessionStatus: string | null;
  paymentRequired: boolean;
  paymentStatus: string | null;
  paymentReason: string | null;
  additionalFeeRequired: boolean;
  additionalFeeReason: string | null;
  additionalFeeAmount: number;
  exitGraceMinutes: number | null;
  exitGraceDeadline: string | null;

  paymentLinkUrl: string | null;
  collectionStatus: string;
  collectionLastAction?: string | null;
  collectionLastActionAt?: string | null;
  collectionHistory?: Array<Record<string, unknown>>;
};

export type UnpaidInvoicesResponse = {
  ok: true;
  generatedAt: string;
  items: UnpaidInvoiceItem[];
};

export type InvoicePaymentRequestMessageResponse = {
  ok: true;
  invoiceId: string;
  invoiceNo: string;
  sessionId: string;
  customerLabel: string;
  parkingLotName: string | null;
  parkingLotLabel: string;
  usedAt: string | null;
  usedAtText: string;
  amount: number;
  unpaidAmount: number;
  paymentLinkUrl: string;
  message: string;
};

export type InvoicePaymentLinkResponse = {
  ok: true;
  invoiceId: string;
  invoiceNo: string;
  paymentLinkUrl: string;
  collectionStatus: string;
  collectionLastAction: string;
  collectionLastActionAt: string;
};

export type InvoiceCollectionActionResponse = {
  ok: true;
  invoiceId: string;
  invoiceNo: string;
  collectionStatus: string;
  collectionLastAction: string;
  collectionLastActionAt: string;
  paymentLinkUrl: string | null;
};

export type PublicInvoiceResponse = {
  ok: true;
  invoice: {
    invoiceId: string;
    invoiceNo: string;
    sessionId: string;
    sessionNo: string | null;
    status: string;
    amount: number;
    discountAmount: number;
    paidAmount: number;
    unpaidAmount: number;
    issuedAt: string | null;
    dueAt: string | null;
    paidAt: string | null;
    parkingLotName: string | null;
    sectionCode: string | null;
    parkingSpaceNumber: string | null;
    plateNumber: string | null;
    driverName: string | null;
    phone: string | null;
    entryTime: string | null;
    exitTime: string | null;
    totalMinutes: number | null;
    paymentStatus: string;
    paymentLinkUrl: string | null;
  };
};

export async function getPublicInvoice(invoiceId: string) {
  return request<PublicInvoiceResponse>(
    `/invoices/${invoiceId}/public`,
    {
      auth: false,
    },
  );
}

export async function mockPayPublicInvoice(
  invoiceId: string,
  input?: {
    amount?: number;
    method?: string;
    reference?: string;
  },
) {
  return request<{
    ok: true;
    action: string;
    invoiceId: string;
    invoiceNo: string;
    amount?: number;
    paidAmount?: number;
    unpaidAmount: number;
    status?: string;
    transactionId?: string | null;
  }>(`/invoices/${invoiceId}/mock-pay`, {
    method: 'POST',
    auth: false,
    body: JSON.stringify({
      amount: input?.amount,
      method: input?.method ?? 'MOCK_CARD',
      reference: input?.reference ?? `PUBLIC-WEB-${Date.now()}`,
    }),
  });
}

export async function sendInvoiceSms(
  invoiceId: string,
  input?: {
    recipient?: string;
    baseUrl?: string;
    message?: string;
  },
) {
  return request<{
    ok: true;
    invoiceId: string;
    invoiceNo: string;
    channel: 'SMS';
    recipient: string | null;
    paymentLinkUrl: string;
    message: string;
    deliveryStatus: string;
    collectionStatus: string;
  }>(`/invoices/${invoiceId}/send-sms`, {
    method: 'POST',
    body: JSON.stringify({
      recipient: input?.recipient,
      baseUrl:
        input?.baseUrl ??
        (typeof window !== 'undefined'
          ? window.location.origin
          : undefined),
      message: input?.message,
    }),
  });
}

export async function sendInvoiceEmail(
  invoiceId: string,
  input?: {
    recipient?: string;
    baseUrl?: string;
    subject?: string;
    message?: string;
  },
) {
  return request<{
    ok: true;
    invoiceId: string;
    invoiceNo: string;
    channel: 'EMAIL';
    recipient: string | null;
    subject: string;
    message: string;
    paymentLinkUrl: string;
    deliveryStatus: string;
    collectionStatus: string;
  }>(`/invoices/${invoiceId}/send-email`, {
    method: 'POST',
    body: JSON.stringify({
      recipient: input?.recipient,
      baseUrl:
        input?.baseUrl ??
        (typeof window !== 'undefined'
          ? window.location.origin
          : undefined),
      subject: input?.subject,
      message: input?.message,
    }),
  });
}

export async function getUnpaidInvoices(input?: {
  parkingLotId?: string;
  limit?: number;
}) {
  const params = new URLSearchParams();

  if (input?.parkingLotId) {
    params.set('parkingLotId', input.parkingLotId);
  }

  if (input?.limit) {
    params.set('limit', String(input.limit));
  }

  const query = params.toString();

  return request<UnpaidInvoicesResponse>(
    `/invoices/unpaid${query ? `?${query}` : ''}`,
  );
}

export async function createInvoicePaymentRequestMessage(
  invoiceId: string,
  input?: {
    baseUrl?: string;
  },
) {
  return request<InvoicePaymentRequestMessageResponse>(
    `/invoices/${invoiceId}/payment-request-message`,
    {
      method: 'POST',
      body: JSON.stringify({
        baseUrl:
          input?.baseUrl ??
          (typeof window !== 'undefined'
            ? window.location.origin
            : undefined),
      }),
    },
  );
}

export async function createInvoicePaymentLink(
  invoiceId: string,
  input?: {
    baseUrl?: string;
    channel?: string;
    recipient?: string;
  },
) {
  return request<InvoicePaymentLinkResponse>(
    `/invoices/${invoiceId}/payment-link`,
    {
      method: 'POST',
      body: JSON.stringify({
        baseUrl:
          input?.baseUrl ??
          (typeof window !== 'undefined'
            ? window.location.origin
            : undefined),
        channel: input?.channel ?? 'WEB',
        recipient: input?.recipient,
      }),
    },
  );
}

export async function recordInvoiceCollectionAction(
  invoiceId: string,
  input: {
    action:
      | 'CREATE_PAYMENT_LINK'
      | 'COPY_PAYMENT_LINK'
      | 'SEND_SMS'
      | 'SEND_EMAIL'
      | 'CALL_DRIVER'
      | 'MARK_CONTACTED';
    channel?: string;
    recipient?: string;
    note?: string;
    metadata?: Record<string, unknown>;
  },
) {
  return request<InvoiceCollectionActionResponse>(
    `/invoices/${invoiceId}/collection-action`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export class ApiError extends Error {
  status: number;
  payload: ApiErrorPayload | unknown;

  constructor(status: number, payload: ApiErrorPayload | unknown) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : `Request failed: ${status}`;

    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('kosmos.consoleAccessToken') ?? window.localStorage.getItem('kosmos.accessToken');
}

export function setAccessToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('kosmos.consoleAccessToken', token);
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('kosmos.refreshToken');
}

export function setRefreshToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('kosmos.refreshToken', token);
}

export function clearTokens() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem('kosmos.consoleAccessToken');
  window.localStorage.removeItem('kosmos.accessToken');
  window.localStorage.removeItem('kosmos.refreshToken');
}

export function clearAccessToken() {
  clearTokens();
}

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function request<T>(
  path: string,
  init?: RequestInit & {
    accessToken?: string;
    auth?: boolean;
  },
): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  const accessToken =
    init?.accessToken ??
    (init?.auth === false ? null : getAccessToken());

  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const response = await fetch(`${resolveApiBaseUrl()}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    throw new ApiError(response.status, payload);
  }

  return payload as T;
}

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & {
    accessToken?: string;
    auth?: boolean;
  },
): Promise<T> {
  return request<T>(path, init);
}

export async function loginWithBackend(
  email: string,
  password: string,
): Promise<SessionPayload & { refreshToken?: string }> {
  const response = await request<any>('/auth/login', {
    method: 'POST',
    auth: false,
    headers: {
      'x-device-id': 'web-dev-browser',
    },
    body: JSON.stringify({ email, password }),
  });

  if (response.accessToken) {
    setAccessToken(response.accessToken);
  }

  if (response.refreshToken) {
    setRefreshToken(response.refreshToken);
  }

  return {
    accessToken: response.accessToken,
    refreshToken: response.refreshToken,
    user: {
      id: response.user?.id ?? response.user?.sub ?? '',
      name: response.user?.name ?? '',
      email: response.user?.email ?? null,
      roles: response.user?.roles ?? [],
      permissions: response.user?.permissions ?? [],
      scopes: {
        parkingLotIds: response.user?.scopes?.parkingLotIds ?? [],
        parkingSectionIds: response.user?.scopes?.parkingSectionIds ?? [],
      },
    },
  };
}

export async function getOperatorMapData(
  accessToken: string,
  parkingLotId?: string,
) {
  const query = parkingLotId
    ? `?parkingLotId=${encodeURIComponent(parkingLotId)}`
    : '';

  return request<OperatorMapResponse>(`/mobile/operator/map/optimized${query}`, {
    accessToken,
  });
}

export async function registerOccupiedSpace(
  accessToken: string,
  payload: SpaceRegisterPayload,
) {
  return request('/mobile/me/register-occupied-space', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
  });
}

async function internalQuickAction(
  action: 'entry' | 'exit' | 'collect' | 'fault',
  parkingSpaceId: string,
) {
  const response = await fetch(`/api/operator/quick-actions/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ parkingSpaceId }),
  });

  const result = await response.json();

  if (!response.ok || !result.ok) {
    throw new Error(result.message ?? `${action} action failed`);
  }

  return result;
}

export async function entryQuickAction(
  _accessToken: string,
  parkingSpaceId: string,
) {
  return internalQuickAction('entry', parkingSpaceId);
}

export async function exitQuickAction(
  _accessToken: string,
  parkingSpaceId: string,
) {
  return internalQuickAction('exit', parkingSpaceId);
}

export async function collectQuickAction(
  _accessToken: string,
  parkingSpaceId: string,
) {
  return internalQuickAction('collect', parkingSpaceId);
}

export async function faultQuickAction(
  _accessToken: string,
  parkingSpaceId: string,
) {
  return internalQuickAction('fault', parkingSpaceId);
}

export type LiveSpaceState =
  | 'EMPTY'
  | 'OCCUPIED_REGISTERED'
  | 'OCCUPIED_UNREGISTERED'
  | 'UNREGISTERED_OVERDUE'
  | 'PAYMENT_GRACE_EXPIRED'
  | 'TENANT_VISIT_GRACE'
  | 'LONG_PARKING_ALERT'
  | 'EXITED_UNPAID'
  | 'DISABLED'
  | 'SENSOR_ERROR'
  | 'UNKNOWN';

export type LiveSpace = {
  parkingLotId: string | null;
  parkingLotName: string | null;
  parkingLotCode?: string | null;
  parkingLotOperationMode?: 'SENSOR' | 'MANUAL' | string | null;
  sectionId: string;
  sectionCode: string | null;
  spaceId: string;
  spaceCode: string;
  spaceNumber: string | null;
  rawSpaceStatus: string;
  state: LiveSpaceState;
  color: string;
  sensor: {
    id: string;
    name: string;
    devEui: string;
    status: string;
    lastSeenAt: string | null;
  } | null;
  activeSession: {
    id: string;
    sessionNo: string;
    status: string;
    isRegistered: boolean;
    entryTime: string | null;
    exitTime?: string | null;
    entrySource?: 'SENSOR' | 'MANUAL' | string | null;
    exitSource?: 'SENSOR' | 'MANUAL' | string | null;
    manualEntryAt?: string | null;
    manualExitAt?: string | null;
    unregisteredOverdue: boolean;
    unregisteredOverdueAt: string | null;
    paymentStatus?: string | null;
    paidBeforeExit?: boolean;
    paidExitGraceUntil?: string | null;
    paymentGraceExpired?: boolean;
    paymentGraceExpiredAt?: string | null;
    additionalFeeRequired?: boolean;
    longParkingAlert?: boolean;
    longParkingAlertAt?: string | null;
    longParkingAlertThresholdHours?: number | null;
    accruedFeeAmount?: number | null;
    accruedFeeCurrency?: string | null;
    accruedFeeTotalMinutes?: number | null;
    accruedFeeCalculatedAt?: string | null;
    accruedFeePolicyId?: string | null;
  } | null;
  unpaidClosedSession: {
    id: string;
    sessionNo: string;
    status: string;
    isRegistered: boolean;
    entryTime: string | null;
    exitTime: string | null;
    totalMinutes: number | null;
    paymentRequired: boolean;
    paymentStatus: string | null;
    additionalFeeRequired?: boolean;
    paymentReason?: string | null;
  } | null;
};

export type LiveSpacesResponse = {
  ok: true;
  generatedAt: string;
  spaces: LiveSpace[];
};

export async function getLiveParkingSpaces(accessToken?: string) {
  return request<LiveSpacesResponse>('/parking-monitor/spaces/live', {
    accessToken,
  });
}


export async function registerParkingSession(
  payload: {
    parkingSpaceId?: string;
    sessionId?: string;
    plateNumber?: string;
    driverName?: string;
    phone?: string;
    registrationSource?: string;
  },
  accessToken?: string,
) {
  return request('/parking-registration/register', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      plateNumber: '12가3456',
      driverName: 'Daniel Yoon',
      phone: '010-1234-5678',
      registrationSource: 'CLOUD_ADMIN',
      ...payload,
    }),
  });
}

export async function manualEntryParkingSession(
  input: {
    parkingSpaceId: string;
    plateNumber?: string | null;
    contactNumber?: string | null;
  },
  accessToken: string,
) {
  return request('/parking-sessions/manual-entry', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(input),
  });
}

export async function manualExitParkingSession(
  sessionId: string,
  input: {
    collectedAmount?: number | string | null;
    paymentMethod?: string | null;
    note?: string | null;
  },
  accessToken: string,
) {
  return request(`/parking-sessions/${sessionId}/manual-exit`, {
    method: 'POST',
    accessToken,
    body: JSON.stringify(input),
  });
}

export async function mockCompletePayment(
  payload: {
    sessionId: string;
    amount?: number;
    paymentMethod?: string;
    paymentReference?: string;
  },
  accessToken?: string,
) {
  return request('/payments/mock/complete', {
    method: 'POST',
    accessToken,
    body: JSON.stringify({
      amount: 1000,
      paymentMethod: 'MOCK',
      paymentReference: `MOCK-WEB-${Date.now()}`,
      ...payload,
    }),
  });
}