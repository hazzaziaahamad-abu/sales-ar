"use client";

import { useState, useEffect } from "react";
import type { Deal, Renewal, MonthlyExpense, MonthlyBudget, StartupCost } from "@/types";
import { fetchDeals, fetchRenewals, fetchMonthlyExpenses, createExpense, deleteExpense, updateExpense, updateDeal, fetchMonthlyBudget, upsertBudgetItem, deleteBudgetItem, copyBudgetFromPreviousMonth, fetchStartupCosts, createStartupCost, deleteStartupCost, fetchEmployees } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { useTopbarControls } from "@/components/layout/topbar-context";
import { MONTHS_AR, SOURCE_COLORS } from "@/lib/utils/constants";
import { formatMoney, formatMoneyFull } from "@/lib/utils/format";
import { StatCard } from "@/components/ui/stat-card";
import { DonutChart } from "@/components/ui/donut-chart";
import { BarChart } from "@/components/ui/bar-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Banknote,
  TrendingUp,
  Target,
  BarChart3,
  Plus,
  Trash2,
  Receipt,
  Pencil,
  ClipboardList,
  Copy,
  AlertTriangle,
  CheckCircle2,
  ArrowDown,
  ArrowUp,
  Building2,
  Timer,
  TrendingDown,
  CalendarClock,
  Users,
} from "lucide-react";

/* CSS variable color → hex for donut chart */
const COLOR_HEX: Record<string, string> = {
  cyan: "#00D4FF",
  "cc-purple": "#8B5CF6",
  "cc-green": "#10B981",
  pink: "#EC4899",
  amber: "#F59E0B",
  "cc-blue": "#3B82F6",
  "muted-foreground": "#64748B",
};

const DEFAULT_CATEGORIES = ["رواتب", "اتصالات", "استضافة", "إيجار", "تسويق", "مواصلات", "صيانة", "اشتراكات", "مستلزمات", "أخرى"];

const MONTHLY_TARGET = 17500;

