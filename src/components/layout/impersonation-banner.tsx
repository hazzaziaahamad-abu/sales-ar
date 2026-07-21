"use client";

import { useAuth } from "@/lib/auth-context";
import { UserCog, LogOut } from "lucide-react";

/**
 * شريط علوي يظهر عندما يشاهد الأدمن المنصة «كموظف».
 * يوضّح الهوية الحالية ويتيح الرجوع لحساب الأدمن بضغطة.
 */
export function ImpersonationBanner() {
  const { isImpersonating, user, realUser, stopImpersonating } = useAuth();
  if (!isImpersonating || !user) return null;

  return (
    <div className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-amber-500 px-4 py-2 text-center text-[12px] sm:text-sm font-bold text-black">
      <span className="inline-flex items-center gap-1.5">
        <UserCog className="w-4 h-4" />
        تشاهد المنصة كـ «{user.name}» — عرض فقط
        {user.roleName ? <span className="font-semibold opacity-80">({user.roleName})</span> : null}
      </span>
      {realUser?.name && <span className="opacity-70 font-medium hidden sm:inline">— حسابك: {realUser.name}</span>}
      <button
        onClick={stopImpersonating}
        className="inline-flex items-center gap-1 rounded-md bg-black/15 px-2.5 py-1 transition hover:bg-black/25"
      >
        <LogOut className="w-3.5 h-3.5" /> رجوع لحسابي
      </button>
    </div>
  );
}
