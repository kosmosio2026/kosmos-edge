import { NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { tryCandidateRequest } from '@/lib/server-admin-request';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const data = await tryCandidateRequest({
      accessToken: session.accessToken,
      candidates: ['/system/status'],
      method: 'GET',
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Failed',
      },
      { status: 502 },
    );
  }
}