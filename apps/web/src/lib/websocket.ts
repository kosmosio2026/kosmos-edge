import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;
let currentToken: string | undefined;

function cleanUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function normalizeWebSocketBaseUrl(value: string) {
  return cleanUrl(value)
    .replace(/\/api$/, '')
    .replace(/\/realtime$/, '');
}

function getWebSocketBaseUrl() {
  const wsUrl = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (wsUrl) {
    return normalizeWebSocketBaseUrl(wsUrl);
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
  if (apiBaseUrl) {
    return normalizeWebSocketBaseUrl(apiBaseUrl);
  }

  if (typeof window !== 'undefined') {
    return window.location.origin;
  }

  return '';
}

function getWebSocketNamespace() {
  const namespace = process.env.NEXT_PUBLIC_WS_NAMESPACE?.trim();
  if (!namespace) return '/realtime';
  return namespace.startsWith('/') ? namespace : `/${namespace}`;
}

export function getSocket(accessToken?: string): Socket {
  const baseUrl = getWebSocketBaseUrl();
  const namespace = getWebSocketNamespace();

  if (socket && currentToken === accessToken) {
    return socket;
  }

  if (socket) {
    socket.disconnect();
    socket = null;
  }

  currentToken = accessToken;

  socket = io(`${baseUrl}${namespace}`, {
    path: '/socket.io',
    transports: ['websocket'],
    autoConnect: false,
    withCredentials: true,
    auth: accessToken
      ? {
          token: accessToken,
        }
      : undefined,
  });

  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
  currentToken = undefined;
}
