import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { studentApi } from '../api/studentApi';
import { clearApiToken, setApiToken } from './tokenStorage';

const AuthContext = createContext(null);

const STORAGE_KEY = 'volta.student.lastUser';

export function AuthProvider({ children }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [user, setUser] = useState(null);

  async function refreshMe() {
    const res = await studentApi.me();
    setUser(res?.user || null);
    if (res?.user) await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(res.user));
    return res?.user || null;
  }

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) setUser(JSON.parse(raw));
      } catch {}

      // UI imediat — nu așteptăm rețeaua pentru primul frame
      if (!cancelled) setBootstrapped(true);

      try {
        await refreshMe();
      } catch (e) {
        if (cancelled) return;
        // Doar sesiune invalidă: scoatem utilizatorul. Timeout/rețea: păstrăm cache-ul.
        if (e?.status === 401) {
          setUser(null);
          await clearApiToken();
          try {
            await AsyncStorage.removeItem(STORAGE_KEY);
          } catch {}
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn({ email, password, remember }) {
    const res = await studentApi.login({ email, password, remember });
    if (res?.token) {
      await setApiToken(res.token);
    }
    return await refreshMe();
  }

  async function signOut() {
    try {
      await studentApi.logout();
    } catch {}
    await clearApiToken();
    setUser(null);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch {}
  }

  const value = useMemo(
    () => ({
      bootstrapped,
      user,
      signIn,
      signOut,
      refreshMe,
      setUser,
    }),
    [bootstrapped, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