export default function FinancePage() {
  const { activeOrgId: orgId } = useAuth();
  const { activeMonthIndex } = useTopbarControls();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [expenses, setExpenses] = useState<MonthlyExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ category: "", amount: "", description: "", expense_date: "", employee_name: "" });
  const [employees, setEmployees] = useState<{ id: string; name: string }[]>([]);
  const [savingExpense, setSavingExpense] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [editingExpense, setEditingExpense] = useState<MonthlyExpense | null>(null);
  const [editForm, setEditForm] = useState({ category: "", amount: "", description: "", expense_date: "", employee_name: "" });
  const [savingEdit, setSavingEdit] = useState(false);
  const [customCategory, setCustomCategory] = useState("");

  /* Budget state */
  const [budget, setBudget] = useState<MonthlyBudget[]>([]);
  const [budgetDialog, setBudgetDialog] = useState(false);
  const [budgetForm, setBudgetForm] = useState({ category: "", planned_amount: "", notes: "" });
  const [savingBudget, setSavingBudget] = useState(false);
  const [editingBudget, setEditingBudget] = useState<MonthlyBudget | null>(null);
  const [editBudgetForm, setEditBudgetForm] = useState({ planned_amount: "", notes: "" });
  const [copyingBudget, setCopyingBudget] = useState(false);
  const [budgetCustomCat, setBudgetCustomCat] = useState("");

  /* Startup costs state */
  const [startupCosts, setStartupCosts] = useState<StartupCost[]>([]);
  const [startupDialog, setStartupDialog] = useState(false);
  const [startupForm, setStartupForm] = useState({ category: "", item_name: "", amount: "", paid_date: "", notes: "" });
  const [savingStartup, setSavingStartup] = useState(false);
  const [startupCustomCat, setStartupCustomCat] = useState("");

  const now = new Date();
  const selectedMonth = activeMonthIndex?.month ?? (now.getMonth() + 1);
  const selectedYear = activeMonthIndex?.year ?? now.getFullYear();

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchDeals(), fetchRenewals(), fetchMonthlyExpenses(selectedMonth, selectedYear), fetchMonthlyBudget(selectedMonth, selectedYear), fetchStartupCosts(), fetchEmployees()])
      .then(([d, r, e, b, sc, emp]) => {
        setDeals(d);
        setRenewals(r);
        setExpenses(e);
        setBudget(b);
        setStartupCosts(sc);
        setEmployees(emp.map(em => ({ id: em.id, name: em.name })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
    setCategoryFilter(null);
  }, [orgId, selectedMonth, selectedYear]);

  async function handleAddExpense() {
    if (!expenseForm.category.trim() || !expenseForm.amount) return;
    setSavingExpense(true);
    try {
      const expDate = expenseForm.expense_date || now.toISOString().split("T")[0];
      const d = new Date(expDate);
      const expMonth = d.getMonth() + 1;
      const expYear = d.getFullYear();
      const descParts: string[] = [];
      if (expenseForm.category === "رواتب" && expenseForm.employee_name) descParts.push(`راتب: ${expenseForm.employee_name}`);
      if (expenseForm.description.trim()) descParts.push(expenseForm.description.trim());
      const created = await createExpense({
        category: expenseForm.category.trim(),
        amount: parseFloat(expenseForm.amount),
        description: descParts.join(" - ") || undefined,
        expense_date: expDate,
        month: expMonth,
        year: expYear,
      });
      // Only add to current list if it belongs to the selected month
      if (expMonth === selectedMonth && expYear === selectedYear) {
        setExpenses((prev) => [created, ...prev].sort((a, b) => b.amount - a.amount));
      }
      setExpenseForm({ category: "", amount: "", description: "", expense_date: "", employee_name: "" });
      setExpenseDialog(false);
    } catch (err) {
      console.error(err);
    }
    setSavingExpense(false);
  }

  async function handleDeleteExpense(id: string) {
    await deleteExpense(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }

  function openEditDialog(exp: MonthlyExpense) {
    setEditingExpense(exp);
    let empName = "";
    let desc = exp.description || "";
    if (exp.category === "رواتب" && desc.startsWith("راتب: ")) {
      const parts = desc.split(" - ");
      empName = parts[0].replace("راتب: ", "");
      desc = parts.slice(1).join(" - ");
    }
    setEditForm({
      category: exp.category,
      amount: String(exp.amount),
      description: desc,
      expense_date: exp.expense_date,
      employee_name: empName,
    });
  }

  async function handleEditExpense() {
    if (!editingExpense || !editForm.category.trim() || !editForm.amount) return;
    setSavingEdit(true);
    try {
      const expDate = editForm.expense_date || editingExpense.expense_date;
      const d = new Date(expDate);
      const expMonth = d.getMonth() + 1;
      const expYear = d.getFullYear();
      const editDescParts: string[] = [];
      if (editForm.category === "رواتب" && editForm.employee_name) editDescParts.push(`راتب: ${editForm.employee_name}`);
      if (editForm.description.trim()) editDescParts.push(editForm.description.trim());
      const updated = await updateExpense(editingExpense.id, {
        category: editForm.category.trim(),
        amount: parseFloat(editForm.amount),
        description: editDescParts.join(" - ") || undefined,
        expense_date: expDate,
        month: expMonth,
        year: expYear,
      });
      if (expMonth === selectedMonth && expYear === selectedYear) {
        setExpenses((prev) => prev.map((e) => e.id === updated.id ? updated : e).sort((a, b) => b.amount - a.amount));
      } else {
        setExpenses((prev) => prev.filter((e) => e.id !== editingExpense.id));
      }
      setEditingExpense(null);
    } catch (err) {
      console.error(err);
    }
    setSavingEdit(false);
  }

  /* ─── Budget Handlers ─── */
  async function handleAddBudget() {
    if (!budgetForm.category.trim() || !budgetForm.planned_amount) return;
    setSavingBudget(true);
    try {
      const created = await upsertBudgetItem({
        category: budgetForm.category.trim(),
        planned_amount: parseFloat(budgetForm.planned_amount),
        month: selectedMonth,
        year: selectedYear,
        notes: budgetForm.notes.trim() || undefined,
      });
      setBudget(prev => {
        const existing = prev.findIndex(b => b.category === created.category);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = created;
          return next.sort((a, b) => b.planned_amount - a.planned_amount);
        }
        return [...prev, created].sort((a, b) => b.planned_amount - a.planned_amount);
      });
      setBudgetForm({ category: "", planned_amount: "", notes: "" });
      setBudgetDialog(false);
    } catch (err) { console.error(err); }
    setSavingBudget(false);
  }

  async function handleEditBudget() {
    if (!editingBudget || !editBudgetForm.planned_amount) return;
    setSavingBudget(true);
    try {
      const updated = await upsertBudgetItem({
        category: editingBudget.category,
        planned_amount: parseFloat(editBudgetForm.planned_amount),
        month: selectedMonth,
        year: selectedYear,
        notes: editBudgetForm.notes.trim() || undefined,
      });
      setBudget(prev => prev.map(b => b.id === editingBudget.id ? updated : b).sort((a, b) => b.planned_amount - a.planned_amount));
      setEditingBudget(null);
    } catch (err) { console.error(err); }
    setSavingBudget(false);
  }

  async function handleDeleteBudget(id: string) {
    await deleteBudgetItem(id);
    setBudget(prev => prev.filter(b => b.id !== id));
  }

  async function handleCopyBudget() {
    setCopyingBudget(true);
    try {
      const copied = await copyBudgetFromPreviousMonth(selectedMonth, selectedYear);
      if (copied.length > 0) {
        setBudget(copied.sort((a, b) => b.planned_amount - a.planned_amount));
      }
    } catch (err) { console.error(err); }
    setCopyingBudget(false);
  }

  /* ─── Startup Cost Handlers ─── */
  const STARTUP_CATEGORIES = ["تقنية", "تراخيص", "تجهيزات", "تسويق تأسيسي", "قانونية", "توظيف", "أخرى"];
  const allStartupCategories = [...new Set([...STARTUP_CATEGORIES, ...startupCosts.map(c => c.category)])];

  async function handleAddStartupCost() {
    if (!startupForm.item_name.trim() || !startupForm.amount) return;
    setSavingStartup(true);
    try {
      const created = await createStartupCost({
        category: startupForm.category.trim() || "أخرى",
        item_name: startupForm.item_name.trim(),
        amount: parseFloat(startupForm.amount),
        paid_date: startupForm.paid_date || undefined,
        notes: startupForm.notes.trim() || undefined,
      });
      setStartupCosts(prev => [created, ...prev].sort((a, b) => b.amount - a.amount));
      setStartupForm({ category: "", item_name: "", amount: "", paid_date: "", notes: "" });
      setStartupDialog(false);
    } catch (err) { console.error(err); }
    setSavingStartup(false);
  }

  async function handleDeleteStartupCost(id: string) {
    await deleteStartupCost(id);
    setStartupCosts(prev => prev.filter(c => c.id !== id));
  }

  /* ─── Collection Status Handler ─── */
  async function handleCollectionStatus(dealId: string, status: "محصّل" | "معلق" | "متأخر") {
    try {
      const updated = await updateDeal(dealId, { collection_status: status });
      setDeals(prev => prev.map(d => d.id === dealId ? updated : d));
    } catch (err) {
      console.error(err);
    }
  }

  // Merge default categories with existing ones from expenses
  const allCategories = [...new Set([...DEFAULT_CATEGORIES, ...expenses.map((e) => e.category)])];

  /* ─── Helper: match renewal to a month (by month only, ignoring year) ─── */
  function renewalMatchesMonth(r: Renewal, m: number) {
    const rd = new Date(r.renewal_date);
    return rd.getMonth() + 1 === m;
  }

  /* ─── Computed Metrics (filtered by selected month) ─── */
  const monthDeals = deals.filter((d) => d.month === selectedMonth && d.year === selectedYear);
  const closedDeals = monthDeals.filter((d) => d.stage === "مكتملة");
  const salesRevenue = closedDeals.reduce((s, d) => s + d.deal_value, 0);
  const pipelineValue = monthDeals.filter((d) => d.stage !== "مكتملة").reduce((s, d) => s + d.deal_value, 0);

  /* Renewals revenue for the selected month */
  const monthRenewals = renewals.filter((r) => {
    if (r.status !== "مكتمل") return false;
    return renewalMatchesMonth(r, selectedMonth);
  });
  const renewalsRevenue = monthRenewals.reduce((s, r) => s + r.plan_price, 0);

  /* Total revenue = sales + renewals */
  const totalRevenue = salesRevenue + renewalsRevenue;
  const avgDealValue = closedDeals.length > 0 ? Math.round(salesRevenue / closedDeals.length) : 0;

  /* MRR: selected month total revenue */
  const mrr = totalRevenue;
  const arr = mrr * 12;

  /* ─── Monthly Revenue (last 12 months from selected) — sales + renewals ─── */
  const allClosedDeals = deals.filter((d) => d.stage === "مكتملة");
  const completedRenewals = renewals.filter((r) => r.status === "مكتمل");
  const monthlyRevenue = (() => {
    const months: { month: string; salesRev: number; renewalsRev: number; revenue: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(selectedYear, selectedMonth - 1 - i, 1);
      const m = d.getMonth() + 1;
      const y = d.getFullYear();
      const sRev = allClosedDeals
        .filter((deal) => deal.month === m && deal.year === y)
        .reduce((s, deal) => s + deal.deal_value, 0);
      const rRev = completedRenewals
        .filter((r) => renewalMatchesMonth(r, m))
        .reduce((s, r) => s + r.plan_price, 0);
      months.push({ month: MONTHS_AR[d.getMonth()], salesRev: sRev, renewalsRev: rRev, revenue: sRev + rRev });
    }
    return months;
  })();

  const maxRevenue = Math.max(...monthlyRevenue.map((m) => m.revenue), 1);
  const useMillions = maxRevenue >= 1_000_000;
  const divisor = useMillions ? 1_000_000 : 1;
  const chartUnit = useMillions ? "مليون ر.س" : "ر.س";

  const barData = monthlyRevenue.map((m) => ({
    label: m.month.slice(0, 3),
    values: [
      { value: m.salesRev / divisor, color: "#00D4FF", label: "مبيعات" },
      { value: m.renewalsRev / divisor, color: "#10B981", label: "تجديدات" },
    ],
  }));

  /* ─── Revenue by Source (donut) — includes renewals as a source ─── */
  const sourceRevenue = (() => {
    const map: Record<string, number> = {};
    closedDeals.forEach((d) => {
      const src = d.source || "اخرى";
      map[src] = (map[src] || 0) + d.deal_value;
    });
    if (renewalsRevenue > 0) {
      map["تجديدات"] = (map["تجديدات"] || 0) + renewalsRevenue;
    }
    return Object.entries(map)
      .map(([source, value]) => ({ source, value }))
      .sort((a, b) => b.value - a.value);
  })();

  const RENEWALS_COLOR = "#10B981";
  const donutSegments = sourceRevenue.map((s) => ({
    label: s.source,
    value: s.value,
    color: s.source === "تجديدات" ? RENEWALS_COLOR : (COLOR_HEX[SOURCE_COLORS[s.source] || "cyan"] || "#00D4FF"),
  }));

  const totalClosedRevenue = sourceRevenue.reduce((s, x) => s + x.value, 0);

  /* ─── 1. Revenue by Product/Plan (donut) ─── */
  const PRODUCT_COLORS: Record<string, string> = {
    "MENU": "#00D4FF",
    "نحجز": "#8B5CF6",
    "درع": "#F59E0B",
  };
  const productRevenue = (() => {
    const map: Record<string, number> = {};
    closedDeals.forEach((d) => {
      const product = d.plan?.trim() || "أخرى";
      map[product] = (map[product] || 0) + d.deal_value;
    });
    if (renewalsRevenue > 0) {
      // Distribute renewals by plan_name
      monthRenewals.forEach((r) => {
        const product = r.plan_name?.trim() || "أخرى";
        map[product] = (map[product] || 0) + r.plan_price;
      });
    }
    return Object.entries(map)
      .map(([product, value]) => ({ product, value }))
      .sort((a, b) => b.value - a.value);
  })();
  const productDonutSegments = productRevenue.map((p, i) => ({
    label: p.product,
    value: p.value,
    color: PRODUCT_COLORS[p.product] || ["#EC4899", "#10B981", "#3B82F6", "#EF4444", "#64748B"][i % 5],
  }));
  const totalProductRevenue = productRevenue.reduce((s, x) => s + x.value, 0);

  /* ─── 2. ARPU (Average Revenue Per User) ─── */
  const activeCustomers = new Set(closedDeals.map(d => d.client_name?.trim().toLowerCase())).size;
  const arpu = activeCustomers > 0 ? Math.round(totalRevenue / activeCustomers) : 0;

  /* ─── 3. MoM Growth % ─── */
  const momGrowth = (() => {
    const prevIdx = monthlyRevenue.length - 2; // second to last = previous month
    const currIdx = monthlyRevenue.length - 1; // last = current month
    if (prevIdx < 0 || currIdx < 0) return null;
    const prevRev = monthlyRevenue[prevIdx].revenue;
    const currRev = monthlyRevenue[currIdx].revenue;
    if (prevRev === 0) return currRev > 0 ? 100 : 0;
    return Math.round(((currRev - prevRev) / prevRev) * 100);
  })();

  /* ─── 4. Threatened Revenue (renewals expiring in 30/60 days) ─── */
  const threatenedRevenue = (() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
    const in60 = new Date(today); in60.setDate(in60.getDate() + 60);

    const activeRenewals = renewals.filter(r => r.status !== "مكتمل" && r.status !== "ملغي بسبب");
    const expiring30 = activeRenewals.filter(r => {
      const rd = new Date(r.renewal_date);
      return rd >= today && rd <= in30;
    });
    const expiring60 = activeRenewals.filter(r => {
      const rd = new Date(r.renewal_date);
      return rd > in30 && rd <= in60;
    });
    const overdue = activeRenewals.filter(r => {
      const rd = new Date(r.renewal_date);
      return rd < today;
    });

    return {
      overdue: { count: overdue.length, value: overdue.reduce((s, r) => s + r.plan_price, 0), items: overdue },
      in30: { count: expiring30.length, value: expiring30.reduce((s, r) => s + r.plan_price, 0), items: expiring30 },
      in60: { count: expiring60.length, value: expiring60.reduce((s, r) => s + r.plan_price, 0), items: expiring60 },
      total: overdue.reduce((s, r) => s + r.plan_price, 0) + expiring30.reduce((s, r) => s + r.plan_price, 0) + expiring60.reduce((s, r) => s + r.plan_price, 0),
    };
  })();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-green-dim flex items-center justify-center">
          <Banknote className="w-4 h-4 text-cc-green" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">المالية</h1>
          <p className="text-xs text-muted-foreground">
            مراقبة المؤشرات المالية الرئيسية
          </p>
        </div>
      </div>

      {/* KPI cards — 6 metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="cc-card rounded-[14px] p-4">
              <Skeleton className="h-7 w-20 mb-2" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))
        ) : (
          <>
            <StatCard
              value={formatMoney(arr)}
              label="ARR السنوي"
              color="cyan"
              icon={<Banknote className="w-4 h-4 text-cyan" />}
            />
            <StatCard
              value={formatMoney(mrr)}
              label="MRR الشهري"
              color="green"
              icon={<TrendingUp className="w-4 h-4 text-cc-green" />}
            />
            <StatCard
              value={formatMoney(totalRevenue)}
              label="إجمالي الإيرادات"
              color="purple"
              icon={<BarChart3 className="w-4 h-4 text-cc-purple" />}
            />
            <StatCard
              value={formatMoney(arpu)}
              label="ARPU متوسط لكل عميل"
              color="blue"
              icon={<Users className="w-4 h-4 text-cc-blue" />}
            />
            <div className="cc-card rounded-[14px] p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-muted-foreground">النمو الشهري</span>
                {momGrowth !== null && momGrowth >= 0 ? (
                  <ArrowUp className="w-4 h-4 text-cc-green" />
                ) : (
                  <ArrowDown className="w-4 h-4 text-cc-red" />
                )}
              </div>
              <p className={`text-2xl font-bold ${
                momGrowth === null ? "text-muted-foreground" :
                momGrowth >= 0 ? "text-cc-green" : "text-cc-red"
              }`}>
                {momGrowth !== null ? `${momGrowth > 0 ? "+" : ""}${momGrowth}%` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">MoM%</p>
            </div>
            <StatCard
              value={formatMoney(pipelineValue)}
              label="قيمة خط الأنابيب"
              color="amber"
              icon={<Target className="w-4 h-4 text-amber" />}
            />
          </>
        )}
      </div>

      {/* ─── Monthly Revenue Target ─── */}
      {!loading && (
        <div className="cc-card rounded-[14px] p-5 border border-cyan/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-cyan" />
              <h3 className="text-sm font-bold text-foreground">هدف الإيرادات الشهري</h3>
            </div>
            <span className={`text-2xl font-bold ${totalRevenue >= MONTHLY_TARGET ? "text-cc-green" : "text-amber"}`}>
              {MONTHLY_TARGET > 0 ? Math.round((totalRevenue / MONTHLY_TARGET) * 100) : 0}%
            </span>
          </div>
          <div className="h-4 bg-white/[0.06] rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                totalRevenue >= MONTHLY_TARGET ? "bg-gradient-to-l from-emerald-400 to-emerald-600" : "bg-gradient-to-l from-cyan-400 to-cyan-600"
              }`}
              style={{ width: `${Math.min(100, MONTHLY_TARGET > 0 ? (totalRevenue / MONTHLY_TARGET) * 100 : 0)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>محقق: <span className="text-foreground font-bold">{formatMoneyFull(totalRevenue)}</span></span>
            <span>الهدف: <span className="text-foreground font-bold">{formatMoneyFull(MONTHLY_TARGET)}</span></span>
            <span>متبقي: <span className={`font-bold ${totalRevenue >= MONTHLY_TARGET ? "text-cc-green" : "text-amber"}`}>
              {totalRevenue >= MONTHLY_TARGET ? "تم التحقيق!" : formatMoneyFull(MONTHLY_TARGET - totalRevenue)}
            </span></span>
          </div>
        </div>
      )}

      {/* Two charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Revenue bar chart */}
        <div className="cc-card rounded-[14px] p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">
            الإيرادات الشهرية ({chartUnit})
          </h3>
          {loading ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : (
            <>
              <BarChart data={barData} height={280} />
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-cyan-dim/30 text-center">
                  <p className="text-lg font-bold text-cyan">
                    {formatMoney(totalRevenue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    إجمالي الإيرادات
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-green-dim/30 text-center">
                  <p className="text-lg font-bold text-cc-green">
                    {closedDeals.length}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    مبيعات مكتملة
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-purple-dim/30 text-center">
                  <p className="text-lg font-bold text-cc-purple">
                    {formatMoney(avgDealValue)}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    متوسط قيمة المبيع
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Revenue by Source donut */}
        <div className="cc-card rounded-[14px] p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">
            الإيرادات حسب المصدر
          </h3>
          {loading ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : donutSegments.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              لا توجد بيانات
            </div>
          ) : (
            <>
              <DonutChart
                segments={donutSegments}
                centerValue={formatMoney(totalClosedRevenue)}
                centerLabel="إجمالي"
              />
              <div className="mt-4 space-y-2">
                {sourceRevenue.map((s, i) => {
                  const pct = totalClosedRevenue > 0 ? Math.round((s.value / totalClosedRevenue) * 100) : 0;
                  const hex = COLOR_HEX[SOURCE_COLORS[s.source] || "cyan"] || "#00D4FF";
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="text-muted-foreground">{s.source}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">
                          {formatMoney(s.value)}
                        </span>
                        <span className="text-muted-foreground">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ─── Product Revenue Donut + Threatened Revenue Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue by Product donut */}
        <div className="cc-card rounded-[14px] p-5">
          <h3 className="text-sm font-bold text-foreground mb-4">
            الإيرادات حسب المنتج
          </h3>
          {loading ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : productDonutSegments.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
              لا توجد بيانات
            </div>
          ) : (
            <>
              <DonutChart
                segments={productDonutSegments}
                centerValue={formatMoney(totalProductRevenue)}
                centerLabel="إجمالي"
              />
              <div className="mt-4 space-y-2">
                {productRevenue.map((p, i) => {
                  const pct = totalProductRevenue > 0 ? Math.round((p.value / totalProductRevenue) * 100) : 0;
                  const hex = productDonutSegments[i]?.color || "#00D4FF";
                  return (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: hex }}
                        />
                        <span className="text-muted-foreground">{p.product}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">
                          {formatMoney(p.value)}
                        </span>
                        <span className="text-muted-foreground">
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Threatened Revenue */}
        <div className="cc-card rounded-[14px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-amber" />
            <h3 className="text-sm font-bold text-foreground">إيرادات مهددة</h3>
            {threatenedRevenue.total > 0 && (
              <span className="mr-auto text-lg font-bold text-amber">{formatMoney(threatenedRevenue.total)}</span>
            )}
          </div>
          {loading ? (
            <Skeleton className="h-[280px] w-full rounded-lg" />
          ) : threatenedRevenue.total === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
              <CheckCircle2 className="w-10 h-10 text-cc-green opacity-40" />
              <span>لا توجد إيرادات مهددة حالياً</span>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Overdue */}
              {threatenedRevenue.overdue.count > 0 && (
                <div className="p-4 rounded-lg bg-cc-red/10 border border-cc-red/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-cc-red" />
                      <span className="text-sm font-bold text-cc-red">متأخرة</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{threatenedRevenue.overdue.count} عقد</span>
                  </div>
                  <p className="text-xl font-bold text-cc-red">{formatMoney(threatenedRevenue.overdue.value)}</p>
                  <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                    {threatenedRevenue.overdue.items.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate flex-1">{r.customer_name}</span>
                        <span className="text-cc-red font-medium mr-2">{formatMoney(r.plan_price)}</span>
                        <span className="text-muted-foreground/60">{r.renewal_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiring in 30 days */}
              {threatenedRevenue.in30.count > 0 && (
                <div className="p-4 rounded-lg bg-amber/10 border border-amber/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-amber" />
                      <span className="text-sm font-bold text-amber">تنتهي خلال 30 يوم</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{threatenedRevenue.in30.count} عقد</span>
                  </div>
                  <p className="text-xl font-bold text-amber">{formatMoney(threatenedRevenue.in30.value)}</p>
                  <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                    {threatenedRevenue.in30.items.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate flex-1">{r.customer_name}</span>
                        <span className="text-amber font-medium mr-2">{formatMoney(r.plan_price)}</span>
                        <span className="text-muted-foreground/60">{r.renewal_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiring in 60 days */}
              {threatenedRevenue.in60.count > 0 && (
                <div className="p-4 rounded-lg bg-cyan/10 border border-cyan/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CalendarClock className="w-4 h-4 text-cyan" />
                      <span className="text-sm font-bold text-cyan">تنتهي خلال 60 يوم</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{threatenedRevenue.in60.count} عقد</span>
                  </div>
                  <p className="text-xl font-bold text-cyan">{formatMoney(threatenedRevenue.in60.value)}</p>
                  <div className="mt-2 space-y-1 max-h-[120px] overflow-y-auto">
                    {threatenedRevenue.in60.items.map(r => (
                      <div key={r.id} className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground truncate flex-1">{r.customer_name}</span>
                        <span className="text-cyan font-medium mr-2">{formatMoney(r.plan_price)}</span>
                        <span className="text-muted-foreground/60">{r.renewal_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Collection Status Section ─── */}
      {!loading && closedDeals.length > 0 && (
        <div className="cc-card rounded-[14px] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Banknote className="w-5 h-5 text-cc-green" />
            <h3 className="text-sm font-bold text-foreground">حالة التحصيل — {MONTHS_AR[selectedMonth - 1]} {selectedYear}</h3>
          </div>

          {/* Status summary pills */}
          {(() => {
            const collected = closedDeals.filter(d => d.collection_status === "محصّل");
            const pending = closedDeals.filter(d => !d.collection_status || d.collection_status === "معلق");
            const overdue = closedDeals.filter(d => d.collection_status === "متأخر");
            const collectedVal = collected.reduce((s, d) => s + d.deal_value, 0);
            const pendingVal = pending.reduce((s, d) => s + d.deal_value, 0);
            const overdueVal = overdue.reduce((s, d) => s + d.deal_value, 0);

            return (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 rounded-lg bg-cc-green/10 border border-cc-green/20 text-center">
                    <p className="text-xl font-bold text-cc-green">{formatMoney(collectedVal)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">محصّل ({collected.length})</p>
                  </div>
                  <div className="p-3 rounded-lg bg-amber/10 border border-amber/20 text-center">
                    <p className="text-xl font-bold text-amber">{formatMoney(pendingVal)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">معلق ({pending.length})</p>
                  </div>
                  <div className="p-3 rounded-lg bg-cc-red/10 border border-cc-red/20 text-center">
                    <p className="text-xl font-bold text-cc-red">{formatMoney(overdueVal)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">متأخر ({overdue.length})</p>
                  </div>
                </div>

                {/* Collection progress bar */}
                {(() => {
                  const total = collectedVal + pendingVal + overdueVal;
                  const collPct = total > 0 ? Math.round((collectedVal / total) * 100) : 0;
                  return (
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">نسبة التحصيل</span>
                        <span className="text-xs font-bold text-cc-green">{collPct}%</span>
                      </div>
                      <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-600 transition-all duration-700"
                          style={{ width: `${collPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })()}

                {/* Deals table with status toggle */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">العميل</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">القيمة</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-muted-foreground">المنتج</th>
                        <th className="text-center py-2 px-3 text-xs font-semibold text-muted-foreground">حالة التحصيل</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedDeals.map(deal => {
                        const status = deal.collection_status || "معلق";
                        return (
                          <tr key={deal.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                            <td className="py-2.5 px-3 text-foreground font-medium">{deal.client_name}</td>
                            <td className="py-2.5 px-3 text-cyan font-semibold">{formatMoney(deal.deal_value)}</td>
                            <td className="py-2.5 px-3 text-muted-foreground">{deal.plan || "—"}</td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center justify-center gap-1">
                                {(["محصّل", "معلق", "متأخر"] as const).map(s => (
                                  <button
                                    key={s}
                                    onClick={() => handleCollectionStatus(deal.id, s)}
                                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border ${
                                      status === s
                                        ? s === "محصّل" ? "bg-cc-green/15 text-cc-green border-cc-green/30"
                                        : s === "متأخر" ? "bg-cc-red/15 text-cc-red border-cc-red/30"
                                        : "bg-amber/15 text-amber border-amber/30"
                                        : "bg-white/[0.03] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                                    }`}
                                  >
                                    {s}
                                  </button>
                                ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ─── Monthly Budget Plan vs Actual ─── */}
      <div className="cc-card rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan" />
            <h3 className="text-sm font-bold text-foreground">الخطة المالية الشهرية — {MONTHS_AR[selectedMonth - 1]} {selectedYear}</h3>
          </div>
          <div className="flex items-center gap-2">
            {budget.length === 0 && (
              <Button size="sm" variant="outline" onClick={handleCopyBudget} disabled={copyingBudget} className="gap-1.5 text-xs">
                <Copy className="w-3.5 h-3.5" /> {copyingBudget ? "جاري النسخ..." : "نسخ من الشهر السابق"}
              </Button>
            )}
            <Button size="sm" onClick={() => setBudgetDialog(true)} className="gap-1.5">
              <Plus className="w-4 h-4" /> إضافة بند
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : budget.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد خطة مالية لهذا الشهر</p>
            <p className="text-sm mt-1">أضف البنود المخططة أو انسخها من الشهر السابق</p>
          </div>
        ) : (
          <>
            {/* Budget overview cards */}
            {(() => {
              const totalPlanned = budget.reduce((s, b) => s + b.planned_amount, 0);
              const totalActual = expenses.reduce((s, e) => s + e.amount, 0);
              const variance = totalPlanned - totalActual;
              const usagePct = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 100) : 0;
              const overBudgetCount = budget.filter(b => {
                const actual = expenses.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0);
                return actual > b.planned_amount;
              }).length;

              return (
                <div className="space-y-5">
                  {/* Summary row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 rounded-lg bg-cyan/10 border border-cyan/20 text-center">
                      <p className="text-xl font-bold text-cyan">{formatMoney(totalPlanned)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">إجمالي الميزانية</p>
                    </div>
                    <div className="p-3 rounded-lg bg-cc-purple/10 border border-cc-purple/20 text-center">
                      <p className="text-xl font-bold text-cc-purple">{formatMoney(totalActual)}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">المصروف الفعلي</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center border ${
                      variance >= 0 ? "bg-cc-green/10 border-cc-green/20" : "bg-cc-red/10 border-cc-red/20"
                    }`}>
                      <p className={`text-xl font-bold ${variance >= 0 ? "text-cc-green" : "text-cc-red"}`}>
                        {variance >= 0 ? "+" : ""}{formatMoney(variance)}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{variance >= 0 ? "متبقي من الميزانية" : "تجاوز الميزانية"}</p>
                    </div>
                    <div className={`p-3 rounded-lg text-center border ${
                      usagePct <= 80 ? "bg-cc-green/10 border-cc-green/20" : usagePct <= 100 ? "bg-amber/10 border-amber/20" : "bg-cc-red/10 border-cc-red/20"
                    }`}>
                      <p className={`text-xl font-bold ${
                        usagePct <= 80 ? "text-cc-green" : usagePct <= 100 ? "text-amber" : "text-cc-red"
                      }`}>{usagePct}%</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">نسبة الاستخدام</p>
                    </div>
                  </div>

                  {/* Overall progress bar */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">استهلاك الميزانية الإجمالي</span>
                      {overBudgetCount > 0 && (
                        <span className="text-xs text-cc-red flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> {overBudgetCount} بند تجاوز الميزانية
                        </span>
                      )}
                    </div>
                    <div className="h-3 bg-white/[0.04] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          usagePct <= 80 ? "bg-gradient-to-l from-emerald-400 to-emerald-600" :
                          usagePct <= 100 ? "bg-gradient-to-l from-amber-400 to-amber-600" :
                          "bg-gradient-to-l from-red-400 to-red-600"
                        }`}
                        style={{ width: `${Math.min(usagePct, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Budget items comparison table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground">البند</th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground">المخطط</th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground">الفعلي</th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground">الفرق</th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-muted-foreground">الاستخدام</th>
                          <th className="text-center py-3 px-3 text-xs font-semibold text-muted-foreground w-20">إجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {budget.map(b => {
                          const actual = expenses.filter(e => e.category === b.category).reduce((s, e) => s + e.amount, 0);
                          const diff = b.planned_amount - actual;
                          const pct = b.planned_amount > 0 ? Math.round((actual / b.planned_amount) * 100) : 0;
                          const isOver = actual > b.planned_amount;
                          const barColor = pct <= 80 ? "bg-cc-green" : pct <= 100 ? "bg-amber" : "bg-cc-red";
                          const textColor = pct <= 80 ? "text-cc-green" : pct <= 100 ? "text-amber" : "text-cc-red";

                          return (
                            <tr key={b.id} className="group border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  {isOver ? (
                                    <ArrowUp className="w-3.5 h-3.5 text-cc-red shrink-0" />
                                  ) : actual > 0 ? (
                                    <CheckCircle2 className="w-3.5 h-3.5 text-cc-green shrink-0" />
                                  ) : (
                                    <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                                  )}
                                  <span className="font-medium text-foreground">{b.category}</span>
                                  {b.notes && <span className="text-[10px] text-muted-foreground hidden sm:inline">({b.notes})</span>}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-cyan font-semibold">{formatMoney(b.planned_amount)}</td>
                              <td className="py-3 px-3 text-cc-purple font-semibold">{formatMoney(actual)}</td>
                              <td className={`py-3 px-3 font-semibold ${isOver ? "text-cc-red" : "text-cc-green"}`}>
                                <span className="flex items-center gap-1">
                                  {isOver ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                                  {formatMoney(Math.abs(diff))}
                                </span>
                              </td>
                              <td className="py-3 px-3">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-white/[0.04] rounded-full overflow-hidden min-w-[60px]">
                                    <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                  </div>
                                  <span className={`text-xs font-bold ${textColor} min-w-[36px] text-left`}>{pct}%</span>
                                </div>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => { setEditingBudget(b); setEditBudgetForm({ planned_amount: String(b.planned_amount), notes: b.notes || "" }); }}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-cyan/10 text-muted-foreground hover:text-cyan transition-all"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteBudget(b.id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-cc-red/10 text-muted-foreground hover:text-cc-red transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-border font-bold">
                          <td className="py-3 px-3 text-foreground">الإجمالي</td>
                          <td className="py-3 px-3 text-cyan">{formatMoney(totalPlanned)}</td>
                          <td className="py-3 px-3 text-cc-purple">{formatMoney(totalActual)}</td>
                          <td className={`py-3 px-3 ${variance >= 0 ? "text-cc-green" : "text-cc-red"}`}>
                            {variance >= 0 ? "+" : ""}{formatMoney(variance)}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`text-xs font-bold ${
                              usagePct <= 80 ? "text-cc-green" : usagePct <= 100 ? "text-amber" : "text-cc-red"
                            }`}>{usagePct}%</span>
                          </td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Unbudgeted expenses warning */}
                  {(() => {
                    const budgetCats = new Set(budget.map(b => b.category));
                    const unbudgeted = expenses.filter(e => !budgetCats.has(e.category));
                    if (unbudgeted.length === 0) return null;
                    const unbudgetedTotal = unbudgeted.reduce((s, e) => s + e.amount, 0);
                    const unbudgetedCats = [...new Set(unbudgeted.map(e => e.category))];
                    return (
                      <div className="mt-4 p-3 rounded-lg bg-amber/10 border border-amber/20">
                        <div className="flex items-center gap-2 mb-1">
                          <AlertTriangle className="w-4 h-4 text-amber" />
                          <span className="text-sm font-semibold text-amber">مصاريف خارج الميزانية</span>
                          <span className="text-xs text-muted-foreground mr-auto">{formatMoney(unbudgetedTotal)}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {unbudgetedCats.map(cat => {
                            const catTotal = unbudgeted.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0);
                            return (
                              <span key={cat} className="px-2 py-1 rounded-md bg-amber/15 text-amber text-[11px] font-medium">
                                {cat}: {formatMoney(catTotal)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ─── Monthly Expenses Section ─── */}
      <div className="cc-card rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-cc-red" />
            <h3 className="text-sm font-bold text-foreground">المصاريف الشهرية — {MONTHS_AR[selectedMonth - 1]} {selectedYear}</h3>
          </div>
          <Button size="sm" onClick={() => setExpenseDialog(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> إضافة مصروف
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">
            <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد مصاريف مسجلة لهذا الشهر</p>
            <p className="text-sm mt-1">أضف أول مصروف لتتبع النفقات</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
              <div className="p-3 rounded-lg bg-cc-red/10 border border-cc-red/20 text-center">
                <p className="text-xl font-bold text-cc-red">{formatMoney(expenses.reduce((s, e) => s + e.amount, 0))}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">إجمالي المصاريف</p>
              </div>
              <div className="p-3 rounded-lg bg-amber/10 border border-amber/20 text-center">
                <p className="text-xl font-bold text-amber">{expenses.length}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">عدد الأصناف</p>
              </div>
              <div className="p-3 rounded-lg bg-cyan/10 border border-cyan/20 text-center">
                <p className="text-xl font-bold text-cyan">
                  {formatMoney(totalRevenue > 0 ? totalRevenue - expenses.reduce((s, e) => s + e.amount, 0) : 0)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">صافي الربح</p>
              </div>
            </div>

            {/* Category filter */}
            {(() => {
              const categories = [...new Set(expenses.map((e) => e.category))];
              if (categories.length < 2) return null;
              return (
                <div className="flex flex-wrap gap-2 mb-4">
                  <button
                    onClick={() => setCategoryFilter(null)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      categoryFilter === null
                        ? "bg-cyan/15 text-cyan border-cyan/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    الكل ({expenses.length})
                  </button>
                  {categories.map((cat) => {
                    const count = expenses.filter((e) => e.category === cat).length;
                    const catTotal = expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0);
                    return (
                      <button
                        key={cat}
                        onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                          categoryFilter === cat
                            ? "bg-cyan/15 text-cyan border-cyan/30"
                            : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                        }`}
                      >
                        {cat} ({count}) — {formatMoney(catTotal)}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* Expense items sorted by amount (highest first) */}
            <div className="space-y-2">
              {(() => {
                const filtered = categoryFilter ? expenses.filter((e) => e.category === categoryFilter) : expenses;
                const maxAmount = Math.max(...filtered.map((e) => e.amount), 1);
                const sorted = [...filtered].sort((a, b) => b.amount - a.amount);
                return sorted.map((exp, idx) => {
                  const pct = Math.round((exp.amount / maxAmount) * 100);
                  // Color gradient: top items red → middle amber → bottom green
                  const ratio = sorted.length > 1 ? idx / (sorted.length - 1) : 0;
                  let barColor = "bg-cc-red";
                  let textColor = "text-cc-red";
                  if (ratio > 0.6) {
                    barColor = "bg-cc-green";
                    textColor = "text-cc-green";
                  } else if (ratio > 0.3) {
                    barColor = "bg-amber";
                    textColor = "text-amber";
                  }

                  const totalExp = filtered.reduce((s, e) => s + e.amount, 0);
                  const expPct = totalExp > 0 ? Math.round((exp.amount / totalExp) * 100) : 0;

                  return (
                    <div key={exp.id} className="group relative bg-white/[0.02] rounded-[14px] p-3 border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className={`text-xs font-bold ${textColor} w-8 shrink-0`}>#{idx + 1}</span>
                          <span className="text-sm font-semibold text-foreground truncate">{exp.category}</span>
                          {exp.description && (
                            <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">— {exp.description}</span>
                          )}
                          <span className="text-[10px] text-muted-foreground/60 hidden md:inline">{exp.expense_date}</span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`text-sm font-bold ${textColor}`}>{formatMoney(exp.amount)}</span>
                          <span className="text-[10px] text-muted-foreground">{expPct}%</span>
                          <button
                            onClick={() => openEditDialog(exp)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-cyan/10 text-muted-foreground hover:text-cyan transition-all"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-cc-red/10 text-muted-foreground hover:text-cc-red transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Category breakdown donut */}
            {expenses.length >= 2 && (
              <div className="mt-5 pt-5 border-t border-border">
                <h4 className="text-xs font-bold text-muted-foreground mb-3">توزيع المصاريف حسب الصنف</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {(() => {
                    const catMap: Record<string, number> = {};
                    expenses.forEach((e) => { catMap[e.category] = (catMap[e.category] || 0) + e.amount; });
                    const totalExp = expenses.reduce((s, e) => s + e.amount, 0);
                    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
                    const catColors = ["#EF4444", "#F59E0B", "#8B5CF6", "#00D4FF", "#10B981", "#EC4899", "#3B82F6"];
                    return cats.map(([cat, val], i) => {
                      const pct = totalExp > 0 ? Math.round((val / totalExp) * 100) : 0;
                      const color = catColors[i % catColors.length];
                      return (
                        <div key={cat} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center">
                          <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ backgroundColor: color }} />
                          <p className="text-[11px] font-semibold text-foreground truncate">{cat}</p>
                          <p className="text-xs font-bold mt-0.5" style={{ color }}>{formatMoney(val)}</p>
                          <p className="text-[10px] text-muted-foreground">{pct}%</p>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ─── Startup Costs & ROI Section ─── */}
      <div className="cc-card rounded-[14px] p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cc-purple" />
            <h3 className="text-sm font-bold text-foreground">مصاريف تأسيس المشروع</h3>
          </div>
          <Button size="sm" onClick={() => setStartupDialog(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> إضافة تكلفة
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
          </div>
        ) : startupCosts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-foreground">لا توجد مصاريف تأسيس مسجلة</p>
            <p className="text-sm mt-1 mb-5">اختر تصنيف وأضف أول بند لمتابعة استرداد رأس المال</p>
            {/* Quick-add categories */}
            <div className="flex flex-wrap justify-center gap-2 mb-4">
              {allStartupCategories.map(cat => (
                <button
                  key={cat}
                  onClick={() => { setStartupForm({ ...startupForm, category: cat }); setStartupDialog(true); }}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-cc-purple/20 bg-cc-purple/10 text-cc-purple hover:bg-cc-purple/20 hover:border-cc-purple/40 transition-all"
                >
                  + {cat}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-center gap-2 max-w-xs mx-auto">
              <Input
                value={startupCustomCat}
                onChange={(e) => setStartupCustomCat(e.target.value)}
                placeholder="أو اكتب تصنيف جديد..."
                className="text-center text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!startupCustomCat.trim()}
                onClick={() => {
                  setStartupForm({ ...startupForm, category: startupCustomCat.trim() });
                  setStartupCustomCat("");
                  setStartupDialog(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        ) : (
          <>
            {(() => {
              const totalStartup = startupCosts.reduce((s, c) => s + c.amount, 0);

              // Calculate cumulative net profit across all months
              const allClosedD = deals.filter(d => d.stage === "مكتملة");
              const allCompRen = renewals.filter(r => r.status === "مكتمل");

              // Build monthly profit history (all months that have data)
              const monthlyProfits: { month: number; year: number; label: string; revenue: number; expenses: number; netProfit: number }[] = [];

              // Get unique months from deals and renewals
              const monthSet = new Set<string>();
              allClosedD.forEach(d => monthSet.add(`${d.year}-${d.month}`));
              allCompRen.forEach(r => {
                const rd = new Date(r.renewal_date);
                monthSet.add(`${rd.getFullYear()}-${rd.getMonth() + 1}`);
              });
              // Also add current selected month
              monthSet.add(`${selectedYear}-${selectedMonth}`);

              const sortedMonths = [...monthSet].map(s => {
                const [y, m] = s.split("-").map(Number);
                return { year: y, month: m };
              }).sort((a, b) => a.year - b.year || a.month - b.month);

              // We only have current month's expenses loaded
              // For net profit: revenue from all months, expenses only from current month loaded
              // Simple approach: calculate cumulative revenue and subtract current month expenses * months approximation
              // Better: just use actual total revenue - total startup costs to show recovery
              const totalAllRevenue = allClosedD.reduce((s, d) => s + d.deal_value, 0) + allCompRen.reduce((s, r) => s + r.plan_price, 0);
              const currentMonthExpenses = expenses.reduce((s, e) => s + e.amount, 0);
              const currentNetProfit = totalRevenue - currentMonthExpenses;

              // Recovery calculation
              const recoveredAmount = Math.max(0, totalAllRevenue - currentMonthExpenses); // Simplified: total revenue earned
              const recoveryPct = totalStartup > 0 ? Math.min(Math.round((recoveredAmount / totalStartup) * 100), 100) : 0;
              const remaining = Math.max(0, totalStartup - recoveredAmount);
              const isRecovered = recoveredAmount >= totalStartup;

              // Estimated months to recover (based on current month net profit)
              const monthsToRecover = currentNetProfit > 0 && !isRecovered
                ? Math.ceil(remaining / currentNetProfit)
                : 0;

              // Category breakdown
              const catMap: Record<string, number> = {};
              startupCosts.forEach(c => { catMap[c.category] = (catMap[c.category] || 0) + c.amount; });
              const catEntries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
              const catColors = ["#8B5CF6", "#00D4FF", "#F59E0B", "#EC4899", "#10B981", "#3B82F6", "#EF4444"];

              return (
                <div className="space-y-5">
                  {/* Recovery progress */}
                  <div className={`rounded-[14px] p-5 border ${
                    isRecovered
                      ? "bg-gradient-to-l from-emerald-500/10 to-emerald-600/5 border-emerald-500/20"
                      : "bg-gradient-to-l from-purple-500/10 to-indigo-500/5 border-purple-500/20"
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {isRecovered ? (
                          <CheckCircle2 className="w-5 h-5 text-cc-green" />
                        ) : (
                          <Timer className="w-5 h-5 text-cc-purple" />
                        )}
                        <span className="text-sm font-bold text-foreground">
                          {isRecovered ? "تم استرداد رأس المال بالكامل! 🎉" : "مؤشر استرداد رأس المال"}
                        </span>
                      </div>
                      <span className={`text-2xl font-bold ${isRecovered ? "text-cc-green" : "text-cc-purple"}`}>
                        {recoveryPct}%
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="h-4 bg-white/[0.10] rounded-full overflow-hidden mb-3">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isRecovered
                            ? "bg-gradient-to-l from-emerald-400 to-emerald-600"
                            : recoveryPct >= 70
                              ? "bg-gradient-to-l from-amber-400 to-amber-600"
                              : "bg-gradient-to-l from-purple-400 to-indigo-600"
                        }`}
                        style={{ width: `${recoveryPct}%` }}
                      />
                    </div>

                    {/* Key numbers */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center">
                        <p className="text-lg font-bold text-cc-purple">{formatMoney(totalStartup)}</p>
                        <p className="text-[10px] text-muted-foreground">إجمالي التأسيس</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold text-cyan">{formatMoney(recoveredAmount)}</p>
                        <p className="text-[10px] text-muted-foreground">تم استرداده</p>
                      </div>
                      <div className="text-center">
                        <p className={`text-lg font-bold ${isRecovered ? "text-cc-green" : "text-amber"}`}>
                          {isRecovered ? "0" : formatMoney(remaining)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">المتبقي</p>
                      </div>
                      <div className="text-center">
                        {isRecovered ? (
                          <>
                            <p className="text-lg font-bold text-cc-green">✅</p>
                            <p className="text-[10px] text-muted-foreground">مكتمل</p>
                          </>
                        ) : monthsToRecover > 0 ? (
                          <>
                            <p className="text-lg font-bold text-foreground flex items-center justify-center gap-1">
                              <CalendarClock className="w-4 h-4 text-muted-foreground" />
                              {monthsToRecover}
                            </p>
                            <p className="text-[10px] text-muted-foreground">شهر للاسترداد (تقديري)</p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-bold text-muted-foreground">—</p>
                            <p className="text-[10px] text-muted-foreground">يعتمد على الأرباح</p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Monthly net profit indicator */}
                    <div className="mt-3 pt-3 border-t border-white/[0.06] flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">صافي ربح الشهر الحالي ({MONTHS_AR[selectedMonth - 1]})</span>
                      <span className={`text-sm font-bold ${currentNetProfit >= 0 ? "text-cc-green" : "text-cc-red"}`}>
                        {currentNetProfit >= 0 ? "+" : ""}{formatMoney(currentNetProfit)}
                      </span>
                    </div>
                  </div>

                  {/* Category breakdown */}
                  {catEntries.length > 1 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {catEntries.map(([cat, val], i) => {
                        const pct = totalStartup > 0 ? Math.round((val / totalStartup) * 100) : 0;
                        const color = catColors[i % catColors.length];
                        return (
                          <div key={cat} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-center">
                            <div className="w-3 h-3 rounded-full mx-auto mb-1.5" style={{ backgroundColor: color }} />
                            <p className="text-[11px] font-semibold text-foreground truncate">{cat}</p>
                            <p className="text-xs font-bold mt-0.5" style={{ color }}>{formatMoney(val)}</p>
                            <p className="text-[10px] text-muted-foreground">{pct}%</p>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Cost items list */}
                  <div className="space-y-2">
                    {startupCosts.map((cost, idx) => {
                      const maxAmt = Math.max(...startupCosts.map(c => c.amount), 1);
                      const pct = Math.round((cost.amount / maxAmt) * 100);
                      return (
                        <div key={cost.id} className="group relative bg-white/[0.02] rounded-[14px] p-3 border border-white/[0.06] hover:border-white/[0.1] transition-colors">
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <span className="text-xs font-bold text-cc-purple w-8 shrink-0">#{idx + 1}</span>
                              <span className="text-sm font-semibold text-foreground truncate">{cost.item_name}</span>
                              <span className="text-[10px] text-muted-foreground bg-white/[0.04] rounded px-1.5 py-0.5">{cost.category}</span>
                              {cost.notes && <span className="text-[10px] text-muted-foreground truncate hidden sm:inline">— {cost.notes}</span>}
                              {cost.paid_date && <span className="text-[10px] text-muted-foreground/60 hidden md:inline">{cost.paid_date}</span>}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-sm font-bold text-cc-purple">{formatMoney(cost.amount)}</span>
                              <button
                                onClick={() => handleDeleteStartupCost(cost.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-cc-red/10 text-muted-foreground hover:text-cc-red transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                          <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                            <div className="h-full rounded-full bg-cc-purple/60 transition-all" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* ─── Add Expense Dialog ─── */}
      <Dialog open={expenseDialog} onOpenChange={(open) => { setExpenseDialog(open); if (!open) setCustomCategory(""); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة مصروف</DialogTitle>
            <DialogDescription>اختر البند وسجل المصروف</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-1.5">
              <Label>البند</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setExpenseForm({ ...expenseForm, category: cat })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      expenseForm.category === cat
                        ? "bg-cyan/15 text-cyan border-cyan/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  placeholder="أو أضف بند جديد..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!customCategory.trim()}
                  onClick={() => {
                    setExpenseForm({ ...expenseForm, category: customCategory.trim() });
                    setCustomCategory("");
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {expenseForm.category && (
                <p className="text-xs text-cyan mt-1">البند المختار: {expenseForm.category}</p>
              )}
            </div>
            {expenseForm.category === "رواتب" && employees.length > 0 && (
              <div className="grid gap-1.5">
                <Label>الموظف</Label>
                <div className="flex flex-wrap gap-2">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setExpenseForm({ ...expenseForm, employee_name: expenseForm.employee_name === emp.name ? "" : emp.name })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        expenseForm.employee_name === emp.name
                          ? "bg-cc-purple/15 text-cc-purple border-cc-purple/30"
                          : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                      }`}
                    >
                      {emp.name}
                    </button>
                  ))}
                </div>
                {expenseForm.employee_name && (
                  <p className="text-xs text-cc-purple mt-1">الموظف المختار: {expenseForm.employee_name}</p>
                )}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>المبلغ (ر.س)</Label>
              <Input
                type="number"
                value={expenseForm.amount}
                onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                placeholder="0"
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={expenseForm.expense_date}
                onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>وصف (اختياري)</Label>
              <Input
                value={expenseForm.description}
                onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                placeholder="تفاصيل إضافية..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>إلغاء</Button>
            <Button onClick={handleAddExpense} disabled={savingExpense || !expenseForm.category.trim() || !expenseForm.amount}>
              {savingExpense ? "جاري الحفظ..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Expense Dialog ─── */}
      <Dialog open={!!editingExpense} onOpenChange={(open) => { if (!open) setEditingExpense(null); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل مصروف</DialogTitle>
            <DialogDescription>عدّل بيانات المصروف</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-1.5">
              <Label>البند</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setEditForm({ ...editForm, category: cat })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      editForm.category === cat
                        ? "bg-cyan/15 text-cyan border-cyan/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <Input
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                placeholder="أو اكتب بند جديد..."
              />
            </div>
            {editForm.category === "رواتب" && employees.length > 0 && (
              <div className="grid gap-1.5">
                <Label>الموظف</Label>
                <div className="flex flex-wrap gap-2">
                  {employees.map((emp) => (
                    <button
                      key={emp.id}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, employee_name: editForm.employee_name === emp.name ? "" : emp.name })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        editForm.employee_name === emp.name
                          ? "bg-cc-purple/15 text-cc-purple border-cc-purple/30"
                          : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                      }`}
                    >
                      {emp.name}
                    </button>
                  ))}
                </div>
                {editForm.employee_name && (
                  <p className="text-xs text-cc-purple mt-1">الموظف المختار: {editForm.employee_name}</p>
                )}
              </div>
            )}
            <div className="grid gap-1.5">
              <Label>المبلغ (ر.س)</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                placeholder="0"
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>التاريخ</Label>
              <Input
                type="date"
                value={editForm.expense_date}
                onChange={(e) => setEditForm({ ...editForm, expense_date: e.target.value })}
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>وصف (اختياري)</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                placeholder="تفاصيل إضافية..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingExpense(null)}>إلغاء</Button>
            <Button onClick={handleEditExpense} disabled={savingEdit || !editForm.category.trim() || !editForm.amount}>
              {savingEdit ? "جاري الحفظ..." : "حفظ التعديل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Budget Item Dialog ─── */}
      <Dialog open={budgetDialog} onOpenChange={(open) => { setBudgetDialog(open); if (!open) setBudgetCustomCat(""); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة بند للميزانية</DialogTitle>
            <DialogDescription>حدد البند والمبلغ المخطط لهذا الشهر</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-1.5">
              <Label>البند</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {allCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setBudgetForm({ ...budgetForm, category: cat })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      budgetForm.category === cat
                        ? "bg-cyan/15 text-cyan border-cyan/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    {cat}
                    {(() => { const b = budget.find(b => b.category === cat); return b ? ` ✓` : ""; })()}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={budgetCustomCat}
                  onChange={(e) => setBudgetCustomCat(e.target.value)}
                  placeholder="أو أضف بند جديد..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!budgetCustomCat.trim()}
                  onClick={() => {
                    setBudgetForm({ ...budgetForm, category: budgetCustomCat.trim() });
                    setBudgetCustomCat("");
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {budgetForm.category && (
                <p className="text-xs text-cyan mt-1">البند المختار: {budgetForm.category}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>المبلغ المخطط (ر.س)</Label>
              <Input
                type="number"
                value={budgetForm.planned_amount}
                onChange={(e) => setBudgetForm({ ...budgetForm, planned_amount: e.target.value })}
                placeholder="0"
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Input
                value={budgetForm.notes}
                onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
                placeholder="تفاصيل إضافية..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBudgetDialog(false)}>إلغاء</Button>
            <Button onClick={handleAddBudget} disabled={savingBudget || !budgetForm.category.trim() || !budgetForm.planned_amount}>
              {savingBudget ? "جاري الحفظ..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Budget Item Dialog ─── */}
      <Dialog open={!!editingBudget} onOpenChange={(open) => { if (!open) setEditingBudget(null); }}>
        <DialogContent className="max-w-sm" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بند: {editingBudget?.category}</DialogTitle>
            <DialogDescription>عدّل المبلغ المخطط لهذا البند</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-1.5">
              <Label>المبلغ المخطط (ر.س)</Label>
              <Input
                type="number"
                value={editBudgetForm.planned_amount}
                onChange={(e) => setEditBudgetForm({ ...editBudgetForm, planned_amount: e.target.value })}
                placeholder="0"
                dir="ltr"
                className="text-right"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Input
                value={editBudgetForm.notes}
                onChange={(e) => setEditBudgetForm({ ...editBudgetForm, notes: e.target.value })}
                placeholder="تفاصيل إضافية..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingBudget(null)}>إلغاء</Button>
            <Button onClick={handleEditBudget} disabled={savingBudget || !editBudgetForm.planned_amount}>
              {savingBudget ? "جاري الحفظ..." : "حفظ التعديل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Add Startup Cost Dialog ─── */}
      <Dialog open={startupDialog} onOpenChange={(open) => { setStartupDialog(open); if (!open) setStartupCustomCat(""); }}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إضافة تكلفة تأسيس</DialogTitle>
            <DialogDescription>سجّل بنود مصاريف تأسيس المشروع</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-3">
            <div className="grid gap-1.5">
              <Label>التصنيف</Label>
              <div className="flex flex-wrap gap-2 mb-2">
                {allStartupCategories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setStartupForm({ ...startupForm, category: cat })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      startupForm.category === cat
                        ? "bg-cc-purple/15 text-cc-purple border-cc-purple/30"
                        : "bg-white/[0.05] text-muted-foreground border-white/[0.06] hover:border-white/[0.15]"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={startupCustomCat}
                  onChange={(e) => setStartupCustomCat(e.target.value)}
                  placeholder="أو أضف تصنيف جديد..."
                  className="flex-1"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!startupCustomCat.trim()}
                  onClick={() => {
                    setStartupForm({ ...startupForm, category: startupCustomCat.trim() });
                    setStartupCustomCat("");
                  }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
              {startupForm.category && (
                <p className="text-xs text-cc-purple mt-1">التصنيف المختار: {startupForm.category}</p>
              )}
            </div>
            <div className="grid gap-1.5">
              <Label>البند <span className="text-cc-red">*</span></Label>
              <Input
                value={startupForm.item_name}
                onChange={(e) => setStartupForm({ ...startupForm, item_name: e.target.value })}
                placeholder="مثال: تطوير الموقع، اشتراك سيرفر..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>المبلغ (ر.س) <span className="text-cc-red">*</span></Label>
                <Input
                  type="number"
                  value={startupForm.amount}
                  onChange={(e) => setStartupForm({ ...startupForm, amount: e.target.value })}
                  placeholder="0"
                  dir="ltr"
                  className="text-right"
                />
              </div>
              <div className="grid gap-1.5">
                <Label>تاريخ الدفع</Label>
                <Input
                  type="date"
                  value={startupForm.paid_date}
                  onChange={(e) => setStartupForm({ ...startupForm, paid_date: e.target.value })}
                  dir="ltr"
                  className="text-right"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>ملاحظات (اختياري)</Label>
              <Input
                value={startupForm.notes}
                onChange={(e) => setStartupForm({ ...startupForm, notes: e.target.value })}
                placeholder="تفاصيل إضافية..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStartupDialog(false)}>إلغاء</Button>
            <Button onClick={handleAddStartupCost} disabled={savingStartup || !startupForm.item_name.trim() || !startupForm.amount}>
              {savingStartup ? "جاري الحفظ..." : "إضافة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
