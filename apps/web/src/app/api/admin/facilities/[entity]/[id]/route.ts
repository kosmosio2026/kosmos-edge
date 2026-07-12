import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSession } from '@/lib/session';
import { adminBackendCandidates } from '@/lib/admin-backend-adapters';
import { tryCandidateRequest } from '@/lib/server-admin-request';

function getEntityCandidates(entity: string) {
  if (entity === 'lots') return adminBackendCandidates.facilities.lots;
  if (entity === 'sections') return adminBackendCandidates.facilities.sections;
  return adminBackendCandidates.facilities.spaces;
}

function getEntityPath(entity: string) {
  return `/facilities/${entity}`;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ entity: string; id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { entity, id } = await context.params;
  const body = await request.json();

  try {
    const data = await tryCandidateRequest({
      accessToken: session.accessToken,
      candidates: getEntityCandidates(entity).update,
      method: 'PATCH',
      pathParams: { id },
      body,
    });

    revalidatePath(getEntityPath(entity));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Failed' },
      { status: 502 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ entity: string; id: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
  }

  const { entity, id } = await context.params;

  try {
    const data = await tryCandidateRequest({
      accessToken: session.accessToken,
      candidates: getEntityCandidates(entity).delete,
      method: 'DELETE',
      pathParams: { id },
    });

    revalidatePath(getEntityPath(entity));
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    return NextResponse.json(
      { ok: false, message: error instanceof Error ? error.message : 'Failed' },
      { status: 502 },
    );
  }
}