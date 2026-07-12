import { Injectable } from '@nestjs/common';
import { RedisPublisher } from '../../../common/redis/redis.publisher';

@Injectable()
export class TelemetryIngestService {
  constructor(private readonly redis: RedisPublisher) {}

  async publishDeviceTelemetry(eventName: string, payload: any) {
    await this.redis.publish(eventName, payload);

    return {
      ok: true,
      event: eventName,
    };
  }
}