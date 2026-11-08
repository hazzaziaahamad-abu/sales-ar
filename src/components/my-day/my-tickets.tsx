"use client";

// «تذاكري» داخل «يومي»: تذاكر الدعم المفتوحة المسندة للموظف — الأعجل أولاً، مع إجراء مباشر.
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getOrgId, updateTicket } from "@/lib/supabase/db";
import { phoneFormats } from "@/lib/daily-tasks/shared";
import { todayLocal } from "@/lib/utils/format";
import { FollowUpLogButton } from "@/components/follow-up-log";
import { ClientProfilePanel } from "@/components/client-profile-panel";
import { LifeBuoy, Phone, MessageCircle, UserRound, CheckCircle2, Wrench } from "lucide-react";

interface MyTicket {
  id: string;
  ticket_number: number | null;
  client_name: string;
  client_phone: string | null;
  issue: string;
  priority: string;
  status: string;
  created_at: string;
  due_date: string | null;
}

const PRIORITY_RANK: Record<string, number> = { "عاجل": 0, "مرتفع": 1, "عادي": 2 };
const DAY = 86400000;
const ageLabel = (iso: string) => {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3600000);
  if (h < 1) return "الآن";
  if (h < 24) return `من ${h} ساعة`;
  return `من ${Math.floor(h / 24)} يوم`;
};

export function MyTickets({ agentName }: { agentName: string }) {
  const [tickets, setTickets] = useState<MyTicket[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await createClient().from("tickets")
      .select("id, ticket_number, client_name, client_phone, issue, priority, status, created_at, due_date")
      .eq("org_id", getOrgId()).eq("assigned_agent_name", agentName.trim())
      .not("status", "in", '("محلول","مغلق")').order("created_at");
    if (e) { setError("تعذّر تحميل التذاكر"); return; }
    setTickets(((data ?? []) as MyTicket[]).sort((a, b) =>
      (PRIORITY_RANK[a.priority] ?? 3) - (PRIORITY_RANK[b.priority] ?? 3) || a.created_at.localeCompare(b.created_at)));
  }, [agentName]);
  useEffect(() => { load(); }, [load]);

  async function setStatus(t: MyTicket, status: "قيد الحل" | "محلول") {
    if (status === "محلول" && !window.confirm(`تأكيد حل تذكرة «${t.client_name}»؟`)) return;
    setBusy(t.id);
    setError(null);
    try {
      await updateTicket(t.id, status === "محلول" ? { status, resolved_date: todayLocal() } : { status });
      await load();
    } catch (e) {
      console.error(e);
      setError("تعذّر تحديث التذكرة");
    } finally {
      setBusy(null);
    }
  }

  if (!tickets || tickets.length === 0) return null;

  return (
    <section className="cc-card rounded-2xl border border-cyan-500/20 p-4 space-y-2">
      <h2 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <LifeBuoy className="h-4 w-4 text-cyan-400" /> تذاكري المفتوحة
        <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-400">{tickets.length}</span>
      </h2>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {tickets.map((t) => {
        const ph = phoneFormats(t.client_phone);
        const late = t.due_date && t.due_date < todayLocal();
        const old = Date.now() - new Date(t.created_at).getTime() > DAY;
        return (
          <div key={t.id} className={`rounded-xl border bg-white/[0.02] p-3 space-y-2 ${t.priority === "عاجل" || late ? "border-red-500/30" : "border-white/[0.06]"}`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-sm text-foreground">{t.client_name}</span>
              {t.ticket_number ? <span className="text-[10px] text-muted-foreground">#{t.ticket_number}</span> : null}
              <span className="rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-muted-foreground">{t.status}</span>
              {t.priority !== "عادي" && <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">{t.priority}</span>}
              <span className={`text-[11px] ${old ? "text-amber-400" : "text-muted-foreground"}`}>مفتوحة {ageLabel(t.created_at)}</span>
              {late && <span className="text-[11px] text-red-400">· فات موعدها</span>}
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">{t.issue}</div>
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setProfile(t.client_phone || t.client_name)}
                className="flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs">
                <UserRound className="h-3.5 w-3.5" /> الملف
              </button>
              <div className="flex h-9 items-center rounded-lg border border-amber-500/20 bg-amber-500/10 px-1" title="سجل المتابعة">
                <FollowUpLogButton entityType="ticket" entityId={t.id} entityName={t.client_name} />
              </div>
              {ph && <a href={`tel:+${ph.intl}`} className="flex h-9 items-center gap-1 rounded-lg border border-white/[0.08] px-2.5 text-xs"><Phone className="h-3.5 w-3.5" /> اتصال</a>}
              {ph && <a href={`https://wa.me/${ph.intl}`} target="_blank" rel="noreferrer" className="flex h-9 items-center gap-1 rounded-lg border border-green-500/20 bg-green-500/10 px-2.5 text-xs text-green-400"><MessageCircle className="h-3.5 w-3.5" /> واتساب</a>}
              <span className="flex-1" />
              {t.status === "مفتوح" && (
                <button type="button" disabled={busy === t.id} onClick={() => setStatus(t, "قيد الحل")}
                  className="flex h-9 items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 text-xs text-amber-400 disabled:opacity-50">
                  <Wrench className="h-3.5 w-3.5" /> بدأت فيها
                </button>
              )}
              <button type="button" disabled={busy === t.id} onClick={() => setStatus(t, "محلول")}
                className="flex h-9 items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 text-xs font-bold text-emerald-400 disabled:opacity-50">
                <CheckCircle2 className="h-3.5 w-3.5" /> تم الحل
              </button>
            </div>
          </div>
        );
      })}
      <ClientProfilePanel open={profile !== null} onClose={() => setProfile(null)} initialQuery={profile ?? undefined} />
    </section>
  );
}
