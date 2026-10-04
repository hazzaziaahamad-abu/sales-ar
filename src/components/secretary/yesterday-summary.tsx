"use client";

import { useEffect, useMemo, useState } from "react";
import {
  History, ChevronRight, ChevronLeft, Loader2, Sparkles, Copy, Share2,
  TrendingUp, RefreshCw, Headphones, CheckSquare, MessageCircle, Activity,
  Users, UserX, Plus, Pencil, Trash2, LogIn, ChevronDown, ChevronUp,
} from "lucide-react";
import { fetchTeamActivityForDay, type UserLoginLog } from "@/lib/supabase/db";
import { formatMoneyFull, saudiDateStr } from "@/lib/utils/format";
import type { ActivityLog, Deal, Employee, FollowUpNote, Renewal, Ticket } from "@/types";

type Note = FollowUpNote & { entity_name?: string };

const DAY_MS = 86400000;

/** يحوّل أي تاريخ (YYYY-MM-DD أو timestamp) إلى يوم بتوقيت السعودية. */
function dayOf(s?: string | null): string {
  if (!s) return "";
  if (s.length === 10) return s;
  return saudiDateStr(new Date(s));
}

function timeOf(s: string): string {
  return new Date(s).toLocaleTimeString("ar-SA-u-ca-gregory-nu-latn", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Riyadh" });
}

function shiftDay(day: string, delta: number): string {
  return saudiDateStr(new Date(new Date(`${day}T12:00:00+03:00`).getTime() + delta * DAY_MS));
}

function dayLabel(day: string): string {
  return new Date(`${day}T12:00:00+03:00`).toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" });
}

function sameName(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  const x = a.trim(), y = b.trim();
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
}

const ACTION_ICON = { create: Plus, update: Pencil, delete: Trash2 } as const;
const ACTION_COLOR = { create: "text-emerald-400", update: "text-sky-400", delete: "text-red-400" } as const;
const ACTION_LABEL = { create: "إضافة", update: "تعديل", delete: "حذف" } as const;
const NOTE_TYPE_LABEL: Record<string, string> = { deal: "صفقة", renewal: "تجديد", ticket: "تذكرة" };

interface MemberSummary {
  name: string;
  logs: ActivityLog[];
  notes: Note[];
  logins: UserLoginLog[];
  sections: [string, number][];
  closedDeals: number;
  closedRevenue: number;
  first?: string;
  last?: string;
  total: number;
}

export function YesterdaySummary({ deals, renewals, tickets, employees }: {
  deals: Deal[];
  renewals: Renewal[];
  tickets: Ticket[];
  employees: Employee[];
}) {
  const yesterday = useMemo(() => saudiDateStr(new Date(Date.now() - DAY_MS)), []);
  const [day, setDay] = useState(yesterday);
  const [data, setData] = useState<{ logs: ActivityLog[]; logins: UserLoginLog[]; notes: Note[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openMember, setOpenMember] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [ai, setAi] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(false); setAi(""); setOpenMember(null);
    fetchTeamActivityForDay(day)
      .then((res) => { if (!cancelled) setData(res); })
      .catch((e) => { console.error(e); if (!cancelled) { setError(true); setData(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [day]);

  const summary = useMemo(() => {
    const logs = data?.logs ?? [];
    const logins = data?.logins ?? [];
    const notes = data?.notes ?? [];

    // نتائج اليوم من الجداول الأساسية
    const newDeals = deals.filter(d => dayOf(d.created_at) === day);
    const closedDeals = deals.filter(d => d.stage === "مكتملة" && dayOf(d.close_date || d.created_at) === day);
    const closedRevenue = closedDeals.reduce((s, d) => s + d.deal_value, 0);
    const doneRenewals = renewals.filter(r => r.status === "مكتمل" && dayOf(r.updated_at) === day);
    const renewalRevenue = doneRenewals.reduce((s, r) => s + r.plan_price, 0);
    const newTickets = tickets.filter(t => dayOf(t.created_at) === day);
    const resolvedTickets = tickets.filter(t => t.status === "محلول" && dayOf(t.resolved_date || t.updated_at) === day);

    // العمليات حسب القسم
    const sectionMap = new Map<string, { create: number; update: number; delete: number }>();
    for (const l of logs) {
      const k = l.section_label || l.section;
      const cur = sectionMap.get(k) || { create: 0, update: 0, delete: 0 };
      cur[l.action] = (cur[l.action] || 0) + 1;
      sectionMap.set(k, cur);
    }
    const sections = Array.from(sectionMap.entries())
      .map(([label, c]) => ({ label, ...c, total: c.create + c.update + c.delete }))
      .sort((a, b) => b.total - a.total);

    // تغييرات المراحل البارزة (من سجل العمليات)
    const stageMoves = logs.filter(l => l.section === "sales" && l.action === "update" && l.details?.startsWith("تغيير المرحلة"));

    // ملخص كل عضو في الفريق
    const memberMap = new Map<string, MemberSummary>();
    const get = (name: string) => {
      let m = memberMap.get(name);
      if (!m) { m = { name, logs: [], notes: [], logins: [], sections: [], closedDeals: 0, closedRevenue: 0, total: 0 }; memberMap.set(name, m); }
      return m;
    };
    for (const l of logs) get(l.user_name?.trim() || "غير معروف").logs.push(l);
    for (const n of notes) get(n.author_name?.trim() || "غير معروف").notes.push(n);
    for (const l of logins) get(l.user_name?.trim() || "غير معروف").logins.push(l);
    for (const d of closedDeals) {
      const rep = d.assigned_rep_name?.trim();
      if (!rep) continue;
      const key = Array.from(memberMap.keys()).find(k => sameName(k, rep)) || rep;
      const m = get(key);
      m.closedDeals += 1; m.closedRevenue += d.deal_value;
    }
    const members = Array.from(memberMap.values()).map(m => {
      const secCount = new Map<string, number>();
      for (const l of m.logs) secCount.set(l.section_label || l.section, (secCount.get(l.section_label || l.section) || 0) + 1);
      const times = [...m.logs.map(l => l.created_at), ...m.notes.map(n => n.created_at), ...m.logins.map(l => l.login_at)].sort();
      return {
        ...m,
        sections: Array.from(secCount.entries()).sort((a, b) => b[1] - a[1]),
        first: times[0],
        last: times[times.length - 1],
        total: m.logs.length + m.notes.length,
      };
    }).sort((a, b) => b.total - a.total || b.logins.length - a.logins.length);

    // موظفون نشطون بالنظام لكن ما ظهر لهم أي أثر في المنصة
    const absent = employees
      .filter(e => e.status === "نشط")
      .filter(e => !members.some(m => sameName(m.name, e.name)));

    return {
      newDeals, closedDeals, closedRevenue, doneRenewals, renewalRevenue, newTickets, resolvedTickets,
      sections, stageMoves, members, absent,
      totalActions: logs.length, totalNotes: notes.length,
      activeMembers: members.filter(m => m.total > 0 || m.logins.length > 0).length,
    };
  }, [data, deals, renewals, tickets, employees, day]);

  const isYesterday = day === yesterday;
  const title = isYesterday ? "ملخص أمس" : `ملخص ${dayLabel(day)}`;

  function buildText(): string {
    const s = summary;
    const lines: string[] = [];
    lines.push(`📋 *${title} — ما تم في المنصة*`);
    lines.push(`📅 ${dayLabel(day)}`);
    lines.push("─".repeat(24));
    lines.push(`💰 صفقات مغلقة: ${s.closedDeals.length} — ${formatMoneyFull(s.closedRevenue)}`);
    lines.push(`🆕 صفقات جديدة: ${s.newDeals.length}`);
    lines.push(`🔄 تجديدات مكتملة: ${s.doneRenewals.length} — ${formatMoneyFull(s.renewalRevenue)}`);
    lines.push(`🎫 تذاكر: ${s.newTickets.length} جديدة / ${s.resolvedTickets.length} محلولة`);
    lines.push(`📝 ملاحظات متابعة: ${s.totalNotes}`);
    lines.push(`⚙️ إجمالي العمليات: ${s.totalActions} — ${s.activeMembers} عضو نشط`);
    if (s.closedDeals.length > 0) {
      lines.push("", "*✅ الصفقات المغلقة:*");
      s.closedDeals.forEach(d => lines.push(`• ${d.client_name} — ${formatMoneyFull(d.deal_value)}${d.assigned_rep_name ? ` (${d.assigned_rep_name})` : ""}`));
    }
    if (s.members.length > 0) {
      lines.push("", "*👥 الفريق:*");
      s.members.forEach(m => {
        const parts = [`${m.logs.length} عملية`];
        if (m.notes.length) parts.push(`${m.notes.length} ملاحظة`);
        if (m.closedDeals) parts.push(`${m.closedDeals} إغلاق`);
        if (!m.total && m.logins.length) parts.push("دخول فقط");
        lines.push(`• ${m.name}: ${parts.join(" · ")}`);
      });
    }
    if (s.absent.length > 0) {
      lines.push("", `*😶 بدون نشاط:* ${s.absent.map(e => e.name).join("، ")}`);
    }
    return lines.join("\n");
  }

  async function runAi() {
    setAiLoading(true); setAi("");
    try {
      const s = summary;
      const context = {
        day,
        closed_deals: s.closedDeals.map(d => ({ client: d.client_name, value: d.deal_value, rep: d.assigned_rep_name })),
        new_deals: s.newDeals.length,
        renewals_done: s.doneRenewals.length, renewal_revenue: s.renewalRevenue,
        tickets_new: s.newTickets.length, tickets_resolved: s.resolvedTickets.length,
        sections: s.sections.map(x => ({ section: x.label, create: x.create, update: x.update, delete: x.delete })),
        team: s.members.map(m => ({ name: m.name, actions: m.logs.length, notes: m.notes.length, logins: m.logins.length, closed: m.closedDeals, sections: m.sections.slice(0, 4) })),
        inactive: s.absent.map(e => e.name),
        sample_notes: (data?.notes ?? []).slice(0, 25).map(n => ({ by: n.author_name, on: n.entity_name, note: n.note.slice(0, 160) })),
      };
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `أنت السكرتير التنفيذي. اكتب للمدير ملخصاً مختصراً لما تم في المنصة من الفريق يوم ${day}: أبرز الإنجازات، من اشتغل أكثر ومن غاب، أي ملاحظة مقلقة، ثم ٣ توصيات لليوم. استخدم نقاطاً قصيرة. البيانات: ${JSON.stringify(context)}`,
        }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const reader = res.body?.getReader();
      if (!reader) return;
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (const line of decoder.decode(value).split("\n").filter(l => l.startsWith("data: "))) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) { full += parsed.text; setAi(full); }
          } catch { /* skip */ }
        }
      }
      if (!full) setAi("لا توجد ملاحظات إضافية.");
    } catch {
      setAi("تعذر الاتصال بالذكاء الاصطناعي.");
    }
    setAiLoading(false);
  }

  const s = summary;
  const kpis = [
    { icon: TrendingUp, v: String(s.closedDeals.length), sub: s.closedRevenue > 0 ? formatMoneyFull(s.closedRevenue) : undefined, l: "صفقات مغلقة", c: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
    { icon: Plus, v: String(s.newDeals.length), l: "صفقات جديدة", c: "text-teal-400", bg: "bg-teal-500/10 border-teal-500/20" },
    { icon: RefreshCw, v: String(s.doneRenewals.length), sub: s.renewalRevenue > 0 ? formatMoneyFull(s.renewalRevenue) : undefined, l: "تجديدات مكتملة", c: "text-sky-400", bg: "bg-sky-500/10 border-sky-500/20" },
    { icon: Headphones, v: `${s.newTickets.length}/${s.resolvedTickets.length}`, l: "تذاكر جديدة/محلولة", c: "text-rose-400", bg: "bg-rose-500/10 border-rose-500/20" },
    { icon: MessageCircle, v: String(s.totalNotes), l: "ملاحظات متابعة", c: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
    { icon: Activity, v: String(s.totalActions), sub: `${s.activeMembers} عضو نشط`, l: "عمليات في المنصة", c: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20" },
  ];

  return (
    <div className="rounded-2xl border border-indigo-500/25 bg-gradient-to-bl from-indigo-500/[0.08] via-transparent to-cyan-500/[0.04] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center">
            <History className="w-5 h-5 text-indigo-300" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-foreground">{title} — كل ما تم في المنصة</h3>
            <p className="text-[12px] text-muted-foreground">{dayLabel(day)} · عمليات الفريق، الملاحظات، الإغلاقات والتذاكر</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setDay(d => shiftDay(d, -1))} title="اليوم السابق" className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
          {!isYesterday && (
            <button onClick={() => setDay(yesterday)} className="text-[11px] px-2 py-1 rounded-md bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20">أمس</button>
          )}
          <button onClick={() => setDay(d => shiftDay(d, 1))} disabled={day >= yesterday} title="اليوم التالي" className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="w-px h-5 bg-white/[0.08] mx-1" />
          <button onClick={() => { navigator.clipboard.writeText(buildText()); setCopied(true); setTimeout(() => setCopied(false), 1500); }} disabled={loading} title="نسخ الملخص" className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground">
            <Copy className="w-3 h-3" /> {copied ? "تم" : "نسخ"}
          </button>
          <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(buildText())}`, "_blank")} disabled={loading} title="مشاركة واتساب" className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20">
            <Share2 className="w-3 h-3" /> واتساب
          </button>
          <button onClick={runAi} disabled={loading || aiLoading} title="ملخص ذكي" className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/20 text-violet-300 hover:bg-violet-500/20 disabled:opacity-50">
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} ملخص ذكي
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>
      ) : error ? (
        <p className="text-[12px] text-red-400 text-center py-6">تعذر تحميل نشاط الفريق لهذا اليوم.</p>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
            {kpis.map((k, i) => (
              <div key={i} className={`rounded-xl border p-2.5 text-center ${k.bg}`}>
                <k.icon className={`w-4 h-4 mx-auto mb-1 ${k.c}`} />
                <p className={`text-lg font-extrabold ${k.c}`}>{k.v}</p>
                <p className="text-[11px] text-muted-foreground">{k.l}</p>
                {k.sub && <p className={`text-[11px] mt-0.5 opacity-80 ${k.c}`}>{k.sub}</p>}
              </div>
            ))}
          </div>

          {ai && (
            <div className="rounded-xl bg-violet-500/[0.06] border border-violet-500/20 p-3">
              <p className="text-[12px] font-bold text-violet-300 mb-1.5 flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> قراءة السكرتير</p>
              <div className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{ai}</div>
            </div>
          )}

          {/* الإغلاقات + تحركات المراحل */}
          {(s.closedDeals.length > 0 || s.doneRenewals.length > 0 || s.stageMoves.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                <p className="text-[12px] font-bold text-emerald-400 mb-2 flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5" /> الإنجازات</p>
                {s.closedDeals.length === 0 && s.doneRenewals.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">لا إغلاقات ولا تجديدات مكتملة</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {s.closedDeals.map(d => (
                      <div key={d.id} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="truncate"><span className="text-emerald-400">💰</span> {d.client_name} <span className="text-muted-foreground">· {d.assigned_rep_name || "بلا مسؤول"}</span></span>
                        <span className="text-emerald-400 font-bold shrink-0">{formatMoneyFull(d.deal_value)}</span>
                      </div>
                    ))}
                    {s.doneRenewals.map(r => (
                      <div key={r.id} className="flex items-center justify-between gap-2 text-[12px]">
                        <span className="truncate"><span className="text-sky-400">🔄</span> {r.customer_name} <span className="text-muted-foreground">· {r.assigned_rep || "بلا مسؤول"}</span></span>
                        <span className="text-sky-400 font-bold shrink-0">{formatMoneyFull(r.plan_price)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
                <p className="text-[12px] font-bold text-sky-400 mb-2 flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> تحركات مراحل الصفقات ({s.stageMoves.length})</p>
                {s.stageMoves.length === 0 ? (
                  <p className="text-[12px] text-muted-foreground">لا تغييرات على المراحل</p>
                ) : (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {s.stageMoves.map(l => (
                      <div key={l.id} className="text-[12px] flex items-center justify-between gap-2">
                        <span className="truncate">{l.entity_title || "صفقة"} <span className="text-muted-foreground">← {l.details?.replace("تغيير المرحلة إلى ", "")}</span></span>
                        <span className="text-[11px] text-muted-foreground shrink-0">{l.user_name || ""} · {timeOf(l.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* العمليات حسب القسم */}
          {s.sections.length > 0 && (
            <div>
              <p className="text-[12px] font-bold text-muted-foreground mb-1.5">العمليات حسب القسم</p>
              <div className="flex flex-wrap gap-1.5">
                {s.sections.map(sec => (
                  <div key={sec.label} className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-2.5 py-1.5 text-[12px] flex items-center gap-2">
                    <span className="font-bold text-foreground">{sec.label}</span>
                    <span className="text-muted-foreground">{sec.total}</span>
                    <span className="flex items-center gap-1.5 text-[11px]">
                      {sec.create > 0 && <span className="text-emerald-400">+{sec.create}</span>}
                      {sec.update > 0 && <span className="text-sky-400">✎{sec.update}</span>}
                      {sec.delete > 0 && <span className="text-red-400">−{sec.delete}</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* الفريق */}
          <div>
            <p className="text-[12px] font-bold text-muted-foreground mb-1.5 flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> ماذا عمل كل عضو · اضغط للتفاصيل</p>
            {s.members.length === 0 ? (
              <p className="text-[12px] text-muted-foreground text-center py-4 rounded-xl bg-white/[0.02] border border-white/[0.05]">لا يوجد أي نشاط مسجّل في هذا اليوم</p>
            ) : (
              <div className="space-y-1.5">
                {s.members.map(m => {
                  const open = openMember === m.name;
                  const timeline = [
                    ...m.logs.map(l => ({ at: l.created_at, kind: "log" as const, l })),
                    ...m.notes.map(n => ({ at: n.created_at, kind: "note" as const, n })),
                  ].sort((a, b) => b.at.localeCompare(a.at));
                  return (
                    <div key={m.name} className="rounded-lg bg-white/[0.02] border border-white/[0.06]">
                      <button onClick={() => setOpenMember(open ? null : m.name)} className="w-full flex items-center gap-2 px-3 py-2 text-right">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[13px] font-bold text-foreground">{m.name}</span>
                            <span className="text-[11px] text-violet-300">{m.logs.length} عملية</span>
                            {m.notes.length > 0 && <span className="text-[11px] text-amber-300">· {m.notes.length} ملاحظة</span>}
                            {m.closedDeals > 0 && <span className="text-[11px] text-emerald-400">· {m.closedDeals} إغلاق ({formatMoneyFull(m.closedRevenue)})</span>}
                            {m.logins.length > 0 && <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">· <LogIn className="w-3 h-3" /> {m.logins.length}</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {m.sections.length > 0 ? m.sections.slice(0, 4).map(([sec, n]) => `${sec} ${n}`).join(" · ") : m.total === 0 ? "دخل المنصة بدون عمليات" : "ملاحظات متابعة فقط"}
                            {m.first && m.last && <> · من {timeOf(m.first)} إلى {timeOf(m.last)}</>}
                          </p>
                        </div>
                        {timeline.length > 0 && (open ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />)}
                      </button>
                      {open && timeline.length > 0 && (
                        <div className="border-t border-white/[0.05] px-3 py-2 space-y-1 max-h-64 overflow-y-auto">
                          {timeline.map((t, i) => {
                            if (t.kind === "note") {
                              return (
                                <div key={`n-${i}`} className="flex items-start gap-2 text-[12px]">
                                  <MessageCircle className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
                                  <span className="flex-1 min-w-0">
                                    <span className="text-muted-foreground">ملاحظة على {NOTE_TYPE_LABEL[t.n.entity_type] || ""} {t.n.entity_name}: </span>
                                    <span className="text-foreground">{t.n.note.length > 140 ? `${t.n.note.slice(0, 140)}…` : t.n.note}</span>
                                  </span>
                                  <span className="text-[11px] text-muted-foreground shrink-0">{timeOf(t.at)}</span>
                                </div>
                              );
                            }
                            const Icon = ACTION_ICON[t.l.action] || Pencil;
                            return (
                              <div key={`l-${i}`} className="flex items-start gap-2 text-[12px]">
                                <Icon className={`w-3 h-3 mt-0.5 shrink-0 ${ACTION_COLOR[t.l.action] || "text-muted-foreground"}`} />
                                <span className="flex-1 min-w-0 truncate">
                                  <span className="text-muted-foreground">{ACTION_LABEL[t.l.action]} · {t.l.section_label}</span>
                                  {t.l.entity_title && <span className="text-foreground"> — {t.l.entity_title}</span>}
                                  {t.l.details && <span className="text-muted-foreground"> · {t.l.details}</span>}
                                </span>
                                <span className="text-[11px] text-muted-foreground shrink-0">{timeOf(t.at)}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* بدون نشاط */}
          {s.absent.length > 0 && (
            <div className="rounded-xl bg-red-500/[0.04] border border-red-500/15 p-3">
              <p className="text-[12px] font-bold text-red-300 mb-1.5 flex items-center gap-1.5"><UserX className="w-3.5 h-3.5" /> بدون أي نشاط في المنصة ({s.absent.length})</p>
              <div className="flex flex-wrap gap-1.5">
                {s.absent.map(e => (
                  <span key={e.id} className="text-[11px] px-2 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-muted-foreground">{e.name}</span>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
