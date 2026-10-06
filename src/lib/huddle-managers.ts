"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getEditableContent, saveEditableContent } from "@/lib/supabase/db";

// مستخدمون يملكون صلاحيات المدير داخل «المتابعة اليومية» فقط
// (تقييم الجودة، تعديل أرقام الفريق، تأكيد/رفض المبيعات).
// السوبر أدمن مدير دائماً، وهو الوحيد اللي يعدّل القائمة.
const KEY = "huddle_managers";

export interface HuddleManager { id: string; name: string }

export function useHuddleManagers() {
  const { user, activeOrgId } = useAuth();
  const [managers, setManagers] = useState<HuddleManager[]>([]);

  useEffect(() => {
    getEditableContent<HuddleManager[]>(KEY)
      .then((v) => setManagers(Array.isArray(v) ? v : []))
      .catch(console.error);
  }, [activeOrgId]);

  const save = useCallback(async (next: HuddleManager[]) => {
    await saveEditableContent(KEY, next);
    setManagers(next);
  }, []);

  const isOwner = user?.isSuperAdmin ?? false;
  const isManager = isOwner || (!!user && managers.some((m) => m.id === user.id));

  return { managers, isManager, isOwner, save };
}
