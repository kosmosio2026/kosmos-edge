import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import Redis from 'ioredis';

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private sub = new Redis();

  afterInit() {
    this.sub.subscribe('parking.events');

    this.sub.on('message', (channel, message) => {
      if (channel === 'parking.events') {
        const data = JSON.parse(message);
        this.server.emit(data.type, data.payload);
      }
    });
  }

  handleConnection(client: Socket) {
    console.log('[realtime] client connected', {
      id: client.id,
      namespace: client.nsp.name,
      origin: client.handshake.headers.origin,
      hasToken: Boolean(client.handshake.auth?.token),
    });

    client.emit('connected', {
      ok: true,
      namespace: '/realtime',
      connectedAt: new Date().toISOString(),
    });
  }

  handleDisconnect(client: Socket) {
    console.log('[realtime] client disconnected', {
      id: client.id,
      namespace: client.nsp.name,
    });
  }

  emit(type: string, payload: any) {
    this.server.emit(type, payload);
  }

  broadcastEntry(session: any) {
    this.server.emit('parking.entry', session);
  }

  broadcastExit(session: any) {
    this.server.emit('parking.exit', session);
  }

  broadcastViolation(payload: any) {
    this.server.emit('parking.violation', payload);
  }
}
