"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Radar, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Globe, Tag, Zap, TrendingUp, DollarSign, Megaphone,
  FileText, ExternalLink, Calendar, Search, X, Eye,
  Sparkles, Loader2, BrainCircuit,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/* ─── Types ─── */
interface CompetitorPlan {
  id: string;
  name: string;
  price: number;
  billing: "monthly" | "yearly" | "once";
  features: string;
}

interface CompetitorOffer {
  id: string;
  title: string;
  description: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

interface CompetitorUpdate {
  id: string;
  title: string;
  description: string;
  date: string;
  source: string;
  type: "feature" | "pricing" | "partnership" | "other";
}

interface Competitor {
  id: string;
  name: string;
  category: string;
  website: string;
  strengths: string;
  weaknesses: string;
  notes: string;
  plans: CompetitorPlan[];
  offers: CompetitorOffer[];
  updates: CompetitorUpdate[];
  created_at: string;
}

const STORAGE_KEY = "competitors_data";
const CATEGORIES = ["أنظمة نقاط البيع", "أتمتة المطاعم", "إدارة المخزون", "أنظمة الحجز", "التوصيل", "أخرى"];
const UPDATE_TYPES: Record<string, { label: string; color: string }> = {
  feature: { label: "ميزة جديدة", color: "text-emerald-400 bg-emerald-500/10" },
  pricing: { label: "تغيير أسعار", color: "text-amber-400 bg-amber-500/10" },
  partnership: { label: "شراكة", color: "text-violet-400 bg-violet-500/10" },
  other: { label: "أخرى", color: "text-slate-400 bg-slate-500/10" },
};
const BILLING_LABELS: Record<string, string> = { monthly: "شهري", yearly: "سنوي", once: "مرة واحدة" };

function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

/* ─── Section Component ─── */
function Section({ title, icon, children, badge, defaultOpen = true }: {
  title: string; icon: React.ReactNode; children: React.ReactNode; badge?: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="cc-card rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-4 hover:bg-white/[0.02] transition-colors">
        <div className="flex items-center gap-2.5">
          {icon}
          <span className="text-sm font-bold text-foreground">{title}</span>
          {badge}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-border pt-4">{children}</div>}
    </div>
  );
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showAddPlan, setShowAddPlan] = useState(false);
  const [showAddOffer, setShowAddOffer] = useState(false);
  const [showAddUpdate, setShowAddUpdate] = useState(false);
  const [editingCompetitor, setEditingCompetitor] = useState<Competitor | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Forms
  const emptyComp = { name: "", category: CATEGORIES[0], website: "", strengths: "", weaknesses: "", notes: "" };
  const [compForm, setCompForm] = useState(emptyComp);
  const [planForm, setPlanForm] = useState<{ name: string; price: number; billing: "monthly" | "yearly" | "once"; features: string }>({ name: "", price: 0, billing: "monthly", features: "" });
  const [offerForm, setOfferForm] = useState({ title: "", description: "", start_date: "", end_date: "" });
  const [updateForm, setUpdateForm] = useState<{ title: string; description: string; date: string; source: string; type: "feature" | "pricing" | "partnership" | "other" }>({ title: "", description: "", date: new Date().toISOString().slice(0, 10), source: "", type: "feature" });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(competitors));
  }, [competitors]);

  const filtered = useMemo(() => {
    if (!search.trim()) return competitors;
    const q = search.toLowerCase();
    return competitors.filter(c => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q));
  }, [competitors, search]);

  const selected = competitors.find(c => c.id === selectedId) || null;

  // ── CRUD ──
  function addCompetitor() {
    if (!compForm.name.trim()) return;
    const newComp: Competitor = {
      id: genId(), ...compForm, plans: [], offers: [], updates: [],
      created_at: new Date().toISOString(),
    };
    setCompetitors(prev => [newComp, ...prev]);
    setCompForm(emptyComp);
    setShowAddDialog(false);
    setSelectedId(newComp.id);
  }

  function saveEditCompetitor() {
    if (!editingCompetitor) return;
    setCompetitors(prev => prev.map(c => c.id === editingCompetitor.id ? { ...c, ...compForm } : c));
    setEditingCompetitor(null);
    setCompForm(emptyComp);
  }

  function deleteCompetitor(id: string) {
    setCompetitors(prev => prev.filter(c => c.id !== id));
    if (selectedId === id) setSelectedId(null);
  }

  function addPlan() {
    if (!selected || !planForm.name.trim()) return;
    const plan: CompetitorPlan = { id: genId(), ...planForm };
    setCompetitors(prev => prev.map(c => c.id === selected.id ? { ...c, plans: [...c.plans, plan] } : c));
    setPlanForm({ name: "", price: 0, billing: "monthly", features: "" });
    setShowAddPlan(false);
  }

  function deletePlan(planId: string) {
    if (!selected) return;
    setCompetitors(prev => prev.map(c => c.id === selected.id ? { ...c, plans: c.plans.filter(p => p.id !== planId) } : c));
  }

  function addOffer() {
    if (!selected || !offerForm.title.trim()) return;
    const offer: CompetitorOffer = { id: genId(), ...offerForm, active: true };
    setCompetitors(prev => prev.map(c => c.id === selected.id ? { ...c, offers: [...c.offers, offer] } : c));
    setOfferForm({ title: "", description: "", start_date: "", end_date: "" });
    setShowAddOffer(false);
  }

  function deleteOffer(offerId: string) {
    if (!selected) return;
    setCompetitors(prev => prev.map(c => c.id === selected.id ? { ...c, offers: c.offers.filter(o => o.id !== offerId) } : c));
  }

  function addUpdate() {
    if (!selected || !updateForm.title.trim()) return;
    const upd: CompetitorUpdate = { id: genId(), ...updateForm };
    setCompetitors(prev => prev.map(c => c.id === selected.id ? { ...c, updates: [upd, ...c.updates] } : c));
    setUpdateForm({ title: "", description: "", date: new Date().toISOString().slice(0, 10), source: "", type: "feature" });
    setShowAddUpdate(false);
  }

  function deleteUpdate(updId: string) {
    if (!selected) return;
    setCompetitors(prev => prev.map(c => c.id === selected.id ? { ...c, updates: c.updates.filter(u => u.id !== updId) } : c));
  }

  // ── Price comparison across all competitors ──
  const allPlans = useMemo(() => {
    return competitors.flatMap(c => c.plans.map(p => ({ ...p, competitorName: c.name })));
  }, [competitors]);

  // ── AI Analysis ──
  async function runAiAnalysis() {
    if (competitors.length === 0) return;
    setAiLoading(true);
    setAiAnalysis("");
    try {
      const context = competitors.map(c => ({
        name: c.name,
        category: c.category,
        strengths: c.strengths,
        weaknesses: c.weaknesses,
        plans: c.plans.map(p => ({ name: p.name, price: p.price, billing: BILLING_LABELS[p.billing], features: p.features })),
        active_offers: c.offers.filter(o => {
          const now = new Date().toISOString().slice(0, 10);
          return (!o.end_date || o.end_date >= now) && (!o.start_date || o.start_date <= now);
        }).map(o => ({ title: o.title, description: o.description })),
        recent_updates: c.updates.slice(0, 5).map(u => ({ title: u.title, type: UPDATE_TYPES[u.type]?.label, date: u.date, description: u.description })),
      }));

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `أنت محلل استراتيجي متخصص في تحليل المنافسين لشركة RESTAVO (شركة أتمتة مطاعم سعودية). حلل بيانات المنافسين التالية وقدم:

1. **ملخص المشهد التنافسي**: من هو الأقوى ولماذا؟
2. **تحليل الأسعار**: هل أسعارنا تنافسية؟ أين الفجوة؟
3. **فرص يمكن استغلالها**: بناءً على نقاط ضعف المنافسين
4. **تهديدات يجب الانتباه لها**: عروض أو تطويرات خطيرة
5. **توصيات فورية**: 3-5 إجراءات عملية يمكن تنفيذها الحين

بيانات المنافسين:
${JSON.stringify(context, null, 2)}`,
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
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.text) { full += parsed.text; setAiAnalysis(full); }
          } catch { /* skip */ }
        }
      }
      if (!full) setAiAnalysis("تم التحليل. أضف المزيد من البيانات عن المنافسين للحصول على تحليل أعمق.");
    } catch {
      setAiAnalysis("تعذر الاتصال بالذكاء الاصطناعي. تأكد من إعدادات API.");
    }
    setAiLoading(false);
  }

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 border border-rose-500/20 flex items-center justify-center">
            <Radar className="w-5 h-5 text-rose-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">مراقبة المنافسين</h1>
            <p className="text-xs text-muted-foreground">{competitors.length} منافس مسجّل</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={runAiAnalysis} disabled={aiLoading || competitors.length === 0} className="gap-2 bg-gradient-to-l from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 border-0">
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4" />}
            تحليل ذكي
          </Button>
          <Button onClick={() => { setCompForm(emptyComp); setEditingCompetitor(null); setShowAddDialog(true); }} className="gap-2 bg-gradient-to-l from-rose-600 to-orange-600 hover:from-rose-500 hover:to-orange-500 border-0">
            <Plus className="w-4 h-4" /> إضافة منافس
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الفئة..."
          className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-rose-500/50"
        />
      </div>

      {/* ── Add/Edit Competitor Dialog ── */}
      {(showAddDialog || editingCompetitor) && (
        <div className="cc-card rounded-xl p-5 border border-rose-500/20">
          <h3 className="text-sm font-bold text-foreground mb-4">{editingCompetitor ? "تعديل المنافس" : "إضافة منافس جديد"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input value={compForm.name} onChange={e => setCompForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم المنافس *" className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-rose-500/50" />
            <select value={compForm.category} onChange={e => setCompForm(p => ({ ...p, category: e.target.value }))} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none focus:border-rose-500/50">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={compForm.website} onChange={e => setCompForm(p => ({ ...p, website: e.target.value }))} placeholder="الموقع الإلكتروني" className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-rose-500/50" dir="ltr" />
            <div />
            <textarea value={compForm.strengths} onChange={e => setCompForm(p => ({ ...p, strengths: e.target.value }))} placeholder="نقاط القوة..." rows={2} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-rose-500/50 resize-none" />
            <textarea value={compForm.weaknesses} onChange={e => setCompForm(p => ({ ...p, weaknesses: e.target.value }))} placeholder="نقاط الضعف..." rows={2} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-rose-500/50 resize-none" />
            <textarea value={compForm.notes} onChange={e => setCompForm(p => ({ ...p, notes: e.target.value }))} placeholder="ملاحظات عامة..." rows={2} className="md:col-span-2 px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none focus:border-rose-500/50 resize-none" />
          </div>
          <div className="flex gap-2 mt-4">
            <Button size="sm" onClick={editingCompetitor ? saveEditCompetitor : addCompetitor} disabled={!compForm.name.trim()} className="bg-rose-600 hover:bg-rose-500 border-0">
              {editingCompetitor ? "حفظ التعديل" : "إضافة"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setShowAddDialog(false); setEditingCompetitor(null); setCompForm(emptyComp); }}>
              إلغاء
            </Button>
          </div>
        </div>
      )}

      {/* ── Competitors Grid ── */}
      {filtered.length === 0 && !showAddDialog ? (
        <div className="cc-card rounded-xl p-10 text-center">
          <Radar className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
          <p className="text-sm text-muted-foreground">لا يوجد منافسين مسجّلين بعد</p>
          <p className="text-xs text-muted-foreground mt-1">أضف المنافسين لتتبع أسعارهم وعروضهم وتطوراتهم</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedId(selectedId === c.id ? null : c.id)}
              className={`text-right p-4 rounded-xl border transition-all ${selectedId === c.id ? "bg-rose-500/[0.08] border-rose-500/30 ring-1 ring-rose-500/20" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04]"}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center text-rose-400 text-sm font-bold">
                    {c.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{c.name}</p>
                    <p className="text-[10px] text-muted-foreground">{c.category}</p>
                  </div>
                </div>
                {selectedId === c.id && <Eye className="w-4 h-4 text-rose-400" />}
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>{c.plans.length} باقة</span>
                <span>{c.offers.length} عرض</span>
                <span>{c.updates.length} تحديث</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* ── Selected Competitor Details ── */}
      {selected && (
        <div className="space-y-4">
          {/* Competitor Header */}
          <div className="cc-card rounded-xl p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center text-rose-400 text-lg font-bold">
                  {selected.name[0]}
                </div>
                <div>
                  <h2 className="text-base font-bold text-foreground">{selected.name}</h2>
                  <p className="text-xs text-muted-foreground">{selected.category}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {selected.website && (
                  <a href={selected.website.startsWith("http") ? selected.website : `https://${selected.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300">
                    <Globe className="w-3.5 h-3.5" /> الموقع
                  </a>
                )}
                <Button size="sm" variant="outline" className="gap-1 text-xs" onClick={() => {
                  setCompForm({ name: selected.name, category: selected.category, website: selected.website, strengths: selected.strengths, weaknesses: selected.weaknesses, notes: selected.notes });
                  setEditingCompetitor(selected);
                }}>
                  <Pencil className="w-3 h-3" /> تعديل
                </Button>
                <Button size="sm" variant="outline" className="gap-1 text-xs text-red-400 hover:text-red-300 border-red-500/20 hover:border-red-500/40" onClick={() => deleteCompetitor(selected.id)}>
                  <Trash2 className="w-3 h-3" /> حذف
                </Button>
              </div>
            </div>
            {/* Strengths & Weaknesses */}
            {(selected.strengths || selected.weaknesses) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                {selected.strengths && (
                  <div className="p-3 rounded-lg bg-emerald-500/[0.06] border border-emerald-500/15">
                    <p className="text-[10px] font-bold text-emerald-400 mb-1">نقاط القوة</p>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{selected.strengths}</p>
                  </div>
                )}
                {selected.weaknesses && (
                  <div className="p-3 rounded-lg bg-red-500/[0.06] border border-red-500/15">
                    <p className="text-[10px] font-bold text-red-400 mb-1">نقاط الضعف</p>
                    <p className="text-xs text-foreground/80 whitespace-pre-wrap">{selected.weaknesses}</p>
                  </div>
                )}
              </div>
            )}
            {selected.notes && (
              <div className="mt-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.06]">
                <p className="text-[10px] font-bold text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-xs text-foreground/80 whitespace-pre-wrap">{selected.notes}</p>
              </div>
            )}
          </div>

          {/* ── Pricing Plans ── */}
          <Section title="الأسعار والباقات" icon={<DollarSign className="w-5 h-5 text-emerald-400" />} badge={<span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">{selected.plans.length}</span>}>
            <div className="space-y-3">
              {showAddPlan ? (
                <div className="p-3 rounded-lg bg-white/[0.03] border border-emerald-500/20 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <input value={planForm.name} onChange={e => setPlanForm(p => ({ ...p, name: e.target.value }))} placeholder="اسم الباقة *" className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none" />
                    <input type="number" value={planForm.price || ""} onChange={e => setPlanForm(p => ({ ...p, price: Number(e.target.value) }))} placeholder="السعر (ر.س)" className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none" />
                    <select value={planForm.billing} onChange={e => setPlanForm(p => ({ ...p, billing: e.target.value as "monthly" | "yearly" | "once" }))} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none">
                      <option value="monthly">شهري</option>
                      <option value="yearly">سنوي</option>
                      <option value="once">مرة واحدة</option>
                    </select>
                  </div>
                  <textarea value={planForm.features} onChange={e => setPlanForm(p => ({ ...p, features: e.target.value }))} placeholder="المميزات (سطر لكل ميزة)..." rows={3} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none resize-none" />
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addPlan} disabled={!planForm.name.trim()} className="bg-emerald-600 hover:bg-emerald-500 border-0">إضافة</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddPlan(false)}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowAddPlan(true)} className="gap-1 text-xs"><Plus className="w-3 h-3" /> إضافة باقة</Button>
              )}
              {selected.plans.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد باقات مسجّلة</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {selected.plans.map(p => (
                    <div key={p.id} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-xs font-bold text-foreground">{p.name}</p>
                        <button onClick={() => deletePlan(p.id)} className="text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="w-3 h-3" /></button>
                      </div>
                      <p className="text-lg font-bold text-emerald-400">{p.price.toLocaleString()} <span className="text-[10px] text-muted-foreground">ر.س / {BILLING_LABELS[p.billing]}</span></p>
                      {p.features && (
                        <div className="mt-2 space-y-1">
                          {p.features.split("\n").filter(Boolean).map((f, i) => (
                            <p key={i} className="text-[10px] text-muted-foreground flex items-start gap-1"><span className="text-emerald-400 mt-0.5">•</span> {f}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Section>

          {/* ── Offers & Promotions ── */}
          <Section title="العروض والحملات" icon={<Megaphone className="w-5 h-5 text-amber-400" />} badge={selected.offers.filter(o => o.active).length > 0 ? <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400">{selected.offers.filter(o => o.active).length} نشط</span> : undefined}>
            <div className="space-y-3">
              {showAddOffer ? (
                <div className="p-3 rounded-lg bg-white/[0.03] border border-amber-500/20 space-y-2">
                  <input value={offerForm.title} onChange={e => setOfferForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان العرض *" className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none" />
                  <textarea value={offerForm.description} onChange={e => setOfferForm(p => ({ ...p, description: e.target.value }))} placeholder="تفاصيل العرض..." rows={2} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-muted-foreground">تاريخ البداية</label>
                      <input type="date" value={offerForm.start_date} onChange={e => setOfferForm(p => ({ ...p, start_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted-foreground">تاريخ النهاية</label>
                      <input type="date" value={offerForm.end_date} onChange={e => setOfferForm(p => ({ ...p, end_date: e.target.value }))} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addOffer} disabled={!offerForm.title.trim()} className="bg-amber-600 hover:bg-amber-500 border-0 text-black">إضافة</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddOffer(false)}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowAddOffer(true)} className="gap-1 text-xs"><Plus className="w-3 h-3" /> إضافة عرض</Button>
              )}
              {selected.offers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد عروض مسجّلة</p>
              ) : (
                <div className="space-y-2">
                  {selected.offers.map(o => {
                    const now = new Date().toISOString().slice(0, 10);
                    const isActive = (!o.end_date || o.end_date >= now) && (!o.start_date || o.start_date <= now);
                    return (
                      <div key={o.id} className={`flex items-start gap-3 px-3 py-2.5 rounded-xl border ${isActive ? "bg-amber-500/[0.06] border-amber-500/15" : "bg-white/[0.01] border-white/[0.04] opacity-60"}`}>
                        <Tag className={`w-4 h-4 mt-0.5 shrink-0 ${isActive ? "text-amber-400" : "text-muted-foreground"}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-xs font-medium text-foreground">{o.title}</p>
                            {isActive && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400">نشط</span>}
                          </div>
                          {o.description && <p className="text-[10px] text-muted-foreground mt-0.5">{o.description}</p>}
                          {(o.start_date || o.end_date) && (
                            <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {o.start_date && o.start_date} {o.start_date && o.end_date && "—"} {o.end_date && o.end_date}
                            </p>
                          )}
                        </div>
                        <button onClick={() => deleteOffer(o.id)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* ── Latest Developments ── */}
          <Section title="آخر التطويرات والأخبار" icon={<Zap className="w-5 h-5 text-violet-400" />} badge={<span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{selected.updates.length}</span>}>
            <div className="space-y-3">
              {showAddUpdate ? (
                <div className="p-3 rounded-lg bg-white/[0.03] border border-violet-500/20 space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <input value={updateForm.title} onChange={e => setUpdateForm(p => ({ ...p, title: e.target.value }))} placeholder="عنوان التحديث *" className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none" />
                    <select value={updateForm.type} onChange={e => setUpdateForm(p => ({ ...p, type: e.target.value as "feature" | "pricing" | "partnership" | "other" }))} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none">
                      {Object.entries(UPDATE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <textarea value={updateForm.description} onChange={e => setUpdateForm(p => ({ ...p, description: e.target.value }))} placeholder="التفاصيل..." rows={2} className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none resize-none" />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="date" value={updateForm.date} onChange={e => setUpdateForm(p => ({ ...p, date: e.target.value }))} className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs focus:outline-none" />
                    <input value={updateForm.source} onChange={e => setUpdateForm(p => ({ ...p, source: e.target.value }))} placeholder="المصدر (اختياري)" className="px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-foreground text-xs placeholder:text-muted-foreground focus:outline-none" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={addUpdate} disabled={!updateForm.title.trim()} className="bg-violet-600 hover:bg-violet-500 border-0">إضافة</Button>
                    <Button size="sm" variant="outline" onClick={() => setShowAddUpdate(false)}>إلغاء</Button>
                  </div>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setShowAddUpdate(true)} className="gap-1 text-xs"><Plus className="w-3 h-3" /> إضافة تحديث</Button>
              )}
              {selected.updates.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">لا توجد تحديثات مسجّلة</p>
              ) : (
                <div className="space-y-2">
                  {selected.updates.map(u => {
                    const t = UPDATE_TYPES[u.type] || UPDATE_TYPES.other;
                    return (
                      <div key={u.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06]">
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 mt-0.5 ${t.color}`}>{t.label}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground">{u.title}</p>
                          {u.description && <p className="text-[10px] text-muted-foreground mt-0.5">{u.description}</p>}
                          <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {u.date}</span>
                            {u.source && <span className="flex items-center gap-1"><ExternalLink className="w-3 h-3" /> {u.source}</span>}
                          </div>
                        </div>
                        <button onClick={() => deleteUpdate(u.id)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"><Trash2 className="w-3 h-3" /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ── AI Analysis Result ── */}
      {(aiAnalysis || aiLoading) && (
        <div className="cc-card rounded-xl p-5 border border-violet-500/20 bg-gradient-to-l from-violet-500/[0.04] to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <BrainCircuit className="w-5 h-5 text-violet-400" />
            <h3 className="text-sm font-bold text-foreground">التحليل التنافسي الذكي</h3>
            {aiLoading && <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />}
          </div>
          <div className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
            {aiAnalysis || "جاري تحليل بيانات المنافسين..."}
          </div>
        </div>
      )}

      {/* ── Price Comparison Table ── */}
      {allPlans.length > 0 && (
        <Section title="مقارنة الأسعار" icon={<TrendingUp className="w-5 h-5 text-cyan-400" />} defaultOpen={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">المنافس</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">الباقة</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">السعر</th>
                  <th className="text-right py-2 px-3 text-muted-foreground font-medium">الدورة</th>
                </tr>
              </thead>
              <tbody>
                {[...allPlans].sort((a, b) => a.price - b.price).map(p => (
                  <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-2 px-3 text-foreground font-medium">{p.competitorName}</td>
                    <td className="py-2 px-3 text-foreground">{p.name}</td>
                    <td className="py-2 px-3 text-emerald-400 font-bold">{p.price.toLocaleString()} ر.س</td>
                    <td className="py-2 px-3 text-muted-foreground">{BILLING_LABELS[p.billing]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      )}
    </div>
  );
}
