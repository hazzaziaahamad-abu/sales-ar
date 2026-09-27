// Builds the "subscribers" feed for قائمة الاستهداف: paying customers we want
// to pitch loyalty cards (بطاقات الولاء) and the cashier (الكاشير) to.
//
// Sources:
//   • التجديدات — customers on the basic plan (الباقة الأساسية) who renewed
//     (status "مكتمل") and whose latest renewal row is not a cancellation.
//   • مبيعات الدعم — support-sales deals that closed ("مكتملة").
//
// Customers are merged across both sources by normalized phone (or name when
// there is no phone), and each one gets a rule-based recommendation.

import type { Deal, Renewal, Ticket, TargetClient } from "@/types";

export type RecommendationPriority = "high" | "medium" | "low";

export interface SubscriberCandidate {
  key: string;
  client_name: string;
  client_phone?: string;
  plan?: string;
  source: string;
  assigned_rep?: string;
  sales_type?: "office" | "support";
  deal_id?: string;
  recommendation: string;
  recommendation_priority: RecommendationPriority;
  /** Subscription end date (YYYY-MM-DD), when known. */
  expiry_date?: string;
}

export const SOURCE_RENEWALS = "التجديدات - الباقة الأساسية";
export const SOURCE_SUPPORT = "مبيعات الدعم";

const CASHIER_PLAN = "الكاشير";

/** "0501234567", "501234567", "+966 50 123 4567" → "501234567". */
export function normalizePhone(phone?: string | null): string {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return digits.length > 9 ? digits.slice(-9) : digits.replace(/^0+/, "");
}

function normalizeName(name?: string | null): string {
  return (name || "").trim().replace(/\s+/g, " ").toLowerCase();
}

export function customerKey(phone?: string | null, name?: string | null): string {
  const p = normalizePhone(phone);
  return p ? `p:${p}` : `n:${normalizeName(name)}`;
}

function isBasicPlan(plan?: string | null): boolean {
  return (plan || "").replace(/[أإآ]/g, "ا").replace(/^ال/, "").trim() === "اساسية";
}

function daysSince(date?: string | null, now = Date.now()): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 86_400_000);
}

function addYear(date: string): string {
  const [y, m, d] = date.slice(0, 10).split("-");
  return `${Number(y) + 1}-${m}-${d}`;
}

/**
 * A customer's subscription end date from their renewal rows (renewal_date is
 * the expiry): the earliest still-open renewal after the last completed one,
 * otherwise the last completed renewal's date + one year.
 */
function expiryFromRenewals(rows: Renewal[]): string | undefined {
  const dated = rows.filter((r) => r.renewal_date && r.status !== "ملغي بسبب");
  const lastDone = dated
    .filter((r) => r.status === "مكتمل")
    .map((r) => r.renewal_date.slice(0, 10))
    .sort()
    .pop();
  const nextOpen = dated
    .filter((r) => r.status !== "مكتمل" && r.renewal_date.slice(0, 10) > (lastDone ?? ""))
    .map((r) => r.renewal_date.slice(0, 10))
    .sort()[0];
  if (nextOpen) return nextOpen;
  return lastDone ? addYear(lastDone) : undefined;
}

interface Aggregate {
  key: string;
  name: string;
  phone?: string;
  rep?: string;
  basicRenewals: number;
  lastRenewalPaid?: string;
  supportDeals: Deal[];
}

