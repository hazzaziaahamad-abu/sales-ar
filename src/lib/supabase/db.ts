import { createClient } from "./client";
import type { Deal, Ticket, Employee, Project, Partnership, KPISnapshot, Review, Renewal, SalesActivity, SalesTarget, RepWeeklyScore, PipPlan, SalesGuideSetting } from "@/types";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export function getOrgId(): string {
  if (typeof window === "undefined") return DEFAULT_ORG;
  return localStorage.getItem("cc_org_id") || DEFAULT_ORG;
}

// ─── DEALS ───────────────────────────────────────────────────────────────────

export async function fetchDeals(): Promise<Deal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deals")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Deal[];
}

export async function createDeal(
  deal: Omit<Deal, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Deal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert({ ...deal, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function updateDeal(
  id: string,
  deal: Partial<Omit<Deal, "id" | "org_id">>
): Promise<Deal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deals")
    .update({ ...deal, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function deleteDeal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── TICKETS ─────────────────────────────────────────────────────────────────

export async function fetchTickets(): Promise<Ticket[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

export async function createTicket(
  ticket: Omit<Ticket, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Ticket> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tickets")
    .insert({ ...ticket, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Ticket;
}

export async function updateTicket(
  id: string,
  ticket: Partial<Omit<Ticket, "id" | "org_id">>
): Promise<Ticket> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tickets")
    .update({ ...ticket, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as Ticket;
}

export async function deleteTicket(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── EMPLOYEES ───────────────────────────────────────────────────────────────

export async function fetchEmployees(): Promise<Employee[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Employee[];
}

export async function createEmployee(
  emp: Omit<Employee, "id" | "org_id" | "created_at">
): Promise<Employee> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("employees")
    .insert({ ...emp, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function updateEmployee(
  id: string,
  emp: Partial<Omit<Employee, "id" | "org_id">>
): Promise<Employee> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("employees")
    .update(emp)
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as Employee;
}

export async function deleteEmployee(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── PROJECTS ────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Project[];
}

export async function createProject(
  proj: Omit<Project, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .insert({ ...proj, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

export async function updateProject(
  id: string,
  proj: Partial<Omit<Project, "id" | "org_id">>
): Promise<Project> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("projects")
    .update({ ...proj, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as Project;
}

// ─── PARTNERSHIPS ─────────────────────────────────────────────────────────────

export async function fetchPartnerships(): Promise<Partnership[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partnerships")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Partnership[];
}

export async function createPartnership(
  p: Omit<Partnership, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Partnership> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partnerships")
    .insert({ ...p, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Partnership;
}

export async function updatePartnership(
  id: string,
  p: Partial<Omit<Partnership, "id" | "org_id">>
): Promise<Partnership> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partnerships")
    .update({ ...p, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as Partnership;
}

export async function deletePartnership(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("partnerships")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── REVIEWS ─────────────────────────────────────────────────────────────────

export async function fetchReviews(): Promise<Review[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function createReview(
  review: Omit<Review, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Review> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert({ ...review, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Review;
}

export async function updateReview(
  id: string,
  review: Partial<Omit<Review, "id" | "org_id">>
): Promise<Review> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("reviews")
    .update({ ...review, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as Review;
}

export async function deleteReview(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── RENEWALS ────────────────────────────────────────────────────────────────

export async function fetchRenewals(): Promise<Renewal[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("renewals")
    .select("*")
    .eq("org_id", getOrgId())
    .order("renewal_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Renewal[];
}

export async function createRenewal(
  renewal: Omit<Renewal, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Renewal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("renewals")
    .insert({ ...renewal, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Renewal;
}

export async function updateRenewal(
  id: string,
  renewal: Partial<Omit<Renewal, "id" | "org_id">>
): Promise<Renewal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("renewals")
    .update({ ...renewal, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as Renewal;
}

export async function deleteRenewal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("renewals")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── BATCH INSERTS ───────────────────────────────────────────────────────────

export async function insertManyDeals(
  deals: Omit<Deal, "id" | "org_id" | "created_at" | "updated_at">[]
): Promise<number> {
  if (deals.length === 0) return 0;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("deals")
    .insert(deals.map((d) => ({ ...d, org_id: getOrgId() })))
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function insertManyTickets(
  tickets: Omit<Ticket, "id" | "org_id" | "created_at" | "updated_at">[]
): Promise<number> {
  if (tickets.length === 0) return 0;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tickets")
    .insert(tickets.map((t) => ({ ...t, org_id: getOrgId() })))
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

export async function insertManyRenewals(
  renewals: Omit<Renewal, "id" | "org_id" | "created_at" | "updated_at">[]
): Promise<number> {
  if (renewals.length === 0) return 0;
  const supabase = createClient();
  const { data, error } = await supabase
    .from("renewals")
    .insert(renewals.map((r) => ({ ...r, org_id: getOrgId() })))
    .select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

// ─── EXCEL UPLOAD HISTORY ────────────────────────────────────────────────────

export interface UploadRecord {
  id: string;
  filename: string;
  deals_imported: number;
  tickets_imported: number;
  renewals_imported: number;
  status: string;
  created_at: string;
}

export async function saveUploadRecord(record: {
  filename: string;
  sheets_count: number;
  deals_imported: number;
  tickets_imported: number;
  renewals_imported: number;
  status: string;
}): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("excel_uploads")
    .insert({ ...record, org_id: getOrgId() });
}

export async function fetchUploadHistory(): Promise<UploadRecord[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("excel_uploads")
    .select("id, filename, deals_imported, tickets_imported, renewals_imported, status, created_at")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false })
    .limit(20);
  return (data ?? []) as UploadRecord[];
}

// ─── KPI SNAPSHOTS ───────────────────────────────────────────────────────────

export async function fetchKpiSnapshots(): Promise<KPISnapshot[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("kpi_snapshots")
    .select("*")
    .eq("org_id", getOrgId())
    .order("year", { ascending: true })
    .order("month", { ascending: true });
  if (error) throw error;
  return (data ?? []) as KPISnapshot[];
}

// ─── SALES ACTIVITIES ─────────────────────────────────────────────────────────

export async function fetchSalesActivities(dateFrom?: string, dateTo?: string): Promise<SalesActivity[]> {
  const supabase = createClient();
  let query = supabase
    .from("sales_activities")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (dateFrom) query = query.gte("activity_date", dateFrom);
  if (dateTo) query = query.lte("activity_date", dateTo);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SalesActivity[];
}

export async function createSalesActivity(
  activity: Omit<SalesActivity, "id" | "org_id" | "created_at">
): Promise<SalesActivity> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_activities")
    .insert({ ...activity, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as SalesActivity;
}

export async function deleteSalesActivity(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("sales_activities")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── SALES TARGETS ──────────────────────────────────────────────────────────

export async function fetchSalesTargets(): Promise<SalesTarget[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_targets")
    .select("*")
    .eq("org_id", getOrgId())
    .order("period_type");
  if (error) throw error;
  return (data ?? []) as SalesTarget[];
}

export async function upsertSalesTarget(
  target: Omit<SalesTarget, "id" | "org_id" | "created_at" | "updated_at">
): Promise<SalesTarget> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_targets")
    .upsert(
      { ...target, org_id: getOrgId(), updated_at: new Date().toISOString() },
      { onConflict: "org_id,period_type,target_key" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as SalesTarget;
}

// ─── REP WEEKLY SCORES ──────────────────────────────────────────────────────

export async function fetchRepWeeklyScores(weekStart?: string): Promise<RepWeeklyScore[]> {
  const supabase = createClient();
  let query = supabase
    .from("rep_weekly_scores")
    .select("*")
    .eq("org_id", getOrgId())
    .order("total_points", { ascending: false });
  if (weekStart) query = query.eq("week_start", weekStart);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as RepWeeklyScore[];
}

export async function createRepWeeklyScore(
  score: Omit<RepWeeklyScore, "id" | "org_id" | "created_at">
): Promise<RepWeeklyScore> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("rep_weekly_scores")
    .insert({ ...score, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as RepWeeklyScore;
}

// ─── PIP PLANS ──────────────────────────────────────────────────────────────

export async function fetchPipPlans(): Promise<PipPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pip_plans")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PipPlan[];
}

export async function createPipPlan(
  plan: Omit<PipPlan, "id" | "org_id" | "created_at" | "updated_at">
): Promise<PipPlan> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pip_plans")
    .insert({ ...plan, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as PipPlan;
}

export async function updatePipPlan(
  id: string,
  plan: Partial<Omit<PipPlan, "id" | "org_id">>
): Promise<PipPlan> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pip_plans")
    .update({ ...plan, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as PipPlan;
}

// ─── SALES GUIDE SETTINGS ──────────────────────────────────────────────────

export async function fetchSalesGuideSettings(): Promise<SalesGuideSetting[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_guide_settings")
    .select("*")
    .eq("org_id", getOrgId());
  if (error) throw error;
  return (data ?? []) as SalesGuideSetting[];
}

export async function upsertSalesGuideSetting(
  setting_key: string,
  setting_value: unknown
): Promise<SalesGuideSetting> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_guide_settings")
    .upsert(
      { setting_key, setting_value, org_id: getOrgId(), updated_at: new Date().toISOString() },
      { onConflict: "org_id,setting_key" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as SalesGuideSetting;
}
