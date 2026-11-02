'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { API_URL, ApiError } from './api';

/**
 * Авторизация сайта: JWT, выданный нашим API (email + пароль или Google).
 * Токен хранится в localStorage; при 401 от API сессия сбрасывается (событие auth:expired).
 */
export interface SessionUser {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
}

export interface AppUser extends SessionUser {
  /** Совместимость со старым кодом страниц: возвращает JWT для заголовка Authorization. */
  getIdToken: () => Promise<string>;
}

interface Session {
  token: string;
  expiresAt: number;
  user: SessionUser;
}

interface AuthContextValue {
  user: AppUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; phone?: string }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: (patch: Partial<SessionUser>) => void;
}

const KEY = 'bars-session-v1';
const AuthContext = createContext<AuthContextValue | null>(null);

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
  if (!res.ok) {
    const msg = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(res.status, msg ?? 'Ошибка входа');
  }
  return data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  const save = useCallback((s: Session | null) => {
    setSession(s);
    try {
      if (s) localStorage.setItem(KEY, JSON.stringify(s));
      else localStorage.removeItem(KEY);
    } catch {
      /* приватный режим */
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const s = raw ? (JSON.parse(raw) as Session) : null;
      if (s && s.expiresAt > Date.now()) setSession(s);
      else localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setLoading(false);
    const expired = () => save(null);
    window.addEventListener('auth:expired', expired);
    // вход/выход в другой вкладке
    const onStorage = (e: StorageEvent) => {
      if (e.key !== KEY) return;
      setSession(e.newValue ? (JSON.parse(e.newValue) as Session) : null);
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('auth:expired', expired);
      window.removeEventListener('storage', onStorage);
    };
  }, [save]);

  const login = useCallback(async (email: string, password: string) => {
    save(await post<Session>('/api/auth/login', { email, password }));
  }, [save]);

  const register = useCallback(async (data: { name: string; email: string; password: string; phone?: string }) => {
    save(await post<Session>('/api/auth/register', data));
  }, [save]);

  const loginWithGoogle = useCallback(async () => {
    // Firebase грузится только при нажатии «Войти через Google»
    const [{ auth, googleProvider }, { signInWithPopup, signOut }] = await Promise.all([import('./firebase'), import('firebase/auth')]);
    const cred = await signInWithPopup(auth, googleProvider);
    const idToken = await cred.user.getIdToken();
    save(await post<Session>('/api/auth/google', { idToken }));
    await signOut(auth).catch(() => {});
  }, [save]);

  const signOut = useCallback(async () => save(null), [save]);

  const refreshUser = useCallback(
    (patch: Partial<SessionUser>) => {
      if (session) save({ ...session, user: { ...session.user, ...patch } });
    },
    [session, save],
  );

  const user = useMemo<AppUser | null>(
    () => (session ? { ...session.user, getIdToken: async () => session.token } : null),
    [session],
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, register, loginWithGoogle, signOut, refreshUser }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth вне AuthProvider');
  return ctx;
}
