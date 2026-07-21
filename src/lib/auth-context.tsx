"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setDbReadOnly } from "@/lib/supabase/readonly-guard";
import { todayLocal } from "@/lib/utils/format";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  roleId: string;
  roleName: string;
  allowedPages: string[];
  isSuperAdmin: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;          // الهوية الفعّالة (المستخدَم فيها العرض إن وُجد)
  realUser: AuthUser | null;      // المستخدم الحقيقي المسجّل دخوله
  isImpersonating: boolean;       // هل الأدمن يشاهد كموظف الآن؟
  impersonate: (target: AuthUser) => void;  // للسوبر أدمن فقط
  stopImpersonating: () => void;
  loading: boolean;
  signOut: () => Promise<void>;
  activeOrgId: string;
  switchOrg: (orgId: string) => void;
  orgs: { id: string; name: string; nameAr: string }[];
}

const VIEW_AS_KEY = "cc_view_as";

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [realUser, setRealUser] = useState<AuthUser | null>(null);
  const [viewAs, setViewAs] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeOrgId, setActiveOrgId] = useState("");
  const [orgs, setOrgs] = useState<{ id: string; name: string; nameAr: string }[]>([]);
  const preImpersonationOrg = useRef<string | null>(null);

  // الهوية الفعّالة: عند العرض كموظف نستخدم بياناته، وإلا المستخدم الحقيقي.
  const user = viewAs ?? realUser;
  const isImpersonating = viewAs !== null;

  // وضع «العرض فقط» يمنع أي كتابة على قاعدة البيانات أثناء الدخول كموظف.
  useEffect(() => {
    setDbReadOnly(isImpersonating);
  }, [isImpersonating]);

  const loadUser = useCallback(async () => {
    const supabase = createClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setRealUser(null);
      setLoading(false);
      return;
    }

    // Fetch profile with role
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("*, roles(*)")
      .eq("id", authUser.id)
      .single();

    if (!profile) {
      setRealUser(null);
      setLoading(false);
      return;
    }

    const role = profile.roles as { id: string; name: string; slug: string; allowed_pages: string[] };

    const authUserData: AuthUser = {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      orgId: profile.org_id,
      roleId: role.id,
      roleName: role.name,
      allowedPages: role.allowed_pages,
      isSuperAdmin: profile.is_super_admin,
    };

    setRealUser(authUserData);

    // Log login (once per session)
    const loginKey = `login_logged_${authUser.id}_${todayLocal()}`;
    if (!sessionStorage.getItem(loginKey)) {
      sessionStorage.setItem(loginKey, "1");
      supabase.from("user_login_logs").insert({
        org_id: profile.org_id,
        user_id: authUser.id,
        user_name: profile.name,
        user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 200) : null,
      }).then(() => {});
    }

    // Set org_id in localStorage for db.ts compatibility
    const orgId = localStorage.getItem("cc_org_id") || profile.org_id;
    // Non-super-admin always uses their own org
    const effectiveOrgId = profile.is_super_admin ? orgId : profile.org_id;
    setActiveOrgId(effectiveOrgId);
    localStorage.setItem("cc_org_id", effectiveOrgId);

    // Load orgs — all for super admin, own org for others
    if (profile.is_super_admin) {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, name_ar")
        .order("created_at");
      if (orgData) {
        setOrgs(orgData.map((o) => ({ id: o.id, name: o.name, nameAr: o.name_ar || o.name })));
      }
    } else {
      const { data: orgData } = await supabase
        .from("organizations")
        .select("id, name, name_ar")
        .eq("id", profile.org_id)
        .single();
      if (orgData) {
        setOrgs([{ id: orgData.id, name: orgData.name, nameAr: orgData.name_ar || orgData.name }]);
      }
    }

    // استرجاع وضع «العرض كموظف» (للسوبر أدمن فقط) بعد ضبط المنظمة الافتراضية
    if (authUserData.isSuperAdmin && typeof sessionStorage !== "undefined") {
      const saved = sessionStorage.getItem(VIEW_AS_KEY);
      if (saved) {
        try {
          const vu = JSON.parse(saved) as AuthUser;
          setViewAs(vu);
          preImpersonationOrg.current = profile.org_id;
          setActiveOrgId(vu.orgId);
          localStorage.setItem("cc_org_id", vu.orgId);
        } catch { sessionStorage.removeItem(VIEW_AS_KEY); }
      }
    } else if (typeof sessionStorage !== "undefined") {
      sessionStorage.removeItem(VIEW_AS_KEY);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setRealUser(null);
        setViewAs(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [loadUser]);

  const signOut = useCallback(async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    setRealUser(null);
    setViewAs(null);
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(VIEW_AS_KEY);
    localStorage.removeItem("cc_org_id");
    router.push("/login");
  }, [router]);

  // الدخول/العرض كموظف — متاح للسوبر أدمن فقط
  const impersonate = useCallback((target: AuthUser) => {
    if (!realUser?.isSuperAdmin || target.id === realUser.id) return;
    preImpersonationOrg.current = activeOrgId;
    setViewAs(target);
    if (typeof sessionStorage !== "undefined") sessionStorage.setItem(VIEW_AS_KEY, JSON.stringify(target));
    setActiveOrgId(target.orgId);
    localStorage.setItem("cc_org_id", target.orgId);
    window.dispatchEvent(new Event("org-switch"));
  }, [realUser, activeOrgId]);

  const stopImpersonating = useCallback(() => {
    setViewAs(null);
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(VIEW_AS_KEY);
    const backOrg = preImpersonationOrg.current || realUser?.orgId || "";
    if (backOrg) {
      setActiveOrgId(backOrg);
      localStorage.setItem("cc_org_id", backOrg);
    }
    preImpersonationOrg.current = null;
    window.dispatchEvent(new Event("org-switch"));
  }, [realUser]);

  const switchOrg = useCallback((orgId: string) => {
    setActiveOrgId(orgId);
    localStorage.setItem("cc_org_id", orgId);
    // Force re-render by updating state — pages with orgId in useEffect deps will refetch
    window.dispatchEvent(new Event("org-switch"));
  }, []);

  return (
    <AuthContext.Provider value={{ user, realUser, isImpersonating, impersonate, stopImpersonating, loading, signOut, activeOrgId, switchOrg, orgs }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
