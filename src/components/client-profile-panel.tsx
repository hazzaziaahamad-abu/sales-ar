"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchClientProfile, fetchClientBio, upsertClientBio, upsertClientMenuUrl, upsertClientPhoneVerified, upsertClientSecondaryPhone, upsertClientPhoneData, fetchDealKpiStages, upsertDealKpiStage, createDealKpiStages, fetchEmployees, fetchUserProfiles, KPI_STAGES, updateDeal, createFollowUpNote, createMentionNotification, createReminder, type ClientProfileData } from "@/lib/supabase/db";
import { getTopContributor } from "@/components/sales/SalesKPIDashboard";
import { FollowUpLogButton } from "@/components/follow-up-log";
import { useAuth } from "@/lib/auth-context";
import { Search, Phone, User, ShoppingBag, RefreshCw, Headphones, FileText, ChevronDown, ChevronUp, Clock, X, Pencil, Check, StickyNote, BarChart2, Trophy, MessageSquarePlus, Send, AtSign, Bell, BellOff, CalendarClock, ShieldCheck, ShieldOff, Plus, PhoneCall } from "lucide-react";
import type { Deal, Renewal, Ticket, FollowUpNote, DealKpiStage, Employee } from "@/types";

const STAGE_COLORS: Record<string, string> = {
  "مكتملة": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "قيد التواصل": "bg-sky-500/15 text-sky-400 border-sky-500/20",
  "عرض سعر": "bg-violet-500/15 text-violet-400 border-violet-500/20",
  "تفاوض": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "انتظار الدفع": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "مرفوض مع سبب": "bg-red-500/15 text-red-400 border-red-500/20",
};

const RENEWAL_COLORS: Record<string, string> = {
  "مكتمل": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "مجدول": "bg-sky-500/15 text-sky-400 border-sky-500/20",
  "مجدول تجديد": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "جاري المتابعة": "bg-amber-500/15 text-amber-400 border-amber-500/20",
  "انتظار الدفع": "bg-orange-500/15 text-orange-400 border-orange-500/20",
  "ملغي بسبب": "bg-red-500/15 text-red-400 border-red-500/20",
};

const TICKET_COLORS: Record<string, string> = {
  "محلول": "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  "مفتوح": "bg-red-500/15 text-red-400 border-red-500/20",
  "قيد المعالجة": "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

function formatDate(d: string) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "short", day: "numeric" });
}

function formatMoney(n: number) {
  return n.toLocaleString() + " ر.س";
}

