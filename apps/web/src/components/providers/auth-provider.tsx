'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { AuthSession, AuthUser } from '@/types/auth';
import {
  clearStoredSession,
  getStoredSession,
  login as loginRequest,
  setStoredSession,
} from '@/lib/auth';

type AuthContextValue = {
  session: AuthSession | null;
  user: AuthUser | null;
  isReady: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<AuthSession>;
  logout: (redirectTo?: string) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function normalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    roles: user.roles ?? [],
    permissions: user.permissions ?? [],
    scopes: {
      parkingLotIds: user.scopes?.parkingLotIds ?? [],
      parkingSectionIds: user.scopes?.parkingSectionIds ?? [],
      parkingSpaceIds: user.scopes?.parkingSpaceIds ?? [],
    },
  };
}

function normalizeSession(session: AuthSession): AuthSession {
  return {
    ...session,
    user: normalizeUser(session.user),
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = getStoredSession();

    if (stored) {
      setSession(normalizeSession(stored));
    }

    setIsReady(true);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const next = normalizeSession(await loginRequest(email, password));

    setStoredSession(next);
    setSession(next);

    return next;
  }, []);

  const logout = useCallback((redirectTo = '/login') => {
    clearStoredSession();
    setSession(null);

    window.location.href = redirectTo;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isReady,
      isAuthenticated: Boolean(session?.accessToken),
      login,
      logout,
    }),
    [session, isReady, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return value;
}