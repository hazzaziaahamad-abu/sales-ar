"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPackages, createPackage, updatePackage, deletePackage } from "@/lib/supabase/db";
import { fetchDeals } from "@/lib/supabase/db";
import type { Package, Deal } from "@/types";
import {
  Package as PackageIcon,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  TrendingDown,
  TrendingUp,
  DollarSign,
  BarChart3,
  Users,
} from "lucide-react";

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingPkg, setEditingPkg] = useState<Package | null>(null);
  const [formName, setFormName] = useState("");
  const [formPrice, setFormPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [pkgs, allDeals] = await Promise.all([
        fetchPackages(),
        fetchDeals(),
      ]);
      setPackages(pkgs);
      setDeals(allDeals.filter((d) => d.stage === "مكتملة"));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const resetForm = () => {
    setFormName("");
    setFormPrice("");
    setEditingPkg(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!formName.trim() || !formPrice) return;
    setSaving(true);
    try {
      if (editingPkg) {
        await updatePackage(editingPkg.id, {
          name: formName,
          original_price: parseFloat(formPrice),
        });
      } else {
        await createPackage({
          name: formName,
          original_price: parseFloat(formPrice),
          is_active: true,
        });
      }
      resetForm();
      loadData();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await deletePackage(id);
    loadData();
  };

  const openEdit = (pkg: Package) => {
    setEditingPkg(pkg);
    setFormName(pkg.name);
    setFormPrice(String(pkg.original_price));
    setShowForm(true);
  };

  // Build price map: normalize plan names to match
  const priceMap = new Map<string, number>();
  packages.forEach((p) => {
    priceMap.set(p.name.toLowerCase().trim(), p.original_price);
  });

  const getOriginalPrice = (planName: string | undefined): number | null => {
    if (!planName) return null;
    const normalized = planName.toLowerCase().trim();
    if (priceMap.has(normalized)) return priceMap.get(normalized)!;
    // Try matching common variations
    for (const [key, val] of priceMap) {
      if (normalized.includes(key) || key.includes(normalized)) return val;
    }
    return null;
  };

  // Analyze deals
  const analyzedDeals = deals.map((d) => {
    const origPrice = getOriginalPrice(d.plan);
    const dealVal = Number(d.deal_value);
    const hasDiscount = origPrice !== null && dealVal < origPrice;
    const discountAmount = hasDiscount ? origPrice - dealVal : 0;
    const discountPct = hasDiscount && origPrice > 0 ? Math.round((discountAmount / origPrice) * 100) : 0;
    return { ...d, origPrice, hasDiscount, discountAmount, discountPct, dealVal };
  });

  const matchedDeals = analyzedDeals.filter((d) => d.origPrice !== null);
  const fullPriceDeals = matchedDeals.filter((d) => !d.hasDiscount);
  const discountedDeals = matchedDeals.filter((d) => d.hasDiscount);
  const totalDiscountAmount = discountedDeals.reduce((s, d) => s + d.discountAmount, 0);
  const fullPriceRate = matchedDeals.length > 0 ? Math.round((fullPriceDeals.length / matchedDeals.length) * 100) : 0;

  // Per-employee analysis
  const repStats = new Map<string, { name: string; total: number; fullPrice: number; discounted: number; discountTotal: number; revenue: number }>();
  matchedDeals.forEach((d) => {
    const name = d.assigned_rep_name || "غير محدد";
    if (!repStats.has(name)) {
      repStats.set(name, { name, total: 0, fullPrice: 0, discounted: 0, discountTotal: 0, revenue: 0 });
    }
    const s = repStats.get(name)!;
    s.total++;
    s.revenue += d.dealVal;
    if (d.hasDiscount) {
      s.discounted++;
      s.discountTotal += d.discountAmount;
    } else {
      s.fullPrice++;
    }
  });

  const repStatsArr = Array.from(repStats.values()).sort((a, b) => {
    const rateA = a.total > 0 ? a.fullPrice / a.total : 0;
    const rateB = b.total > 0 ? b.fullPrice / b.total : 0;
    return rateB - rateA;
  });

  // Per-package analysis
  const pkgStats = new Map<string, { name: string; total: number; fullPrice: number; discounted: number; avgDiscount: number; revenue: number; originalTotal: number }>();
  matchedDeals.forEach((d) => {
    const name = d.plan || "غير محدد";
    if (!pkgStats.has(name)) {
      pkgStats.set(name, { name, total: 0, fullPrice: 0, discounted: 0, avgDiscount: 0, revenue: 0, originalTotal: 0 });
    }
    const s = pkgStats.get(name)!;
    s.total++;
    s.revenue += d.dealVal;
    s.originalTotal += d.origPrice!;
    if (d.hasDiscount) {
      s.discounted++;
    } else {
      s.fullPrice++;
    }
  });
  const pkgStatsArr = Array.from(pkgStats.values()).sort((a, b) => b.total - a.total);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span className="w-10 h-10 rounded-[14px] bg-violet-500/20 flex items-center justify-center">
              <PackageIcon className="w-5 h-5 text-violet-400" />
            </span>
            إدارة الباقات
          </h1>
          <p className="text-gray-400 text-sm mt-1">تحديد الأسعار الأصلية وتحليل الخصومات</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[14px] bg-violet-500 hover:bg-violet-600 text-white font-medium transition-all"
        >
          <Plus className="w-5 h-5" /> إضافة باقة
        </button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الصفقات", value: matchedDeals.length, icon: BarChart3, color: "indigo" },
          { label: "بالسعر الأصلي", value: fullPriceDeals.length, icon: TrendingUp, color: "emerald", sub: `${fullPriceRate}%` },
          { label: "بخصم", value: discountedDeals.length, icon: TrendingDown, color: "amber" },
          { label: "إجمالي الخصومات", value: `${totalDiscountAmount.toLocaleString()} ر.س`, icon: DollarSign, color: "red" },
        ].map((s) => (
          <div key={s.label} className="glass-surface rounded-2xl p-4 border border-white/[0.06]">
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-9 h-9 rounded-[14px] bg-${s.color}-500/15 flex items-center justify-center`}>
                <s.icon className={`w-4.5 h-4.5 text-${s.color}-400`} />
              </div>
              <span className="text-gray-400 text-xs">{s.label}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-white">{s.value}</p>
              {s.sub && <span className="text-sm text-emerald-400 font-medium">{s.sub}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Packages Table */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-white">الباقات والأسعار الأصلية</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-gray-400">
                <th className="text-right py-3 px-4 font-medium">الباقة</th>
                <th className="text-right py-3 px-4 font-medium">السعر الأصلي</th>
                <th className="text-right py-3 px-4 font-medium">عدد المبيعات</th>
                <th className="text-right py-3 px-4 font-medium">بالسعر الأصلي</th>
                <th className="text-right py-3 px-4 font-medium">بخصم</th>
                <th className="text-right py-3 px-4 font-medium">نسبة البيع بالأصلي</th>
                <th className="text-center py-3 px-4 font-medium">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => {
                const stats = pkgStatsArr.find((s) => s.name.toLowerCase().trim() === pkg.name.toLowerCase().trim());
                const rate = stats && stats.total > 0 ? Math.round((stats.fullPrice / stats.total) * 100) : 0;
                return (
                  <tr key={pkg.id} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-3 px-4 text-white font-medium">{pkg.name}</td>
                    <td className="py-3 px-4 text-white">{pkg.original_price.toLocaleString()} ر.س</td>
                    <td className="py-3 px-4 text-white">{stats?.total || 0}</td>
                    <td className="py-3 px-4">
                      <span className="text-emerald-400">{stats?.fullPrice || 0}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-amber-400">{stats?.discounted || 0}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${rate >= 70 ? "bg-emerald-400" : rate >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className={`text-xs font-medium ${rate >= 70 ? "text-emerald-400" : rate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                          {rate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => openEdit(pkg)} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(pkg.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Discount Analysis */}
      <div className="glass-surface rounded-2xl border border-white/[0.06] overflow-hidden">
        <div className="p-4 border-b border-white/[0.06]">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            أداء الموظفين — تحليل الخصومات
          </h2>
          <p className="text-xs text-gray-400 mt-1">مرتب حسب نسبة البيع بالسعر الأصلي (الأعلى أولاً)</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-gray-400">
                <th className="text-right py-3 px-4 font-medium">الترتيب</th>
                <th className="text-right py-3 px-4 font-medium">الموظف</th>
                <th className="text-right py-3 px-4 font-medium">إجمالي الصفقات</th>
                <th className="text-right py-3 px-4 font-medium">بالسعر الأصلي</th>
                <th className="text-right py-3 px-4 font-medium">بخصم</th>
                <th className="text-right py-3 px-4 font-medium">نسبة البيع بالأصلي</th>
                <th className="text-right py-3 px-4 font-medium">إجمالي الخصومات</th>
              </tr>
            </thead>
            <tbody>
              {repStatsArr.map((rep, i) => {
                const rate = rep.total > 0 ? Math.round((rep.fullPrice / rep.total) * 100) : 0;
                return (
                  <tr key={rep.name} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                    <td className="py-3 px-4">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i === 0 ? "bg-amber-500/20 text-amber-400" :
                        i === 1 ? "bg-gray-400/20 text-gray-300" :
                        i === 2 ? "bg-orange-500/20 text-orange-400" :
                        "bg-white/10 text-gray-400"
                      }`}>
                        {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-white font-medium">{rep.name}</td>
                    <td className="py-3 px-4 text-white">{rep.total}</td>
                    <td className="py-3 px-4 text-emerald-400 font-medium">{rep.fullPrice}</td>
                    <td className="py-3 px-4 text-amber-400">{rep.discounted}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${rate >= 70 ? "bg-emerald-400" : rate >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                            style={{ width: `${rate}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${rate >= 70 ? "text-emerald-400" : rate >= 40 ? "text-amber-400" : "text-red-400"}`}>
                          {rate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-red-400">{rep.discountTotal.toLocaleString()} ر.س</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" dir="rtl">
          <div className="bg-card rounded-2xl border border-border w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white">{editingPkg ? "تعديل الباقة" : "إضافة باقة جديدة"}</h2>
              <button onClick={resetForm} className="p-2 rounded-lg hover:bg-white/10 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 mb-1 block">اسم الباقة *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  placeholder="مثال: VIP"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1 block">السعر الأصلي (ر.س) *</label>
                <input
                  type="number"
                  value={formPrice}
                  onChange={(e) => setFormPrice(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-[14px] bg-white/[0.04] border border-white/10 text-white text-sm focus:outline-none focus:border-violet-500/50"
                  placeholder="مثال: 879"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={!formName.trim() || !formPrice || saving}
                className="w-full py-3 rounded-[14px] bg-violet-500 hover:bg-violet-600 disabled:opacity-40 text-white font-medium transition-all flex items-center justify-center gap-2"
              >
                {saving ? "جاري الحفظ..." : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingPkg ? "حفظ التعديلات" : "إضافة الباقة"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
