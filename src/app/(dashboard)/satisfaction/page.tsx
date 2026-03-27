"use client";

import { useState, useEffect } from "react";
import { DEMO_SATISFACTION } from "@/lib/demo-data";
import { fetchReviews, createReview, updateReview, deleteReview } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { REVIEW_CATEGORIES, REVIEW_TYPES, PLANS, getKpiStatus, KPI_STATUS_STYLES } from "@/lib/utils/constants";
import { KPICard } from "@/components/ui/kpi-card";
import { LineChart } from "@/components/ui/line-chart";
import { BarChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Review } from "@/types";
import {
  Heart,
  Star,
  TrendingUp,
  Users,
  ThumbsUp,
  Minus,
  ThumbsDown,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

/* ---------- helpers ---------- */

type ReviewType = "very_satisfied" | "satisfied" | "neutral" | "needs_improvement" | "unsatisfied";

function starsToType(stars: number): ReviewType {
  if (stars === 5) return "very_satisfied";
  if (stars === 4) return "satisfied";
  if (stars === 3) return "neutral";
  if (stars === 2) return "needs_improvement";
  return "unsatisfied";
}

const EMPTY_FORM = {
  customer_name: "",
  stars: 5,
  type: "very_satisfied" as ReviewType,
  category: "المنتج",
  plan: "" as string,
  review_date: new Date().toISOString().slice(0, 10),
  comment: "",
};

const feedbackTypeStyle: Record<string, { label: string; color: string; bg: string; icon: typeof ThumbsUp }> = {
  very_satisfied: { label: "راضي جداً", color: "text-cc-green", bg: "bg-green-dim", icon: ThumbsUp },
  satisfied: { label: "راضي", color: "text-cyan", bg: "bg-cyan-dim", icon: ThumbsUp },
  neutral: { label: "متوسط", color: "text-amber", bg: "bg-amber-dim", icon: Minus },
  needs_improvement: { label: "يحتاج تطوير", color: "text-cc-red", bg: "bg-red-dim", icon: ThumbsDown },
  unsatisfied: { label: "غير راضي", color: "text-cc-red", bg: "bg-red-dim", icon: ThumbsDown },
  // Legacy mappings for existing data
  promoter: { label: "راضي جداً", color: "text-cc-green", bg: "bg-green-dim", icon: ThumbsUp },
  detractor: { label: "غير راضي", color: "text-cc-red", bg: "bg-red-dim", icon: ThumbsDown },
};

const DEFAULT_STYLE = { label: "متوسط", color: "text-amber", bg: "bg-amber-dim", icon: Minus };

/* ---------- page ---------- */

export default function SatisfactionPage() {
  const d = DEMO_SATISFACTION;
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | ReviewType>("all");

  const { activeOrgId: orgId } = useAuth();
  /* reviews CRUD state */
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchReviews()
      .then(setReviews)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* KPI status */
  const csatStatus = getKpiStatus(d.csat, d.csatTarget);
  const npsStatus = getKpiStatus(d.nps, d.npsTarget);
  const promotersStatus = getKpiStatus(d.promotersPercent, d.promotersTarget);

  /* month filter */
  const { activeMonthIndex, filterCutoff } = useTopbarControls();
  const monthReviews = filterCutoff
    ? reviews.filter((r) => new Date(r.review_date || r.created_at) >= filterCutoff)
    : activeMonthIndex
      ? reviews.filter((r) => {
          const d = new Date(r.review_date || r.created_at);
          return d.getMonth() + 1 === activeMonthIndex.month && d.getFullYear() === activeMonthIndex.year;
        })
      : reviews;

  /* client search */
  const [clientSearch, setClientSearch] = useState("");

  /* filter reviews */
  const typeFilteredReviews = feedbackFilter === "all"
    ? monthReviews
    : monthReviews.filter((r) => r.type === feedbackFilter);
  const filteredReviews = clientSearch
    ? typeFilteredReviews.filter((r) => r.customer_name.toLowerCase().includes(clientSearch.toLowerCase()))
    : typeFilteredReviews;

  /* chart data */
  const trendData = d.monthlyTrend.map((m) => ({
    label: m.month.slice(0, 3),
    value: m.csat * 20,
    target: m.nps,
  }));

  const npsBarData = d.monthlyTrend.map((m) => ({
    label: m.month.slice(0, 3),
    values: [{ value: m.nps, color: "#00D4FF", label: "NPS" }],
  }));

  const starBarData = d.starDistribution.map((s) => ({
    label: `${s.stars}★`,
    values: [
      {
        value: s.percent,
        color: s.stars >= 4 ? "#10B981" : s.stars === 3 ? "#F59E0B" : "#EF4444",
        label: `${s.stars} نجوم`,
      },
    ],
  }));

  /* ─── Handlers ─── */
  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(review: Review) {
    setEditingId(review.id);
    setForm({
      customer_name: review.customer_name,
      stars: review.stars,
      type: review.type,
      category: review.category || "المنتج",
      plan: (review as Review & { plan?: string }).plan || "",
      review_date: review.review_date || new Date().toISOString().slice(0, 10),
      comment: review.comment || "",
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.customer_name.trim()) return;
    setSaving(true);
    try {
      const avatar = form.customer_name.charAt(0);
      if (editingId) {
        const updated = await updateReview(editingId, {
          customer_name: form.customer_name,
          avatar,
          stars: form.stars,
          type: form.type,
          category: form.category,
          review_date: form.review_date,
          comment: form.comment,
        });
        setReviews((prev) => prev.map((r) => (r.id === editingId ? updated : r)));
      } else {
        const created = await createReview({
          customer_name: form.customer_name,
          avatar,
          stars: form.stars,
          type: form.type,
          category: form.category,
          review_date: form.review_date,
          comment: form.comment,
        });
        setReviews((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(id: string) {
    setDeleteId(id);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (deleteId) {
      try {
        await deleteReview(deleteId);
        setReviews((prev) => prev.filter((r) => r.id !== deleteId));
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-green-dim flex items-center justify-center">
          <Heart className="w-4 h-4 text-cc-green" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">رضا العملاء</h1>
          <p className="text-xs text-muted-foreground">
            قياس رضا العملاء عبر CSAT وNPS وآرائهم التفصيلية
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
          <TabsTrigger value="nps">تفاصيل NPS</TabsTrigger>
          <TabsTrigger value="feedback">آراء العملاء</TabsTrigger>
        </TabsList>

        {/* ─── Tab 1: Overview ─── */}
        <TabsContent value="overview" className="space-y-6">
          {/* 3 KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KPICard
              value={`${d.csat}/5`}
              label="CSAT"
              target={`${d.csatTarget}/5`}
              status={csatStatus}
              icon={<Star className="w-4 h-4" />}
            />
            <KPICard
              value={`+${d.nps}`}
              label="NPS"
              target={`+${d.npsTarget}`}
              status={npsStatus}
              icon={<TrendingUp className="w-4 h-4" />}
            />
            <KPICard
              value={`${d.promotersPercent}%`}
              label="نسبة الرضى"
              target={`${d.promotersTarget}%`}
              status={promotersStatus}
              icon={<Users className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Star distribution */}
            <div className="cc-card rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">توزيع النجوم</h3>
              <BarChart data={starBarData} height={200} />
              <div className="mt-4 space-y-2">
                {d.starDistribution.map((s) => (
                  <div key={s.stars} className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-0.5 w-16 shrink-0">
                      {Array.from({ length: s.stars }).map((_, i) => (
                        <Star key={i} className="w-3 h-3 text-amber fill-amber" />
                      ))}
                    </div>
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber transition-all"
                        style={{ width: `${s.percent}%` }}
                      />
                    </div>
                    <span className="text-muted-foreground w-8 text-left">{s.percent}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CSAT + NPS trend */}
            <div className="cc-card rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-1">اتجاه الرضا</h3>
              <p className="text-xs text-muted-foreground mb-4">CSAT (أخضر) و NPS (خط الهدف) — آخر 6 أشهر</p>
              <LineChart data={trendData} showArea height={200} />
            </div>
          </div>

          {/* NPS segments */}
          <div className="cc-card rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">توزيع شرائح NPS</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <NPSSegment
                label="مروّجون (9-10)"
                percent={d.promotersPercent}
                description="يوصون بالمنتج"
                color="cc-green"
              />
              <NPSSegment
                label="محايدون (7-8)"
                percent={d.passivesPercent}
                description="راضون لكن قابلون للتحوّل"
                color="amber"
              />
              <NPSSegment
                label="منتقدون (0-6)"
                percent={d.detractorsPercent}
                description="غير راضين"
                color="cc-red"
              />
            </div>
            {/* Visual bar */}
            <div className="flex h-3 rounded-full overflow-hidden">
              <div className="bg-cc-green" style={{ width: `${d.promotersPercent}%` }} />
              <div className="bg-amber" style={{ width: `${d.passivesPercent}%` }} />
              <div className="bg-cc-red" style={{ width: `${d.detractorsPercent}%` }} />
            </div>
            <p className="text-xs text-muted-foreground mt-3 text-center">
              NPS = {d.promotersPercent}% − {d.detractorsPercent}% = <span className="text-cyan font-bold">+{d.nps}</span>
            </p>
          </div>
        </TabsContent>

        {/* ─── Tab 2: NPS Detail ─── */}
        <TabsContent value="nps" className="space-y-6">
          <div className="cc-card rounded-xl p-8 text-center">
            <p className="text-sm text-muted-foreground mb-2">مؤشر صافي الرضى</p>
            <p className="text-7xl font-extrabold text-cyan">+{d.nps}</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <span className={`w-2 h-2 rounded-full ${KPI_STATUS_STYLES[npsStatus].dot}`} />
              <span className={`text-sm ${KPI_STATUS_STYLES[npsStatus].text}`}>
                {KPI_STATUS_STYLES[npsStatus].label} — أعلى من الهدف (+{d.npsTarget})
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="cc-card rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">مقارنة مع صناعة SaaS</h3>
              <div className="flex items-end gap-6 justify-center">
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-cyan">+{d.nps}</p>
                  <p className="text-xs text-muted-foreground mt-1">نتيجتك</p>
                </div>
                <div className="text-center">
                  <p className="text-3xl font-extrabold text-muted-foreground">+{d.saasIndustryNPS}</p>
                  <p className="text-xs text-muted-foreground mt-1">متوسط SaaS</p>
                </div>
              </div>
              <p className="text-xs text-cc-green text-center mt-4">
                أعلى بـ {d.nps - d.saasIndustryNPS} نقطة من المتوسط
              </p>
            </div>

            <div className="cc-card rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-4">اتجاه NPS الشهري</h3>
              <BarChart data={npsBarData} height={200} />
            </div>
          </div>

          <div className="cc-card rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-2">توصية للتحسين</h3>
            <p className="text-sm text-muted-foreground leading-7">
              نسبة المنتقدين ({d.detractorsPercent}%) مرتفعة نسبياً. نوصي بالتركيز على تحسين تجربة العملاء في مجالات الأداء والتسعير — وهي الشكاوى الأكثر تكراراً. تقليل نسبة المنتقدين بمقدار 5% يرفع NPS إلى +{d.nps + 5}.
            </p>
          </div>
        </TabsContent>

        {/* ─── Tab 3: Customer Feedback (CRUD) ─── */}
        <TabsContent value="feedback" className="space-y-6">
          <div className="mb-2">
            <Input
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="ابحث باسم العميل..."
              className="max-w-xs"
            />
          </div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "very_satisfied", "satisfied", "neutral", "needs_improvement", "unsatisfied"] as const).map((filter) => {
                const labels = { all: "الكل", very_satisfied: "راضي جداً", satisfied: "راضي", neutral: "متوسط", needs_improvement: "يحتاج تطوير", unsatisfied: "غير راضي" };
                const colors = { all: "", very_satisfied: "text-cc-green", satisfied: "text-cyan", neutral: "text-amber", needs_improvement: "text-cc-red", unsatisfied: "text-cc-red" };
                return (
                  <button
                    key={filter}
                    onClick={() => setFeedbackFilter(filter)}
                    className={`px-4 py-2 rounded-lg text-xs transition-colors border ${
                      feedbackFilter === filter
                        ? "bg-white/[0.08] text-foreground border-cyan/30 font-medium"
                        : "text-muted-foreground border-border hover:text-foreground hover:bg-white/[0.03]"
                    } ${colors[filter]}`}
                  >
                    {labels[filter]}
                  </button>
                );
              })}
            </div>
            <Button onClick={openAddModal} className="gap-1.5">
              <Plus className="w-4 h-4" />
              إضافة رأي
            </Button>
          </div>

          {/* Feedback cards */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <ReviewCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReviews.map((review) => {
                const style = feedbackTypeStyle[review.type] || DEFAULT_STYLE;
                const Icon = style.icon;
                return (
                  <div key={review.id} className="cc-card rounded-xl p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-cyan-dim border border-cyan/30 flex items-center justify-center text-cyan font-bold text-sm">
                        {review.avatar || review.customer_name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">{review.customer_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${style.bg} ${style.color}`}>
                            <Icon className="w-3 h-3" />
                            {style.label}
                          </span>
                          {review.category && (
                            <span className="text-[10px] text-muted-foreground">{review.category}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star
                          key={s}
                          className={`w-4 h-4 ${s < review.stars ? "text-amber fill-amber" : "text-muted-foreground/30"}`}
                        />
                      ))}
                      {review.review_date && (
                        <span className="mr-2 text-[10px] text-muted-foreground">{review.review_date}</span>
                      )}
                    </div>

                    {review.comment && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{review.comment}</p>
                    )}

                    {/* Edit / Delete */}
                    <div className="flex items-center gap-1 pt-2 border-t border-border">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 gap-1 text-xs"
                        onClick={() => openEditModal(review)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        تعديل
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1 text-xs text-cc-red hover:text-cc-red"
                        onClick={() => confirmDelete(review.id)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {filteredReviews.length === 0 && !loading && (
                <div className="col-span-3 text-center text-muted-foreground py-12">
                  لا توجد آراء في هذه الفئة
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Add / Edit Review Modal ─── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? "تعديل الرأي" : "إضافة رأي جديد"}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "قم بتحديث رأي العميل" : "أدخل تفاصيل رأي العميل"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Customer name */}
            <div className="space-y-1.5">
              <Label>اسم العميل</Label>
              <Input
                value={form.customer_name}
                onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                placeholder="اسم العميل"
              />
            </div>

            {/* Stars */}
            <div className="space-y-1.5">
              <Label>التقييم</Label>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      const newStars = i + 1;
                      setForm({ ...form, stars: newStars, type: starsToType(newStars) });
                    }}
                    className="p-0.5 transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 ${i < form.stars ? "text-amber fill-amber" : "text-muted-foreground/30"}`}
                    />
                  </button>
                ))}
                <span className="mr-3 text-sm font-bold text-foreground">{form.stars}/5</span>
              </div>
            </div>

            {/* Type */}
            <div className="space-y-1.5">
              <Label>النوع</Label>
              <div className="flex flex-wrap gap-1.5">
                {REVIEW_TYPES.map((t) => {
                  const colorMap: Record<string, string> = {
                    very_satisfied: "text-cc-green border-cc-green/40 bg-green-dim",
                    satisfied: "text-cyan border-cyan/40 bg-cyan-dim",
                    neutral: "text-amber border-amber/40 bg-amber-dim",
                    needs_improvement: "text-cc-red border-cc-red/40 bg-red-dim",
                    unsatisfied: "text-cc-red border-cc-red/40 bg-red-dim",
                  };
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm({ ...form, type: t.value as ReviewType })}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-colors ${
                        form.type === t.value
                          ? colorMap[t.value]
                          : "border-border text-muted-foreground hover:border-muted-foreground"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Plan + Category row */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label>الخطة</Label>
                <Select value={form.plan} onValueChange={(v) => v && setForm({ ...form, plan: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر الخطة" />
                  </SelectTrigger>
                  <SelectContent>
                    {PLANS.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>


            </div>

            {/* Date */}
            <div className="space-y-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={form.review_date}
                onChange={(e) => setForm({ ...form, review_date: e.target.value })}
              />
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <Label>التعليق</Label>
              <textarea
                value={form.comment}
                onChange={(e) => setForm({ ...form, comment: e.target.value })}
                placeholder="رأي العميل..."
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة الرأي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا الرأي؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              حذف الرأي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- sub-components ---------- */

function NPSSegment({
  label,
  percent,
  description,
  color,
}: {
  label: string;
  percent: number;
  description: string;
  color: string;
}) {
  return (
    <div className="bg-background/50 rounded-lg border border-border p-4 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-2xl font-extrabold text-${color} mt-1`}>{percent}%</p>
      <p className="text-[10px] text-muted-foreground mt-1">{description}</p>
    </div>
  );
}

function ReviewCardSkeleton() {
  return (
    <div className="cc-card rounded-xl p-5 space-y-3">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-3/4" />
    </div>
  );
}
