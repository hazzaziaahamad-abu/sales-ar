import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Deal, Ticket, Employee, Project, Partnership, KPISnapshot, Renewal, Review } from "@/types";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";
const KNOWLEDGE_CACHE_TTL_MS = 60_000;

const knowledgeCache = new Map<string, { value: string; expiresAt: number }>();

/**
 * Builds a knowledge context string from REAL Supabase data.
 * This is injected into the AI agent's system prompt so it can answer
 * questions accurately with real numbers.
 */
export async function buildKnowledgeContext(orgId?: string): Promise<string> {
  const ORG_ID = orgId || DEFAULT_ORG;
  const cached = knowledgeCache.get(ORG_ID);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const startedAt = performance.now();
  const supabase = await createServerSupabaseClient();

  // Fetch only columns needed for aggregate context. Detailed records are
  // retrieved on demand through the agent's queryDatabase tool.
  const [
    { data: deals },
    { data: tickets },
    { data: employees },
    { data: projects },
    { data: partnerships },
    { data: kpiSnapshots },
    { data: renewals },
    { data: reviews },
  ] = await Promise.all([
    supabase
      .from("deals")
      .select("client_name,deal_value,source,stage,probability,assigned_rep_name,cycle_days,month,year")
      .eq("org_id", ORG_ID),
    supabase
      .from("tickets")
      .select("priority,status,assigned_agent_name,response_time_minutes")
      .eq("org_id", ORG_ID),
    supabase.from("employees").select("name,role,status").eq("org_id", ORG_ID),
    supabase
      .from("projects")
      .select("name,team,progress,remaining_tasks,status_tag")
      .eq("org_id", ORG_ID),
    supabase
      .from("partnerships")
      .select("name,type,status,value,manager_name")
      .eq("org_id", ORG_ID),
    supabase
      .from("kpi_snapshots")
      .select("month,year,total_revenue,total_deals,closed_deals,close_rate,target_revenue")
      .eq("org_id", ORG_ID)
      .order("year")
      .order("month"),
    supabase
      .from("renewals")
      .select("plan_price,status,renewal_date")
      .eq("org_id", ORG_ID),
    supabase.from("reviews").select("stars,type").eq("org_id", ORG_ID),
  ]);

  const allDeals = (deals ?? []) as unknown as Deal[];
  const allTickets = (tickets ?? []) as unknown as Ticket[];
  const allEmployees = (employees ?? []) as unknown as Employee[];
  const allProjects = (projects ?? []) as unknown as Project[];
  const allPartnerships = (partnerships ?? []) as unknown as Partnership[];
  const allKpi = (kpiSnapshots ?? []) as unknown as KPISnapshot[];
  const allRenewals = (renewals ?? []) as unknown as Renewal[];
  const allReviews = (reviews ?? []) as unknown as Review[];

  const sections: string[] = [];

  // 1. Company overview
  sections.push(`## معلومات الشركة
- الاسم: RESTAVO — شركة أتمتة مطاعم في السعودية
- المنصة: CommandCenter — لوحة إدارة المبيعات والدعم
- التاريخ الحالي: ${new Date().toLocaleDateString("ar-SA-u-ca-gregory", { year: "numeric", month: "long", day: "numeric" })}`);

  // 2. Monthly KPIs (from kpi_snapshots table)
  if (allKpi.length > 0) {
    const MONTH_NAMES = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
    const totalRevenue = allKpi.reduce((s, k) => s + k.total_revenue, 0);
    const totalTarget = allKpi.reduce((s, k) => s + (k.target_revenue || 0), 0);
    sections.push(`## الأداء الشهري (${allKpi.length} شهر)
${allKpi.map((k) => `- ${MONTH_NAMES[k.month - 1] ?? k.month} ${k.year}: إيرادات $${(k.total_revenue / 1000).toFixed(0)}K | هدف $${((k.target_revenue || 0) / 1000).toFixed(0)}K | ${k.total_revenue >= (k.target_revenue || 0) ? "✅ فوق الهدف" : "⚠️ أقل من الهدف"}`).join("\n")}
- إجمالي الإيرادات: $${totalRevenue >= 1000000 ? (totalRevenue / 1000000).toFixed(1) + "M" : (totalRevenue / 1000).toFixed(0) + "K"}
${totalTarget > 0 ? `- إجمالي الأهداف: $${totalTarget >= 1000000 ? (totalTarget / 1000000).toFixed(1) + "M" : (totalTarget / 1000).toFixed(0) + "K"}\n- نسبة التحقيق: ${((totalRevenue / totalTarget) * 100).toFixed(0)}%` : ""}`);
  } else {
    sections.push(`## الأداء الشهري\nلا توجد بيانات KPI شهرية بعد.`);
  }

  // 3. Sales pipeline
  if (allDeals.length > 0) {
    const closedDeals = allDeals.filter((d) => d.stage === "مكتملة");
    const lostDeals = allDeals.filter((d) => d.stage === "مرفوض مع سبب");
    const activeDeals = allDeals.filter((d) => d.stage !== "مرفوض مع سبب");
    const pipelineValue = activeDeals.reduce((s, d) => s + d.deal_value, 0);
    const avgDealValue = pipelineValue / (activeDeals.length || 1);
    const avgCycle = allDeals.reduce((s, d) => s + d.cycle_days, 0) / allDeals.length;

    const stageDist = allDeals.reduce((acc, d) => {
      acc[d.stage] = (acc[d.stage] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const sourceDist = allDeals.reduce((acc, d) => {
      if (d.source) acc[d.source] = (acc[d.source] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    sections.push(`## المبيعات والصفقات
- إجمالي الصفقات: ${allDeals.length}
- الصفقات المغلقة: ${closedDeals.length}
- الصفقات الخاسرة: ${lostDeals.length}
- معدل الإغلاق: ${allDeals.length > 0 ? ((closedDeals.length / allDeals.length) * 100).toFixed(0) : 0}%
- قيمة Pipeline: $${(pipelineValue / 1000).toFixed(0)}K
- متوسط قيمة الصفقة: $${(avgDealValue / 1000).toFixed(0)}K
- متوسط دورة البيع: ${avgCycle.toFixed(0)} يوم
- توزيع المراحل: ${Object.entries(stageDist).map(([s, c]) => `${s} (${c})`).join("، ")}
${Object.keys(sourceDist).length > 0 ? `- توزيع المصادر: ${Object.entries(sourceDist).map(([s, c]) => `${s} (${c})`).join("، ")}` : ""}`);

    // Per-rep breakdown
    const repDeals = allDeals.reduce((acc, d) => {
      const rep = d.assigned_rep_name || "غير محدد";
      if (!acc[rep]) acc[rep] = { deals: 0, revenue: 0, closed: 0 };
      acc[rep].deals++;
      acc[rep].revenue += d.deal_value;
      if (d.stage === "مكتملة") acc[rep].closed++;
      return acc;
    }, {} as Record<string, { deals: number; revenue: number; closed: number }>);

    if (Object.keys(repDeals).length > 0) {
      sections.push(`### أداء المبيعات بالموظف:
${Object.entries(repDeals).map(([name, stats]) => `- ${name}: ${stats.deals} صفقات | $${(stats.revenue / 1000).toFixed(0)}K | إغلاق ${stats.closed}`).join("\n")}`);
    }
  } else {
    sections.push(`## المبيعات والصفقات\nلا توجد صفقات في النظام بعد.`);
  }

  // 4. Support tickets
  if (allTickets.length > 0) {
    const openTickets = allTickets.filter((t) => t.status === "مفتوح");
    const inProgress = allTickets.filter((t) => t.status === "قيد الحل");
    const resolvedTickets = allTickets.filter((t) => t.status === "محلول");
    const urgentTickets = allTickets.filter((t) => t.priority === "عاجل");

    sections.push(`## الدعم الفني
- إجمالي التذاكر: ${allTickets.length}
- مفتوحة: ${openTickets.length} | قيد الحل: ${inProgress.length} | محلولة: ${resolvedTickets.length}
- عاجلة: ${urgentTickets.length}
- معدل الحل: ${((resolvedTickets.length / allTickets.length) * 100).toFixed(0)}%`);
  } else {
    sections.push(`## الدعم الفني\nلا توجد تذاكر دعم في النظام بعد.`);
  }

  // 5. Team
  if (allEmployees.length > 0) {
    const activeEmployees = allEmployees.filter((e) => e.status === "نشط");
    sections.push(`## الفريق (${allEmployees.length} أعضاء)
${allEmployees.map((e) => `- ${e.name}: ${e.role || "—"} — الحالة: ${e.status}`).join("\n")}
- أعضاء نشطين: ${activeEmployees.length}`);
  } else {
    sections.push(`## الفريق\nلا يوجد أعضاء فريق مسجلين في النظام بعد.`);
  }

  // 6. Projects
  if (allProjects.length > 0) {
    const delayedProjects = allProjects.filter((p) => p.status_tag === "متأخر");
    sections.push(`## المشاريع (${allProjects.length} مشاريع)
${allProjects.map((p) => `- ${p.name}: ${p.progress}% | ${p.status_tag || "—"} | الفريق: ${p.team || "—"} | متبقي: ${p.remaining_tasks} مهمة`).join("\n")}
- مشاريع متأخرة: ${delayedProjects.length}`);
  } else {
    sections.push(`## المشاريع\nلا توجد مشاريع في النظام بعد.`);
  }

  // 7. Partnerships
  if (allPartnerships.length > 0) {
    const activePartners = allPartnerships.filter((p) => p.status === "شراكة نشطة");
    const totalPartnerValue = allPartnerships.reduce((s, p) => s + p.value, 0);
    sections.push(`## الشراكات (${allPartnerships.length} شراكات)
${allPartnerships.map((p) => `- ${p.name}: ${p.type || "—"} | ${p.status || "—"} | $${(p.value / 1000).toFixed(0)}K | المدير: ${p.manager_name || "—"}`).join("\n")}
- شراكات نشطة: ${activePartners.length}
- القيمة الإجمالية: $${totalPartnerValue >= 1000000 ? (totalPartnerValue / 1000000).toFixed(1) + "M" : (totalPartnerValue / 1000).toFixed(0) + "K"}`);
  } else {
    sections.push(`## الشراكات\nلا توجد شراكات مسجلة في النظام بعد.`);
  }

  // 8. Finance (computed from deals)
  if (allDeals.length > 0) {
    const closedDeals = allDeals.filter((d) => d.stage === "مكتملة");
    const totalRevenue = closedDeals.reduce((s, d) => s + d.deal_value, 0);
    const totalPipeline = allDeals.reduce((s, d) => s + d.deal_value, 0);

    // Group by month to calculate MRR
    const monthSet = new Set<string>();
    for (const d of closedDeals) {
      if (d.month && d.year) monthSet.add(`${d.year}-${d.month}`);
    }
    const activeMonths = monthSet.size || 1;
    const mrr = totalRevenue / activeMonths;
    const arr = mrr * 12;

    sections.push(`## المالية (محسوبة من الصفقات)
- إجمالي الإيرادات المحققة: $${totalRevenue >= 1000000 ? (totalRevenue / 1000000).toFixed(1) + "M" : (totalRevenue / 1000).toFixed(0) + "K"}
- قيمة Pipeline الإجمالية: $${totalPipeline >= 1000000 ? (totalPipeline / 1000000).toFixed(1) + "M" : (totalPipeline / 1000).toFixed(0) + "K"}
- MRR الشهري (تقديري): $${(mrr / 1000).toFixed(0)}K
- ARR السنوي (تقديري): $${arr >= 1000000 ? (arr / 1000000).toFixed(1) + "M" : (arr / 1000).toFixed(0) + "K"}
- الفرص المتبقية: $${((totalPipeline - totalRevenue) / 1000).toFixed(0)}K`);
  } else {
    sections.push(`## المالية\nلا توجد بيانات مالية بعد — لم تُسجل صفقات في النظام.`);
  }

  // 9. Renewals
  if (allRenewals.length > 0) {
    const activeRenewals = allRenewals.filter((r) => r.status === "نشط" || r.status === "active");
    const expiredRenewals = allRenewals.filter((r) => r.status === "منتهي" || r.status === "expired");
    const cancelledRenewals = allRenewals.filter((r) => r.status === "ملغي" || r.status === "cancelled" || r.status === "ملغي بسبب");
    const totalValue = allRenewals.reduce((s, r) => s + (r.plan_price || 0), 0);

    sections.push(`## التجديدات (${allRenewals.length} تجديد)
- نشطة: ${activeRenewals.length} | منتهية: ${expiredRenewals.length} | ملغية: ${cancelledRenewals.length}
- القيمة الإجمالية: $${totalValue >= 1000000 ? (totalValue / 1000000).toFixed(1) + "M" : (totalValue / 1000).toFixed(0) + "K"}`);
  } else {
    sections.push(`## التجديدات\nلا توجد تجديدات مسجلة في النظام بعد.`);
  }

  // 10. Reviews
  if (allReviews.length > 0) {
    const avgRating = allReviews.reduce((s, r) => s + (r.stars || 0), 0) / allReviews.length;
    const typeDist = allReviews.reduce((acc, r) => {
      const t = r.type || "غير محدد";
      acc[t] = (acc[t] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    sections.push(`## تقييمات العملاء (${allReviews.length} تقييم)
- متوسط التقييم: ${avgRating.toFixed(1)} / 5
- توزيع التقييمات: ${Object.entries(typeDist).map(([t, c]) => `${t} (${c})`).join("، ")}`);
  } else {
    sections.push(`## تقييمات العملاء\nلا توجد تقييمات مسجلة في النظام بعد.`);
  }

  // 11. Data status summary
  const hasData = allDeals.length > 0 || allTickets.length > 0 || allRenewals.length > 0;
  if (!hasData) {
    sections.push(`## ⚠️ حالة البيانات
النظام فارغ حالياً — لم يتم تحميل أي بيانات بعد.
يرجى تحميل ملف Excel من صفحة "رفع البيانات" لبدء التحليل.
إذا سأل المستخدم عن تحليل أو أرقام، أخبره أنه يجب رفع البيانات أولاً.`);
  }

  sections.push(`## تعليمات دقة البيانات
- هذا السياق ملخص إجمالي سريع.
- لأي أسماء عملاء، أرقام جوال، صفقات أو تذاكر محددة، استخدم أداة queryDatabase بدل التخمين.`);

  const context = sections.join("\n\n");
  knowledgeCache.set(ORG_ID, {
    value: context,
    expiresAt: Date.now() + KNOWLEDGE_CACHE_TTL_MS,
  });

  console.info("[agent] knowledge context built", {
    orgId: ORG_ID,
    durationMs: Math.round(performance.now() - startedAt),
    contextChars: context.length,
    counts: {
      deals: allDeals.length,
      tickets: allTickets.length,
      renewals: allRenewals.length,
      reviews: allReviews.length,
    },
  });

  return context;
}
