import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { supabase } from "./supabase";
import { getOrgId, setOrgId } from "./db";
import type { AuthUser } from "../types";

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  activeOrgId: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState("");

  const loadUser = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("user_profiles")
        .select("*, roles(*)")
        .eq("id", authUser.id)
        .single();

      if (!profile) {
        setUser(null);
        setLoading(false);
        return;
      }

      const role = profile.roles as {
        id: string; name: string; slug: string; allowed_pages: string[];
      };

      setUser({
        id: profile.id,
        email: profile.email,
        name: profile.name,
        orgId: profile.org_id,
        roleId: role.id,
        roleName: role.name,
        allowedPages: role.allowed_pages,
        isSuperAdmin: profile.is_super_admin,
      });

      const orgId = await getOrgId();
      const effectiveOrgId = profile.is_super_admin ? orgId : profile.org_id;
      setActiveOrgId(effectiveOrgId);
      await setOrgId(effectiveOrgId);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
        setLoading(false);
      } else {
        loadUser();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    await loadUser();
    return {};
  }, [loadUser]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signOut, activeOrgId }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
