"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getOrgId } from "@/lib/supabase/db";
import { PLAN_STATUSES, PLATFORMS, platformLabel, type ContentPlan } from "@/lib/content-plans/types";
import { MarketingTabs } from "@/components/content-plans/MarketingTabs";
import { Plus, Clapperboard, Trash2, Link2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

const inputCls = "w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50";
const EMPTY = { title: "", description: "", audience: "", related_product: "", tone: "", platforms: [] as string[] };

export default function ContentMarketingPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<ContentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(
    () =>
      fetch(`/api/content-plans?org=${getOrgId()}`, { cache: "no-store" })
        .then((res) => res.json())
        .catch(() => ({}))
        .then((json) => { setPlans(json.plans ?? []); setLoading(false); }),
    []
  );

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    const res = await fetch("/api/content-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, org: getOrgId() }),
    });
    const json = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return alert(json.error || "تعذّر الإنشاء");
    router.push(`/marketing-plans/content/${json.plan.id}`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف خطة المحتوى وكل عناصرها؟")) return;
    await fetch(`/api/content-plans/${id}`, { method: "DELETE" });
    load();
  };

  return (
    <div className="space-y-6">
      <MarketingTabs active="content" />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
            <Clapperboard className="w-6 h-6 text-violet-400" />
            التسويق بالمحتوى
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">خطط محتوى للفيديوهات وتصاميم البوستات — عنوان وفكرة وسكربت، مع توليد أفكار بالذكاء الاصطناعي ورابط مشاركة</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/20 text-violet-400 hover:bg-violet-500/30 border border-violet-500/20 font-semibold text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          خطة محتوى جديدة
        </button>
      </div>

      {showForm && (
        <div className="glass-surface rounded-[14px] border border-violet-500/20 p-5 space-y-4">
          <h3 className="text-sm font-bold text-foreground">إنشاء خطة محتوى</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">العنوان *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} placeholder="مثال: محتوى أكتوبر – الكافيهات" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">الجمهور المستهدف</label>
              <input value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className={inputCls} placeholder="مثال: أصحاب المطاعم الصغيرة" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">المنتج</label>
              <input value={form.related_product} onChange={(e) => setForm({ ...form, related_product: e.target.value })} className={inputCls} placeholder="مثال: القائمة الإلكترونية" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">نبرة المحتوى</label>
              <input value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} className={inputCls} placeholder="مثال: عفوية وخفيفة باللهجة السعودية" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">الهدف / وصف الخطة</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={cn(inputCls, "resize-none")} />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">المنصات</label>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((p) => {
                const on = form.platforms.includes(p.value);
                return (
                  <button
                    key={p.value}
                    onClick={() => setForm({ ...form, platforms: on ? form.platforms.filter((x) => x !== p.value) : [...form.platforms, p.value] })}
                    className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                      on ? "bg-violet-500/20 text-violet-300 border-violet-500/40" : "bg-white/[0.03] text-muted-foreground border-border")}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
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
          {[...Array(3)].map((_, i) => <div key={i} className="h-40 rounded-[14px] bg-white/[0.04] animate-pulse" />)}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Clapperboard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">لا توجد خطط محتوى بعد</p>
          <p className="text-sm mt-1">أنشئ أول خطة وابدأ تضيف أفكار الفيديوهات والبوستات</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const st = PLAN_STATUSES.find((s) => s.value === plan.status) ?? PLAN_STATUSES[0];
            return (
              <div key={plan.id} className="glass-surface rounded-[14px] border border-border p-5 hover:border-violet-500/30 transition-colors group relative">
                <button onClick={() => handleDelete(plan.id)} className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
                <Link href={`/marketing-plans/content/${plan.id}`} className="block">
                  <h3 className="text-sm font-bold text-foreground leading-snug mb-3">{plan.title}</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", st.color)}>{st.label}</span>
                    {plan.platforms?.slice(0, 3).map((p) => (
                      <span key={p} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{platformLabel(p)}</span>
                    ))}
                  </div>
                  {plan.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{plan.description}</p>}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{plan.items_count ?? 0} محتوى</span>
                    {plan.share_enabled && (
                      <span className="flex items-center gap-1 text-cyan-400"><Link2 className="w-3 h-3" />مشاركة {plan.share_mode === "edit" ? "وتعديل" : "للعرض"}</span>
                    )}
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
