"use client";

// «قائمة الإجراءات»: للمدير كل البنود مع التنبيه/التحويل/التأجيل، وللموظف بنوده هو فقط. البنود الفعلية وراء رقم «تحتاج انتباه» (صفقات متقدمة بلا متابعة،
// تجديدات متأخرة، تذاكر مفتوحة) + عوائق الموظفين — في مكان واحد مع إجراء مباشر لكل بند.
import { useEffect, useMemo, useState } from "react";
import { fetchEmployees, updateDeal, updateRenewal, updateTicket, createFollowUpNote } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { todayLocal } from "@/lib/utils/format";
import { memberOf, type ActionItem, type ActionType } from "@/lib/huddle-kpis";
import { formatMoneyFull } from "@/lib/utils/format";
import { FollowUpLogButton } from "@/components/follow-up-log";
import { ClientProfilePanel } from "@/components/client-profile-panel";
import { Briefcase, RefreshCw, LifeBuoy, AlertOctagon, MessageCircle, UserRound, Megaphone, RotateCw, MoreHorizontal, PauseCircle, ArrowLeftRight, X } from "lucide-react";

/** تذكير آلي من «التذكيرات الآلية» (/api/ticket-followups) — للسوبر أدمن. */
export interface Nudge {
  id: string;
  ticket_id: string;
  ticket_number: number | null;
  title: string;
  assignee_name: string;
  body: string;
  status: "pending" | "approved" | "sending" | "sent" | "rejected" | "skipped";
  last_activity_at: string;
  send_at: string | null;
}

export interface Blocker {
  member: string;
  text: string;
}

