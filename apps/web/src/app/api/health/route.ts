import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'web-console',
    timestamp: new Date().toISOString(),
  });
}