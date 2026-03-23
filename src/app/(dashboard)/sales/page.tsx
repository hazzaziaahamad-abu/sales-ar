"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Deal } from "@/types";
import { fetchDeals, createDeal, updateDeal, deleteDeal } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { STAGES, SOURCES, SOURCE_COLORS, PLANS } from "@/lib/utils/constants";
import { DEMO_LOST_DEALS } from "@/lib/demo-data";
import SalesKPIsView from "@/components/SalesKPIsView";
import { formatMoney, formatMoneyFull, formatDate, formatPhone, formatPercent } from "@/lib/utils/format";
import { getKpiStatus, KPI_STATUS_STYLES, KPI_TARGETS } from "@/lib/utils/constants";
import { StatCard } from "@/components/ui/stat-card";
import { KPICard } from "@/components/ui/kpi-card";
import { ColorBadge } from "@/components/ui/color-badge";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TrendingUp,
  Plus,
  Pencil,
  Trash2,
  CheckCircle,
  Clock,
  Settings,
  MessageSquare,
  Phone,
  Target,
  BarChart3,
  RefreshCw,
  Heart,
  ArrowLeft,
} from "lucide-react";

/* ─── Stage badge color mapping ─── */
const STAGE_BADGE_COLOR: Record<string, "green" | "amber" | "purple" | "cyan" | "red" | "blue"> = {
  "تواصل": "green",
  "تفاوض": "purple",
  "تجهيز": "cyan",
  "انتظار الدفع": "amber",
  "مكتملة": "green",
  "تاجيل": "blue",
  "اعادة الاتصال في وقت اخر": "amber",
  "تجريبي": "purple",
  "مرفوض مع سبب": "red",
};

/* ─── Stage summary config ─── */
const STAGE_SUMMARY = [
  { stage: "مكتملة", color: "green" as const, icon: <CheckCircle className="w-4 h-4 text-cc-green" /> },
  { stage: "انتظار الدفع", color: "amber" as const, icon: <Clock className="w-4 h-4 text-amber" /> },
  { stage: "تجهيز", color: "cyan" as const, icon: <Settings className="w-4 h-4 text-cyan" /> },
  { stage: "تفاوض", color: "purple" as const, icon: <MessageSquare className="w-4 h-4 text-cc-purple" /> },
];

/* ─── Empty deal form shape ─── */
const EMPTY_FORM = {
  client_name: "",
  client_phone: "",
  deal_value: 0,
  assigned_rep_name: "",
  source: "حملة اعلانية",
  stage: "تواصل",
  plan: "",
  deal_date: new Date().toISOString().slice(0, 10),
  probability: 50,
};