function StatusBadge({ label, colorMap }: { label: string; colorMap: Record<string, string> }) {
  const cls = colorMap[label] || "bg-white/5 text-muted-foreground border-white/10";
  return (
    <span className={`text-[12px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
      {label}
    </span>
  );
}

function SectionToggle({ title, icon, count, children }: { title: string; icon: React.ReactNode; count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-xs font-bold text-foreground">{title}</span>
          <span className="text-[12px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{count}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="p-2.5 space-y-2">{children}</div>}
    </div>
  );
}

function DealKpiSection({ deal, employees }: { deal: Deal; employees: Employee[] }) {
  const [stages, setStages] = useState<DealKpiStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let s = await fetchDealKpiStages(deal.id);
        if (s.length === 0) {
          s = await createDealKpiStages(deal.id);
        }
        if (!cancelled) setStages(s);
      } catch { /* ignore */ }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [deal.id]);

  const saveStage = async (stageNum: number, empId: string, empName: string) => {
    setSaving(true);
    try {
      await upsertDealKpiStage(deal.id, stageNum, empId, empName);
      const updated = await fetchDealKpiStages(deal.id);
      setStages(updated);
      const allDone = KPI_STAGES.every(ks => updated.find(s => s.stage_number === ks.num && s.completed_at));
      if (allDone && deal.stage !== "مكتملة") {
        await updateDeal(deal.id, { stage: "مكتملة", close_date: new Date().toISOString() });
      }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const completedCount = stages.filter(s => s.completed_at).length;
  const topContrib = getTopContributor(stages);

  if (loading) return <div className="text-[11px] text-muted-foreground py-1">جاري تحميل المراحل...</div>;

  return (
    <div className="space-y-1.5 pt-1 border-t border-border/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <BarChart2 className="w-3 h-3 text-orange-400" />
          <span className="text-[11px] font-bold text-foreground">مراحل KPI</span>
        </div>
        <span className="text-[11px] text-muted-foreground">{completedCount}/5</span>
      </div>
      {topContrib && (
        <div className="flex items-center gap-1 px-1.5 py-1 rounded-md bg-amber-500/10 border border-amber-500/20">
          <Trophy className="w-3 h-3 text-amber-400" />
          <span className="text-[11px] font-semibold text-amber-400">
            مسجّلة باسم: {topContrib.name} ({topContrib.totalWeight}%)
          </span>
        </div>
      )}
      <div className="flex gap-0.5">
        {KPI_STAGES.map(ks => {
          const done = stages.find(s => s.stage_number === ks.num && s.completed_at);
          return <div key={ks.num} className={`flex-1 h-1 rounded-full ${done ? "bg-orange-400" : "bg-white/10"}`} />;
        })}
      </div>
      <div className="space-y-1">
        {KPI_STAGES.map(ks => {
          const stage = stages.find(s => s.stage_number === ks.num);
          const done = !!stage?.completed_at;
          return (
            <div key={ks.num} className={`flex items-center gap-1.5 rounded-md px-1.5 py-1 ${done ? "bg-orange-500/5" : ""}`}>
              <span className={`text-[11px] font-semibold min-w-[70px] ${done ? "text-orange-400" : "text-muted-foreground"}`}>
                {done && "✓ "}{ks.name}
              </span>
              <span className="text-[10px] text-muted-foreground/60">{ks.weight}%</span>
              <select
                value={stage?.assigned_to || ""}
                onChange={e => {
                  const emp = employees.find(em => em.id === e.target.value);
                  if (emp) saveStage(ks.num, emp.id, emp.name);
                }}
                disabled={saving}
                className="flex-1 text-[11px] bg-transparent border border-border/30 rounded px-1 py-0.5 text-foreground focus:outline-none focus:ring-1 focus:ring-orange-500/50 disabled:opacity-50"
              >
                <option value="">— موظف —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.name}</option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DealCard({ deal, notes, employees }: { deal: Deal; notes: FollowUpNote[]; employees: Employee[] }) {
  const [showNotes, setShowNotes] = useState(false);
  const [showKpi, setShowKpi] = useState(false);
  const dealNotes = notes.filter(n => n.entity_type === "deal" && n.entity_id === deal.id);
  const isSupport = deal.sales_type === "support";
  return (
    <div className="rounded-lg border border-border/40 bg-card/50 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge label={deal.stage} colorMap={STAGE_COLORS} />
        <div className="flex items-center gap-1.5">
          <FollowUpLogButton entityType="deal" entityId={deal.id} entityName={deal.client_name} />
          <span className="text-[12px] text-muted-foreground">{formatDate(deal.created_at)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{isSupport ? "دعم" : "مكتب"} · {deal.plan || "—"}</span>
        <span className="text-xs font-bold text-emerald-400">{formatMoney(deal.deal_value)}</span>
      </div>
      {deal.assigned_rep_name && (
        <p className="text-[12px] text-muted-foreground">المندوب: {deal.assigned_rep_name}</p>
      )}
      {deal.source && (
        <p className="text-[12px] text-muted-foreground">المصدر: {deal.source}</p>
      )}
      {deal.close_date && (
        <p className="text-[12px] text-muted-foreground">تاريخ الإغلاق: {formatDate(deal.close_date)}</p>
      )}
      {deal.loss_reason && (
        <p className="text-[12px] text-red-400">سبب الرفض: {deal.loss_reason}</p>
      )}
      {deal.notes && (
        <p className="text-[12px] text-muted-foreground/70 line-clamp-2">{deal.notes}</p>
      )}
      {isSupport && (
        <button onClick={() => setShowKpi(!showKpi)} className="text-[12px] text-orange-400 hover:underline flex items-center gap-1">
          <BarChart2 className="w-3 h-3" /> {showKpi ? "إخفاء" : "عرض"} مراحل KPI
        </button>
      )}
      {showKpi && isSupport && <DealKpiSection deal={deal} employees={employees} />}
      {dealNotes.length > 0 && (
        <>
          <button onClick={() => setShowNotes(!showNotes)} className="text-[12px] text-primary hover:underline flex items-center gap-1">
            <FileText className="w-3 h-3" /> {dealNotes.length} متابعة
          </button>
          {showNotes && (
            <div className="space-y-1 mr-2 border-r-2 border-primary/20 pr-2">
              {dealNotes.map(n => (
                <div key={n.id} className="text-[12px]">
                  <span className="text-muted-foreground">{formatDate(n.created_at)}</span>
                  <span className="text-foreground/70 mr-1">— {n.author_name}:</span>
                  <span className="text-foreground/60">{n.note}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RenewalCard({ renewal, notes }: { renewal: Renewal; notes: FollowUpNote[] }) {
  const [showNotes, setShowNotes] = useState(false);
  const renewalNotes = notes.filter(n => n.entity_type === "renewal" && n.entity_id === renewal.id);
  return (
    <div className="rounded-lg border border-border/40 bg-card/50 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge label={renewal.status} colorMap={RENEWAL_COLORS} />
        <div className="flex items-center gap-1.5">
          <FollowUpLogButton entityType="renewal" entityId={renewal.id} entityName={renewal.customer_name} />
          <span className="text-[12px] text-muted-foreground">{formatDate(renewal.renewal_date)}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{renewal.plan_name}</span>
        <span className="text-xs font-bold text-emerald-400">{formatMoney(renewal.plan_price)}</span>
      </div>
      {renewal.assigned_rep && (
        <p className="text-[12px] text-muted-foreground">المسؤول: {renewal.assigned_rep}</p>
      )}
      {renewal.payment_date && (
        <p className="text-[12px] text-emerald-400/70">تاريخ الدفع: {formatDate(renewal.payment_date)}</p>
      )}
      {renewal.cancel_reason && (
        <p className="text-[12px] text-red-400">سبب الإلغاء: {renewal.cancel_reason}</p>
      )}
      {renewal.notes && (
        <p className="text-[12px] text-muted-foreground/70 line-clamp-2">{renewal.notes}</p>
      )}
      {renewalNotes.length > 0 && (
        <>
          <button onClick={() => setShowNotes(!showNotes)} className="text-[12px] text-primary hover:underline flex items-center gap-1">
            <FileText className="w-3 h-3" /> {renewalNotes.length} متابعة
          </button>
          {showNotes && (
            <div className="space-y-1 mr-2 border-r-2 border-primary/20 pr-2">
              {renewalNotes.map(n => (
                <div key={n.id} className="text-[12px]">
                  <span className="text-muted-foreground">{formatDate(n.created_at)}</span>
                  <span className="text-foreground/70 mr-1">— {n.author_name}:</span>
                  <span className="text-foreground/60">{n.note}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

const TICKET_TYPE_LABEL: Record<string, string> = {
  problem: "مشكلة",
  service: "خدمة",
};

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/50 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <StatusBadge label={ticket.status} colorMap={TICKET_COLORS} />
          {ticket.request_type && (
            <span className={`text-[11px] px-1.5 py-0.5 rounded-full border font-medium ${
              ticket.request_type === "problem"
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : "bg-sky-500/10 text-sky-400 border-sky-500/20"
            }`}>
              {TICKET_TYPE_LABEL[ticket.request_type] || ticket.request_type}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <FollowUpLogButton entityType="ticket" entityId={ticket.id} entityName={ticket.client_name} />
          <span className="text-[12px] text-muted-foreground">{formatDate(ticket.created_at)}</span>
        </div>
      </div>

      {ticket.ticket_number && (
        <p className="text-[11px] text-muted-foreground/60">رقم التذكرة: #{ticket.ticket_number}</p>
      )}

      <p className="text-xs text-foreground leading-relaxed">{ticket.issue}</p>

      {(ticket.issue_category || ticket.issue_subcategory) && (
        <p className="text-[12px] text-muted-foreground">
          {ticket.issue_category}{ticket.issue_subcategory ? ` ← ${ticket.issue_subcategory}` : ""}
        </p>
      )}

      <div className="flex items-center gap-3 text-[12px] text-muted-foreground flex-wrap">
        {ticket.priority && (
          <span className={`font-medium ${
            ticket.priority === "عاجل" ? "text-red-400" :
            ticket.priority === "عالي" ? "text-orange-400" :
            ticket.priority === "متوسط" ? "text-amber-400" : "text-muted-foreground"
          }`}>
            {ticket.priority}
          </span>
        )}
        {ticket.assigned_agent_name && <span>الفني: {ticket.assigned_agent_name}</span>}
        {ticket.due_date && <span className="text-orange-400/80">الاستحقاق: {formatDate(ticket.due_date)}</span>}
      </div>

      {ticket.resolved_date && (
        <p className="text-[12px] text-emerald-400/70">✓ تم الحل: {formatDate(ticket.resolved_date)}</p>
      )}
    </div>
  );
}

interface ClientProfilePanelProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
  highlightNoteId?: string; // scroll to & highlight a specific note
}

export function ClientProfilePanel({ open, onClose, initialQuery, highlightNoteId }: ClientProfilePanelProps) {
  const { user } = useAuth();
  const [search, setSearch] = useState(initialQuery || "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClientProfileData | null>(null);
  const [searched, setSearched] = useState(false);
  const [bio, setBio] = useState("");
  const [bioEditing, setBioEditing] = useState(false);
  const [bioDraft, setBioDraft] = useState("");
  const [bioSaving, setBioSaving] = useState(false);
  const [bioKey, setBioKey] = useState("");
  const [menuUrl, setMenuUrl] = useState("");
  const [menuUrlDraft, setMenuUrlDraft] = useState("");
  const [menuUrlEditing, setMenuUrlEditing] = useState(false);
  const [menuUrlSaving, setMenuUrlSaving] = useState(false);
  const [menuUrlCopied, setMenuUrlCopied] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneVerifiedSaving, setPhoneVerifiedSaving] = useState(false);
  const [secondaryPhone, setSecondaryPhone] = useState("");
  const [secondaryPhoneDraft, setSecondaryPhoneDraft] = useState("");
  const [secondaryPhoneEditing, setSecondaryPhoneEditing] = useState(false);
  const [secondaryPhoneSaving, setSecondaryPhoneSaving] = useState(false);
  const [secondaryPhoneError, setSecondaryPhoneError] = useState("");
  /* primary phone editing */
  const [primaryPhoneOverride, setPrimaryPhoneOverride] = useState("");
  const [primaryPhoneOverrideDraft, setPrimaryPhoneOverrideDraft] = useState("");
  const [primaryPhoneEditing, setPrimaryPhoneEditing] = useState(false);
  const [primaryPhoneSaving, setPrimaryPhoneSaving] = useState(false);
  /* phone comments */
  const [primaryPhoneComment, setPrimaryPhoneComment] = useState("");
  const [primaryPhoneCommentDraft, setPrimaryPhoneCommentDraft] = useState("");
  const [primaryPhoneCommentEditing, setPrimaryPhoneCommentEditing] = useState(false);
  const [primaryPhoneCommentSaving, setPrimaryPhoneCommentSaving] = useState(false);
  const [secondaryPhoneComment, setSecondaryPhoneComment] = useState("");
  const [secondaryPhoneCommentDraft, setSecondaryPhoneCommentDraft] = useState("");
  const [secondaryPhoneCommentEditing, setSecondaryPhoneCommentEditing] = useState(false);
  const [secondaryPhoneCommentSaving, setSecondaryPhoneCommentSaving] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [mentionNames, setMentionNames] = useState<string[]>([]);
  const [quickNote, setQuickNote] = useState("");
  const [quickNoteSaving, setQuickNoteSaving] = useState(false);
  const quickNoteRef = useRef<HTMLTextAreaElement>(null);
  /* @mention */
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1);
  /* reminder */
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [reminderDate, setReminderDate] = useState("");
  const [reminderTime, setReminderTime] = useState("");
  const [savingReminder, setSavingReminder] = useState(false);

  useEffect(() => {
    Promise.all([fetchEmployees(), fetchUserProfiles()]).then(([emps, profiles]) => {
      setEmployees(emps);
      const empNames = emps.map((e) => e.name);
      const profileNames = profiles.map((p) => p.name).filter(Boolean);
      setMentionNames([...new Set([...profileNames, ...empNames])]);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (initialQuery && open) {
      setSearch(initialQuery);
      doSearch(initialQuery);
    }
  }, [initialQuery, open]);

  const loadBio = useCallback(async (key: string) => {
    if (!key) return;
    setBioKey(key);
    try {
      const { bio: b, menuUrl: m, phoneVerified: pv, secondaryPhone: sp, primaryOverride: po, primaryComment: pc, secondaryComment: sc } = await fetchClientBio(key);
      setBio(b);
      setBioDraft(b);
      setMenuUrl(m);
      setMenuUrlDraft(m);
      setPhoneVerified(pv);
      setSecondaryPhone(sp);
      setSecondaryPhoneDraft(sp);
      setPrimaryPhoneOverride(po);
      setPrimaryPhoneOverrideDraft(po);
      setPrimaryPhoneComment(pc);
      setPrimaryPhoneCommentDraft(pc);
      setSecondaryPhoneComment(sc);
      setSecondaryPhoneCommentDraft(sc);
    } catch {
      setBio("");
      setBioDraft("");
      setMenuUrl("");
      setMenuUrlDraft("");
      setPhoneVerified(false);
      setSecondaryPhone("");
      setSecondaryPhoneDraft("");
      setPrimaryPhoneOverride("");
      setPrimaryPhoneOverrideDraft("");
      setPrimaryPhoneComment("");
      setPrimaryPhoneCommentDraft("");
      setSecondaryPhoneComment("");
      setSecondaryPhoneCommentDraft("");
    }
  }, []);

  const saveBio = useCallback(async () => {
    if (!bioKey) return;
    setBioSaving(true);
    try {
      await upsertClientBio(bioKey, bioDraft.trim(), user?.name);
      setBio(bioDraft.trim());
      setBioEditing(false);
    } catch {
      // silent
    } finally {
      setBioSaving(false);
    }
  }, [bioKey, bioDraft, user?.name]);

  const saveMenuUrl = useCallback(async () => {
    if (!bioKey) return;
    setMenuUrlSaving(true);
    try {
      await upsertClientMenuUrl(bioKey, menuUrlDraft.trim(), user?.name);
      setMenuUrl(menuUrlDraft.trim());
      setMenuUrlEditing(false);
    } catch {
      // silent
    } finally {
      setMenuUrlSaving(false);
    }
  }, [bioKey, menuUrlDraft, user?.name]);

  const togglePhoneVerified = useCallback(async () => {
    if (!bioKey) return;
    const next = !phoneVerified;
    setPhoneVerified(next);
    setPhoneVerifiedSaving(true);
    try {
      await upsertClientPhoneVerified(bioKey, next);
    } catch {
      setPhoneVerified(!next);
    } finally {
      setPhoneVerifiedSaving(false);
    }
  }, [bioKey, phoneVerified, user?.name]);

  const saveSecondaryPhone = useCallback(async () => {
    if (!bioKey) {
      setSecondaryPhoneError("تعذّر الحفظ — أعد البحث وحاول مجدداً");
      return;
    }
    setSecondaryPhoneSaving(true);
    setSecondaryPhoneError("");
    try {
      await upsertClientSecondaryPhone(bioKey, secondaryPhoneDraft.trim());
      setSecondaryPhone(secondaryPhoneDraft.trim());
      setSecondaryPhoneEditing(false);
    } catch (e) {
      console.error("saveSecondaryPhone error:", e);
      setSecondaryPhoneError("فشل الحفظ — تحقق من الاتصال أو صلاحيات قاعدة البيانات");
    } finally {
      setSecondaryPhoneSaving(false);
    }
  }, [bioKey, secondaryPhoneDraft, user?.name]);

  const savePrimaryPhoneOverride = useCallback(async () => {
    if (!bioKey) return;
    setPrimaryPhoneSaving(true);
    try {
      await upsertClientPhoneData(bioKey, { primaryOverride: primaryPhoneOverrideDraft.trim() });
      setPrimaryPhoneOverride(primaryPhoneOverrideDraft.trim());
      setPrimaryPhoneEditing(false);
    } catch {
      // silent
    } finally {
      setPrimaryPhoneSaving(false);
    }
  }, [bioKey, primaryPhoneOverrideDraft]);

  const savePrimaryPhoneComment = useCallback(async () => {
    if (!bioKey || primaryPhoneCommentDraft === primaryPhoneComment) { setPrimaryPhoneCommentEditing(false); return; }
    setPrimaryPhoneCommentSaving(true);
    try {
      await upsertClientPhoneData(bioKey, { primaryComment: primaryPhoneCommentDraft.trim() });
      setPrimaryPhoneComment(primaryPhoneCommentDraft.trim());
    } catch {
      // silent
    } finally {
      setPrimaryPhoneCommentSaving(false);
      setPrimaryPhoneCommentEditing(false);
    }
  }, [bioKey, primaryPhoneCommentDraft, primaryPhoneComment]);

  const saveSecondaryPhoneComment = useCallback(async () => {
    if (!bioKey || secondaryPhoneCommentDraft === secondaryPhoneComment) { setSecondaryPhoneCommentEditing(false); return; }
    setSecondaryPhoneCommentSaving(true);
    try {
      await upsertClientPhoneData(bioKey, { secondaryComment: secondaryPhoneCommentDraft.trim() });
      setSecondaryPhoneComment(secondaryPhoneCommentDraft.trim());
    } catch {
      // silent
    } finally {
      setSecondaryPhoneCommentSaving(false);
      setSecondaryPhoneCommentEditing(false);
    }
  }, [bioKey, secondaryPhoneCommentDraft, secondaryPhoneComment]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setBio("");
    setBioDraft("");
    setBioEditing(false);
    try {
      const result = await fetchClientProfile(q.trim());
      setData(result);
      const phone = result.deals[0]?.client_phone || result.renewals[0]?.customer_phone || result.tickets[0]?.client_phone || "";
      const name = result.deals[0]?.client_name || result.renewals[0]?.customer_name || result.tickets[0]?.client_name || "";
      const key = phone || name;
      if (key) loadBio(key);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [loadBio]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(search);
  };

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setSearch("");
      setData(null);
      setSearched(false);
      setBio("");
      setBioDraft("");
      setBioEditing(false);
      setBioKey("");
      setQuickNote("");
      setShowReminderPicker(false);
      setReminderDate("");
      setReminderTime("");
      setPrimaryPhoneOverride("");
      setPrimaryPhoneOverrideDraft("");
      setPrimaryPhoneEditing(false);
      setPrimaryPhoneComment("");
      setPrimaryPhoneCommentDraft("");
      setPrimaryPhoneCommentEditing(false);
      setSecondaryPhoneComment("");
      setSecondaryPhoneCommentDraft("");
      setSecondaryPhoneCommentEditing(false);
    }, 300);
  };

  const filteredEmployees = mentionNames.filter(name => !mentionFilter || name.includes(mentionFilter));

  const insertMention = useCallback((name: string) => {
    const ta = quickNoteRef.current;
    if (!ta || mentionStart === -1) return;
    const before = quickNote.slice(0, mentionStart);
    const after = quickNote.slice(ta.selectionStart);
    const next = before + `@${name} ` + after;
    setQuickNote(next);
    setShowMentions(false);
    setMentionFilter("");
    setMentionStart(-1);
    setTimeout(() => {
      ta.focus();
      const pos = before.length + name.length + 2;
      ta.setSelectionRange(pos, pos);
    }, 0);
  }, [quickNote, mentionStart]);

  function handleQuickNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setQuickNote(val);
    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);
    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && (atIdx === 0 || before[atIdx - 1] === " " || before[atIdx - 1] === "\n")) {
      const query = before.slice(atIdx + 1);
      if (!query.includes("\n")) {
        setMentionStart(atIdx);
        setMentionFilter(query);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  }

  function handleQuickNoteKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentions && filteredEmployees.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredEmployees.length - 1)); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filteredEmployees[mentionIndex]); return; }
      if (e.key === "Escape") { setShowMentions(false); return; }
    }
    if (e.key === "Enter" && e.ctrlKey) addQuickNote();
  }

  const addQuickNote = useCallback(async () => {
    if (!quickNote.trim() || !data) return;
    const activeDeal = data.deals.find(d => d.stage !== "مرفوض مع سبب") || data.deals[0];
    const activeRenewal = !activeDeal ? data.renewals[0] : null;
    const entityType = activeDeal ? "deal" : activeRenewal ? "renewal" : null;
    const entityId = activeDeal?.id || activeRenewal?.id;
    if (!entityType || !entityId) return;
    setQuickNoteSaving(true);
    try {
      const authorName = user?.name || user?.email || "مستخدم";
      const created = await createFollowUpNote(entityType, entityId, quickNote.trim(), authorName);
      setData(prev => prev ? { ...prev, notes: [created, ...prev.notes] } : prev);
      const entityName = activeDeal?.client_name || activeRenewal?.customer_name || "";
      const notified = new Set<string>();
      for (const name of mentionNames) {
        if (!quickNote.includes(`@${name}`)) continue;
        if (name === authorName) continue;
        if (notified.has(name)) continue;
        notified.add(name);
        createMentionNotification(created.id, entityType, entityId, entityName, name, authorName, quickNote.trim())
          .catch((err) => console.error("[mention] failed:", err));
      }
      setQuickNote("");
    } catch { /* silent */ } finally {
      setQuickNoteSaving(false);
    }
  }, [quickNote, data, user, employees]);

  async function saveQuickReminder() {
    if (!reminderDate || !reminderTime || !data) return;
    const activeDeal = data.deals.find(d => d.stage !== "مرفوض مع سبب") || data.deals[0];
    const activeRenewal = !activeDeal ? data.renewals[0] : null;
    const entityType = activeDeal ? "deal" : activeRenewal ? "renewal" : null;
    const entityId = activeDeal?.id || activeRenewal?.id;
    if (!entityType || !entityId) return;
    setSavingReminder(true);
    try {
      const authorName = user?.name || user?.email || "مستخدم";
      const entityName = activeDeal?.client_name || activeRenewal?.customer_name || "";
      await createReminder({
        entity_type: entityType,
        entity_id: entityId,
        entity_name: entityName,
        note_text: quickNote.trim() || undefined,
        remind_at: new Date(`${reminderDate}T${reminderTime}:00`).toISOString(),
        user_name: authorName,
      });
      setShowReminderPicker(false);
      setReminderDate("");
      setReminderTime("");
    } catch { /* silent */ } finally {
      setSavingReminder(false);
    }
  }

  const clientName = data?.deals[0]?.client_name || data?.renewals[0]?.customer_name || data?.tickets[0]?.client_name || "";
  const rawClientPhone = data?.deals[0]?.client_phone || data?.renewals[0]?.customer_phone || data?.tickets[0]?.client_phone || "";
  const clientPhone = primaryPhoneOverride || rawClientPhone;
  const currentPlan = data?.renewals?.find(r => r.status !== "ملغي بسبب")?.plan_name
    || data?.deals?.find(d => d.stage === "مكتملة")?.plan || "";

  const totalDeals = data?.deals.length || 0;
  const closedDeals = data?.deals.filter(d => d.stage === "مكتملة").length || 0;
  const totalRevenue = data?.deals.filter(d => d.stage === "مكتملة").reduce((s, d) => s + d.deal_value, 0) || 0;
  const renewalRevenue = data?.renewals.filter(r => r.status === "مكتمل").reduce((s, r) => s + r.plan_price, 0) || 0;
  const hasData = totalDeals > 0 || (data?.renewals.length || 0) > 0 || (data?.tickets.length || 0) > 0;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <SheetContent side="right" className="sm:max-w-md w-[95vw] overflow-y-auto p-0" showCloseButton={false}>
        {/* Header */}
        <SheetHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/50 p-3">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-sm font-bold">ملخص العميل</SheetTitle>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث باسم العميل أو رقم الجوال..."
                className="w-full pr-8 pl-3 py-2 text-xs rounded-lg border border-border/50 bg-muted/30 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                dir="rtl"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !search.trim()}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:brightness-110 disabled:opacity-50 transition-all"
            >
              {loading ? "..." : "بحث"}
            </button>
          </form>
        </SheetHeader>

        <div className="p-3 space-y-3">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!loading && searched && !hasData && (
            <div className="text-center py-12">
              <User className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لم يتم العثور على بيانات لهذا العميل</p>
            </div>
          )}

          {!loading && hasData && data && (
            <>
              {/* Client Info Card */}
              <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-3 space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{clientName}</p>
                    {(clientPhone || rawClientPhone) && (
                      <div className="mt-0.5 space-y-1">
                        {/* Primary phone */}
                        {primaryPhoneEditing ? (
                          <div className="flex items-center gap-1" dir="ltr">
                            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                            <input
                              type="tel"
                              value={primaryPhoneOverrideDraft}
                              onChange={(e) => setPrimaryPhoneOverrideDraft(e.target.value)}
                              placeholder={rawClientPhone || "رقم الجوال"}
                              className="text-xs bg-muted/30 border border-border/50 rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-primary/50"
                              autoFocus
                              onKeyDown={(e) => { if (e.key === "Enter") savePrimaryPhoneOverride(); if (e.key === "Escape") { setPrimaryPhoneEditing(false); setPrimaryPhoneOverrideDraft(primaryPhoneOverride); } }}
                            />
                            <button onClick={savePrimaryPhoneOverride} disabled={primaryPhoneSaving} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                              {primaryPhoneSaving ? <span className="text-[10px]">...</span> : <Check className="w-3 h-3" />}
                            </button>
                            <button onClick={() => { setPrimaryPhoneEditing(false); setPrimaryPhoneOverrideDraft(primaryPhoneOverride); }} className="text-muted-foreground hover:text-foreground">
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5" dir="ltr">
                            <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground">{clientPhone}</span>
                            <button
                              onClick={togglePhoneVerified}
                              disabled={phoneVerifiedSaving || !bioKey}
                              title={phoneVerified ? "تم التحقق من الرقم — اضغط لإلغاء التحقق" : "اضغط للتحقق من صحة الرقم"}
                              className={`shrink-0 transition-colors disabled:opacity-50 ${phoneVerified ? "text-emerald-400 hover:text-red-400" : "text-muted-foreground/40 hover:text-emerald-400"}`}
                            >
                              {phoneVerified ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldOff className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => { setPrimaryPhoneOverrideDraft(clientPhone); setPrimaryPhoneEditing(true); }}
                              disabled={!bioKey}
                              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors disabled:opacity-30"
                              title="تعديل الرقم"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        {/* Primary phone comment */}
                        {primaryPhoneCommentEditing ? (
                          <div className="flex items-center gap-1 pr-4">
                            <input
                              type="text"
                              value={primaryPhoneCommentDraft}
                              onChange={(e) => setPrimaryPhoneCommentDraft(e.target.value)}
                              placeholder="تعليق..."
                              className="text-[11px] bg-muted/30 border border-border/50 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                              autoFocus
                              onBlur={savePrimaryPhoneComment}
                              onKeyDown={(e) => { if (e.key === "Enter") savePrimaryPhoneComment(); if (e.key === "Escape") { setPrimaryPhoneCommentEditing(false); setPrimaryPhoneCommentDraft(primaryPhoneComment); } }}
                            />
                            {primaryPhoneCommentSaving && <span className="text-[10px] text-muted-foreground">...</span>}
                          </div>
                        ) : (
                          <button
                            onClick={() => { setPrimaryPhoneCommentDraft(primaryPhoneComment); setPrimaryPhoneCommentEditing(true); }}
                            className="flex items-center gap-1 pr-4 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            {primaryPhoneComment || <span className="opacity-60">+ تعليق</span>}
                            {primaryPhoneComment && <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100" />}
                          </button>
                        )}
                        {/* Secondary phone */}
                        {secondaryPhoneEditing ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1" dir="ltr">
                              <PhoneCall className="w-3 h-3 text-muted-foreground shrink-0" />
                              <input
                                type="tel"
                                value={secondaryPhoneDraft}
                                onChange={(e) => { setSecondaryPhoneDraft(e.target.value); setSecondaryPhoneError(""); }}
                                placeholder="+966 أو رقم دولي"
                                className={`text-xs bg-muted/30 border rounded px-1.5 py-0.5 w-28 focus:outline-none focus:ring-1 ${secondaryPhoneError ? "border-cc-red/50 focus:ring-cc-red/30" : "border-border/50 focus:ring-primary/50"}`}
                                autoFocus
                                onKeyDown={(e) => { if (e.key === "Enter") saveSecondaryPhone(); if (e.key === "Escape") setSecondaryPhoneEditing(false); }}
                              />
                              <button onClick={saveSecondaryPhone} disabled={secondaryPhoneSaving} className="text-emerald-400 hover:text-emerald-300 disabled:opacity-50">
                                {secondaryPhoneSaving ? <span className="text-[10px]">...</span> : <Check className="w-3 h-3" />}
                              </button>
                              <button onClick={() => { setSecondaryPhoneEditing(false); setSecondaryPhoneError(""); }} className="text-muted-foreground hover:text-foreground">
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                            {secondaryPhoneError && (
                              <p className="text-[11px] text-cc-red">{secondaryPhoneError}</p>
                            )}
                          </div>
                        ) : secondaryPhone ? (
                          <div className="flex items-center gap-1.5" dir="ltr">
                            <PhoneCall className="w-3 h-3 text-muted-foreground shrink-0" />
                            <span className="text-xs text-muted-foreground">{secondaryPhone}</span>
                            <button onClick={() => { setSecondaryPhoneDraft(secondaryPhone); setSecondaryPhoneEditing(true); }} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors">
                              <Pencil className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setSecondaryPhoneDraft(""); setSecondaryPhoneEditing(true); }}
                            className="flex items-center gap-1 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                          >
                            <Plus className="w-3 h-3" /> رقم ثانٍ
                          </button>
                        )}
                        {/* Secondary phone comment (shown only when secondary phone exists) */}
                        {secondaryPhone && (
                          secondaryPhoneCommentEditing ? (
                            <div className="flex items-center gap-1 pr-4">
                              <input
                                type="text"
                                value={secondaryPhoneCommentDraft}
                                onChange={(e) => setSecondaryPhoneCommentDraft(e.target.value)}
                                placeholder="تعليق..."
                                className="text-[11px] bg-muted/30 border border-border/50 rounded px-1.5 py-0.5 flex-1 focus:outline-none focus:ring-1 focus:ring-primary/50"
                                autoFocus
                                onBlur={saveSecondaryPhoneComment}
                                onKeyDown={(e) => { if (e.key === "Enter") saveSecondaryPhoneComment(); if (e.key === "Escape") { setSecondaryPhoneCommentEditing(false); setSecondaryPhoneCommentDraft(secondaryPhoneComment); } }}
                              />
                              {secondaryPhoneCommentSaving && <span className="text-[10px] text-muted-foreground">...</span>}
                            </div>
                          ) : (
                            <button
                              onClick={() => { setSecondaryPhoneCommentDraft(secondaryPhoneComment); setSecondaryPhoneCommentEditing(true); }}
                              className="flex items-center gap-1 pr-4 text-[11px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                            >
                              {secondaryPhoneComment || <span className="opacity-60">+ تعليق</span>}
                            </button>
                          )
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {currentPlan && (
                  <p className="text-[12px] text-primary">الباقة: {currentPlan}</p>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="text-center p-1.5 rounded-lg bg-background/50">
                    <p className="text-sm font-bold text-foreground">{closedDeals}/{totalDeals}</p>
                    <p className="text-[11px] text-muted-foreground">صفقات مغلقة</p>
                  </div>
                  <div className="text-center p-1.5 rounded-lg bg-background/50">
                    <p className="text-sm font-bold text-emerald-400">{formatMoney(totalRevenue + renewalRevenue)}</p>
                    <p className="text-[11px] text-muted-foreground">إجمالي الإيرادات</p>
                  </div>
                  <div className="text-center p-1.5 rounded-lg bg-background/50">
                    <p className="text-sm font-bold text-foreground">{data.tickets.length}</p>
                    <p className="text-[11px] text-muted-foreground">تذاكر دعم</p>
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-xs font-bold text-foreground">نبذة عن العميل</span>
                  </div>
                  {!bioEditing ? (
                    <button
                      onClick={() => { setBioDraft(bio); setBioEditing(true); }}
                      className="flex items-center gap-1 text-[12px] text-primary hover:underline"
                    >
                      <Pencil className="w-3 h-3" /> {bio ? "تعديل" : "إضافة"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={saveBio}
                        disabled={bioSaving}
                        className="flex items-center gap-0.5 text-[12px] text-emerald-400 hover:underline disabled:opacity-50"
                      >
                        <Check className="w-3 h-3" /> حفظ
                      </button>
                      <button
                        onClick={() => { setBioEditing(false); setBioDraft(bio); }}
                        className="text-[12px] text-muted-foreground hover:underline"
                      >
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
                {bioEditing ? (
                  <textarea
                    value={bioDraft}
                    onChange={(e) => setBioDraft(e.target.value)}
                    placeholder="اكتب نبذة عن العميل... (مثال: عميل قديم، يفضل التواصل عبر واتساب، مهتم بالترقية)"
                    className="w-full text-xs bg-background/50 border border-border/50 rounded-lg p-2 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                    rows={3}
                    dir="rtl"
                  />
                ) : bio ? (
                  <p className="text-xs text-foreground/70 whitespace-pre-line leading-relaxed">{bio}</p>
                ) : (
                  <p className="text-[12px] text-muted-foreground/50">لا توجد نبذة — اضغط "إضافة" لكتابة ملاحظات عن العميل</p>
                )}
              </div>

              {/* Menu URL */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm">🔗</span>
                    <span className="text-xs font-bold text-foreground">رابط المنيو</span>
                  </div>
                  {!menuUrlEditing ? (
                    <button
                      onClick={() => { setMenuUrlDraft(menuUrl); setMenuUrlEditing(true); }}
                      className="flex items-center gap-0.5 text-[12px] text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="w-3 h-3" /> {menuUrl ? "تعديل" : "إضافة"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button onClick={saveMenuUrl} disabled={menuUrlSaving} className="flex items-center gap-0.5 text-[12px] text-emerald-400 hover:underline disabled:opacity-50">
                        <Check className="w-3 h-3" /> حفظ
                      </button>
                      <button onClick={() => { setMenuUrlEditing(false); setMenuUrlDraft(menuUrl); }} className="text-[12px] text-muted-foreground hover:underline">
                        إلغاء
                      </button>
                    </div>
                  )}
                </div>
                {menuUrlEditing ? (
                  <input
                    type="url"
                    value={menuUrlDraft}
                    onChange={(e) => setMenuUrlDraft(e.target.value)}
                    placeholder="https://..."
                    className="w-full text-xs bg-background/50 border border-border/50 rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary/50"
                    dir="ltr"
                  />
                ) : menuUrl ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={menuUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 text-xs text-cyan-400 hover:underline truncate"
                      dir="ltr"
                    >
                      {menuUrl}
                    </a>
                    <button
                      onClick={() => { navigator.clipboard.writeText(menuUrl); setMenuUrlCopied(true); setTimeout(() => setMenuUrlCopied(false), 2000); }}
                      className="text-[11px] px-2 py-0.5 rounded border border-border/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    >
                      {menuUrlCopied ? "✓ تم" : "نسخ"}
                    </button>
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(menuUrl)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] px-2 py-0.5 rounded border border-green-600/40 text-green-400 hover:bg-green-500/10 transition-colors shrink-0"
                    >
                      واتساب
                    </a>
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground/50">لا يوجد رابط — اضغط "إضافة" لإضافة رابط المنيو</p>
                )}
              </div>

              {/* Quick follow-up note */}
              {(data.deals.length > 0 || data.renewals.length > 0) && (
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <MessageSquarePlus className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-bold text-foreground">إضافة متابعة</span>
                  </div>
                  <div className="flex gap-2 items-start relative">
                    <div className="flex-1 relative">
                      <textarea
                        ref={quickNoteRef}
                        value={quickNote}
                        onChange={handleQuickNoteChange}
                        onKeyDown={handleQuickNoteKeyDown}
                        placeholder="اكتب ملاحظة... اكتب @ لمنشن موظف (Ctrl+Enter للإرسال)"
                        className="w-full min-h-[64px] rounded-lg border border-border/50 bg-background/50 p-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-cyan-400/50 resize-none"
                        dir="rtl"
                      />
                      {/* Mention dropdown */}
                      {showMentions && filteredEmployees.length > 0 && (
                        <div className="absolute top-full mt-1 right-0 w-full bg-card border border-border rounded-lg shadow-lg z-50 max-h-[160px] overflow-y-auto">
                          {filteredEmployees.map((name, idx) => (
                            <button
                              key={name}
                              onClick={() => insertMention(name)}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-right text-xs transition-colors ${idx === mentionIndex ? "bg-cyan-500/10 text-cyan-400" : "text-foreground hover:bg-white/5"}`}
                            >
                              <div className="w-6 h-6 rounded-full bg-amber-500/15 text-amber-400 flex items-center justify-center text-[10px] font-bold shrink-0">{name.charAt(0)}</div>
                              <span>{name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={addQuickNote}
                        disabled={!quickNote.trim() || quickNoteSaving}
                        className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-400/30 hover:bg-cyan-500/25 disabled:opacity-40 transition-colors"
                        title="إرسال"
                      >
                        {quickNoteSaving ? <div className="w-4 h-4 border border-cyan-400/40 border-t-cyan-400 rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => {
                          const ta = quickNoteRef.current;
                          if (!ta) return;
                          const cursor = ta.selectionStart;
                          const before = quickNote.slice(0, cursor);
                          const after = quickNote.slice(cursor);
                          const needSpace = before.length > 0 && before[before.length - 1] !== " ";
                          const prefix = needSpace ? " @" : "@";
                          setQuickNote(before + prefix + after);
                          setMentionStart(before.length + (needSpace ? 1 : 0));
                          setShowMentions(true);
                          setMentionFilter("");
                          setTimeout(() => { ta.focus(); const pos = cursor + prefix.length; ta.setSelectionRange(pos, pos); }, 0);
                        }}
                        className="p-2 rounded-lg border border-amber-400/30 text-amber-400 hover:bg-amber-400/10 transition-colors"
                        title="منشن موظف @"
                      >
                        <AtSign className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setShowReminderPicker(p => !p)}
                        className={`p-2 rounded-lg border transition-colors ${showReminderPicker ? "border-purple-400/60 bg-purple-400/15 text-purple-400" : "border-purple-400/30 text-purple-400 hover:bg-purple-400/10"}`}
                        title="تذكير بتاريخ ووقت"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  {/* Reminder picker */}
                  {showReminderPicker && (
                    <div className="p-2.5 rounded-lg border border-purple-400/30 bg-purple-400/5 space-y-2">
                      <p className="text-[12px] font-medium text-purple-400 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5" /> تذكيرني في:
                      </p>
                      <div className="flex gap-2">
                        <input type="date" value={reminderDate} onChange={e => setReminderDate(e.target.value)}
                          className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-400" />
                        <input type="time" value={reminderTime} onChange={e => setReminderTime(e.target.value)}
                          className="w-24 rounded-md border border-border bg-card px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-purple-400" />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={saveQuickReminder}
                          disabled={!reminderDate || !reminderTime || savingReminder}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium bg-purple-400/20 text-purple-400 hover:bg-purple-400/30 disabled:opacity-40 transition-colors"
                        >
                          <Bell className="w-3 h-3" />{savingReminder ? "جاري الحفظ..." : "حفظ التذكير"}
                        </button>
                        <button onClick={() => setShowReminderPicker(false)} className="px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:bg-white/5 transition-colors">إلغاء</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Timeline */}
              {data.notes.length > 0 && (
                <SectionToggle
                  title="آخر المتابعات"
                  icon={<Clock className="w-3.5 h-3.5 text-primary" />}
                  count={data.notes.length}
                >
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {data.notes.slice(0, 15).map(n => {
                      const isHighlighted = highlightNoteId === n.id;
                      return (
                        <div
                          key={n.id}
                          id={`note-${n.id}`}
                          ref={isHighlighted ? (el) => { el?.scrollIntoView({ behavior: "smooth", block: "center" }); } : undefined}
                          className={`flex gap-2 text-[12px] p-1.5 rounded-lg transition-colors ${
                            isHighlighted
                              ? "bg-amber-500/15 border border-amber-500/30 ring-1 ring-amber-500/20"
                              : "bg-muted/20"
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${isHighlighted ? "bg-amber-400" : "bg-primary/50"}`} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <span>{formatDate(n.created_at)}</span>
                              <span className={`font-medium ${isHighlighted ? "text-amber-400" : "text-foreground/80"}`}>{n.author_name}</span>
                              {isHighlighted && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">المنشن</span>}
                            </div>
                            <p className="text-foreground/60 whitespace-pre-line break-words">{n.note}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SectionToggle>
              )}

              {/* Deals */}
              {data.deals.length > 0 && (
                <SectionToggle
                  title="الصفقات"
                  icon={<ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />}
                  count={data.deals.length}
                >
                  {data.deals.map(d => (
                    <DealCard key={d.id} deal={d} notes={data.notes} employees={employees} />
                  ))}
                </SectionToggle>
              )}

              {/* Renewals */}
              {data.renewals.length > 0 && (
                <SectionToggle
                  title="التجديدات"
                  icon={<RefreshCw className="w-3.5 h-3.5 text-sky-400" />}
                  count={data.renewals.length}
                >
                  {data.renewals.map(r => (
                    <RenewalCard key={r.id} renewal={r} notes={data.notes} />
                  ))}
                </SectionToggle>
              )}

              {/* Tickets */}
              {data.tickets.length > 0 && (() => {
                const open = data.tickets.filter(t => t.status === "مفتوح").length;
                const inProgress = data.tickets.filter(t => t.status === "قيد المعالجة").length;
                const resolved = data.tickets.filter(t => t.status === "محلول").length;
                return (
                  <SectionToggle
                    title="طلبات الدعم"
                    icon={<Headphones className="w-3.5 h-3.5 text-orange-400" />}
                    count={data.tickets.length}
                  >
                    {/* Summary row */}
                    <div className="flex gap-2 mb-1">
                      {open > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 font-medium">
                          {open} مفتوح
                        </span>
                      )}
                      {inProgress > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                          {inProgress} قيد المعالجة
                        </span>
                      )}
                      {resolved > 0 && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                          {resolved} محلول
                        </span>
                      )}
                    </div>
                    {data.tickets.map(t => (
                      <TicketCard key={t.id} ticket={t} />
                    ))}
                  </SectionToggle>
                );
              })()}
            </>
          )}

          {!searched && !loading && (
            <div className="text-center py-12">
              <Search className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">ابحث عن عميل لعرض ملخصه الكامل</p>
              <p className="text-[12px] text-muted-foreground/60 mt-1">يشمل الصفقات، التجديدات، التذاكر، والمتابعات</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
