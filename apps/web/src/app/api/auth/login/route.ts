import { NextRequest, NextResponse } from 'next/server';
import { loginWithBackend } from '@/lib/api';
import { setSession } from '@/lib/session';
import type { SessionPayload } from '@/types/operator';

type BackendUserWithOptionalScopes = {
  id: string;
  name: string;
  email: string;
  roles: SessionPayload['user']['roles'];
  permissions: string[];
  scopes?: {
    parkingLotIds?: string[];
    parkingSectionIds?: string[];
  };
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const backendSession = await loginWithBackend(body.email, body.password);

    const backendUser =
      backendSession.user as BackendUserWithOptionalScopes;

    const session: SessionPayload = {
      accessToken: backendSession.accessToken,
      user: {
        ...backendUser,
        scopes: {
          parkingLotIds: backendUser.scopes?.parkingLotIds ?? [],
          parkingSectionIds: backendUser.scopes?.parkingSectionIds ?? [],
        },
      },
    };

    await setSession(session);

    return NextResponse.json({
      ok: true,
      accessToken: session.accessToken,
      refreshToken: backendSession.refreshToken,
      user: session.user,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Login failed',
      },
      { status: 401 },
    );
  }
}