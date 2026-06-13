"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { logPageVisit } from "@/lib/supabase/db";

export function PageTracker() {
  const pathname = usePathname();
  const { user } = useAuth();
  const lastLogged = useRef<string>("");

  useEffect(() => {
    if (!user || lastLogged.current === pathname) return;
    lastLogged.current = pathname;
    logPageVisit(pathname, user.name);
  }, [pathname, user]);

  return null;
}