export default function SalesPage() {
  const { activeOrgId: orgId } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  /* modal state */
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  /* delete confirmation */
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  /* card filter */
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [clientSearch, setClientSearch] = useState("");
  const { activeMonthIndex, filterCutoff } = useTopbarControls();

  /* time/month-filtered deals (used for all analytics + table) */
  const monthDeals = filterCutoff
    ? deals.filter((d) => new Date(d.deal_date || d.created_at) >= filterCutoff)
    : activeMonthIndex
      ? deals.filter((d) => d.month === activeMonthIndex.month && d.year === activeMonthIndex.year)
      : deals;
  const stageFilteredDeals = stageFilter ? monthDeals.filter((d) => d.stage === stageFilter) : monthDeals;
  const filteredDeals = clientSearch
    ? stageFilteredDeals.filter((d) => d.client_name.toLowerCase().includes(clientSearch.toLowerCase()))
    : stageFilteredDeals;

  useEffect(() => {
    setLoading(true);
    fetchDeals()
      .then(setDeals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId]);

  /* ─── Computed values ─── */
  const totalDeals = monthDeals.length;
  const totalValue = monthDeals.reduce((s, d) => s + d.deal_value, 0);
  const avgDealValue = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0;

  const stageCounts = monthDeals.reduce<Record<string, { count: number; value: number }>>((acc, d) => {
    if (!acc[d.stage]) acc[d.stage] = { count: 0, value: 0 };
    acc[d.stage].count++;
    acc[d.stage].value += d.deal_value;
    return acc;
  }, {});

  const sourceCounts = monthDeals.reduce<Record<string, number>>((acc, d) => {
    if (d.source) acc[d.source] = (acc[d.source] || 0) + 1;
    return acc;
  }, {});

  /* KPI calculations */
  const closedDeals = monthDeals.filter((d) => d.stage === "مكتملة").length;
  const winRate = totalDeals > 0 ? Math.round((closedDeals / totalDeals) * 100) : 0;
  const avgCycleDays = totalDeals > 0 ? Math.round(monthDeals.reduce((s, d) => s + d.cycle_days, 0) / totalDeals) : 0;
  const pipelineValue = monthDeals.filter((d) => d.stage !== "مكتملة").reduce((s, d) => s + d.deal_value, 0);

  /* Rep performance */
  const repPerformance = (() => {
    const repMap: Record<string, { deals: number; closed: number; value: number; cycleDays: number }> = {};
    monthDeals.forEach((d) => {
      const rep = d.assigned_rep_name || "غير محدد";
      if (!repMap[rep]) repMap[rep] = { deals: 0, closed: 0, value: 0, cycleDays: 0 };
      repMap[rep].deals++;
      repMap[rep].value += d.deal_value;
      repMap[rep].cycleDays += d.cycle_days;
      if (d.stage === "مكتملة") repMap[rep].closed++;
    });
    return Object.entries(repMap)
      .map(([name, data]) => ({
        name,
        deals: data.deals,
        closed: data.closed,
        value: data.value,
        winRate: data.deals > 0 ? Math.round((data.closed / data.deals) * 100) : 0,
        avgCycle: data.deals > 0 ? Math.round(data.cycleDays / data.deals) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  })();

  /* Lost deals analysis */
  const lostReasons = DEMO_LOST_DEALS.reduce<Record<string, { count: number; value: number }>>((acc, d) => {
    const reason = d.loss_reason || "أخرى";
    if (!acc[reason]) acc[reason] = { count: 0, value: 0 };
    acc[reason].count++;
    acc[reason].value += d.deal_value;
    return acc;
  }, {});
  const totalLostValue = DEMO_LOST_DEALS.reduce((s, d) => s + d.deal_value, 0);

  /* Source ROI data */
  const sourceData = SOURCES.map((src) => {
    const srcDeals = monthDeals.filter((d) => d.source === src);
    const srcWon = srcDeals.filter((d) => d.stage === "مكتملة");
    return {
      source: src,
      count: srcDeals.length,
      value: srcDeals.reduce((s, d) => s + d.deal_value, 0),
      won: srcWon.length,
      winRate: srcDeals.length > 0 ? Math.round((srcWon.length / srcDeals.length) * 100) : 0,
    };
  }).filter((s) => s.count > 0);

  /* Funnel data */
  const funnelStages = ["تواصل", "تفاوض", "تجهيز", "انتظار الدفع", "مكتملة"];
  const funnelData = funnelStages.map((stage) => ({
    stage,
    count: stageCounts[stage]?.count || 0,
    value: stageCounts[stage]?.value || 0,
  }));

  /* ─── Handlers ─── */
  function openAddModal() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEditModal(deal: Deal) {
    setEditingId(deal.id);
    setForm({
      client_name: deal.client_name,
      client_phone: deal.client_phone || "",
      deal_value: deal.deal_value,
      assigned_rep_name: deal.assigned_rep_name || "",
      source: deal.source || "حملة اعلانية",
      stage: deal.stage,
      plan: deal.plan || "",
      deal_date: deal.deal_date || new Date().toISOString().slice(0, 10),
      probability: deal.probability,
    });
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.client_name.trim()) return;
    setSaving(true);
    try {
      const dealDate = form.deal_date;
      const month = new Date(dealDate).getMonth() + 1;
      const year = new Date(dealDate).getFullYear();

      if (editingId) {
        const updated = await updateDeal(editingId, {
          client_name: form.client_name,
          client_phone: form.client_phone,
          deal_value: form.deal_value,
          assigned_rep_name: form.assigned_rep_name,
          source: form.source,
          stage: form.stage,
          plan: form.plan || undefined,
          deal_date: form.deal_date,
          probability: form.probability,
        });
        setDeals((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
      } else {
        const created = await createDeal({
          client_name: form.client_name,
          client_phone: form.client_phone,
          deal_value: form.deal_value,
          assigned_rep_name: form.assigned_rep_name,
          source: form.source,
          stage: form.stage,
          plan: form.plan || undefined,
          deal_date: form.deal_date,
          probability: form.probability,
          cycle_days: 0,
          month,
          year,
        });
        setDeals((prev) => [created, ...prev]);
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
        await deleteDeal(deleteId);
        setDeals((prev) => prev.filter((d) => d.id !== deleteId));
      } catch (err) {
        console.error(err);
      }
    }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      {/* ─── Page Header ─── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-dim flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-cyan" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">المبيعات</h1>
            <p className="text-xs text-muted-foreground">متابعة المبيعات وخط الأنابيب</p>
          </div>
        </div>
        <Button onClick={openAddModal} className="gap-1.5">
          <Plus className="w-4 h-4" />
          إضافة مبيع
        </Button>
      </div>

      {/* ─── Stage Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : STAGE_SUMMARY.map((s) => {
              const data = stageCounts[s.stage] || { count: 0, value: 0 };
              const pct = totalDeals > 0 ? Math.round((data.count / totalDeals) * 100) : 0;
              return (
                <StatCard
                  key={s.stage}
                  value={String(data.count)}
                  label={s.stage}
                  color={s.color}
                  progress={pct}
                  icon={s.icon}
                  subtext={formatMoney(data.value)}
                  onClick={() => setStageFilter(stageFilter === s.stage ? null : s.stage)}
                  active={stageFilter === s.stage}
                />
              );
            })}
      </div>

      {/* ─── Financial Summary Row ─── */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="cc-card rounded-2xl p-5 text-center" style={{ borderColor: "rgba(0,212,255,0.3)" }}>
            <p className="text-2xl font-extrabold text-cyan">{formatMoney(totalValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي قيمة المبيعات</p>
          </div>
          <div className="cc-card rounded-2xl p-5 text-center" style={{ borderColor: "rgba(16,185,129,0.3)" }}>
            <p className="text-2xl font-extrabold text-cc-green">{totalDeals}</p>
            <p className="text-xs text-muted-foreground mt-1">عدد المبيعات</p>
          </div>
          <div className="cc-card rounded-2xl p-5 text-center" style={{ borderColor: "rgba(139,92,246,0.3)" }}>
            <p className="text-2xl font-extrabold text-cc-purple">{formatMoney(avgDealValue)}</p>
            <p className="text-xs text-muted-foreground mt-1">متوسط قيمة المبيع</p>
          </div>
        </div>
      )}

      {/* ─── Source Distribution Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <StatCardSkeleton key={i} />)
          : SOURCES.map((src) => {
              const count = sourceCounts[src] || 0;
              const pct = totalDeals > 0 ? Math.round((count / totalDeals) * 100) : 0;
              const rawColor = SOURCE_COLORS[src] || "cyan";
              const cssVar = rawColor.replace("cc-", "");
              return (
                <div key={src} className="cc-card rounded-2xl p-4 border-t-2" style={{ borderTopColor: `var(--${cssVar})` }}>
                  <p className="text-xl font-bold text-foreground">{count}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{src}</p>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full bg-${rawColor}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">{pct}%</p>
                </div>
              );
            })}
      </div>

      {/* ─── Deals Table ─── */}
      <div className="cc-card rounded-2xl overflow-x-auto">
        <div className="p-4 pb-0">
          <Input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="ابحث باسم العميل..."
            className="max-w-xs"
          />
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العميل</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الجوال</TableHead>
              <TableHead>المصدر</TableHead>
              <TableHead>القيمة</TableHead>
              <TableHead>المرحلة</TableHead>
              <TableHead className="min-w-[120px]">الاحتمالية</TableHead>
              <TableHead>المسؤول</TableHead>
              <TableHead className="text-center">إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16 rounded-full" /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-1.5 flex-1 rounded-full" />
                      <Skeleton className="h-4 w-8" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Skeleton className="h-7 w-7 rounded-md" />
                      <Skeleton className="h-7 w-7 rounded-md" />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : filteredDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {stageFilter ? `لا توجد مبيعات في مرحلة "${stageFilter}"` : "لا توجد مبيعات"}
                </TableCell>
              </TableRow>
            ) : (
              filteredDeals.map((deal) => (
                <TableRow key={deal.id}>
                  <TableCell className="font-medium text-foreground">
                    {deal.client_name}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {deal.deal_date ? formatDate(deal.deal_date) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs font-mono" dir="ltr">
                    {deal.client_phone ? formatPhone(deal.client_phone) : "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {deal.source || "—"}
                  </TableCell>
                  <TableCell className="font-bold text-cyan text-xs">
                    {formatMoneyFull(deal.deal_value)}
                  </TableCell>
                  <TableCell>
                    <ColorBadge
                      text={deal.stage}
                      color={STAGE_BADGE_COLOR[deal.stage] || "blue"}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-cyan transition-all"
                          style={{ width: `${deal.probability}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-7 text-left" dir="ltr">
                        {deal.probability}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {deal.assigned_rep_name || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => openEditModal(deal)}
                        title="تعديل"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-xs"
                        onClick={() => confirmDelete(deal.id)}
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── Sales Team Performance ─── */}
      {!loading && repPerformance.length > 0 && (
        <div className="cc-card rounded-2xl overflow-hidden">
          <div className="p-5 pb-0">
            <h3 className="text-sm font-bold text-foreground">أداء فريق المبيعات</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="py-3 px-5 text-right font-medium">المندوب</th>
                  <th className="py-3 px-4 text-center font-medium">الصفقات</th>
                  <th className="py-3 px-4 text-center font-medium">مُغلق</th>
                  <th className="py-3 px-4 text-right font-medium min-w-[140px]">معدل الإغلاق</th>
                  <th className="py-3 px-4 text-center font-medium">متوسط الدورة</th>
                  <th className="py-3 px-4 text-right font-medium">إجمالي القيمة</th>
                  <th className="py-3 px-4 text-center font-medium">الترتيب</th>
                </tr>
              </thead>
              <tbody>
                {repPerformance.map((rep, idx) => {
                  const initial = rep.name.charAt(0);
                  const avatarColors = [
                    "bg-cyan/20 text-cyan",
                    "bg-cc-green/20 text-cc-green",
                    "bg-amber/20 text-amber",
                    "bg-cc-purple/20 text-cc-purple",
                    "bg-cc-blue/20 text-cc-blue",
                    "bg-pink/20 text-pink",
                  ];
                  const avatarColor = avatarColors[idx % avatarColors.length];
                  const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "—";
                  const rateColor = rep.winRate >= 30 ? "bg-amber" : rep.winRate > 0 ? "bg-cc-red" : "bg-muted-foreground/30";

                  return (
                    <tr key={rep.name} className="border-b border-border/50 hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ring-1 ring-white/10 ${avatarColor}`}>
                            {initial}
                          </div>
                          <span className="font-medium text-foreground text-sm">{rep.name}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-muted-foreground">{rep.deals}</td>
                      <td className="py-3.5 px-4 text-center text-muted-foreground">{rep.closed}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-bold ${rep.winRate >= 30 ? "text-amber" : rep.winRate > 0 ? "text-cc-red" : "text-muted-foreground"}`}>
                            {rep.winRate}%
                          </span>
                          <div className="flex-1 h-1.5 bg-muted/20 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${rateColor} transition-all`} style={{ width: `${rep.winRate}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-center text-muted-foreground">
                        <span dir="ltr">+{rep.avgCycle}</span> ي
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold text-cyan">{formatMoney(rep.value)}</td>
                      <td className="py-3.5 px-4 text-center text-lg">{medal}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── KPI Sub-tabs Section ─── */}
      <Tabs defaultValue="kpis" className="space-y-6">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="kpis">مؤشرات المبيعات</TabsTrigger>
          <TabsTrigger value="kpis-full">مؤشرات الأداء KPIs</TabsTrigger>
          <TabsTrigger value="renewals">التجديدات</TabsTrigger>
          <TabsTrigger value="satisfaction">رضا العملاء</TabsTrigger>
        </TabsList>

        {/* Tab 1: Sales KPIs */}
        <TabsContent value="kpis" className="space-y-6">
          {/* 4 KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              label="معدل الإغلاق"
              value={`${winRate}%`}
              target={`${KPI_TARGETS.win_rate}%`}
              status={getKpiStatus(winRate, KPI_TARGETS.win_rate)}
              icon={<Target className="w-4 h-4" />}
            />
            <KPICard
              label="متوسط دورة البيع"
              value={`${avgCycleDays} يوم`}
              target={`${KPI_TARGETS.avg_cycle_days} يوم`}
              status={getKpiStatus(KPI_TARGETS.avg_cycle_days, avgCycleDays)}
              icon={<Clock className="w-4 h-4" />}
            />
            <KPICard
              label="قيمة الأنبوب"
              value={formatMoney(pipelineValue)}
              target={formatMoney(KPI_TARGETS.pipeline_value)}
              status={getKpiStatus(pipelineValue, KPI_TARGETS.pipeline_value)}
              icon={<BarChart3 className="w-4 h-4" />}
            />
            <KPICard
              label="متوسط قيمة المبيع"
              value={formatMoney(avgDealValue)}
              target={formatMoney(KPI_TARGETS.avg_deal_value)}
              status={getKpiStatus(avgDealValue, KPI_TARGETS.avg_deal_value)}
              icon={<TrendingUp className="w-4 h-4" />}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Sales Funnel (Pipeline) */}
            <div className="cc-card rounded-2xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-5">قمع المبيعات (Sales Pipeline)</h3>
              <div className="space-y-4">
                {funnelData.map((f, i) => {
                  const maxValue = Math.max(...funnelData.map((x) => x.value), 1);
                  const widthPct = Math.max((f.value / maxValue) * 100, 15);
                  const barColors = ["bg-cyan", "bg-amber", "bg-cc-purple", "bg-amber", "bg-cc-green"];
                  const badgeColors = ["bg-cyan", "bg-amber/80", "bg-cc-purple", "bg-amber", "bg-cc-green"];
                  const prevValue = i > 0 ? (funnelData[i - 1]?.value || 0) : 0;
                  const changePct = prevValue > 0 ? Math.round(((f.value - prevValue) / prevValue) * 100) : null;
                  return (
                    <div key={f.stage} className="flex items-center gap-3">
                      {/* Stage label */}
                      <span className="text-xs text-muted-foreground w-20 text-right shrink-0">{f.stage}</span>
                      {/* Change percentage */}
                      {changePct !== null ? (
                        <span className="text-[10px] text-muted-foreground w-10 text-left shrink-0" dir="ltr">
                          {changePct > 0 ? `${changePct}%↑` : `${Math.abs(changePct)}%↓`}
                        </span>
                      ) : (
                        <span className="w-10 shrink-0" />
                      )}
                      {/* Value */}
                      <span className="text-xs text-muted-foreground w-12 text-left shrink-0">{formatMoney(f.value)}</span>
                      {/* Bar with badge */}
                      <div className="flex-1 h-9 bg-muted/15 rounded-lg overflow-visible relative flex items-center">
                        <div
                          className={`h-full rounded-lg ${barColors[i]} transition-all`}
                          style={{ width: `${widthPct}%` }}
                        />
                        {f.count > 0 && (
                          <span className={`mr-2 ${badgeColors[i]} text-white text-[11px] font-bold px-3 py-1 rounded-full shrink-0 whitespace-nowrap`}>
                            {f.count} عميل
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Lost Deals Analysis */}
            <div className="cc-card rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-5">
                <span className="text-lg">🔍</span>
                <h3 className="text-sm font-bold text-foreground">تحليل المبيعات الخاسرة</h3>
              </div>
              <div className="space-y-5">
                {(() => {
                  const reasonColors: Record<string, { bar: string; dot: string }> = {
                    "سعر": { bar: "bg-cc-red", dot: "bg-cc-red" },
                    "منافس": { bar: "bg-amber", dot: "bg-amber" },
                    "ميزة ناقصة": { bar: "bg-cc-purple", dot: "bg-cc-purple" },
                    "توقيت": { bar: "bg-cc-blue", dot: "bg-cc-blue" },
                    "أخرى": { bar: "bg-muted-foreground", dot: "bg-muted-foreground" },
                  };
                  const defaultColor = { bar: "bg-cyan", dot: "bg-cyan" };
                  return Object.entries(lostReasons)
                    .sort((a, b) => b[1].count - a[1].count)
                    .map(([reason, data]) => {
                      const pct = Math.round((data.count / DEMO_LOST_DEALS.length) * 100);
                      const colors = reasonColors[reason] || defaultColor;
                      return (
                        <div key={reason} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={`w-3 h-3 rounded-sm ${colors.dot}`} />
                              <span className="text-xs text-muted-foreground">{reason}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-cc-red text-xs font-bold">{data.count} مبيع</span>
                              <span className="text-muted-foreground text-xs">{pct}%</span>
                            </div>
                          </div>
                          <div className="h-2.5 bg-muted/20 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${colors.bar} transition-all`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    });
                })()}
              </div>
              <div className="mt-5 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">آخر المبيعات الخاسرة</p>
              </div>
            </div>
          </div>

          {/* Source ROI */}
          <div className="cc-card rounded-2xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-4">أداء المصادر</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="py-2 text-right font-medium">المصدر</th>
                    <th className="py-2 text-right font-medium">الصفقات</th>
                    <th className="py-2 text-right font-medium">القيمة</th>
                    <th className="py-2 text-right font-medium">فاز</th>
                    <th className="py-2 text-right font-medium">معدل الإغلاق</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceData.map((s) => (
                    <tr key={s.source} className="border-b border-border/50">
                      <td className="py-2.5 font-medium text-foreground">
                        <span className={`inline-block w-2 h-2 rounded-full bg-${SOURCE_COLORS[s.source] || "cyan"} ml-2`} />
                        {s.source}
                      </td>
                      <td className="py-2.5 text-muted-foreground">{s.count}</td>
                      <td className="py-2.5 text-cyan font-medium">{formatMoney(s.value)}</td>
                      <td className="py-2.5 text-cc-green font-medium">{s.won}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-cyan" style={{ width: `${s.winRate}%` }} />
                          </div>
                          <span className="text-muted-foreground">{s.winRate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* Tab: Full KPIs Dashboard */}
        <TabsContent value="kpis-full" className="space-y-6">
          <SalesKPIsView deals={monthDeals} lostDeals={DEMO_LOST_DEALS} />
        </TabsContent>

        {/* Tab 2: Renewals link */}
        <TabsContent value="renewals" className="space-y-6">
          <div className="cc-card rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-cyan-dim mx-auto flex items-center justify-center">
              <RefreshCw className="w-8 h-8 text-cyan" />
            </div>
            <h3 className="text-lg font-bold text-foreground">التجديدات</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              تابع تجديد العملاء ومعدلات الاحتفاظ وأسباب عدم التجديد من صفحة التجديدات المخصصة
            </p>
            <Link href="/renewals">
              <Button className="gap-2 mt-2">
                الذهاب إلى التجديدات
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </TabsContent>

        {/* Tab 3: Satisfaction link */}
        <TabsContent value="satisfaction" className="space-y-6">
          <div className="cc-card rounded-2xl p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-green-dim mx-auto flex items-center justify-center">
              <Heart className="w-8 h-8 text-cc-green" />
            </div>
            <h3 className="text-lg font-bold text-foreground">رضا العملاء</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              قياس رضا العملاء عبر CSAT وNPS وآرائهم التفصيلية من صفحة رضا العملاء المخصصة
            </p>
            <Link href="/satisfaction">
              <Button className="gap-2 mt-2">
                الذهاب إلى رضا العملاء
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Add / Edit Deal Modal ─── */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل مبيع" : "إضافة مبيع جديد"}</DialogTitle>
            <DialogDescription>
              {editingId ? "قم بتحديث بيانات المبيع" : "أدخل بيانات المبيع الجديد"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            {/* Client name */}
            <div className="grid gap-1.5">
              <Label htmlFor="client_name">اسم العميل</Label>
              <Input
                id="client_name"
                value={form.client_name}
                onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                placeholder="أدخل اسم العميل"
              />
            </div>

            {/* Phone + Value row */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="client_phone">رقم الجوال</Label>
                <Input
                  id="client_phone"
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deal_value">القيمة (ر.س)</Label>
                <Input
                  id="deal_value"
                  type="number"
                  value={form.deal_value || ""}
                  onChange={(e) =>
                    setForm({ ...form, deal_value: Number(e.target.value) || 0 })
                  }
                  placeholder="0"
                  dir="ltr"
                  className="text-right"
                />
              </div>
            </div>

            {/* Rep + Date row */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="assigned_rep_name">المسؤول</Label>
                <Input
                  id="assigned_rep_name"
                  value={form.assigned_rep_name}
                  onChange={(e) => setForm({ ...form, assigned_rep_name: e.target.value })}
                  placeholder="اسم المسؤول"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="deal_date">التاريخ</Label>
                <Input
                  id="deal_date"
                  type="date"
                  value={form.deal_date}
                  onChange={(e) => setForm({ ...form, deal_date: e.target.value })}
                  dir="ltr"
                  className="text-right"
                />
              </div>
            </div>

            {/* Source (radio buttons) */}
            <div className="grid gap-1.5">
              <Label>المصدر</Label>
              <div className="flex flex-wrap gap-2">
                {SOURCES.map((src) => (
                  <label
                    key={src}
                    className={`flex items-center gap-1.5 cursor-pointer rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      form.source === src
                        ? "border-cyan bg-cyan-dim text-cyan"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    <input
                      type="radio"
                      name="source"
                      value={src}
                      checked={form.source === src}
                      onChange={(e) => setForm({ ...form, source: e.target.value })}
                      className="sr-only"
                    />
                    {src}
                  </label>
                ))}
              </div>
            </div>

            {/* Stage (dropdown) */}
            <div className="grid gap-1.5">
              <Label>المرحلة</Label>
              <Select value={form.stage} onValueChange={(val) => val && setForm({ ...form, stage: val })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر المرحلة" />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((stg) => (
                    <SelectItem key={stg} value={stg}>
                      {stg}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Plan (dropdown) */}
            <div className="grid gap-1.5">
              <Label>الباقة</Label>
              <Select value={form.plan} onValueChange={(val) => val && setForm({ ...form, plan: val })}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="اختر الباقة" />
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

            {/* Probability slider */}
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="probability">احتمالية الإغلاق</Label>
                <span className="text-xs font-bold text-cyan">{form.probability}%</span>
              </div>
              <input
                id="probability"
                type="range"
                min={0}
                max={100}
                step={5}
                value={form.probability}
                onChange={(e) => setForm({ ...form, probability: Number(e.target.value) })}
                className="w-full h-1.5 bg-muted rounded-full appearance-none cursor-pointer accent-cyan [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-cyan [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة المبيع"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation Dialog ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف هذا المبيع؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              حذف المبيع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="cc-card rounded-xl p-4 border-t-2 border-t-muted">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-10" />
          <Skeleton className="h-3 w-20" />
        </div>
        <Skeleton className="w-9 h-9 rounded-lg" />
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-1.5 w-full rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
    </div>
  );
}
