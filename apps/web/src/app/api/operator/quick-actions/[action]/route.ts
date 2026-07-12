import { NextRequest, NextResponse } from 'next/server';
import { backendActionCandidates, type BackendQuickAction } from '@/lib/backend-adapters';
import { getSession } from '@/lib/session';
import { tryBackendCandidates } from '@/lib/server-backend-request';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ action: string }> },
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, message: 'Unauthorized' },
      { status: 401 },
    );
  }

  const { action } = await context.params;
  const typedAction = action as BackendQuickAction;

  if (!(typedAction in backendActionCandidates)) {
    return NextResponse.json(
      { ok: false, message: `Unsupported action: ${action}` },
      { status: 400 },
    );
  }

  const body = await request.json();

  try {
    const result = await tryBackendCandidates({
      accessToken: session.accessToken,
      candidates: backendActionCandidates[typedAction],
      body,
    });

    return NextResponse.json({
      ok: true,
      action: typedAction,
      result,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        action: typedAction,
        message: error instanceof Error ? error.message : 'Quick action failed',
      },
      { status: 502 },
    );
  }
}