import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { adminBackendCandidates } from '@/lib/admin-backend-adapters';
import { tryCandidateRequest } from '@/lib/server-admin-request';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ kind: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { kind } = await context.params;
  const candidates =
    kind === 'members'
      ? adminBackendCandidates.users.members
      : adminBackendCandidates.users.visitors;

  try {
    const data = await tryCandidateRequest({
      accessToken: session.accessToken,
      candidates,
      method: 'GET',
    });

    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Failed' },
      { status: 502 },
    );
  }
}