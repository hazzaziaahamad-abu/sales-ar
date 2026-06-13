"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { fetchMarketingPlans, createMarketingPlan, deleteMarketingPlan, fetchPlanIdeas } from "@/lib/supabase/db";
import type { MarketingPlan } from "@/types";
import { Plus, Megaphone, Trash2, Calendar, Target, Package, ChevronLeft, Lightbulb } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-slate-500/20 text-slate-400" },
  in_progress: { label: "قيد التنفيذ", color: "bg-amber-500/20 text-amber-400" },
  done: { label: "مكتملة", color: "bg-emerald-500/20 text-emerald-400" },
  archived: { label: "مؤرشفة", color: "bg-zinc-500/20 text-zinc-400" },
};

const SEGMENTS = ["مطاعم", "كافيهات", "صالونات", "عام"];
const PRODUCTS = ["القائمة الإلكترونية", "الكاشير", "نظام ولاء", "نحجز", "درع", "القائمة الإلكترونية + الكاشير"];

export default function MarketingPlansPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<MarketingPlan[]>([]);
  const [ideaCounts, setIdeaCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", segment: "عام", related_product: "", objective: "", market_notes: "", start_date: "", end_date: "" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const data = await fetchMarketingPlans();
    setPlans(data);
    const counts: Record<string, number> = {};
    await Promise.all(data.map(async (p) => {
      const ideas = await fetchPlanIdeas(p.id);
      counts[p.id] = ideas.length;
    }));
    setIdeaCounts(counts);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await createMarketingPlan(form);
    setForm({ title: "", segment: "عام", related_product: "", objective: "", market_notes: "", start_date: "", end_date: "" });
    setShowForm(false);
    setSaving(false);
    load();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الخطة؟")) return;
    await deleteMarketingPlan(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-violet-400" />
            الخطط التسويقية
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">بناء وإدارة الخطط التسويقية الاستراتيجية</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/20 font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          خطة جديدة
        </button>
      </div>

      {showForm && (
        <div className="glass-surface rounded-[14px] border border-violet-500/20 p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">إنشاء خطة جديدة</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">العنوان *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" placeholder="مثال: رمضان ٢٠٢٧ – مطاعم" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">الفئة *</label>
              <select value={form.segment} onChange={(e) => setForm({ ...form, segment: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                {SEGMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">المنتج</label>
              <select value={form.related_product} onChange={(e) => setForm({ ...form, related_product: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50">
                <option value="">—</option>
                {PRODUCTS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">الهدف الاستراتيجي</label>
              <input value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">تاريخ البداية</label>
              <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">تاريخ النهاية</label>
              <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">ملاحظات السوق</label>
            <textarea value={form.market_notes} onChange={(e) => setForm({ ...form, market_notes: e.target.value })} rows={3} className="w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-none" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !form.title.trim()} className="px-5 py-2 rounded-lg bg-violet-500 text-white font-semibold text-sm hover:bg-violet-600 transition-colors disabled:opacity-50">
              {saving ? "جارٍ الحفظ..." : "إنشاء"}
            </button>
            <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg bg-white/[0.06] text-muted-foreground font-semibold text-sm hover:text-foreground transition-colors">إلغاء</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-48 rounded-[14px] bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Megaphone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا توجد خطط تسويقية بعد</p>
          <p className="text-sm mt-1">ابدأ بإنشاء أول خطة تسويقية</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const st = STATUS_MAP[plan.status] || STATUS_MAP.draft;
            return (
              <div key={plan.id} className="glass-surface rounded-[14px] border border-border p-5 hover:border-violet-500/30 transition-colors group relative">
                <button onClick={() => handleDelete(plan.id)} className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <Link href={`/marketing-plans/${plan.id}`} className="block">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-sm font-bold text-foreground leading-snug">{plan.title}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", st.color)}>{st.label}</span>
                    <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{plan.segment}</span>
                  </div>
                  {plan.related_product && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <Package className="w-3 h-3" />
                      <span>{plan.related_product}</span>
                    </div>
                  )}
                  {plan.objective && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                      <Target className="w-3 h-3" />
                      <span className="line-clamp-2">{plan.objective}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
                    {plan.start_date && (
                      <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        <span>{plan.start_date} → {plan.end_date || "—"}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Lightbulb className="w-3 h-3" />
                      <span>{ideaCounts[plan.id] || 0} فكرة</span>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
