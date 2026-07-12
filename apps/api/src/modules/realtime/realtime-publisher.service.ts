import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { WsEventName } from '@parking/shared';

@Injectable()
export class RealtimePublisherService implements OnModuleDestroy {
  private readonly redis: Redis;
  private readonly channel = 'parking:realtime';

  constructor() {
    this.redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
  }

  async publish(event: WsEventName, payload: unknown) {
    await this.redis.publish(
      this.channel,
      JSON.stringify({
        event,
        payload,
        publishedAt: new Date().toISOString(),
      }),
    );
  }

  getChannel() {
    return this.channel;
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}