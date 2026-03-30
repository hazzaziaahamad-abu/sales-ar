import { createClient } from "./client";
import type { Deal, Ticket, Employee, Project, Partnership, KPISnapshot, Review, Renewal, Referral, MonthlyExpense, Marketer, SalesActivity, SalesTarget, RepWeeklyScore, PipPlan, SalesGuideSetting, SalesMessage, SalesMessageRating, FollowUpNote, MentionNotification, PendingDeal, TargetClient, GiftOffer } from "@/types";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export function getOrgId(): string {
  if (typeof window === "undefined") return DEFAULT_ORG;
  return localStorage.getItem("cc_org_id") || DEFAULT_ORG;
}

// ─── CLIENT CODE GENERATOR ──────────────────────────────────────────────────

async function getNextClientCode(table: "deals" | "renewals", prefix: "S" | "R" | "D"): Promise<string> {
  const supabase = createClient();
  let query = supabase
    .from(table)
    .select("client_code")
    .eq("org_id", getOrgId())
    .not("client_code", "is", null);
  if (table === "deals") {
    query = query.like("client_code", `${prefix}-%`);
  }
  const { data } = await query.order("client_code", { ascending: false }).limit(1);

  let nextNum = 1;
  if (data && data.length > 0 && data[0].client_code) {
    const match = data[0].client_code.match(/\d+$/);
    if (match) nextNum = parseInt(match[0], 10) + 1;
  }
  return `${prefix}-${String(nextNum).padStart(4, "0")}`;
}

// ─── DEALS ───────────────────────────────────────────────────────────────────

export async function fetchDeals(salesType?: "office" | "support"): Promise<Deal[]> {
  const supabase = createClient();
  let query = supabase
    .from("deals")
    .select("*")
    .eq("org_id", getOrgId());
  if (salesType) query = query.eq("sales_type", salesType);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Deal[];
}

