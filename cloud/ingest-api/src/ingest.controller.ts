import { Body, Controller, Headers, Post } from '@nestjs/common';

@Controller('sync')
export class IngestController {
  @Post('events')
  receiveEvents(
    @Headers('x-sync-destination') destination: string | undefined,
    @Body() body: unknown,
  ) {
    console.log('[CLOUD] Event received:', {
      destination: destination ?? 'unknown',
      body,
    });

    return {
      ok: true,
      destination: destination ?? 'unknown',
      receivedAt: new Date().toISOString(),
      body,
    };
  }
}