export function buildSubscriberCandidates(
  renewals: Renewal[],
  supportDeals: Deal[],
  tickets: Ticket[],
  now = Date.now()
): SubscriberCandidate[] {
  const byKey = new Map<string, Aggregate>();
  const get = (key: string, name: string, phone?: string) => {
    let a = byKey.get(key);
    if (!a) {
      a = { key, name, phone, basicRenewals: 0, supportDeals: [] };
      byKey.set(key, a);
    }
    if (!a.phone && phone) a.phone = phone;
    return a;
  };

  // ── Renewals: basic-plan customers who renewed and are still subscribed ──
  const renewalsByKey = new Map<string, Renewal[]>();
  for (const r of renewals) {
    if (!r.customer_name?.trim()) continue;
    const k = customerKey(r.customer_phone, r.customer_name);
    const list = renewalsByKey.get(k) ?? [];
    list.push(r);
    renewalsByKey.set(k, list);
  }
  for (const [k, rows] of renewalsByKey) {
    const sorted = [...rows].sort((a, b) => (a.renewal_date || "").localeCompare(b.renewal_date || ""));
    const latest = sorted[sorted.length - 1];
    // Cancelled last, or moved to another plan since → not a basic subscriber now.
    if (latest.status === "ملغي بسبب" || !isBasicPlan(latest.plan_name)) continue;
    const completed = sorted.filter((r) => r.status === "مكتمل" && isBasicPlan(r.plan_name));
    if (completed.length === 0) continue;
    const last = completed[completed.length - 1];
    const a = get(k, last.customer_name.trim(), last.customer_phone || undefined);
    // The same renewal is sometimes entered more than once — count distinct dates.
    a.basicRenewals = new Set(completed.map((r) => r.renewal_date)).size;
    a.lastRenewalPaid = last.payment_date || last.renewal_date;
    a.rep = last.assigned_rep || a.rep;
  }

  // ── Support sales: closed deals ──
  for (const d of supportDeals) {
    if (d.stage !== "مكتملة" || !d.client_name?.trim()) continue;
    const a = get(customerKey(d.client_phone, d.client_name), d.client_name.trim(), d.client_phone || undefined);
    a.supportDeals.push(d);
    if (!a.rep && d.assigned_rep_name) a.rep = d.assigned_rep_name;
  }

  // ── Open tickets per customer ──
  const openTickets = new Map<string, number>();
  for (const t of tickets) {
    if (t.status === "محلول") continue;
    const k = customerKey(t.client_phone, t.client_name);
    openTickets.set(k, (openTickets.get(k) ?? 0) + 1);
  }

  const result: SubscriberCandidate[] = [];
  for (const a of byKey.values()) {
    const latestDeal = [...a.supportDeals].sort((x, y) =>
      (x.close_date || x.created_at || "").localeCompare(y.close_date || y.created_at || "")
    ).pop();
    const hasCashier = a.supportDeals.some((d) => d.plan === CASHIER_PLAN);
    const fromRenewals = a.basicRenewals > 0;
    const fromSupport = a.supportDeals.length > 0;
    const open = openTickets.get(a.key) ?? 0;
    const lastPaid = [a.lastRenewalPaid, latestDeal?.close_date || latestDeal?.deal_date]
      .filter(Boolean)
      .sort()
      .pop();
    const since = daysSince(lastPaid, now);
    // Support-sale customers usually have an auto-created renewal row too;
    // fall back to one year after the latest closed deal.
    const renewalRows = renewalsByKey.get(a.key);
    const dealDate = (latestDeal?.close_date || latestDeal?.deal_date)?.slice(0, 10);
    const expiry = (renewalRows && expiryFromRenewals(renewalRows)) || (dealDate ? addYear(dealDate) : undefined);

    const { text, priority } = recommend({
      fromRenewals,
      fromSupport,
      basicRenewals: a.basicRenewals,
      supportDeals: a.supportDeals.length,
      supportPlan: latestDeal?.plan,
      hasCashier,
      openTickets: open,
      daysSincePaid: since,
      daysToRenewal: expiry ? -(daysSince(expiry, now) ?? 0) : null,
    });

    result.push({
      key: a.key,
      client_name: a.name,
      client_phone: a.phone,
      plan: fromRenewals ? "الاساسية" : latestDeal?.plan || undefined,
      source: fromRenewals && fromSupport
        ? `${SOURCE_RENEWALS} + ${SOURCE_SUPPORT}`
        : fromRenewals ? SOURCE_RENEWALS : SOURCE_SUPPORT,
      assigned_rep: a.rep,
      // Keep the deal link for support-only customers so the card can open it.
      sales_type: !fromRenewals && latestDeal ? "support" : undefined,
      deal_id: !fromRenewals && latestDeal ? latestDeal.id : undefined,
      recommendation: text,
      recommendation_priority: priority,
      expiry_date: expiry,
    });
  }

  const order: Record<RecommendationPriority, number> = { high: 0, medium: 1, low: 2 };
  return result.sort(
    (x, y) => order[x.recommendation_priority] - order[y.recommendation_priority] || x.client_name.localeCompare(y.client_name, "ar")
  );
}

interface RecommendInput {
  fromRenewals: boolean;
  fromSupport: boolean;
  basicRenewals: number;
  supportDeals: number;
  supportPlan?: string;
  hasCashier: boolean;
  openTickets: number;
  daysSincePaid: number | null;
  daysToRenewal: number | null;
}

const HIGHER_PLANS = new Set(["VIP", "Vip", "بلس", "الذهبية"]);

