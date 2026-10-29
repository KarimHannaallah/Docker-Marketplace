import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/auth';
import { setUnauthorizedHandler, tokenStore } from '../api/client';
import type { User } from '../api/types';
import { AuthContext, type AuthState } from './context';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Un token déjà présent doit être vérifié avant d'afficher quoi que ce soit de protégé.
  const [loading, setLoading] = useState(() => tokenStore.get() !== null);

  useEffect(() => {
    // Si une requête reçoit un 401, le client API a déjà effacé le token : on déconnecte l'UI.
    setUnauthorizedHandler(() => setUser(null));
    if (!tokenStore.get()) return;
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
    return () => setUnauthorizedHandler(null);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await authApi.login(email, password);
    tokenStore.set(token);
    setUser(user);
  }, []);

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      await authApi.register(name, email, password);
      await login(email, password); // connexion automatique après l'inscription
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout(); // révoque le token côté serveur
    } catch {
      /* même si l'appel échoue, on oublie le token local */
    } finally {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const deleteAccount = useCallback(async () => {
    await authApi.deleteMe();
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, login, register, logout, deleteAccount }),
    [user, loading, login, register, logout, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
