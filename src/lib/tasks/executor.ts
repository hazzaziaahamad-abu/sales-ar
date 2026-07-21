/**
 * Scheduled-task executor.
 *
 * Resolves a task's audience, composes per-recipient content (text + optional
 * generated image card + link), sends over WhatsApp, and records a run row.
 * Uses the service-role client and scopes every query by org_id in code.
 */

import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendTextFromOrg, sendImageFromOrg } from "@/lib/wa/client";
import { computeNextRun } from "@/lib/tasks/schedule";
import { buildCardUrl, type CardPayload } from "@/lib/tasks/card";
import type { ScheduledTask, TaskActionConfig, TaskAudience } from "@/types";

interface Recipient {
  name: string;
  phone: string;
  vars: Record<string, string>;
  card?: CardPayload;
}

interface RunResult {
  status: "success" | "partial" | "failed";
  recipientsTotal: number;
  recipientsSent: number;
  summary: string;
  details: { recipients: { name?: string; phone: string; ok: boolean; error?: string }[]; error?: string };
}

const DEFAULT_THRESHOLD = 70;

function nfmt(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return "0";
  return Number(n).toLocaleString("en-US");
}

function resolvePeriod(audience: TaskAudience): { month: number; year: number } {
  if (audience.period && typeof audience.period === "object") return audience.period;
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

/** Fill {placeholders} in a template from a recipient's vars. */
function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

async function resolveUnderperformers(
  orgId: string,
  audience: TaskAudience
): Promise<Recipient[]> {
  const threshold = audience.threshold ?? DEFAULT_THRESHOLD;
  let { month, year } = resolvePeriod(audience);

  // Pull scores for the period; if none, fall back to the latest period present.
  let { data: scores } = await supabaseAdmin
    .from("employee_scores")
    .select("employee_id, overall_score, revenue, deals_won, close_rate, month, year")
    .eq("org_id", orgId)
    .eq("month", month)
    .eq("year", year);

  if (!scores || scores.length === 0) {
    const { data: latest } = await supabaseAdmin
      .from("employee_scores")
      .select("month, year")
      .eq("org_id", orgId)
      .order("year", { ascending: false })
      .order("month", { ascending: false })
      .limit(1);
    if (latest && latest[0]) {
      month = latest[0].month;
      year = latest[0].year;
      const res = await supabaseAdmin
        .from("employee_scores")
        .select("employee_id, overall_score, revenue, deals_won, close_rate, month, year")
        .eq("org_id", orgId)
        .eq("month", month)
        .eq("year", year);
      scores = res.data ?? [];
    }
  }

  const under = (scores ?? []).filter((s) => Number(s.overall_score) < threshold);
  if (under.length === 0) return [];

  const { data: employees } = await supabaseAdmin
    .from("employees")
    .select("id, name, phone, status")
    .eq("org_id", orgId)
    .in("id", under.map((s) => s.employee_id));

  const byId = new Map((employees ?? []).map((e) => [e.id, e]));
  const recipients: Recipient[] = [];
  for (const s of under) {
    const emp = byId.get(s.employee_id);
    if (!emp?.phone) continue;
    const score = Number(s.overall_score);
    const gap = Math.max(0, threshold - score);
    const vars: Record<string, string> = {
      name: emp.name ?? "",
      score: String(score),
      threshold: String(threshold),
      gap: String(gap),
      revenue: nfmt(s.revenue),
      deals: nfmt(s.deals_won),
      close_rate: `${nfmt(s.close_rate)}%`,
    };
    recipients.push({
      name: emp.name ?? "",
      phone: emp.phone,
      vars,
      card: {
        t: "performance",
        title: "تنبيه الأداء",
        name: emp.name ?? "",
        body: `النتيجة ${score} من أصل ${threshold} المطلوبة`,
        stats: [
          { label: "النتيجة", value: String(score), tone: "bad" },
          { label: "المطلوب", value: String(threshold), tone: "neutral" },
          { label: "الإيراد", value: nfmt(s.revenue), tone: "neutral" },
        ],
      },
    });
  }
  return recipients;
}

async function resolveExplicit(
  orgId: string,
  audience: TaskAudience
): Promise<Recipient[]> {
  const recipients: Recipient[] = [];

  if (audience.kind === "phones") {
    for (const phone of audience.phones ?? []) {
      const digits = String(phone).replace(/[^\d]/g, "");
      if (digits.length >= 8) recipients.push({ name: "", phone: digits, vars: { name: "" } });
    }
    return recipients;
  }

  // employees / all_team
  const seen = new Set<string>();
  const pushEmployees = (rows: { id: string; name: string | null; phone: string | null }[] | null) => {
    for (const emp of rows ?? []) {
      if (!emp.phone || seen.has(emp.id)) continue;
      seen.add(emp.id);
      recipients.push({ name: emp.name ?? "", phone: emp.phone, vars: { name: emp.name ?? "" } });
    }
  };

  const byId = audience.kind === "employees" ? audience.employee_ids ?? [] : [];
  const byName = audience.kind === "employees" ? audience.employee_names ?? [] : [];

  // Explicit selection by id and/or name; otherwise the whole team.
  if (audience.kind === "employees" && (byId.length || byName.length)) {
    if (byId.length) {
      const { data } = await supabaseAdmin
        .from("employees").select("id, name, phone").eq("org_id", orgId).in("id", byId);
      pushEmployees(data);
    }
    for (const name of byName) {
      const { data } = await supabaseAdmin
        .from("employees").select("id, name, phone").eq("org_id", orgId).ilike("name", `%${name}%`);
      pushEmployees(data);
    }
  } else {
    const { data } = await supabaseAdmin
      .from("employees").select("id, name, phone").eq("org_id", orgId);
    pushEmployees(data);
  }
  return recipients;
}

async function resolveAudience(task: ScheduledTask): Promise<Recipient[]> {
  const audience = task.action_config?.audience;
  if (!audience) return [];
  if (task.action_type === "notify_underperformers" || audience.kind === "underperformers") {
    return resolveUnderperformers(task.org_id, audience);
  }
  return resolveExplicit(task.org_id, audience);
}

/** Execute a single task now and return an aggregate result. */
export async function runTask(task: ScheduledTask): Promise<RunResult> {
  const config: TaskActionConfig = task.action_config ?? { audience: { kind: "all_team" }, message: { template: "" } };
  const message = config.message ?? { template: "" };

  let recipients: Recipient[];
  try {
    recipients = await resolveAudience(task);
  } catch (err) {
    return {
      status: "failed",
      recipientsTotal: 0,
      recipientsSent: 0,
      summary: "فشل تحديد المستلمين",
      details: { recipients: [], error: err instanceof Error ? err.message : "audience error" },
    };
  }

  if (recipients.length === 0) {
    return {
      status: "success",
      recipientsTotal: 0,
      recipientsSent: 0,
      summary: "لا يوجد مستلمون مطابقون",
      details: { recipients: [] },
    };
  }

  const results: { name?: string; phone: string; ok: boolean; error?: string }[] = [];
  for (const r of recipients) {
    let text = fillTemplate(message.template || "", r.vars);
    if (message.link) text += `\n${message.link}`;
    try {
      if (message.include_image && r.card) {
        await sendImageFromOrg(task.org_id, r.phone, buildCardUrl(r.card), text);
      } else {
        await sendTextFromOrg(task.org_id, r.phone, text);
      }
      results.push({ name: r.name, phone: r.phone, ok: true });
    } catch (err) {
      results.push({
        name: r.name,
        phone: r.phone,
        ok: false,
        error: err instanceof Error ? err.message : "send failed",
      });
    }
  }

  const sent = results.filter((r) => r.ok).length;
  const status: RunResult["status"] = sent === 0 ? "failed" : sent < results.length ? "partial" : "success";
  return {
    status,
    recipientsTotal: results.length,
    recipientsSent: sent,
    summary: `أُرسلت ${sent} من ${results.length}`,
    details: { recipients: results },
  };
}

/** Execute a task and persist a run record. Returns the run result. */
export async function runTaskAndRecord(task: ScheduledTask): Promise<RunResult> {
  const { data: runRow } = await supabaseAdmin
    .from("scheduled_task_runs")
    .insert({ task_id: task.id, org_id: task.org_id, status: "running" })
    .select("id")
    .single();

  const result = await runTask(task);

  if (runRow?.id) {
    await supabaseAdmin
      .from("scheduled_task_runs")
      .update({
        status: result.status,
        finished_at: new Date().toISOString(),
        recipients_total: result.recipientsTotal,
        recipients_sent: result.recipientsSent,
        summary: result.summary,
        details: result.details,
      })
      .eq("id", runRow.id);
  }
  return result;
}

/** Run every active task whose next_run_at is due. Invoked by the cron route. */
export async function runDueTasks(): Promise<{ ran: number; results: { id: string; status: string; summary: string }[] }> {
  const nowIso = new Date().toISOString();
  const { data: due } = await supabaseAdmin
    .from("scheduled_tasks")
    .select("*")
    .eq("status", "active")
    .lte("next_run_at", nowIso)
    .not("next_run_at", "is", null)
    .limit(50);

  const tasks = (due ?? []) as ScheduledTask[];
  const results: { id: string; status: string; summary: string }[] = [];

  for (const task of tasks) {
    const result = await runTaskAndRecord(task);

    const next = computeNextRun(task, new Date());
    await supabaseAdmin
      .from("scheduled_tasks")
      .update({
        last_run_at: new Date().toISOString(),
        run_count: (task.run_count ?? 0) + 1,
        next_run_at: next ? next.toISOString() : null,
        status: next ? "active" : "completed",
      })
      .eq("id", task.id);

    results.push({ id: task.id, status: result.status, summary: result.summary });
  }

  return { ran: tasks.length, results };
}
