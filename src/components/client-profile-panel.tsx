"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchClientProfile, type ClientProfileData } from "@/lib/supabase/db";
import { Search, Phone, User, ShoppingBag, RefreshCw, Headphones, FileText, ChevronDown, ChevronUp, Clock, X } from "lucide-react";
import type { Deal, Renewal, Ticket, FollowUpNote } from "@/types";

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
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium ${cls}`}>
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
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{count}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && <div className="p-2.5 space-y-2">{children}</div>}
    </div>
  );
}

function DealCard({ deal, notes }: { deal: Deal; notes: FollowUpNote[] }) {
  const [showNotes, setShowNotes] = useState(false);
  const dealNotes = notes.filter(n => n.entity_type === "deal" && n.entity_id === deal.id);
  return (
    <div className="rounded-lg border border-border/40 bg-card/50 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge label={deal.stage} colorMap={STAGE_COLORS} />
        <span className="text-[10px] text-muted-foreground">{formatDate(deal.created_at)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{deal.sales_type === "support" ? "دعم" : "مكتب"} · {deal.plan || "—"}</span>
        <span className="text-xs font-bold text-emerald-400">{formatMoney(deal.deal_value)}</span>
      </div>
      {deal.assigned_rep_name && (
        <p className="text-[10px] text-muted-foreground">المندوب: {deal.assigned_rep_name}</p>
      )}
      {deal.source && (
        <p className="text-[10px] text-muted-foreground">المصدر: {deal.source}</p>
      )}
      {deal.close_date && (
        <p className="text-[10px] text-muted-foreground">تاريخ الإغلاق: {formatDate(deal.close_date)}</p>
      )}
      {deal.loss_reason && (
        <p className="text-[10px] text-red-400">سبب الرفض: {deal.loss_reason}</p>
      )}
      {deal.notes && (
        <p className="text-[10px] text-muted-foreground/70 line-clamp-2">{deal.notes}</p>
      )}
      {dealNotes.length > 0 && (
        <>
          <button onClick={() => setShowNotes(!showNotes)} className="text-[10px] text-primary hover:underline flex items-center gap-1">
            <FileText className="w-3 h-3" /> {dealNotes.length} متابعة
          </button>
          {showNotes && (
            <div className="space-y-1 mr-2 border-r-2 border-primary/20 pr-2">
              {dealNotes.map(n => (
                <div key={n.id} className="text-[10px]">
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
        <span className="text-[10px] text-muted-foreground">{formatDate(renewal.renewal_date)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{renewal.plan_name}</span>
        <span className="text-xs font-bold text-emerald-400">{formatMoney(renewal.plan_price)}</span>
      </div>
      {renewal.assigned_rep && (
        <p className="text-[10px] text-muted-foreground">المسؤول: {renewal.assigned_rep}</p>
      )}
      {renewal.payment_date && (
        <p className="text-[10px] text-emerald-400/70">تاريخ الدفع: {formatDate(renewal.payment_date)}</p>
      )}
      {renewal.cancel_reason && (
        <p className="text-[10px] text-red-400">سبب الإلغاء: {renewal.cancel_reason}</p>
      )}
      {renewal.notes && (
        <p className="text-[10px] text-muted-foreground/70 line-clamp-2">{renewal.notes}</p>
      )}
      {renewalNotes.length > 0 && (
        <>
          <button onClick={() => setShowNotes(!showNotes)} className="text-[10px] text-primary hover:underline flex items-center gap-1">
            <FileText className="w-3 h-3" /> {renewalNotes.length} متابعة
          </button>
          {showNotes && (
            <div className="space-y-1 mr-2 border-r-2 border-primary/20 pr-2">
              {renewalNotes.map(n => (
                <div key={n.id} className="text-[10px]">
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

function TicketCard({ ticket }: { ticket: Ticket }) {
  return (
    <div className="rounded-lg border border-border/40 bg-card/50 p-2.5 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <StatusBadge label={ticket.status} colorMap={TICKET_COLORS} />
        <span className="text-[10px] text-muted-foreground">{formatDate(ticket.created_at)}</span>
      </div>
      <p className="text-xs text-foreground">{ticket.issue}</p>
      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {ticket.priority && <span>الأولوية: {ticket.priority}</span>}
        {ticket.assigned_agent_name && <span>الفني: {ticket.assigned_agent_name}</span>}
      </div>
      {ticket.resolved_date && (
        <p className="text-[10px] text-emerald-400/70">تم الحل: {formatDate(ticket.resolved_date)}</p>
      )}
    </div>
  );
}

interface ClientProfilePanelProps {
  open: boolean;
  onClose: () => void;
  initialQuery?: string;
}

export function ClientProfilePanel({ open, onClose, initialQuery }: ClientProfilePanelProps) {
  const [search, setSearch] = useState(initialQuery || "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<ClientProfileData | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (initialQuery && open) {
      setSearch(initialQuery);
      doSearch(initialQuery);
    }
  }, [initialQuery, open]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const result = await fetchClientProfile(q.trim());
      setData(result);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
    }, 300);
  };

  const clientName = data?.deals[0]?.client_name || data?.renewals[0]?.customer_name || data?.tickets[0]?.client_name || "";
  const clientPhone = data?.deals[0]?.client_phone || data?.renewals[0]?.customer_phone || data?.tickets[0]?.client_phone || "";
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
                    {clientPhone && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5" dir="ltr">
                        <Phone className="w-3 h-3" /> {clientPhone}
                      </p>
                    )}
                  </div>
                </div>
                {currentPlan && (
                  <p className="text-[10px] text-primary">الباقة: {currentPlan}</p>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <div className="text-center p-1.5 rounded-lg bg-background/50">
                    <p className="text-sm font-bold text-foreground">{closedDeals}/{totalDeals}</p>
                    <p className="text-[9px] text-muted-foreground">صفقات مغلقة</p>
                  </div>
                  <div className="text-center p-1.5 rounded-lg bg-background/50">
                    <p className="text-sm font-bold text-emerald-400">{formatMoney(totalRevenue + renewalRevenue)}</p>
                    <p className="text-[9px] text-muted-foreground">إجمالي الإيرادات</p>
                  </div>
                  <div className="text-center p-1.5 rounded-lg bg-background/50">
                    <p className="text-sm font-bold text-foreground">{data.tickets.length}</p>
                    <p className="text-[9px] text-muted-foreground">تذاكر دعم</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              {data.notes.length > 0 && (
                <SectionToggle
                  title="آخر المتابعات"
                  icon={<Clock className="w-3.5 h-3.5 text-primary" />}
                  count={data.notes.length}
                >
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {data.notes.slice(0, 15).map(n => (
                      <div key={n.id} className="flex gap-2 text-[10px] p-1.5 rounded-lg bg-muted/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <span>{formatDate(n.created_at)}</span>
                            <span className="font-medium text-foreground/80">{n.author_name}</span>
                          </div>
                          <p className="text-foreground/60 whitespace-pre-line break-words">{n.note}</p>
                        </div>
                      </div>
                    ))}
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
                    <DealCard key={d.id} deal={d} notes={data.notes} />
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
              {data.tickets.length > 0 && (
                <SectionToggle
                  title="تذاكر الدعم"
                  icon={<Headphones className="w-3.5 h-3.5 text-orange-400" />}
                  count={data.tickets.length}
                >
                  {data.tickets.map(t => (
                    <TicketCard key={t.id} ticket={t} />
                  ))}
                </SectionToggle>
              )}
            </>
          )}

          {!searched && !loading && (
            <div className="text-center py-12">
              <Search className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">ابحث عن عميل لعرض ملخصه الكامل</p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">يشمل الصفقات، التجديدات، التذاكر، والمتابعات</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
