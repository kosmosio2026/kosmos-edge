import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { adminBackendCandidates } from '@/lib/admin-backend-adapters';
import { tryCandidateRequest } from '@/lib/server-admin-request';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await context.params;
  const body = await request.json();

  try {
    const data = await tryCandidateRequest({
      accessToken: session.accessToken,
      candidates: adminBackendCandidates.deviceFaults.action,
      method: 'POST',
      pathParams: { id },
      body,
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Failed' },
      { status: 502 },
    );
  }
}