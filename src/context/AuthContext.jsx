import { createContext, useContext, useEffect, useState } from 'react';
import { getMe, loginUser, logoutUser, registerUser } from '../api/users';
import { tokenStore } from '../lib/token';

const AuthCtx = createContext(null);

function normalizeUser(user) {
  if (!user) return null;
  const avatarUrl = user.avatarUrl || user.avatar || user.photoUrl || user.photo || '';
  return { ...user, avatarUrl };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // on load: if token exists, try /me
  useEffect(() => {
    (async () => {
      if (!tokenStore.get()) { setReady(true); return; }
      try {
        const { user } = await getMe();
        setUser(normalizeUser(user));
      } catch {
        tokenStore.set(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const login = async (usernameOrEmail, password) => {
    await loginUser(usernameOrEmail, password);
    const { user } = await getMe();
    setUser(normalizeUser(user));
  };

  const refresh = async () => {
    if (!tokenStore.get()) {
      setUser(null);
      return null;
    }
    try {
      const { user } = await getMe();
      const normalized = normalizeUser(user);
      setUser(normalized);
      return normalized;
    } catch (err) {
      tokenStore.set(null);
      setUser(null);
      throw err;
    }
  };

  const register = async (payload) => {
    await registerUser(payload);
  };

  const logout = async () => {
    await logoutUser();
    setUser(null);
  };

  return (
    <AuthCtx.Provider value={{ user, ready, login, logout, register, refresh }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