export async function createDeal(
  deal: Omit<Deal, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Deal> {
  const supabase = createClient();
  const prefix = deal.sales_type === "support" ? "D" : "S";
  const client_code = await getNextClientCode("deals", prefix);
  const { data, error } = await supabase
    .from("deals")
    .insert({ ...deal, org_id: getOrgId(), client_code })
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
  const client_code = await getNextClientCode("renewals", "R");
  const { data, error } = await supabase
    .from("renewals")
    .insert({ ...renewal, org_id: getOrgId(), client_code })
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

// ─── SALES MESSAGES & SCRIPTS ──────────────────────────────────────────────

export async function fetchSalesMessages(msgType?: string): Promise<SalesMessage[]> {
  const supabase = createClient();
  let query = supabase
    .from("sales_messages")
    .select("*")
    .eq("org_id", getOrgId())
    .order("avg_rating", { ascending: false });
  if (msgType) query = query.eq("msg_type", msgType);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as SalesMessage[];
}

export async function createSalesMessage(
  msg: Omit<SalesMessage, "id" | "org_id" | "avg_rating" | "ratings_count" | "created_at" | "updated_at">
): Promise<SalesMessage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_messages")
    .insert({ ...msg, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as SalesMessage;
}

export async function updateSalesMessage(
  id: string,
  msg: Partial<Pick<SalesMessage, "title" | "content" | "category">>
): Promise<SalesMessage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_messages")
    .update({ ...msg, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as SalesMessage;
}

export async function deleteSalesMessage(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("sales_messages")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

export async function fetchMessageRatings(messageId: string): Promise<SalesMessageRating[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sales_message_ratings")
    .select("*")
    .eq("message_id", messageId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SalesMessageRating[];
}

export async function addMessageRating(
  messageId: string,
  rating: number,
  comment?: string,
  ratedBy?: string
): Promise<SalesMessageRating> {
  const supabase = createClient();

  // Insert rating
  const { data, error } = await supabase
    .from("sales_message_ratings")
    .insert({ message_id: messageId, org_id: getOrgId(), rating, comment, rated_by: ratedBy })
    .select()
    .single();
  if (error) throw error;

  // Update average on the message
  const { data: allRatings } = await supabase
    .from("sales_message_ratings")
    .select("rating")
    .eq("message_id", messageId);

  if (allRatings && allRatings.length > 0) {
    const avg = allRatings.reduce((s, r) => s + r.rating, 0) / allRatings.length;
    await supabase
      .from("sales_messages")
      .update({ avg_rating: Math.round(avg * 10) / 10, ratings_count: allRatings.length })
      .eq("id", messageId);
  }

  return data as SalesMessageRating;
}

// ─── Referrals ─────────────────────────────────────────────────────────────

export async function fetchReferrals(): Promise<Referral[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("referrals")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  return (data || []) as Referral[];
}

export async function createReferral(
  referral: Omit<Referral, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Referral> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("referrals")
    .insert({ ...referral, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Referral;
}

export async function updateReferral(
  id: string,
  referral: Partial<Omit<Referral, "id" | "org_id">>
): Promise<Referral> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("referrals")
    .update({ ...referral, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Referral;
}

// ─── Weekly Retention Stats (computed from real data) ──────────────────────

export async function fetchWeeklyRetentionStats(): Promise<{
  renewed: number;
  expiring: number;
  contacted: number;
  upsell: number;
  renewRate: number;
}> {
  const supabase = createClient();
  const orgId = getOrgId();
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];

  // Next 14 days for expiring
  const expiringEnd = new Date(now);
  expiringEnd.setDate(now.getDate() + 14);
  const expiringEndStr = expiringEnd.toISOString().split("T")[0];

  // Renewals completed this week
  const { data: renewedData } = await supabase
    .from("renewals")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "مكتمل")
    .gte("updated_at", weekStartStr);
  const renewed = renewedData?.length || 0;

  // Subscriptions expiring in next 14 days
  const { data: expiringData } = await supabase
    .from("renewals")
    .select("id")
    .eq("org_id", orgId)
    .neq("status", "مكتمل")
    .neq("status", "ملغي بسبب")
    .gte("renewal_date", todayStr)
    .lte("renewal_date", expiringEndStr);
  const expiring = expiringData?.length || 0;

  // Contacted this week (status = جاري المتابعة and updated this week)
  const { data: contactedData } = await supabase
    .from("renewals")
    .select("id")
    .eq("org_id", orgId)
    .eq("status", "جاري المتابعة")
    .gte("updated_at", weekStartStr);
  const contacted = contactedData?.length || 0;

  // Upsell: deals closed this week with source "جديد لعميل حالي"
  const { data: upsellData } = await supabase
    .from("deals")
    .select("id")
    .eq("org_id", orgId)
    .eq("stage", "مكتملة")
    .eq("source", "جديد لعميل حالي")
    .gte("updated_at", weekStartStr);
  const upsell = upsellData?.length || 0;

  // Renewal rate: completed / (completed + cancelled) this month
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const { data: allDueData } = await supabase
    .from("renewals")
    .select("status")
    .eq("org_id", orgId)
    .gte("renewal_date", monthStart)
    .lte("renewal_date", todayStr);
  const allDue = allDueData || [];
  const completedCount = allDue.filter((r) => r.status === "مكتمل").length;
  const renewRate = allDue.length > 0 ? Math.round((completedCount / allDue.length) * 100) : 0;

  return { renewed, expiring, contacted, upsell, renewRate };
}

export async function fetchWeeklyReferralStats(): Promise<{
  active: number;
  newRefs: number;
  converted: number;
  rewards: number;
  convRate: number;
}> {
  const supabase = createClient();
  const orgId = getOrgId();
  const now = new Date();
  const dayOfWeek = now.getDay();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  weekStart.setHours(0, 0, 0, 0);
  const weekStartStr = weekStart.toISOString().split("T")[0];

  // All referrals for org
  const { data: allRefs } = await supabase
    .from("referrals")
    .select("*")
    .eq("org_id", orgId);
  const refs = (allRefs || []) as Referral[];

  // Active referrers (unique referrer names)
  const activeReferrers = new Set(refs.map((r) => r.referrer_name));
  const active = activeReferrers.size;

  // New referrals this week
  const newRefs = refs.filter((r) => r.created_at >= weekStartStr).length;

  // Converted
  const convertedCount = refs.filter((r) => r.converted).length;

  // Rewards paid
  const rewards = refs.filter((r) => r.reward_paid).reduce((s, r) => s + r.reward_amount, 0);

  // Conversion rate
  const convRate = refs.length > 0 ? Math.round((convertedCount / refs.length) * 100) : 0;

  return { active, newRefs, converted: convertedCount, rewards, convRate };
}

// ─── Monthly Expenses ──────────────────────────────────────────────────────

export async function fetchMonthlyExpenses(month?: number, year?: number): Promise<MonthlyExpense[]> {
  const supabase = createClient();
  let query = supabase
    .from("monthly_expenses")
    .select("*")
    .eq("org_id", getOrgId())
    .order("amount", { ascending: false });

  if (month !== undefined && year !== undefined) {
    query = query.eq("month", month).eq("year", year);
  }

  const { data } = await query;
  return (data || []) as MonthlyExpense[];
}

export async function createExpense(
  expense: Omit<MonthlyExpense, "id" | "org_id" | "created_at" | "updated_at">
): Promise<MonthlyExpense> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("monthly_expenses")
    .insert({ ...expense, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyExpense;
}

export async function updateExpense(
  id: string,
  expense: Partial<Omit<MonthlyExpense, "id" | "org_id">>
): Promise<MonthlyExpense> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("monthly_expenses")
    .update({ ...expense, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyExpense;
}

export async function deleteExpense(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("monthly_expenses").delete().eq("id", id);
}

// ─── Marketers ──────────────────────────────────────────────────────────────

export async function fetchMarketers(): Promise<Marketer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketers")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Marketer[];
}

export async function createMarketer(
  marketer: Omit<Marketer, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Marketer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketers")
    .insert({ ...marketer, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Marketer;
}

export async function updateMarketer(
  id: string,
  marketer: Partial<Omit<Marketer, "id" | "org_id">>
): Promise<Marketer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("marketers")
    .update({ ...marketer, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as Marketer;
}

export async function deleteMarketer(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("marketers")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── FOLLOW-UP NOTES ──────────────────────────────────────────────────────────

export async function fetchFollowUpNotes(entityType: "deal" | "renewal", entityId: string): Promise<FollowUpNote[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("follow_up_notes")
    .select("*")
    .eq("org_id", getOrgId())
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as FollowUpNote[];
}

export async function createFollowUpNote(
  entityType: "deal" | "renewal",
  entityId: string,
  note: string,
  authorName: string
): Promise<FollowUpNote> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("follow_up_notes")
    .insert({ org_id: getOrgId(), entity_type: entityType, entity_id: entityId, note, author_name: authorName })
    .select()
    .single();
  if (error) throw error;
  return data as FollowUpNote;
}

export async function fetchRecentFollowUpNotes(limit = 20): Promise<(FollowUpNote & { entity_name?: string })[]> {
  const supabase = createClient();
  const orgId = getOrgId();

  // Fetch recent notes
  const { data: notes, error } = await supabase
    .from("follow_up_notes")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!notes || notes.length === 0) return [];

  // Get entity names from deals and renewals
  const dealIds = notes.filter(n => n.entity_type === "deal").map(n => n.entity_id);
  const renewalIds = notes.filter(n => n.entity_type === "renewal").map(n => n.entity_id);

  const nameMap: Record<string, string> = {};

  if (dealIds.length > 0) {
    const { data: deals } = await supabase.from("deals").select("id, client_name").in("id", dealIds);
    deals?.forEach(d => { nameMap[d.id] = d.client_name; });
  }
  if (renewalIds.length > 0) {
    const { data: renewals } = await supabase.from("renewals").select("id, business_name").in("id", renewalIds);
    renewals?.forEach(r => { nameMap[r.id] = r.business_name; });
  }

  return notes.map(n => ({ ...n, entity_name: nameMap[n.entity_id] || "" })) as (FollowUpNote & { entity_name?: string })[];
}

export async function createMentionNotification(
  noteId: string,
  entityType: "deal" | "renewal",
  entityId: string,
  entityName: string,
  mentionedName: string,
  authorName: string,
  noteText: string
): Promise<void> {
  const supabase = createClient();
  await supabase.from("mention_notifications").insert({
    org_id: getOrgId(),
    note_id: noteId,
    entity_type: entityType,
    entity_id: entityId,
    entity_name: entityName,
    mentioned_name: mentionedName,
    author_name: authorName,
    note_text: noteText,
  });
}

export async function fetchMentionNotifications(userName: string): Promise<MentionNotification[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("mention_notifications")
    .select("*")
    .eq("org_id", getOrgId())
    .eq("mentioned_name", userName)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data || []) as MentionNotification[];
}

export async function markMentionNotificationsRead(ids: string[]): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("mention_notifications")
    .update({ is_read: true })
    .in("id", ids)
    .eq("org_id", getOrgId());
}

// ─── PENDING DEALS ──────────────────────────────────────────────────────────

export async function submitPendingDeal(orgId: string, deal: Omit<PendingDeal, "id" | "status" | "reviewed_at" | "reviewed_by" | "created_at" | "updated_at">): Promise<PendingDeal> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pending_deals")
    .insert({ ...deal, org_id: orgId, status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data as PendingDeal;
}

export async function fetchPendingDeals(status?: string): Promise<PendingDeal[]> {
  const supabase = createClient();
  let query = supabase
    .from("pending_deals")
    .select("*")
    .eq("org_id", getOrgId());
  if (status) query = query.eq("status", status);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as PendingDeal[];
}

export async function approvePendingDeal(id: string, reviewerName: string): Promise<Deal> {
  const supabase = createClient();
  // 1. Get the pending deal
  const { data: pd, error: fetchErr } = await supabase
    .from("pending_deals")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !pd) throw fetchErr || new Error("Not found");

  // 2. Create real deal
  const prefix = pd.sales_type === "support" ? "D" : "S";
  const client_code = await getNextClientCode("deals", prefix);
  const dealDate = new Date().toISOString().slice(0, 10);
  const d = new Date(dealDate);

  const { data: deal, error: createErr } = await supabase
    .from("deals")
    .insert({
      org_id: pd.org_id,
      client_code,
      sales_type: pd.sales_type || "office",
      client_name: pd.client_name,
      client_phone: pd.client_phone,
      deal_value: pd.deal_value,
      source: pd.source,
      stage: pd.stage || "تواصل",
      plan: pd.plan,
      assigned_rep_name: pd.assigned_rep_name,
      notes: pd.notes,
      probability: 50,
      cycle_days: 0,
      deal_date: dealDate,
      month: d.getMonth() + 1,
      year: d.getFullYear(),
    })
    .select()
    .single();
  if (createErr) throw createErr;

  // 3. Mark pending as approved
  await supabase
    .from("pending_deals")
    .update({ status: "approved", reviewed_at: new Date().toISOString(), reviewed_by: reviewerName })
    .eq("id", id);

  return deal as Deal;
}

export async function rejectPendingDeal(id: string, reviewerName: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("pending_deals")
    .update({ status: "rejected", reviewed_at: new Date().toISOString(), reviewed_by: reviewerName })
    .eq("id", id);
}

export async function countPendingDeals(): Promise<number> {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("pending_deals")
    .select("*", { count: "exact", head: true })
    .eq("org_id", getOrgId())
    .eq("status", "pending");
  if (error) return 0;
  return count ?? 0;
}

// ─── TARGETING CLIENTS ──────────────────────────────────────────────────────

export async function fetchTargetClients(month: number, year: number): Promise<TargetClient[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("targeting_clients")
    .select("*")
    .eq("org_id", getOrgId())
    .eq("month", month)
    .eq("year", year)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as TargetClient[];
}

export async function createTargetClient(
  client: Omit<TargetClient, "id" | "org_id" | "created_at" | "updated_at">
): Promise<TargetClient> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("targeting_clients")
    .insert({ ...client, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as TargetClient;
}

export async function updateTargetClient(
  id: string,
  updates: Partial<Omit<TargetClient, "id" | "org_id">>
): Promise<TargetClient> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("targeting_clients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as TargetClient;
}

export async function deleteTargetClient(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("targeting_clients")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

export async function setDailyTargets(ids: string[], date: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("targeting_clients")
    .update({ target_date: date, updated_at: new Date().toISOString() })
    .in("id", ids);
  if (error) throw error;
}

export async function clearDailyTarget(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("targeting_clients")
    .update({ target_date: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

// ─── GIFT OFFERS ──────────────────────────────────────────────────────────

export async function fetchGiftOffers(): Promise<GiftOffer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gift_offers")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GiftOffer[];
}

export async function createGiftOffer(
  offer: Omit<GiftOffer, "id" | "org_id" | "status" | "opened_at" | "accepted_at" | "rejected_at" | "created_at" | "updated_at">
): Promise<GiftOffer> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gift_offers")
    .insert({ ...offer, org_id: getOrgId(), status: "pending" })
    .select()
    .single();
  if (error) throw error;
  return data as GiftOffer;
}

export async function deleteGiftOffer(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("gift_offers").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchGiftOfferPublic(id: string): Promise<GiftOffer | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gift_offers")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as GiftOffer;
}

export async function markGiftOpened(id: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("gift_offers")
    .update({ status: "opened", opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["pending"]);
}

export async function markGiftAccepted(id: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("gift_offers")
    .update({ status: "accepted", accepted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function markGiftRejected(id: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("gift_offers")
    .update({ status: "rejected", rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}
