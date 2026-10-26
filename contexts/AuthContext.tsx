"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, getToken, TOKEN_KEY } from "@/lib/api";
import { can as roleCan, type Permission } from "@/lib/roles";
import type { User } from "@/lib/types";

type AuthState = {
  user: User | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
  can: (permission: Permission) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User | { user: User }>("/auth/me");
      const resolved = "user" in me ? me.user : me;
      // Deactivated staff lose access immediately.
      setUser(resolved.active === false ? null : resolved);
      if (resolved.active === false) localStorage.removeItem(TOKEN_KEY);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch {
      // The token is dropped locally either way.
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  useEffect(() => {
    void refreshUser();
    const expired = () => setUser(null);
    window.addEventListener("auth:expired", expired);
    return () => window.removeEventListener("auth:expired", expired);
  }, [refreshUser]);

  const can = useCallback(
    (permission: Permission) => roleCan(user?.role, permission),
    [user],
  );

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser, logout, can }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
