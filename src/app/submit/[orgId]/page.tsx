"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { submitPendingDeal } from "@/lib/supabase/db";
import { SOURCES, PLANS } from "@/lib/utils/constants";

const SUBMIT_STAGES = [
  { key: "قيد التواصل", label: "قيد التواصل", color: "emerald" },
  { key: "تفاوض", label: "جاري التفاوض", color: "purple" },
  { key: "تجريبي", label: "يوزر تجريبي", color: "blue" },
  { key: "انتظار الدفع", label: "بانتظار الدفع", color: "amber" },
  { key: "كنسل التجربة", label: "كنسل التجربة", color: "red" },
  { key: "مكتملة", label: "مكتملة", color: "green" },
] as const;

export default function SubmitDealPage() {
  const params = useParams();
  const orgId = params.orgId as string;

  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    deal_value: 0,
    source: "حملة اعلانية",
    plan: "",
    stage: "قيد التواصل",
    assigned_rep_name: "",
    notes: "",
    submitter_name: "",
    sales_type: "office" as "office" | "support",
  });

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.client_name.trim()) {
      setError("اسم العميل مطلوب");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitPendingDeal(orgId, {
        org_id: orgId,
        sales_type: form.sales_type,
        client_name: form.client_name.trim(),
        client_phone: form.client_phone.trim() || undefined,
        deal_value: form.deal_value || 0,
        source: form.source,
        stage: form.stage,
        plan: form.plan || undefined,
        assigned_rep_name: form.assigned_rep_name.trim() || undefined,
        notes: form.notes.trim() || undefined,
        submitter_name: form.submitter_name.trim() || undefined,
      });
      setSubmitted(true);
    } catch {
      setError("حدث خطأ أثناء الإرسال. حاول مرة أخرى.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
            <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">تم إرسال الطلب بنجاح!</h1>
          <p className="text-gray-400 text-sm">سيتم مراجعة الطلب والموافقة عليه من قبل الإدارة.</p>
          <button
            onClick={() => { setSubmitted(false); setForm({ client_name: "", client_phone: "", deal_value: 0, source: "حملة اعلانية", stage: "قيد التواصل", plan: "", assigned_rep_name: "", notes: "", submitter_name: "", sales_type: "office" }); }}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-500/15 text-cyan-400 font-medium hover:bg-cyan-500/25 transition-colors"
          >
            إرسال طلب آخر
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500/30 to-purple-500/30 flex items-center justify-center ring-1 ring-white/10 mb-4">
            <span className="text-sm font-extrabold tracking-[0.2em] text-cyan-400">CC</span>
          </div>
          <h1 className="text-xl font-bold text-white">إضافة عميل جديد</h1>
          <p className="text-sm text-gray-400 mt-1">أدخل بيانات العميل وسيتم مراجعتها والموافقة عليها</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-white/[0.08] bg-white/[0.05] p-6 backdrop-blur-sm">
          {/* Sales type toggle */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">القسم</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, sales_type: "office" })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  form.sales_type === "office"
                    ? "bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30"
                    : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.07]"
                }`}
              >
                مبيعات المكتب
              </button>
              <button
                type="button"
                onClick={() => setForm({ ...form, sales_type: "support" })}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  form.sales_type === "support"
                    ? "bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30"
                    : "bg-white/[0.04] text-gray-400 hover:bg-white/[0.07]"
                }`}
              >
                مبيعات الدعم
              </button>
            </div>
          </div>

          {/* Client name */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">اسم العميل <span className="text-red-400">*</span></label>
            <input
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              placeholder="أدخل اسم العميل"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
              required
            />
          </div>

          {/* Phone + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">رقم الجوال</label>
              <input
                value={form.client_phone}
                onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white text-right placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">القيمة (ر.س)</label>
              <input
                type="number"
                value={form.deal_value || ""}
                onChange={(e) => setForm({ ...form, deal_value: Number(e.target.value) || 0 })}
                placeholder="0"
                dir="ltr"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white text-right placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
              />
            </div>
          </div>

          {/* Source */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">المصدر</label>
            <div className="flex flex-wrap gap-2">
              {SOURCES.map((src) => (
                <button
                  key={src}
                  type="button"
                  onClick={() => setForm({ ...form, source: src })}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    form.source === src
                      ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                      : "border-white/[0.08] text-gray-400 hover:border-white/20"
                  }`}
                >
                  {src}
                </button>
              ))}
            </div>
          </div>

          {/* Stage */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">المرحلة</label>
            <div className="flex flex-wrap gap-2">
              {SUBMIT_STAGES.map((s) => {
                const colorMap: Record<string, string> = {
                  emerald: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                  purple: "border-purple-500/40 bg-purple-500/15 text-purple-400",
                  blue: "border-blue-500/40 bg-blue-500/15 text-blue-400",
                  amber: "border-amber-500/40 bg-amber-500/15 text-amber-400",
                  red: "border-red-500/40 bg-red-500/15 text-red-400",
                  green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                };
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setForm({ ...form, stage: s.key })}
                    className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                      form.stage === s.key
                        ? colorMap[s.color] || "border-cyan-500/40 bg-cyan-500/15 text-cyan-400"
                        : "border-white/[0.08] text-gray-400 hover:border-white/20"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">الباقة</label>
            <div className="flex flex-wrap gap-2">
              {PLANS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, plan: form.plan === p ? "" : p })}
                  className={`rounded-lg border px-3 py-1.5 text-xs transition-colors ${
                    form.plan === p
                      ? "border-purple-500/40 bg-purple-500/15 text-purple-400"
                      : "border-white/[0.08] text-gray-400 hover:border-white/20"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Rep + Submitter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">المسؤول</label>
              <input
                value={form.assigned_rep_name}
                onChange={(e) => setForm({ ...form, assigned_rep_name: e.target.value })}
                placeholder="اسم المسؤول"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-300">اسمك</label>
              <input
                value={form.submitter_name}
                onChange={(e) => setForm({ ...form, submitter_name: e.target.value })}
                placeholder="من يرسل الطلب"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-300">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="أي ملاحظات إضافية..."
              rows={3}
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-cyan-500/40 resize-none"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-gradient-to-l from-cyan-500 to-cyan-600 text-white font-bold text-sm hover:from-cyan-400 hover:to-cyan-500 transition-all disabled:opacity-50"
          >
            {submitting ? "جاري الإرسال..." : "إرسال الطلب للمراجعة"}
          </button>
        </form>

        <p className="text-center text-[11px] text-gray-500 mt-4">
          هذا الطلب سيتم مراجعته من الإدارة قبل إضافته
        </p>
      </div>
    </div>
  );
}
