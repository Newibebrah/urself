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
import { useRouter } from 'next/navigation';
import { createClient } from '../../../lib/supabase/client';
import type { SessionUser } from '../../../lib/auth-types';

interface AuthContextValue {
  user: SessionUser | null;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser,
  children,
}: {
  initialUser: SessionUser | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(initialUser);

  useEffect(() => {
    setUser(initialUser);
  }, [initialUser]);

  const refresh = useCallback(async () => {
    const response = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!response.ok) {
      setUser(null);
      return;
    }
    const data = (await response.json()) as { user: SessionUser | null };
    setUser(data.user);
    router.refresh();
  }, [router]);

  const signOut = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      router.replace('/login');
      router.refresh();
    }
  }, [router]);

  const value = useMemo(
    () => ({ user, isAuthenticated: Boolean(user), refresh, signOut }),
    [refresh, signOut, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }
  return context;
}
