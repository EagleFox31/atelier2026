'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, ApiUser } from '@/lib/api';

interface AuthState {
  user: ApiUser | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<ApiUser>) => void;
  isAuthenticated: boolean;
  hasPermission: (code: string) => boolean;
  hasRole: (code: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'atelier_token';
const USER_KEY  = 'atelier_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
  });

  // Restaure la session et recharge le profil (onboarding, rôles à jour)
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setState({ user: null, token: null, isLoading: false });
      return;
    }

    authApi.profile()
      .then((profile) => {
        localStorage.setItem(USER_KEY, JSON.stringify(profile));
        setState({ user: profile, token, isLoading: false });
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        setState({ user: null, token: null, isLoading: false });
      });
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const { access_token } = await authApi.login(identifier, password);

    localStorage.setItem(TOKEN_KEY, access_token);
    const profile = await authApi.profile();
    localStorage.setItem(USER_KEY, JSON.stringify(profile));

    setState({ user: profile, token: access_token, isLoading: false });
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // On déconnecte quand même côté client
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      setState({ user: null, token: null, isLoading: false });
    }
  }, []);

  const updateUser = useCallback((patch: Partial<ApiUser>) => {
    setState((s) => {
      if (!s.user) return s;
      const user = { ...s.user, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      return { ...s, user };
    });
  }, []);

  const hasPermission = useCallback((code: string) => {
    return state.user?.permissions?.includes(code) ?? false;
  }, [state.user]);

  const hasRole = useCallback((code: string) => {
    return state.user?.roles?.includes(code) ?? false;
  }, [state.user]);

  return (
    <AuthContext.Provider value={{
      ...state,
      isAuthenticated: !!state.token && !!state.user,
      login,
      logout,
      updateUser,
      hasPermission,
      hasRole,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans un AuthProvider');
  return ctx;
}