const TYPE_META: Record<ActionType, { label: string; plural: string; icon: typeof Briefcase; color: string }> = {
  deal: { label: "صفقة", plural: "صفقات", icon: Briefcase, color: "text-violet-400 bg-violet-500/10 border-violet-500/20" },
  renewal: { label: "تجديد", plural: "تجديدات", icon: RefreshCw, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  ticket: { label: "تذكرة", plural: "تذاكر", icon: LifeBuoy, color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20" },
};

const PAGE = 15;

/** مفتاح البند في سجل التأجيل */
export const actionKey = (a: Pick<ActionItem, "type" | "id">) => `${a.type}:${a.id}`;

const addDaysLocal = (n: number) => {
  const d = new Date(`${todayLocal()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

const SNOOZE_OPTIONS = [
  { days: 1, label: "لبكرة" },
  { days: 3, label: "3 أيام" },
  { days: 7, label: "أسبوع" },
];

/** تحويل البند لموظف آخر + ملاحظة تلقائية للتوثيق (ما تنحسب متابعة). */
async function reassign(a: ActionItem, to: string, by: string) {
  if (a.type === "deal") await updateDeal(a.id, { assigned_rep_name: to });
  else if (a.type === "renewal") await updateRenewal(a.id, { assigned_rep: to });
  else await updateTicket(a.id, { assigned_agent_name: to });
  await createFollowUpNote(a.type, a.id, `📝 تحديث تلقائي:\nالمسؤول: ${a.owner || "—"} ← ${to} (تحويل من المتابعة اليومية)`, by).catch(console.error);
}

function sanitizePhone(raw: string): string {
  let p = (raw || "").replace(/[^\d+]/g, "");
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("05") || p.startsWith("5")) p = "+966" + p.replace(/^0/, "");
  return p.replace(/^\+/, "");
}
const waLink = (phone: string, msg: string) => `https://wa.me/${sanitizePhone(phone)}?text=${encodeURIComponent(msg)}`;

const idleLabel = (a: ActionItem) =>
  a.type === "ticket" ? (a.idleDays ? `مفتوحة من ${a.idleDays} يوم` : "فُتحت اليوم") : a.idleDays ? `بلا متابعة ${a.idleDays} يوم` : "اليوم";

function itemLine(a: ActionItem): string {
  if (a.type === "ticket") return `تذكرة ${a.ticketNumber ? `#${a.ticketNumber} ` : ""}${a.client} (${a.status}${a.priority ? ` · ${a.priority}` : ""})`;
  return `${a.client} — ${a.status}${a.value ? ` · ${formatMoneyFull(a.value)}` : ""} (${a.idleDays} يوم)`;
}

function pingMessage(a: ActionItem): string {
  const first = a.owner.trim().split(/\s+/)[0];
  if (a.type === "ticket") return `${first}، تذكرة ${a.client}${a.ticketNumber ? ` #${a.ticketNumber}` : ""} مفتوحة من ${a.idleDays} يوم — وش وضعها؟ حدّث سجل المتابعة لو سمحت.`;
  return `${first}، ${a.type === "deal" ? "صفقة" : "تجديد"} ${a.client} (${a.status}) بلا متابعة من ${a.idleDays} يوم — تواصل اليوم وسجّل ملاحظة في سجل المتابعة.`;
}

export function ActionQueue({
  actions,
  blockers,
  members,
  isPastDate,
  onRefresh,
  refreshing,
  isManager,
  snoozed,
  onSnooze,
  defaultMember,
  nudges = [],
  onNudge,
}: {
  actions: ActionItem[];
  blockers: Blocker[];
  members: string[];
  isPastDate: boolean;
  onRefresh: () => void;
  refreshing: boolean;
  /** التحويل والتأجيل للمدير فقط */
  isManager: boolean;
  /** البنود المؤجلة حالياً مع تاريخ رجوعها */
  snoozed: { item: ActionItem; until: string }[];
  onSnooze: (key: string, until: string | null) => Promise<void>;
  /** الموظف: القائمة تفتح على بنوده هو */
  defaultMember?: string;
  /** التذكيرات الآلية (للسوبر أدمن): المعلّقة تنعرض للاعتماد، والمجدولة تظهر كشارة على البند */
  nudges?: Nudge[];
  onNudge?: (payload: { action: "approve"; items: { id: string; body: string }[] } | { action: "reject"; ids: string[] }) => Promise<void>;
}) {
  const { user } = useAuth();
  const [menu, setMenu] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showSnoozed, setShowSnoozed] = useState(false);
  const [staff, setStaff] = useState<string[]>([]);
  const [type, setType] = useState<ActionType | "all" | "nudge">("all");
  const [member, setMember] = useState<string | "all">(defaultMember ?? "all");
  useEffect(() => { if (defaultMember) setMember(defaultMember); }, [defaultMember]);
  const [limit, setLimit] = useState(PAGE);
  const [profile, setProfile] = useState<string | null>(null);
  const [phones, setPhones] = useState<Map<string, string>>(new Map());

  // جوال كل موظف — للتنبيه بالواتساب من القائمة مباشرة
  useEffect(() => {
    fetchEmployees()
      .then((emps) => {
        const m = new Map<string, string>();
        for (const e of emps) if (e.name && e.phone) m.set(e.name.trim().split(/\s+/)[0].toLowerCase(), e.phone);
        setPhones(m);
        // الموظفين النشطين (لو ما فيه حالة «نشط» مسجلة نعرض الكل)
        const named = emps.filter((e) => e.name?.trim());
        const active = named.filter((e) => e.status === "نشط");
        setStaff([...new Set((active.length ? active : named).map((e) => e.name.trim()))].sort((a, b) => a.localeCompare(b, "ar")));
      })
      .catch(() => undefined);
  }, []);
  const phoneOf = (name: string) => phones.get(name.trim().split(/\s+/)[0].toLowerCase()) ?? null;

  useEffect(() => setLimit(PAGE), [type, member]);

  const byMember = useMemo(() => actions.filter((a) => member === "all" || a.member === member), [actions, member]);
  const filtered = useMemo(() => byMember.filter((a) => type === "all" || a.type === type), [byMember, type]);
  const shownBlockers = blockers.filter((b) => member === "all" || b.member === member);
  const countOf = (t: ActionType) => byMember.filter((a) => a.type === t).length;
  const memberCount = (m: string) => actions.filter((a) => a.member === m).length + blockers.filter((b) => b.member === m).length;

  // التذكيرات الآلية: المعلّقة (حسب فلتر الموظف) + خريطة البند ← حالة تذكيره عشان ما ننبّه مرتين
  const pendingNudges = nudges.filter((n) => n.status === "pending" && (member === "all" || memberOf(n.assignee_name) === member));
  const nudgeOf = useMemo(() => {
    const m = new Map<string, Nudge["status"]>();
    for (const n of nudges) if (n.status === "pending" || n.status === "approved" || n.status === "sending") m.set(n.ticket_id, n.status);
    return m;
  }, [nudges]);
  const decideNudges = async (key: string, payload: Parameters<NonNullable<typeof onNudge>>[0]) => {
    if (!onNudge) return;
    setBusy(key);
    setActionError(null);
    try {
      await onNudge(payload);
    } catch (e) {
      console.error(e);
      setActionError(e instanceof Error ? e.message : "تعذّر تنفيذ الإجراء");
    } finally {
      setBusy(null);
    }
  };

  // تنبيه جماعي: رسالة واحدة للموظف فيها كل بنوده (حسب الفلتر الحالي)
  const bulk = useMemo(() => {
    if (member === "all" || !filtered.length) return null;
    // كرت عواطف يجمع أكثر من شخص — نرسل لكل مسؤول بنوده هو فقط
    const owners = new Map<string, ActionItem[]>();
    for (const a of filtered) {
      const k = a.owner.trim().split(/\s+/)[0];
      owners.set(k, [...(owners.get(k) ?? []), a]);
    }
    return [...owners.entries()].map(([owner, items]) => {
      const lines = items.slice(0, 25).map((a, i) => `${i + 1}. ${itemLine(a)}`);
      if (items.length > 25) lines.push(`… و${items.length - 25} بنود أخرى`);
      return {
        owner,
        count: items.length,
        phone: phoneOf(owner),
        msg: `${owner}، هذي بنودك اللي تحتاج متابعة اليوم (${items.length}):\n${lines.join("\n")}\n\nسجّل ملاحظة في «سجل المتابعة» لكل واحد بعد التواصل 🙏`,
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, member, phones]);

  // الموظف يشوف بنوده هو فقط — بدون فلتر الموظفين وأزرار «نبّه» (تنبيه الموظفين شغل المدير)
  const ownView = !isManager && !!defaultMember;
  const total = ownView ? memberCount(defaultMember) : actions.length + blockers.length;

  return (
    <div className="cc-card rounded-2xl p-4 border border-red-500/20 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <AlertOctagon className="w-4 h-4 text-red-400 shrink-0" />
          <h2 className="text-sm font-bold text-foreground">{ownView ? "بنودي اللي تحتاج متابعة" : "قائمة الإجراءات"}</h2>
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${total ? "bg-red-500/15 text-red-400" : "bg-emerald-500/15 text-emerald-400"}`}>{total}</span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> تحديث
        </button>
      </div>
      {isPastDate && (
        <p className="text-[11px] text-amber-400">القائمة لقطة «الآن» دائماً — ما تتغير بتغيير التاريخ.</p>
      )}

      {/* فلتر الموظف — للمدير فقط */}
      {!ownView && (
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {["all", ...members].map((m) => {
          const c = m === "all" ? total : memberCount(m);
          return (
            <button
              key={m}
              type="button"
              onClick={() => setMember(m)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold border transition-all ${
                member === m ? "bg-violet-500/15 text-violet-300 border-violet-500/30" : "bg-white/[0.03] text-muted-foreground border-white/[0.06]"
              }`}
            >
              {m === "all" ? "الكل" : m}
              <span className={`mr-1 ${c ? "text-red-400" : "text-emerald-400"}`}>{c}</span>
            </button>
          );
        })}
      </div>
      )}

      {/* فلتر النوع */}
      <div className="flex gap-1.5 flex-wrap">
        {(["all", "deal", "renewal", "ticket"] as const).map((t) => {
          const c = t === "all" ? byMember.length : countOf(t);
          if (t !== "all" && !c) return null;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`rounded-lg px-2.5 py-1 text-[11px] border ${
                type === t ? "bg-white/[0.08] text-foreground border-white/[0.15]" : "bg-transparent text-muted-foreground border-white/[0.06]"
              }`}
            >
              {t === "all" ? "كل الأنواع" : TYPE_META[t].plural} · {c}
            </button>
          );
        })}
        {pendingNudges.length > 0 && (
          <button
            type="button"
            onClick={() => setType("nudge")}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border ${
              type === "nudge" ? "bg-orange-500/20 text-orange-300 border-orange-500/40" : "bg-orange-500/10 text-orange-400 border-orange-500/25"
            }`}
          >
            📨 تذكيرات بانتظار موافقتك · {pendingNudges.length}
          </button>
        )}
      </div>

      {/* تنبيه جماعي — للمدير فقط */}
      {isManager && bulk && bulk.map((b) => (
        <a
          key={b.owner}
          href={b.phone ? waLink(b.phone, b.msg) : undefined}
          target="_blank"
          rel="noreferrer"
          aria-disabled={!b.phone}
          className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold border ${
            b.phone ? "bg-green-500/10 text-green-400 border-green-500/25 hover:bg-green-500/20" : "bg-white/[0.03] text-muted-foreground border-white/[0.06] pointer-events-none"
          }`}
        >
          <Megaphone className="w-3.5 h-3.5" />
          {b.phone ? `نبّه ${b.owner} بكل بنوده (${b.count}) في رسالة واحدة` : `${b.owner}: لا يوجد رقم جوال في الموظفين`}
        </a>
      ))}

      {/* العوائق */}
      {shownBlockers.map((b) => (
        <div key={b.member} className="rounded-xl border border-red-500/30 bg-red-500/[0.06] p-3">
          <div className="text-[11px] font-bold text-red-400">عائق · {b.member}</div>
          <div className="text-sm text-foreground mt-0.5 break-words">{b.text}</div>
        </div>
      ))}

      {/* التذكيرات الآلية بانتظار الموافقة */}
      {type === "nudge" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-muted-foreground">تعليق باسمك فيه منشن للموظف — ينرسل في وقت طبيعي داخل الدوام بعد الاعتماد.</p>
            {pendingNudges.length > 1 && (
              <button
                type="button"
                disabled={busy === "nudge-all"}
                onClick={() => decideNudges("nudge-all", { action: "approve", items: pendingNudges.map((n) => ({ id: n.id, body: n.body })) })}
                className="shrink-0 rounded-lg bg-emerald-500/15 px-3 h-8 text-xs font-bold text-emerald-400 disabled:opacity-50"
              >
                اعتماد الكل ({pendingNudges.length})
              </button>
            )}
          </div>
          {actionError && <div className="text-[11px] text-red-400">{actionError}</div>}
          {pendingNudges.length === 0 && <div className="text-center text-sm text-emerald-400 py-6">ما فيه تذكيرات معلّقة 🎯</div>}
          {pendingNudges.map((n) => {
            const days = Math.max(0, Math.floor((Date.now() - new Date(n.last_activity_at).getTime()) / 86400000));
            return (
              <div key={n.id} className="rounded-xl border border-orange-500/20 bg-white/[0.02] p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-bold text-foreground">{n.ticket_number ? `#${n.ticket_number} ` : ""}{n.title || "—"}</span>
                  <span className="text-[11px] text-muted-foreground">· {n.assignee_name} · ساكت من {days} يوم</span>
                </div>
                <div className="rounded-lg bg-white/[0.03] border border-white/[0.05] px-2.5 py-1.5 text-[12px] text-foreground/80 whitespace-pre-line line-clamp-4">{n.body}</div>
                <div className="flex justify-end gap-1.5">
                  <button
                    type="button"
                    disabled={busy === n.id}
                    onClick={() => decideNudges(n.id, { action: "reject", ids: [n.id] })}
                    className="h-8 rounded-lg border border-white/[0.08] px-3 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    رفض
                  </button>
                  <button
                    type="button"
                    disabled={busy === n.id}
                    onClick={() => decideNudges(n.id, { action: "approve", items: [{ id: n.id, body: n.body }] })}
                    className="h-8 rounded-lg bg-emerald-500/15 px-3 text-xs font-bold text-emerald-400 disabled:opacity-50"
                  >
                    اعتماد
                  </button>
                </div>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">لتعديل نص التذكير قبل الإرسال أو مراجعة المجدول: تبويب «التذكيرات الآلية» تحت «المزيد».</p>
        </div>
      ) : /* البنود */
      filtered.length === 0 && shownBlockers.length === 0 ? (
        <div className="text-center text-sm text-emerald-400 py-6">ما فيه شي معلّق هنا 🎯</div>
      ) : (
        <div className="space-y-2">
          {filtered.slice(0, limit).map((a) => {
            const meta = TYPE_META[a.type];
            const Icon = meta.icon;
            const repPhone = phoneOf(a.owner);
            const ownerFirst = a.owner.trim().split(/\s+/)[0];
            // كرت عواطف يجمع عواطف + هنا — نوضح المسؤول الفعلي لو يختلف عن اسم الكرت
            const showOwner = ownerFirst !== a.member && memberOf(ownerFirst) === a.member && ownerFirst.toLowerCase() !== "manal";
            return (
              <div
                key={`${a.type}-${a.id}`}
                className={`rounded-xl border bg-white/[0.02] p-3 ${a.rank === 0 ? "border-red-500/30" : "border-white/[0.06]"}`}
              >
                <div className="flex items-start gap-2">
                  <div className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${meta.color}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-foreground truncate max-w-full">{a.client}</span>
                      {a.ticketNumber ? <span className="text-[10px] text-muted-foreground">#{a.ticketNumber}</span> : null}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/[0.06] text-muted-foreground">{a.status}</span>
                      {nudgeOf.get(a.id) && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-orange-500/10 text-orange-400" title="لا تنبّه مرتين — فيه تذكير آلي لهذا البند">
                          📨 {nudgeOf.get(a.id) === "pending" ? "تذكير آلي بانتظار موافقتك" : "تذكير آلي مجدول"}
                        </span>
                      )}
                      {a.priority && a.priority !== "عادي" && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-red-500/15 text-red-400">{a.priority}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                      <span className="font-semibold text-foreground/80">{a.member}{showOwner ? ` (${ownerFirst})` : ""}</span>
                      <span className={a.idleDays >= 7 ? "text-red-400" : a.idleDays >= 3 ? "text-amber-400" : ""}>{idleLabel(a)}</span>
                      {a.value > 0 && <span className="tabular-nums">{formatMoneyFull(a.value)}</span>}
                    </div>
                    {a.detail && <div className="text-[11px] text-muted-foreground mt-1 line-clamp-1">{a.detail}</div>}
                    {a.lastNote && (
                      <div className="text-[11px] text-muted-foreground/80 mt-1 line-clamp-2 border-r-2 border-white/10 pr-2">
                        <span className="text-foreground/70">{a.lastNote.author?.split(/\s+/)[0] ?? ""}:</span> {a.lastNote.text}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setProfile(a.phone || a.client)}
                    title="ملف العميل"
                    className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-foreground hover:bg-white/[0.08]"
                  >
                    <UserRound className="w-3.5 h-3.5" /> الملف
                  </button>
                  <div className="flex items-center h-8 px-1 rounded-lg bg-amber-500/10 border border-amber-500/20" title="سجل المتابعة — أضف ملاحظة">
                    <FollowUpLogButton entityType={a.type} entityId={a.id} entityName={a.client} />
                  </div>
                  {!isManager ? null : repPhone ? (
                    <a
                      href={waLink(repPhone, pingMessage(a))}
                      target="_blank"
                      rel="noreferrer"
                      title={`نبّه ${ownerFirst} بالواتساب`}
                      className="flex items-center gap-1 h-8 px-2.5 rounded-lg bg-green-500/10 border border-green-500/20 text-[11px] text-green-400 hover:bg-green-500/20"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> نبّه {ownerFirst}
                    </a>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/60 px-1">لا رقم للموظف</span>
                  )}
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => { setMenu(menu === actionKey(a) ? null : actionKey(a)); setActionError(null); }}
                      title="تحويل / تأجيل"
                      className={`flex items-center justify-center h-8 w-8 rounded-lg border ${menu === actionKey(a) ? "bg-white/[0.1] border-white/[0.2]" : "bg-white/[0.04] border-white/[0.08]"} text-muted-foreground hover:text-foreground`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {isManager && menu === actionKey(a) && (
                  <div className="mt-2 rounded-xl border border-white/[0.08] bg-black/20 p-3 space-y-3">
                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
                        <ArrowLeftRight className="w-3.5 h-3.5" /> تحويل لموظف آخر
                      </div>
                      <select
                        defaultValue=""
                        disabled={busy === actionKey(a)}
                        onChange={async (ev) => {
                          const to = ev.target.value;
                          if (!to || to === a.owner.trim()) return;
                          if (!window.confirm(`تحويل «${a.client}» من ${a.owner || "—"} إلى ${to}؟`)) { ev.target.value = ""; return; }
                          setBusy(actionKey(a));
                          setActionError(null);
                          try {
                            await reassign(a, to, user?.name || "المدير");
                            setMenu(null);
                            onRefresh();
                          } catch (e) {
                            console.error(e);
                            setActionError("تعذّر التحويل — حاول مرة ثانية");
                          } finally {
                            setBusy(null);
                          }
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-foreground"
                      >
                        <option value="">اختر الموظف…</option>
                        {staff.filter((n) => n !== a.owner.trim()).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                    <div>
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground mb-1.5">
                        <PauseCircle className="w-3.5 h-3.5" /> تأجيل (يختفي من القائمة والعدّاد ويرجع تلقائياً)
                      </div>
                      <div className="flex gap-1.5">
                        {SNOOZE_OPTIONS.map((o) => (
                          <button
                            key={o.days}
                            type="button"
                            disabled={busy === actionKey(a)}
                            onClick={async () => {
                              setBusy(actionKey(a));
                              setActionError(null);
                              try {
                                await onSnooze(actionKey(a), addDaysLocal(o.days));
                                setMenu(null);
                              } catch (e) {
                                console.error(e);
                                setActionError("تعذّر التأجيل — حاول مرة ثانية");
                              } finally {
                                setBusy(null);
                              }
                            }}
                            className="flex-1 h-8 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-foreground hover:bg-white/[0.08] disabled:opacity-50"
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {actionError && <div className="text-[11px] text-red-400">{actionError}</div>}
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length > limit && (
            <button
              type="button"
              onClick={() => setLimit((l) => l + PAGE)}
              className="w-full rounded-xl py-2 text-xs text-muted-foreground border border-white/[0.06] hover:text-foreground"
            >
              عرض المزيد ({filtered.length - limit})
            </button>
          )}
        </div>
      )}

      {/* البنود المؤجلة */}
      {snoozed.length > 0 && (
        <div className="border-t border-white/[0.06] pt-3">
          <button type="button" onClick={() => setShowSnoozed((v) => !v)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            <PauseCircle className="w-3.5 h-3.5" /> مؤجلة ({snoozed.length}) {showSnoozed ? "▴" : "▾"}
          </button>
          {showSnoozed && (
            <div className="space-y-1.5 mt-2">
              {snoozed.map(({ item: a, until }) => (
                <div key={actionKey(a)} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.02] border border-white/[0.06] px-3 py-2">
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-foreground">{a.client}</span>
                    <span className="text-muted-foreground"> · {TYPE_META[a.type].label} · {a.member} · ترجع <span dir="ltr">{until.slice(5).split("-").reverse().join("/")}</span></span>
                  </div>
                  {isManager && (
                    <button
                      type="button"
                      onClick={() => onSnooze(actionKey(a), null).catch(console.error)}
                      title="إلغاء التأجيل"
                      className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" /> إلغاء
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <ClientProfilePanel open={profile !== null} onClose={() => setProfile(null)} initialQuery={profile ?? undefined} />
    </div>
  );
}
