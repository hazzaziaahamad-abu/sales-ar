"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Check, X } from "lucide-react";
import { fetchUserProfiles } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import type { HuddleManager } from "@/lib/huddle-managers";

/** إدارة «مدراء المتابعة اليومية» — يظهر للسوبر أدمن فقط. */
export function HuddleManagersButton({ managers, onSave }: {
  managers: HuddleManager[];
  onSave: (next: HuddleManager[]) => Promise<void>;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<{ id: string; name: string }[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || users) return;
    fetchUserProfiles()
      .then((list) => setUsers(list.filter((u) => u.id !== user?.id)))
      .catch((e) => { console.error(e); setError("تعذّر تحميل المستخدمين"); });
  }, [open, users, user?.id]);

  function openPanel() {
    setSelected(new Set(managers.map((m) => m.id)));
    setError(null);
    setOpen(true);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      // نحتفظ بالاسم المحفوظ لمن لم يظهر في القائمة (مثلاً من منظمة أخرى)
      const byId = new Map<string, string>([
        ...managers.map((m) => [m.id, m.name] as [string, string]),
        ...(users ?? []).map((u) => [u.id, u.name] as [string, string]),
      ]);
      await onSave(Array.from(selected).map((id) => ({ id, name: byId.get(id) ?? "" })));
      setOpen(false);
    } catch (e) {
      console.error(e);
      setError("تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        onClick={openPanel}
        className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-[12px] bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground transition"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        مدراء المتابعة{managers.length > 0 ? ` (${managers.length})` : ""}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-foreground">مدراء المتابعة اليومية</h3>
              <button onClick={() => setOpen(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] text-muted-foreground hover:text-foreground" title="إغلاق">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[12px] text-muted-foreground leading-relaxed">
              المختارين ياخذون صلاحيات المدير داخل المتابعة اليومية فقط: تقييم الجودة، تعديل أرقام الفريق، وتأكيد/رفض المبيعات. ما يتغيّر شي في باقي النظام.
            </p>

            <div className="max-h-[50vh] overflow-y-auto space-y-1">
              {!users && !error && <Loader2 className="w-5 h-5 animate-spin mx-auto my-6 text-muted-foreground" />}
              {users?.map((u) => {
                const on = selected.has(u.id);
                return (
                  <button
                    key={u.id}
                    onClick={() => toggle(u.id)}
                    className={`w-full flex items-center justify-between gap-2 rounded-lg px-3 py-2 border text-right transition ${on ? "bg-violet-500/10 border-violet-500/30" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"}`}
                  >
                    <span className="text-[13px] text-foreground">{u.name}</span>
                    <span className={`w-5 h-5 rounded-md border flex items-center justify-center ${on ? "bg-violet-500 border-violet-500" : "border-white/[0.2]"}`}>
                      {on && <Check className="w-3.5 h-3.5 text-white" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {error && <p className="text-[12px] text-red-400">{error}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="text-xs px-3 py-2 rounded-lg bg-white/[0.05] text-muted-foreground">إلغاء</button>
              <button onClick={save} disabled={saving || !users} className="text-xs px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 border border-violet-500/20 disabled:opacity-50 flex items-center gap-1.5">
                {saving && <Loader2 className="w-3 h-3 animate-spin" />} حفظ
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
