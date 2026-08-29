"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, MessageCircle, Check, PhoneCall, Loader2 } from "lucide-react";
import { fetchEmployeeTasks, updateEmployeeTask } from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import type { EmployeeTask } from "@/types";

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_LABEL: Record<string, string> = { urgent: "عاجل", high: "مرتفع", medium: "عادي", low: "منخفض" };
const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-300 border-red-500/25",
  high: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  medium: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  low: "bg-white/[0.05] text-muted-foreground border-white/[0.08]",
};

function sanitizePhone(phone?: string): string {
  if (!phone) return "";
  let p = phone.replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = p.slice(2);
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("05")) p = "966" + p.slice(1);
  else if (p.startsWith("5") && p.length === 9) p = "966" + p;
  return p;
}

export function MyCallRequests() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<EmployeeTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) return;
    try {
      const all = await fetchEmployeeTasks({ assigned_to: user.id });
      const calls = all
        .filter(t => t.task_type === "call" && (t.status === "pending" || t.status === "in_progress"))
        .sort((a, b) => {
          const pr = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
          if (pr !== 0) return pr;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      setTasks(calls);
    } catch { /* ignore */ }
    setLoading(false);
  }, [user?.id]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setLoading(true); load(); }, [load]);

  // Realtime: تحديث الطابور فور إسناد/تحديث مهمة اتصال
  useEffect(() => {
    if (!user?.id) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`my-call-requests-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "employee_tasks", filter: `assigned_to=eq.${user.id}` }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, load]);

  async function markDone(id: string) {
    setTasks(prev => prev.filter(t => t.id !== id));
    try { await updateEmployeeTask(id, { status: "completed", completed_at: new Date().toISOString() }); } catch { load(); }
  }

  if (loading || tasks.length === 0) return null;

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-bl from-emerald-500/[0.08] to-transparent p-4 mb-4">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
          <PhoneCall className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-sm font-extrabold text-foreground">مطلوب مني اتصال ({tasks.length})</h3>
          <p className="text-[12px] text-muted-foreground">عملاء طلب منك زملاؤك الاتصال بهم — اتصل ثم اضغط «تم»</p>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.map(t => {
          const phone = sanitizePhone(t.client_phone);
          return (
            <div key={t.id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{t.client_name || t.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.medium}`}>{PRIORITY_LABEL[t.priority] || "عادي"}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[12px] text-muted-foreground">
                    {t.client_phone && <span dir="ltr">{t.client_phone}</span>}
                    {t.assigned_by_name && <span>· طلب: {t.assigned_by_name}</span>}
                    {t.due_date && <span>· الموعد: {t.due_date}</span>}
                  </div>
                  {(t.description || t.notes) && (
                    <p className="text-[12px] text-foreground/80 mt-1">{t.description || t.notes}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.05]">
                {phone ? (
                  <>
                    <a href={`tel:${t.client_phone}`} className="flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                      <Phone className="w-3.5 h-3.5" /> اتصل
                    </a>
                    <a href={`https://wa.me/${phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[12px] px-2.5 py-1 rounded-md bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 transition-colors">
                      <MessageCircle className="w-3.5 h-3.5" /> واتساب
                    </a>
                  </>
                ) : (
                  <span className="text-[12px] text-muted-foreground/60">بلا رقم</span>
                )}
                <button onClick={() => markDone(t.id)} className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-md bg-cyan-600 text-white hover:bg-cyan-500 transition-colors mr-auto">
                  <Check className="w-3.5 h-3.5" /> تم
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
