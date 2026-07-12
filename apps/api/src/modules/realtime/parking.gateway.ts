import {
  OnGatewayConnection,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  namespace: '/parking',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ParkingGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  private subscriber!: Redis;
  private readonly channel = 'parking:realtime';

  afterInit() {
    this.subscriber = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

    this.subscriber.subscribe(this.channel, (error) => {
      if (error) {
        console.error('Redis subscribe error', error);
      }
    });

    this.subscriber.on('message', (_channel, message) => {
      try {
        const parsed = JSON.parse(message) as {
          event: string;
          payload: unknown;
        };

        this.server.emit(parsed.event, parsed.payload);
      } catch (error) {
        console.error('WebSocket relay parse error', error);
      }
    });
  }

  handleConnection(client: Socket) {
    client.emit('connected', {
      ok: true,
      namespace: '/parking',
      connectedAt: new Date().toISOString(),
    });
  }
}