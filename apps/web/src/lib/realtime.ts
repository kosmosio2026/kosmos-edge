import { io, type Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getRealtimeSocket(accessToken?: string) {
  if (socket) return socket;

  const baseUrl =
    process.env.NEXT_PUBLIC_REALTIME_URL ??
    process.env.NEXT_PUBLIC_WS_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  const namespace =
    process.env.NEXT_PUBLIC_REALTIME_NAMESPACE ?? '/realtime';

  socket = io(`${baseUrl}${namespace}`, {
    path: '/socket.io',
    auth: accessToken
      ? {
          token: accessToken,
        }
      : undefined,
    transports: ['websocket'],
    withCredentials: true,
    reconnection: true,
  });

  return socket;
}

export function disconnectRealtimeSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}