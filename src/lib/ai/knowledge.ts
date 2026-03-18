import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Deal, Ticket, Employee, Project, Partnership, KPISnapshot } from "@/types";

import { getOrgId } from "@/lib/supabase/db";

/**
 * Builds a knowledge context string from REAL Supabase data.
 * This is injected into the AI agent's system prompt so it can answer
 * questions accurately with real numbers.
 */
export async function buildKnowledgeContext(): Promise<string> {
  const supabase = await createServerSupabaseClient();

  // Fetch all data in parallel
  const [
    { data: deals },
    { data: tickets },
    { data: employees },
    { data: projects },
    { data: partnerships },
    { data: kpiSnapshots },
  ] = await Promise.all([
    supabase.from("deals").select("*").eq("org_id", getOrgId()).order("created_at", { ascending: false }),
    supabase.from("tickets").select("*").eq("org_id", getOrgId()).order("created_at", { ascending: false }),
    supabase.from("employees").select("*").eq("org_id", getOrgId()),
    supabase.from("projects").select("*").eq("org_id", getOrgId()),
    supabase.from("partnerships").select("*").eq("org_id", getOrgId()),
    supabase.from("kpi_snapshots").select("*").eq("org_id", getOrgId()).order("year").order("month"),
  ]);

  const allDeals = (deals ?? []) as Deal[];
  const allTickets = (tickets ?? []) as Ticket[];
  const allEmployees = (employees ?? []) as Employee[];
  const allProjects = (projects ?? []) as Project[];
  const allPartnerships = (partnerships ?? []) as Partnership[];
  const allKpi = (kpiSnapshots ?? []) as KPISnapshot[];

  const sections: string[] = [];

  // 1. Company overview
  sections.push(`## معلومات الشركة
- الاسم: RESTAVO — شركة أتمتة مطاعم في السعودية
- المنصة: CommandCenter — لوحة إدارة المبيعات والدعم
- التاريخ الحالي: ${new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" })}`);

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
    const closedDeals = allDeals.filter((d) => d.stage === "إغلاق");
    const lostDeals = allDeals.filter((d) => d.stage === "خسارة");
    const activeDeals = allDeals.filter((d) => d.stage !== "خسارة");
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
${Object.keys(sourceDist).length > 0 ? `- توزيع المصادر: ${Object.entries(sourceDist).map(([s, c]) => `${s} (${c})`).join("، ")}` : ""}

### تفاصيل الصفقات:
| العميل | القيمة | المرحلة | الاحتمالية | المسؤول | دورة البيع |
|--------|--------|---------|-----------|---------|-----------|
${allDeals.slice(0, 30).map((d) => `| ${d.client_name} | $${(d.deal_value / 1000).toFixed(0)}K | ${d.stage} | ${d.probability}% | ${d.assigned_rep_name || "—"} | ${d.cycle_days} يوم |`).join("\n")}${allDeals.length > 30 ? `\n... و${allDeals.length - 30} صفقة أخرى` : ""}`);

    // Per-rep breakdown
    const repDeals = allDeals.reduce((acc, d) => {
      const rep = d.assigned_rep_name || "غير محدد";
      if (!acc[rep]) acc[rep] = { deals: 0, revenue: 0, closed: 0 };
      acc[rep].deals++;
      acc[rep].revenue += d.deal_value;
      if (d.stage === "إغلاق") acc[rep].closed++;
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
- معدل الحل: ${((resolvedTickets.length / allTickets.length) * 100).toFixed(0)}%

### تفاصيل التذاكر:
${allTickets.slice(0, 20).map((t) => `| #${t.ticket_number || "—"} | ${t.client_name} | ${t.issue} | ${t.priority} | ${t.status} | ${t.assigned_agent_name || "—"} |`).join("\n")}${allTickets.length > 20 ? `\n... و${allTickets.length - 20} تذكرة أخرى` : ""}`);
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
    const closedDeals = allDeals.filter((d) => d.stage === "إغلاق");
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

  // 9. Data status summary
  const hasData = allDeals.length > 0 || allTickets.length > 0;
  if (!hasData) {
    sections.push(`## ⚠️ حالة البيانات
النظام فارغ حالياً — لم يتم تحميل أي بيانات بعد.
يرجى تحميل ملف Excel من صفحة "رفع البيانات" لبدء التحليل.
إذا سأل المستخدم عن تحليل أو أرقام، أخبره أنه يجب رفع البيانات أولاً.`);
  }

  return sections.join("\n\n");
}
