"use client";
// إغلاق صفقة / تحصيل تجديد من خارج صفحته (مثلاً «دفع ✓» في مهام اليوم) بنفس آثار الحفظ من الصفحة:
// تغيير المرحلة + ملاحظة تلقائية + احتفال + تجديد تلقائي بعد سنة للصفقة اللي لها باقة.
import { createClient } from "@/lib/supabase/client";
import { createFollowUpNote, createRenewal, fetchRenewals, getOrgId, updateDeal, updateRenewal } from "@/lib/supabase/db";
import { triggerSaleCelebration } from "@/components/layout/sale-celebration";
import { dateToLocal, saudiTimestamp } from "@/lib/utils/format";
import type { Deal, Renewal } from "@/types";

/** Auto-create a renewal one year out from a completed deal, with dedup. */
export async function autoCreateRenewalFromDeal(
  dealId: string,
  clientName: string,
  clientPhone: string | undefined,
  plan: string,
  dealValue: number,
  assignedRep: string | undefined,
  salesType: "office" | "support",
  author: string,
) {
  try {
    const renewalDate = new Date();
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
    const target = dateToLocal(renewalDate);

    /* Dedup: skip if a renewal already exists for this customer + plan within ±30d of target */
    const existing = await fetchRenewals();
    const normPhone = (clientPhone || "").replace(/\D/g, "");
    const normName = clientName.trim();
    const targetMs = new Date(target).getTime();
    const dup = existing.find((r) => {
      const samePhone = normPhone && (r.customer_phone || "").replace(/\D/g, "") === normPhone;
      const sameName = !normPhone && (r.customer_name || "").trim() === normName;
      if (!samePhone && !sameName) return false;
      if (r.plan_name !== plan) return false;
      const dMs = new Date(r.renewal_date).getTime();
      return Math.abs(dMs - targetMs) <= 30 * 86_400_000;
    });
    if (dup) {
      createFollowUpNote("deal", dealId, `ℹ️ تجديد تلقائي تم تخطّيه — موجود تجديد مشابه بتاريخ ${dup.renewal_date}.`, author).catch(console.error);
      return;
    }

    await createRenewal({
      customer_name: clientName,
      customer_phone: clientPhone || undefined,
      plan_name: plan,
      plan_price: dealValue,
      renewal_date: target,
      status: "مجدول تجديد",
      assigned_rep: assignedRep || undefined,
      sales_type: salesType,
      notes: `تجديد تلقائي من صفقة ${salesType === "office" ? "مكتب" : "دعم"} مكتملة — ${author}`,
    });
    createFollowUpNote("deal", dealId, `🔄 تم إنشاء تجديد تلقائي للعميل بتاريخ ${target}`, author).catch(console.error);
  } catch (err) {
    console.error("Auto-renewal creation failed:", err);
  }
}

/** يحوّل الصفقة إلى «مكتملة». يرجع false لو كانت مكتملة أصلاً أو ما انوجدت. */
export async function completeDeal(dealId: string, author: string): Promise<boolean> {
  const { data, error } = await createClient().from("deals").select("*").eq("id", dealId).eq("org_id", getOrgId()).maybeSingle();
  if (error) throw error;
  const old = data as Deal | null;
  if (!old || old.stage === "مكتملة") return false;
  await updateDeal(dealId, { stage: "مكتملة", close_date: saudiTimestamp() });
  createFollowUpNote("deal", dealId, `📝 تحديث تلقائي:\nالمرحلة: ${old.stage} ← مكتملة`, author).catch(console.error);
  const salesType = old.sales_type === "office" ? "office" : "support";
  triggerSaleCelebration({ id: `deal-${dealId}`, repName: old.assigned_rep_name || author, clientName: old.client_name, value: Number(old.deal_value) || 0, type: salesType });
  if (old.plan) {
    autoCreateRenewalFromDeal(dealId, old.client_name, old.client_phone, old.plan, Number(old.deal_value) || 0, old.assigned_rep_name, salesType, author);
  }
  return true;
}

/** يحوّل التجديد إلى «مكتمل» مع تاريخ الدفع. يرجع false لو كان مكتملاً أصلاً. */
export async function completeRenewal(renewalId: string, author: string): Promise<boolean> {
  const { data, error } = await createClient().from("renewals").select("*").eq("id", renewalId).eq("org_id", getOrgId()).maybeSingle();
  if (error) throw error;
  const old = data as Renewal | null;
  if (!old || old.status === "مكتمل") return false;
  await updateRenewal(renewalId, { status: "مكتمل", payment_date: saudiTimestamp() });
  createFollowUpNote("renewal", renewalId, `📝 تحديث تلقائي:\nالحالة: ${old.status} ← مكتمل`, author).catch(console.error);
  triggerSaleCelebration({ id: `renewal-${renewalId}`, repName: old.assigned_rep || author, clientName: old.customer_name, value: Number(old.plan_price) || 0, type: "renewal" });
  return true;
}
