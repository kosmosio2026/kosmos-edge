import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { adminBackendCandidates } from '@/lib/admin-backend-adapters';
import { tryCandidateRequest } from '@/lib/server-admin-request';

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const data = await tryCandidateRequest({
      accessToken: session.accessToken,
      candidates: adminBackendCandidates.feePolicies.list,
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

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  try {
    const data = await tryCandidateRequest({
      accessToken: session.accessToken,
      candidates: adminBackendCandidates.feePolicies.create,
      method: 'POST',
      body,
    });

    revalidatePath('/fees/policies');
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Failed' },
      { status: 502 },
    );
  }
}