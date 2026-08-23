"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchOfferVisits, fetchOfferLeads, updateOfferLeadStatus, type OfferVisit, type OfferLead } from "@/lib/supabase/db";
import { Eye, UserCheck, RefreshCw, Phone, MessageCircle } from "lucide-react";

const PAGE_LABEL: Record<string, string> = { menu: "المنيو", nahjez: "نحجز" };
const DEVICE_ICON: Record<string, string> = { mobile: "📱", tablet: "📲", desktop: "💻" };
const LEAD_STATUSES = ["جديد", "تم التواصل", "مهتم", "مغلق"];

function fmt(ts: string) {
  const d = new Date(ts);
  const date = d.toLocaleDateString("en-GB");
  const time = d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}
function isToday(ts: string) {
  const d = new Date(ts);
  const n = new Date();
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate();
}

export function OfferVisitsPanel() {
  const [visits, setVisits] = useState<OfferVisit[]>([]);
  const [leads, setLeads] = useState<OfferLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"leads" | "visits">("leads");

  const load = useCallback(async () => {
    try {
      const [v, l] = await Promise.all([fetchOfferVisits(), fetchOfferLeads()]);
      setVisits(v);
      setLeads(l);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const stats = useMemo(() => ({
    visits: visits.length,
    visitsToday: visits.filter((v) => isToday(v.created_at)).length,
    leads: leads.length,
    leadsToday: leads.filter((l) => isToday(l.created_at)).length,
  }), [visits, leads]);

  async function setStatus(id: string, status: string) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    updateOfferLeadStatus(id, status).catch(() => {});
  }

  return (
    <div className="cc-card rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-cyan/10 flex items-center justify-center">
            <Eye className="w-4 h-4 text-cyan" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">زيارات صفحة العرض</h3>
            <p className="text-[12px] text-muted-foreground">من زار صفحة العرض ومن ترك بياناته</p>
          </div>
        </div>
        <button onClick={() => { setLoading(true); load(); }} className="flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md border border-border/50 transition-colors">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-4">
        {[
          { v: stats.visits, l: "إجمالي الزيارات", c: "text-cyan" },
          { v: stats.visitsToday, l: "زيارات اليوم", c: "text-cc-green" },
          { v: stats.leads, l: "عملاء محتملون", c: "text-cc-purple" },
          { v: stats.leadsToday, l: "منهم اليوم", c: "text-amber" },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-white/[0.04] border border-white/[0.06] p-3 text-center">
            <p className={`text-2xl font-extrabold ${s.c}`}>{loading ? "—" : s.v.toLocaleString()}</p>
            <p className="text-[12px] text-muted-foreground mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="px-4 flex items-center gap-1">
        {([["leads", `عملاء محتملون (${leads.length})`], ["visits", `سجل الزيارات (${visits.length})`]] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-colors border ${
              tab === k ? "bg-cyan/15 text-cyan border-cyan/30" : "text-muted-foreground border-transparent hover:text-foreground hover:bg-white/[0.06]"
            }`}
          >
            {tab === k ? (k === "leads" ? <UserCheck className="w-3.5 h-3.5 inline ml-1" /> : <Eye className="w-3.5 h-3.5 inline ml-1" />) : null}
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 pt-3 max-h-[440px] overflow-y-auto">
        {loading ? (
          <p className="text-center text-xs text-muted-foreground py-8">جارٍ التحميل…</p>
        ) : tab === "leads" ? (
          leads.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">لا يوجد عملاء محتملون بعد</p>
          ) : (
            <div className="space-y-2">
              {leads.map((l) => {
                const phone = (l.phone || "").replace(/\D/g, "");
                const intl = phone.startsWith("0") ? "966" + phone.slice(1) : phone;
                return (
                  <div key={l.id} className="rounded-xl border border-border/40 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{l.name || "بدون اسم"}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-cyan/10 text-cyan border border-cyan/20">{PAGE_LABEL[l.page || ""] || l.page || "—"}</span>
                        {l.ref && <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/20">رابط: {l.ref}</span>}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{fmt(l.created_at)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                        {l.phone && <span dir="ltr">{l.phone}</span>}
                        {l.business_type && <span>· {l.business_type}</span>}
                      </div>
                      <div className="flex items-center gap-1.5">
                        {phone && (
                          <>
                            <a href={`tel:${l.phone}`} title="اتصال" className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-cyan"><Phone className="w-3.5 h-3.5" /></a>
                            <a href={`https://wa.me/${intl}`} target="_blank" rel="noopener noreferrer" title="واتساب" className="flex h-7 w-7 items-center justify-center rounded-md border border-border/50 text-muted-foreground hover:text-cc-green"><MessageCircle className="w-3.5 h-3.5" /></a>
                          </>
                        )}
                        <select
                          value={l.status}
                          onChange={(e) => setStatus(l.id, e.target.value)}
                          className="text-[11px] rounded-md bg-card border border-border/50 text-foreground px-1.5 py-1"
                        >
                          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : visits.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-8">لا توجد زيارات مسجّلة بعد</p>
        ) : (
          <div className="space-y-1.5">
            {visits.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/30 bg-white/[0.02] px-3 py-2 text-[12px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{DEVICE_ICON[v.device || ""] || "🌐"}</span>
                  <span className="px-1.5 py-0.5 rounded-full bg-cyan/10 text-cyan border border-cyan/20 shrink-0">{PAGE_LABEL[v.page] || v.page}</span>
                  {v.ref && <span className="px-1.5 py-0.5 rounded-full bg-amber/10 text-amber border border-amber/20 shrink-0">رابط: {v.ref}</span>}
                  {v.referrer && <span className="text-muted-foreground truncate" title={v.referrer}>من: {v.referrer}</span>}
                </div>
                <span className="text-muted-foreground shrink-0">{fmt(v.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
