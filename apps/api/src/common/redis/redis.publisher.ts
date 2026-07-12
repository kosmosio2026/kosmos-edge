import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisPublisher {
  private pub = new Redis();

  async publish(type: string, payload: any) {
    await this.pub.publish(
      'parking.events',
      JSON.stringify({ type, payload }),
    );
  }
}