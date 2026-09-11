"use client";

import { useCallback, useEffect, useState } from "react";
import { Phone, MessageCircle, Check, PhoneCall, Loader2, PlusCircle, CheckCircle2, X } from "lucide-react";
import { fetchEmployeeTasks, updateEmployeeTask, createFollowUpNote, createMentionNotification } from "@/lib/supabase/db";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/utils/format";
import type { EmployeeTask } from "@/types";

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
const PRIORITY_LABEL: Record<string, string> = { urgent: "عاجل", high: "مرتفع", medium: "عادي", low: "منخفض" };
const PRIORITY_STYLE: Record<string, string> = {
  urgent: "bg-red-500/15 text-red-300 border-red-500/25",
  high: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  medium: "bg-blue-500/15 text-blue-300 border-blue-500/25",
  low: "bg-white/[0.05] text-muted-foreground border-white/[0.08]",
};

const SYSTEM_AUTHORS = new Set(["system", "نظام تلقائي"]);

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
  const [busy, setBusy] = useState<string | null>(null);

  /* الصندوق النصّي المفتوح: { taskId, mode } — تحديث أو إغلاق */
  const [panel, setPanel] = useState<{ id: string; mode: "update" | "close" } | null>(null);
  const [text, setText] = useState("");

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

  function openPanel(id: string, mode: "update" | "close") {
    setPanel(p => (p?.id === id && p.mode === mode ? null : { id, mode }));
    setText("");
  }

  /* ① قبول الطلب: pending → in_progress (يتملّكه موظف الاتصال) */
  async function acceptRequest(t: EmployeeTask) {
    setBusy(t.id);
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, status: "in_progress" } : x));
    try {
      await updateEmployeeTask(t.id, { status: "in_progress", time_started_at: new Date().toISOString() });
    } catch { load(); }
    setBusy(null);
  }

  /* ② تحديث: يُكتب كمتابعة على العميل ليراها موظف الواتس في «آخر المتابعات» */
  async function submitUpdate(t: EmployeeTask) {
    const note = text.trim();
    if (!note) return;
    setBusy(t.id);
    try {
      if (t.entity_id) {
        await createFollowUpNote(
          (t.entity_type as "deal" | "renewal" | "ticket") || "deal",
          t.entity_id,
          `📞 متابعة اتصال — ${user?.name || "موظف الاتصال"}: ${note}`,
          user?.name || "موظف الاتصال",
        );
      }
      setPanel(null);
      setText("");
    } catch { /* ignore */ }
    setBusy(null);
  }

  /* ③ إغلاق الطلب بنتيجة نصّية حرة → إكمال المهمة + إشعار صاحب الذكرة (موظف الواتس) */
  async function closeRequest(t: EmployeeTask) {
    const result = text.trim();
    if (!result) return;
    setBusy(t.id);
    setTasks(prev => prev.filter(x => x.id !== t.id));
    try {
      const owner = t.assigned_by_name?.trim();
      const entityType = (t.entity_type as "deal" | "renewal" | "ticket") || "deal";
      // نتيجة الاتصال كمتابعة على العميل
      if (t.entity_id) {
        const note = await createFollowUpNote(
          entityType,
          t.entity_id,
          `✅ نتيجة الاتصال — ${user?.name || "موظف الاتصال"}: ${result}`,
          user?.name || "موظف الاتصال",
        );
        // إشعار صاحب الذكرة (موظف الواتس الذي طلب الاتصال) — يرجع له الطلب مُغلقاً
        if (owner && !SYSTEM_AUTHORS.has(owner) && owner !== user?.name) {
          await createMentionNotification(
            note.id,
            entityType,
            t.entity_id,
            t.client_name || t.title,
            owner,
            user?.name || "موظف الاتصال",
            `أُغلق طلب الاتصال — النتيجة: ${result}`,
          );
        }
      }
      await updateEmployeeTask(t.id, {
        status: "completed",
        completed_at: new Date().toISOString(),
        completion_notes: result,
      });
      setPanel(null);
      setText("");
    } catch { load(); }
    setBusy(null);
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
          <p className="text-[12px] text-muted-foreground">اقبل الطلب، اتصل وحدّث، ثم أغلقه بنتيجة الاتصال — ترجع لموظف الواتس</p>
        </div>
      </div>

      <div className="space-y-2">
        {tasks.map(t => {
          const phone = sanitizePhone(t.client_phone);
          const accepted = t.status === "in_progress";
          const openPanelHere = panel?.id === t.id ? panel.mode : null;
          return (
            <div key={t.id} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-foreground">{t.client_name || t.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${PRIORITY_STYLE[t.priority] || PRIORITY_STYLE.medium}`}>{PRIORITY_LABEL[t.priority] || "عادي"}</span>
                    {accepted
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-cyan-500/15 text-cyan-300 border-cyan-500/25">قيد العمل</span>
                      : <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-amber-500/15 text-amber-300 border-amber-500/25">بانتظار القبول</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap text-[12px] text-muted-foreground">
                    {t.client_phone && <span dir="ltr">{t.client_phone}</span>}
                    {t.assigned_by_name && <span>· صاحب الذكرة: {t.assigned_by_name}</span>}
                    {t.due_date && <span>· الموعد: {t.due_date}</span>}
                    {accepted && t.time_started_at && <span className="text-cyan-300">· قُبِل: {formatDateTime(t.time_started_at)}</span>}
                  </div>
                  {(t.description || t.notes) && (
                    <p className="text-[12px] text-foreground/80 mt-1">{t.description || t.notes}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/[0.05] flex-wrap">
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

                {!accepted ? (
                  <button
                    onClick={() => acceptRequest(t)}
                    disabled={busy === t.id}
                    className="flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25 hover:bg-amber-500/25 transition-colors mr-auto disabled:opacity-50"
                  >
                    {busy === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} قبول الطلب
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => openPanel(t.id, "update")}
                      className={`flex items-center gap-1 text-[12px] font-medium px-2.5 py-1 rounded-md border transition-colors mr-auto ${openPanelHere === "update" ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" : "bg-cyan-500/10 text-cyan-400 border-cyan-500/20 hover:bg-cyan-500/20"}`}
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> تحديث
                    </button>
                    <button
                      onClick={() => openPanel(t.id, "close")}
                      className={`flex items-center gap-1 text-[12px] font-bold px-2.5 py-1 rounded-md border transition-colors ${openPanelHere === "close" ? "bg-emerald-600 text-white border-emerald-500" : "bg-emerald-500/15 text-emerald-300 border-emerald-500/25 hover:bg-emerald-500/25"}`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> إغلاق الطلب
                    </button>
                  </>
                )}
              </div>

              {openPanelHere && (
                <div className="mt-2 pt-2 border-t border-white/[0.05]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[12px] font-semibold text-foreground">
                      {openPanelHere === "close" ? "نتيجة الاتصال (تُغلق الطلب وترجع لموظف الواتس)" : "تحديث سريع (يُسجَّل في متابعات العميل)"}
                    </span>
                    <button onClick={() => setPanel(null)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                  </div>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows={2}
                    autoFocus
                    placeholder={openPanelHere === "close" ? "مثال: تم التواصل، وعد بالتحويل بكرة الصبح…" : "مثال: ما رد، بحاول العصر…"}
                    className="w-full text-[13px] rounded-lg bg-white/[0.03] border border-white/[0.08] p-2.5 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-cyan-500/40 resize-none"
                  />
                  <div className="flex justify-end mt-1.5">
                    <button
                      onClick={() => openPanelHere === "close" ? closeRequest(t) : submitUpdate(t)}
                      disabled={busy === t.id || !text.trim()}
                      className={`flex items-center gap-1 text-[12px] font-bold px-3 py-1.5 rounded-md text-white transition-colors disabled:opacity-40 ${openPanelHere === "close" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-cyan-600 hover:bg-cyan-500"}`}
                    >
                      {busy === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      {openPanelHere === "close" ? "تأكيد الإغلاق" : "حفظ التحديث"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