function recommend(i: RecommendInput): { text: string; priority: RecommendationPriority } {
  // Unresolved problems come first — pitching an upsell now backfires.
  if (i.openTickets > 0) {
    return {
      priority: "low",
      text: `لديه ${i.openTickets === 1 ? "تذكرة دعم مفتوحة" : `${i.openTickets} تذاكر دعم مفتوحة`} — تابع حلّها أولاً، ثم اعرض بطاقات الولاء كلفتة اهتمام قبل الحديث عن الكاشير.`,
    };
  }

  const why: string[] = [];
  let high = false;
  let low = false;

  if (i.fromRenewals && i.fromSupport) {
    high = true;
    why.push("مشترك في الأساسية وسبق أن اشترى من مبيعات الدعم — يثق بنا ويتقبّل الإضافات");
  } else if (i.fromRenewals && i.basicRenewals >= 2) {
    high = true;
    why.push(`جدّد الباقة الأساسية ${i.basicRenewals} مرات — عميل وفي`);
  } else if (i.fromRenewals) {
    why.push("جدّد الباقة الأساسية وما زال على أقل باقة");
  } else if (i.supportDeals >= 2) {
    high = true;
    why.push(`اشترى من مبيعات الدعم ${i.supportDeals} مرات — متجاوب مع العروض`);
  } else {
    why.push(`اشترى من مبيعات الدعم${i.supportPlan ? ` (${i.supportPlan})` : ""}`);
  }

  const expiredLongAgo = i.daysToRenewal !== null && i.daysToRenewal < -30;
  const renewalSoon = i.daysToRenewal !== null && !expiredLongAgo && i.daysToRenewal <= 45;
  if (expiredLongAgo) {
    low = true;
    why.push(`انتهى اشتراكه منذ ${-i.daysToRenewal!} يوم — تأكد من تجديده أولاً`);
  } else if (renewalSoon) {
    high = true;
    why.push(i.daysToRenewal! <= 0 ? "اشتراكه ينتهي الآن — وقت التجديد" : `اشتراكه ينتهي بعد ${i.daysToRenewal} يوم`);
  } else if (i.daysSincePaid !== null && i.daysSincePaid >= 0 && i.daysSincePaid <= 45) {
    high = true;
    why.push("دفع مؤخراً والتجربة حاضرة في ذهنه");
  } else if (i.daysSincePaid !== null && i.daysSincePaid > 300) {
    low = true;
    why.push("مرّ وقت طويل على آخر دفعة — تأكد من استمراره ورضاه أولاً");
  }

  let pitch: string;
  if (i.hasCashier) {
    pitch = "لديه الكاشير مسبقاً — اعرض بطاقات الولاء فقط واربطها بالكاشير لزيادة عودة زبائنه.";
  } else if (renewalSoon && i.fromRenewals) {
    pitch = "اعرض الكاشير كترقية ضمن التجديد القادم، وأضف بطاقات الولاء كهدية أو بسعر خاص عند الترقية.";
  } else if (!i.fromRenewals && i.supportPlan && HIGHER_PLANS.has(i.supportPlan)) {
    pitch = "على باقة أعلى وغالباً لديه حركة زبائن جيدة — ابدأ ببطاقات الولاء، ثم الكاشير إن لم يكن لديه نظام نقاط بيع.";
  } else if (i.fromRenewals) {
    pitch = "ابدأ ببطاقات الولاء (قيمة سريعة وتكلفة منخفضة)، ثم اعرض الكاشير كترقية تكمّل الباقة الأساسية.";
  } else {
    pitch = "اعرض الكاشير + بطاقات الولاء معاً كحزمة واحدة بسعر مميز.";
  }

  const priority: RecommendationPriority = high ? "high" : low ? "low" : "medium";
  return { priority, text: `${why.join("، ")}. ${pitch}` };
}

/**
 * Split candidates against rows already in the month's list: new ones to insert,
 * and existing ones whose recommendation changed (to refresh in place).
 */
export function diffAgainstExisting(
  candidates: SubscriberCandidate[],
  existing: TargetClient[]
): { toInsert: SubscriberCandidate[]; toRefresh: { id: string; c: SubscriberCandidate }[] } {
  const existingByKey = new Map<string, TargetClient>();
  const existingDealIds = new Set<string>();
  for (const e of existing) {
    existingByKey.set(customerKey(e.client_phone, e.client_name), e);
    if (e.deal_id) existingDealIds.add(e.deal_id);
  }
  const toInsert: SubscriberCandidate[] = [];
  const toRefresh: { id: string; c: SubscriberCandidate }[] = [];
  for (const c of candidates) {
    const match = existingByKey.get(c.key);
    if (match) {
      if (
        match.recommendation !== c.recommendation ||
        match.recommendation_priority !== c.recommendation_priority ||
        (match.expiry_date ?? undefined) !== c.expiry_date
      ) {
        toRefresh.push({ id: match.id, c });
      }
    } else if (!(c.deal_id && existingDealIds.has(c.deal_id))) {
      toInsert.push(c);
    }
  }
  return { toInsert, toRefresh };
}
