import { createClient } from "./client";
import type { Deal, Ticket, Employee, Project, Partnership, KPISnapshot, Review, Renewal, Referral, MonthlyExpense, MonthlyBudget, StartupCost, Marketer, SalesActivity, SalesTarget, RepWeeklyScore, PipPlan, SalesGuideSetting, SalesMessage, SalesMessageRating, FollowUpNote, MentionNotification, PendingDeal, TargetClient, GiftOffer, EmployeeTask, Package, AcademyContent, LearningStage, LearningLesson, LearningQuiz, ActivityLog, TrainingKnowledge, ProductFeature, TrainingSessionLog } from "@/types";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export function getOrgId(): string {
  if (typeof window === "undefined") return DEFAULT_ORG;
  return localStorage.getItem("cc_org_id") || DEFAULT_ORG;
}

// ─── ACTIVITY LOG ───────────────────────────────────────────────────────────

export async function logActivity(entry: {
  action: "create" | "update" | "delete";
  section: string;
  section_label: string;
  entity_id?: string;
  entity_title?: string;
  user_name?: string;
  details?: string;
}): Promise<void> {
  try {
    const supabase = createClient();
    let userName = entry.user_name;
    if (!userName) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("name")
          .eq("id", user.id)
          .single();
        userName = profile?.name || user.email || undefined;
      }
    }
    await supabase.from("activity_logs").insert({
      ...entry,
      user_name: userName,
      org_id: getOrgId(),
    });
  } catch {
    // Logging should never break the main operation
  }
}

// ─── USER LOGIN LOGS ────────────────────────────────────────────────────────

export interface UserLoginLog {
  id: string;
  org_id: string;
  user_id: string;
  user_name: string;
  login_at: string;
  user_agent?: string;
}

export async function fetchUserLoginLogs(limit = 200): Promise<UserLoginLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_login_logs")
    .select("*")
    .eq("org_id", getOrgId())
    .order("login_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as UserLoginLog[];
}

export async function fetchActivityLogs(options?: {
  section?: string;
  limit?: number;
  offset?: number;
}): Promise<ActivityLog[]> {
  const supabase = createClient();
  let query = supabase
    .from("activity_logs")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: false });

  if (options?.section) query = query.eq("section", options.section);
  if (options?.limit) query = query.limit(options.limit);
  if (options?.offset) query = query.range(options.offset, options.offset + (options?.limit || 50) - 1);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ActivityLog[];
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

// ─── CLIENT PROFILE ─────────────────────────────────────────────────────────

export interface ClientProfileData {
  deals: Deal[];
  renewals: Renewal[];
  tickets: Ticket[];
  notes: FollowUpNote[];
}

export async function fetchClientProfile(query: string): Promise<ClientProfileData> {
  const supabase = createClient();
  const orgId = getOrgId();
  const q = query.trim();

  const isPhone = /^\d+$/.test(q.replace(/[\s\-+()]/g, ""));

  const [dealsRes, renewalsRes, ticketsRes] = await Promise.all([
    isPhone
      ? supabase.from("deals").select("*").eq("org_id", orgId).eq("client_phone", q).order("created_at", { ascending: false })
      : supabase.from("deals").select("*").eq("org_id", orgId).ilike("client_name", `%${q}%`).order("created_at", { ascending: false }),
    isPhone
      ? supabase.from("renewals").select("*").eq("org_id", orgId).eq("customer_phone", q).order("created_at", { ascending: false })
      : supabase.from("renewals").select("*").eq("org_id", orgId).ilike("customer_name", `%${q}%`).order("created_at", { ascending: false }),
    isPhone
      ? supabase.from("tickets").select("*").eq("org_id", orgId).eq("client_phone", q).order("created_at", { ascending: false })
      : supabase.from("tickets").select("*").eq("org_id", orgId).ilike("client_name", `%${q}%`).order("created_at", { ascending: false }),
  ]);

  const deals = (dealsRes.data ?? []) as Deal[];
  const renewals = (renewalsRes.data ?? []) as Renewal[];
  const tickets = (ticketsRes.data ?? []) as Ticket[];

  const entityIds: { type: "deal" | "renewal" | "ticket"; id: string }[] = [
    ...deals.map(d => ({ type: "deal" as const, id: d.id })),
    ...renewals.map(r => ({ type: "renewal" as const, id: r.id })),
    ...tickets.map(t => ({ type: "ticket" as const, id: t.id })),
  ];

  let notes: FollowUpNote[] = [];
  if (entityIds.length > 0) {
    const ids = entityIds.map(e => e.id);
    const { data } = await supabase
      .from("follow_up_notes")
      .select("*")
      .eq("org_id", orgId)
      .in("entity_id", ids)
      .order("created_at", { ascending: false });
    notes = (data ?? []) as FollowUpNote[];
  }

  return { deals, renewals, tickets, notes };
}

export async function fetchClientBio(clientKey: string): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase
    .from("client_bios")
    .select("bio")
    .eq("org_id", getOrgId())
    .eq("client_key", clientKey)
    .single();
  return data?.bio || "";
}

export async function upsertClientBio(clientKey: string, bio: string, userName?: string): Promise<void> {
  const supabase = createClient();
  const orgId = getOrgId();
  const { error } = await supabase
    .from("client_bios")
    .upsert(
      { org_id: orgId, client_key: clientKey, bio, updated_by: userName || null, updated_at: new Date().toISOString() },
      { onConflict: "org_id,client_key" }
    );
  if (error) throw error;
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
  // Auto-trim name fields to prevent duplicates
  const trimmed = {
    ...deal,
    client_name: deal.client_name?.trim(),
    assigned_rep_name: deal.assigned_rep_name?.trim(),
    marketer_name: deal.marketer_name?.trim(),
  };
  const { data, error } = await supabase
    .from("deals")
    .insert({ ...trimmed, org_id: getOrgId(), client_code })
    .select()
    .single();
  if (error) throw error;
  const result = data as Deal;
  logActivity({ action: "create", section: "sales", section_label: "المبيعات", entity_id: result.id, entity_title: result.client_name, details: `صفقة جديدة بقيمة ${result.deal_value}` });
  return result;
}

export async function updateDeal(
  id: string,
  deal: Partial<Omit<Deal, "id" | "org_id">>
): Promise<Deal> {
  const supabase = createClient();
  // Auto-trim name fields
  const trimmed = { ...deal };
  if (trimmed.client_name) trimmed.client_name = trimmed.client_name.trim();
  if (trimmed.assigned_rep_name) trimmed.assigned_rep_name = trimmed.assigned_rep_name.trim();
  if (trimmed.marketer_name) trimmed.marketer_name = trimmed.marketer_name.trim();
  const { data, error } = await supabase
    .from("deals")
    .update({ ...trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  const result = data as Deal;
  logActivity({ action: "update", section: "sales", section_label: "المبيعات", entity_id: id, entity_title: result.client_name, details: deal.stage ? `تغيير المرحلة إلى ${deal.stage}` : "تحديث بيانات الصفقة" });
  return result;
}

export async function deleteDeal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
  logActivity({ action: "delete", section: "sales", section_label: "المبيعات", entity_id: id, details: "حذف صفقة" });
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
  const result = data as Ticket;
  logActivity({ action: "create", section: "support", section_label: "الدعم", entity_id: result.id, entity_title: result.client_name, details: `تذكرة جديدة: ${result.issue}` });
  return result;
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
  const result = data as Ticket;
  logActivity({ action: "update", section: "support", section_label: "الدعم", entity_id: id, entity_title: result.client_name, details: ticket.status ? `تغيير الحالة إلى ${ticket.status}` : "تحديث التذكرة" });
  return result;
}

export async function deleteTicket(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("tickets")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
  logActivity({ action: "delete", section: "support", section_label: "الدعم", entity_id: id, details: "حذف تذكرة" });
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
  const result = data as Employee;
  logActivity({ action: "create", section: "team", section_label: "الفريق", entity_id: result.id, entity_title: result.name, details: "إضافة موظف جديد" });
  return result;
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
  const result = data as Employee;
  logActivity({ action: "update", section: "team", section_label: "الفريق", entity_id: id, entity_title: result.name, details: "تحديث بيانات الموظف" });
  return result;
}

export async function deleteEmployee(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("employees")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
  logActivity({ action: "delete", section: "team", section_label: "الفريق", entity_id: id, details: "حذف موظف" });
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
  const result = data as Project;
  logActivity({ action: "create", section: "development", section_label: "التطويرات", entity_id: result.id, entity_title: result.name, details: "مشروع جديد" });
  return result;
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
  const result = data as Project;
  logActivity({ action: "update", section: "development", section_label: "التطويرات", entity_id: id, entity_title: result.name, details: proj.progress !== undefined ? `تقدم المشروع ${proj.progress}%` : "تحديث المشروع" });
  return result;
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
  const result = data as Partnership;
  logActivity({ action: "create", section: "partnerships", section_label: "الشراكات", entity_id: result.id, entity_title: result.name, details: "شراكة جديدة" });
  return result;
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
  const result = data as Partnership;
  logActivity({ action: "update", section: "partnerships", section_label: "الشراكات", entity_id: id, entity_title: result.name, details: "تحديث الشراكة" });
  return result;
}

export async function deletePartnership(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("partnerships")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
  logActivity({ action: "delete", section: "partnerships", section_label: "الشراكات", entity_id: id, details: "حذف شراكة" });
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
  const result = data as Review;
  logActivity({ action: "create", section: "satisfaction", section_label: "رضا العملاء", entity_id: result.id, entity_title: result.customer_name, details: `تقييم ${result.stars} نجوم` });
  return result;
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
  const result = data as Review;
  logActivity({ action: "update", section: "satisfaction", section_label: "رضا العملاء", entity_id: id, entity_title: result.customer_name, details: "تحديث التقييم" });
  return result;
}

export async function deleteReview(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("reviews")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
  logActivity({ action: "delete", section: "satisfaction", section_label: "رضا العملاء", entity_id: id, details: "حذف تقييم" });
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
  // Auto-trim name fields
  const trimmed = {
    ...renewal,
    customer_name: renewal.customer_name?.trim(),
    assigned_rep: renewal.assigned_rep?.trim(),
  };
  const { data, error } = await supabase
    .from("renewals")
    .insert({ ...trimmed, org_id: getOrgId(), client_code })
    .select()
    .single();
  if (error) throw error;
  const result = data as Renewal;
  logActivity({ action: "create", section: "renewals", section_label: "التجديدات", entity_id: result.id, entity_title: result.customer_name, details: `تجديد ${result.plan_name}` });
  return result;
}

export async function updateRenewal(
  id: string,
  renewal: Partial<Omit<Renewal, "id" | "org_id">>
): Promise<Renewal> {
  const supabase = createClient();
  // Auto-trim name fields
  const trimmed = { ...renewal };
  if (trimmed.customer_name) trimmed.customer_name = trimmed.customer_name.trim();
  if (trimmed.assigned_rep) trimmed.assigned_rep = trimmed.assigned_rep.trim();
  const { data, error } = await supabase
    .from("renewals")
    .update({ ...trimmed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  const result = data as Renewal;
  logActivity({ action: "update", section: "renewals", section_label: "التجديدات", entity_id: id, entity_title: result.customer_name, details: renewal.status ? `تغيير الحالة إلى ${renewal.status}` : "تحديث التجديد" });
  return result;
}

export async function deleteRenewal(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("renewals")
    .delete()
    .eq("id", id)
    .eq("org_id", getOrgId());
  if (error) throw error;
  logActivity({ action: "delete", section: "renewals", section_label: "التجديدات", entity_id: id, details: "حذف تجديد" });
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

export async function fetchSalesMessages(msgType?: string, product?: string): Promise<SalesMessage[]> {
  const supabase = createClient();
  let query = supabase
    .from("sales_messages")
    .select("*")
    .eq("org_id", getOrgId())
    .order("avg_rating", { ascending: false });
  if (msgType) query = query.eq("msg_type", msgType);
  if (product) query = query.eq("product", product);
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

// ─── Monthly Budget ─────────────────────────────────────────────────────────

export async function fetchMonthlyBudget(month: number, year: number): Promise<MonthlyBudget[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("monthly_budget")
    .select("*")
    .eq("org_id", getOrgId())
    .eq("month", month)
    .eq("year", year)
    .order("planned_amount", { ascending: false });
  if (error) throw error;
  return (data ?? []) as MonthlyBudget[];
}

export async function upsertBudgetItem(item: {
  category: string;
  planned_amount: number;
  month: number;
  year: number;
  notes?: string;
}): Promise<MonthlyBudget> {
  const supabase = createClient();
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("monthly_budget")
    .upsert(
      {
        org_id: orgId,
        category: item.category,
        planned_amount: item.planned_amount,
        month: item.month,
        year: item.year,
        notes: item.notes || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "org_id,category,month,year" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as MonthlyBudget;
}

export async function deleteBudgetItem(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("monthly_budget").delete().eq("id", id);
}

export async function copyBudgetFromPreviousMonth(month: number, year: number): Promise<MonthlyBudget[]> {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const prevBudget = await fetchMonthlyBudget(prevMonth, prevYear);
  if (prevBudget.length === 0) return [];
  const results: MonthlyBudget[] = [];
  for (const item of prevBudget) {
    const created = await upsertBudgetItem({
      category: item.category,
      planned_amount: item.planned_amount,
      month,
      year,
      notes: item.notes,
    });
    results.push(created);
  }
  return results;
}

// ─── Startup Costs ──────────────────────────────────────────────────────────

export async function fetchStartupCosts(): Promise<StartupCost[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("startup_costs")
    .select("*")
    .eq("org_id", getOrgId())
    .order("amount", { ascending: false });
  if (error) throw error;
  return (data ?? []) as StartupCost[];
}

export async function createStartupCost(item: Omit<StartupCost, "id" | "org_id" | "created_at" | "updated_at">): Promise<StartupCost> {
  const supabase = createClient();
  const clean: Record<string, unknown> = { org_id: getOrgId() };
  for (const [k, v] of Object.entries(item)) {
    if (v !== undefined && v !== "") clean[k] = v;
  }
  const { data, error } = await supabase.from("startup_costs").insert(clean).select().single();
  if (error) throw error;
  return data as StartupCost;
}

export async function updateStartupCost(id: string, updates: Partial<StartupCost>): Promise<StartupCost> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("startup_costs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as StartupCost;
}

export async function deleteStartupCost(id: string): Promise<void> {
  const supabase = createClient();
  await supabase.from("startup_costs").delete().eq("id", id);
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

export async function fetchFollowUpNotes(entityType: "deal" | "renewal" | "ticket", entityId: string): Promise<FollowUpNote[]> {
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
  entityType: "deal" | "renewal" | "ticket",
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

export async function updateFollowUpNote(
  id: string,
  note: string,
  editorName: string
): Promise<FollowUpNote> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("follow_up_notes")
    .update({
      note,
      edited_at: new Date().toISOString(),
      edited_by: editorName,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as FollowUpNote;
}

export async function deleteFollowUpNote(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("follow_up_notes")
    .delete()
    .eq("id", id);
  if (error) throw error;
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
    const { data: renewals } = await supabase.from("renewals").select("id, customer_name").in("id", renewalIds);
    renewals?.forEach(r => { nameMap[r.id] = r.customer_name; });
  }

  return notes.map(n => ({ ...n, entity_name: nameMap[n.entity_id] || "" })) as (FollowUpNote & { entity_name?: string })[];
}

export async function createMentionNotification(
  noteId: string,
  entityType: "deal" | "renewal" | "ticket",
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
      stage: pd.stage || "قيد التواصل",
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
  offer: Partial<Omit<GiftOffer, "id" | "org_id" | "status" | "opened_at" | "accepted_at" | "rejected_at" | "created_at" | "updated_at">> & { client_name: string; entity_type: string; gift_title: string; gift_type: string }
): Promise<GiftOffer> {
  const supabase = createClient();
  // Remove undefined keys to avoid sending null to UUID columns
  const clean: Record<string, unknown> = { org_id: getOrgId(), status: "pending" };
  for (const [k, v] of Object.entries(offer)) {
    if (v !== undefined && v !== "") clean[k] = v;
  }
  const { data, error } = await supabase
    .from("gift_offers")
    .insert(clean)
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

export async function updateGiftOffer(
  id: string,
  updates: Record<string, unknown>
): Promise<GiftOffer> {
  const supabase = createClient();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(updates)) {
    if (v !== undefined) clean[k] = v;
  }
  const { data, error } = await supabase
    .from("gift_offers")
    .update(clean)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as GiftOffer;
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

export async function registerGiftClient(id: string, clientName: string, clientPhone: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("gift_offers")
    .update({ client_name: clientName, client_phone: clientPhone, updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function registerGiftBundleClient(bundleId: string, clientName: string, clientPhone: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("gift_offers")
    .update({ client_name: clientName, client_phone: clientPhone, updated_at: new Date().toISOString() })
    .eq("bundle_id", bundleId);
}

export async function markGiftRejected(id: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("gift_offers")
    .update({ status: "rejected", rejected_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);
}

export async function createGiftBundle(
  clientInfo: { client_name: string; client_phone?: string; entity_type: "renewal" | "deal"; entity_id?: string; box_color?: string },
  gifts: { gift_title: string; gift_description?: string; gift_type: string; gift_value?: string; gift_emoji?: string }[]
): Promise<{ bundle_id: string; offers: GiftOffer[] }> {
  const supabase = createClient();
  const bundleId = crypto.randomUUID();
  const rows = gifts.map((g) => {
    const row: Record<string, unknown> = {
      org_id: getOrgId(),
      bundle_id: bundleId,
      client_name: clientInfo.client_name,
      entity_type: clientInfo.entity_type,
      gift_title: g.gift_title,
      gift_type: g.gift_type,
      gift_emoji: g.gift_emoji || "🎁",
      box_color: clientInfo.box_color || "purple",
      status: "pending",
    };
    if (clientInfo.client_phone) row.client_phone = clientInfo.client_phone;
    if (clientInfo.entity_id) row.entity_id = clientInfo.entity_id;
    if (g.gift_description) row.gift_description = g.gift_description;
    if (g.gift_value) row.gift_value = g.gift_value;
    return row;
  });
  const { data, error } = await supabase
    .from("gift_offers")
    .insert(rows)
    .select();
  if (error) throw error;
  return { bundle_id: bundleId, offers: (data ?? []) as GiftOffer[] };
}

export async function fetchGiftBundle(bundleId: string): Promise<GiftOffer[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("gift_offers")
    .select("*")
    .eq("bundle_id", bundleId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []) as GiftOffer[];
}

export async function deleteGiftBundle(bundleId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("gift_offers").delete().eq("bundle_id", bundleId);
  if (error) throw error;
}

// ─── USER PROFILES (for task assignment) ────────────────────────────────────

export async function fetchUserProfiles(): Promise<{ id: string; name: string; email: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_profiles")
    .select("id, name, email")
    .eq("org_id", getOrgId())
    .order("name");
  if (error) throw error;
  return (data ?? []) as { id: string; name: string; email: string }[];
}

// ─── EMPLOYEE TASKS ─────────────────────────────────────────────────────────

export async function fetchEmployeeTasks(filters?: { assigned_to?: string; status?: string; due_date?: string }): Promise<EmployeeTask[]> {
  const supabase = createClient();
  let query = supabase.from("employee_tasks").select("*").eq("org_id", getOrgId());
  if (filters?.assigned_to) query = query.eq("assigned_to", filters.assigned_to);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.due_date) query = query.eq("due_date", filters.due_date);
  const { data, error } = await query.order("due_date", { ascending: true }).order("priority", { ascending: true });
  if (error) throw error;
  return (data ?? []) as EmployeeTask[];
}

export async function createEmployeeTask(
  task: Omit<EmployeeTask, "id" | "org_id" | "created_at" | "updated_at">
): Promise<EmployeeTask> {
  const supabase = createClient();
  const clean: Record<string, unknown> = { org_id: getOrgId() };
  for (const [k, v] of Object.entries(task)) {
    if (v !== undefined && v !== "") clean[k] = v;
  }
  const { data, error } = await supabase.from("employee_tasks").insert(clean).select().single();
  if (error) throw error;
  const result = data as EmployeeTask;
  logActivity({ action: "create", section: "tasks", section_label: "المهام", entity_id: result.id, entity_title: result.title, details: `مهمة جديدة لـ ${result.assigned_to_name}` });
  return result;
}

export async function updateEmployeeTask(id: string, updates: Partial<EmployeeTask>): Promise<EmployeeTask> {
  const supabase = createClient();
  const clean: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [k, v] of Object.entries(updates)) {
    if (k !== "id" && k !== "org_id" && k !== "created_at" && v !== undefined) clean[k] = v;
  }
  if (updates.status === "completed" && !updates.completed_at) {
    clean.completed_at = new Date().toISOString();
  }
  const { data, error } = await supabase.from("employee_tasks").update(clean).eq("id", id).select().single();
  if (error) throw error;
  const result = data as EmployeeTask;
  logActivity({ action: "update", section: "tasks", section_label: "المهام", entity_id: id, entity_title: result.title, details: updates.status ? `تغيير الحالة إلى ${updates.status}` : "تحديث المهمة" });
  return result;
}

export async function deleteEmployeeTask(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("employee_tasks").delete().eq("id", id);
  if (error) throw error;
  logActivity({ action: "delete", section: "tasks", section_label: "المهام", entity_id: id, details: "حذف مهمة" });
}

// ─── DAILY AUTO-TASKS SYSTEM ──────────────────────────────────────────────

export interface DailyTaskTemplate {
  title: string;
  type: "call" | "followup" | "meeting" | "general" | "renewal" | "support";
}

const DEFAULT_DAILY_TASKS: DailyTaskTemplate[] = [
  { title: "إجراء 5 مكالمات جديدة", type: "call" },
  { title: "متابعة 3 عملاء حاليين", type: "followup" },
  { title: "تحديث Pipeline", type: "general" },
  { title: "إرسال عرض سعر واحد على الأقل", type: "general" },
];

export async function fetchDailyTasksTemplate(): Promise<DailyTaskTemplate[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("sales_guide_settings")
    .select("setting_value")
    .eq("org_id", getOrgId())
    .eq("setting_key", "daily_tasks_template")
    .single();
  if (data?.setting_value && Array.isArray(data.setting_value)) {
    return data.setting_value as DailyTaskTemplate[];
  }
  return DEFAULT_DAILY_TASKS;
}

export async function upsertDailyTasksTemplate(template: DailyTaskTemplate[]): Promise<void> {
  await upsertSalesGuideSetting("daily_tasks_template", template);
}

export async function generateDailyAutoTasks(
  userId: string,
  userName: string
): Promise<EmployeeTask[]> {
  const today = new Date().toISOString().split("T")[0];
  const dayOfWeek = new Date().getDay(); // 0=Sun, 5=Fri, 6=Sat
  // Only generate on workdays (Sun=0 through Thu=4)
  if (dayOfWeek === 5 || dayOfWeek === 6) return [];

  const supabase = createClient();
  const orgId = getOrgId();

  // Check if auto-tasks for today already exist
  const { data: existing } = await supabase
    .from("employee_tasks")
    .select("id")
    .eq("org_id", orgId)
    .eq("assigned_to", userId)
    .eq("due_date", today)
    .eq("assigned_by_name", "نظام تلقائي")
    .limit(1);

  if (existing && existing.length > 0) return [];

  // Fetch template
  const template = await fetchDailyTasksTemplate();

  // Create tasks
  const tasksToInsert = template.map((t) => ({
    org_id: orgId,
    title: t.title,
    task_type: t.type,
    priority: "medium" as const,
    status: "pending" as const,
    assigned_to: userId,
    assigned_to_name: userName,
    assigned_by: "system",
    assigned_by_name: "نظام تلقائي",
    due_date: today,
    start_date: today,
  }));

  const { data, error } = await supabase
    .from("employee_tasks")
    .insert(tasksToInsert)
    .select();
  if (error) throw error;
  return (data ?? []) as EmployeeTask[];
}

export async function fetchAllRepsDailyStats(date: string): Promise<{
  employee_id: string;
  employee_name: string;
  total: number;
  completed: number;
  rate: number;
  tasks: EmployeeTask[];
}[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("employee_tasks")
    .select("*")
    .eq("org_id", getOrgId())
    .eq("due_date", date);
  if (error) throw error;
  const tasks = (data ?? []) as EmployeeTask[];

  const map = new Map<string, { name: string; total: number; completed: number; tasks: EmployeeTask[] }>();
  for (const t of tasks) {
    const existing = map.get(t.assigned_to) || { name: t.assigned_to_name, total: 0, completed: 0, tasks: [] };
    existing.total++;
    if (t.status === "completed") existing.completed++;
    existing.tasks.push(t);
    map.set(t.assigned_to, existing);
  }

  return Array.from(map.entries()).map(([id, s]) => ({
    employee_id: id,
    employee_name: s.name,
    total: s.total,
    completed: s.completed,
    rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
    tasks: s.tasks,
  })).sort((a, b) => b.rate - a.rate);
}

export async function fetchWeeklyTaskStats(userId: string): Promise<{ completed: number; total: number }> {
  const supabase = createClient();
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("employee_tasks")
    .select("status")
    .eq("org_id", getOrgId())
    .eq("assigned_to", userId)
    .gte("due_date", startStr)
    .lte("due_date", endStr);
  if (error) throw error;
  const tasks = data ?? [];
  return {
    total: tasks.length,
    completed: tasks.filter((t) => t.status === "completed").length,
  };
}

export async function fetchMyTaskStats(userId: string): Promise<{ total: number; completed: number; pending: number; in_progress: number; overdue: number }> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("employee_tasks")
    .select("status, due_date")
    .eq("org_id", getOrgId())
    .eq("assigned_to", userId);
  if (error) throw error;
  const tasks = data ?? [];
  const today = new Date().toISOString().split("T")[0];
  return {
    total: tasks.length,
    completed: tasks.filter(t => t.status === "completed").length,
    pending: tasks.filter(t => t.status === "pending").length,
    in_progress: tasks.filter(t => t.status === "in_progress").length,
    overdue: tasks.filter(t => t.status !== "completed" && t.status !== "cancelled" && t.due_date && t.due_date < today).length,
  };
}

export async function fetchTeamTaskStats(): Promise<{ employee_name: string; employee_id: string; total: number; completed: number; pending: number; completion_rate: number }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("employee_tasks")
    .select("assigned_to, assigned_to_name, status")
    .eq("org_id", getOrgId());
  if (error) throw error;
  const tasks = data ?? [];
  const map = new Map<string, { name: string; total: number; completed: number; pending: number }>();
  for (const t of tasks) {
    const existing = map.get(t.assigned_to) || { name: t.assigned_to_name, total: 0, completed: 0, pending: 0 };
    existing.total++;
    if (t.status === "completed") existing.completed++;
    else if (t.status === "pending" || t.status === "in_progress") existing.pending++;
    map.set(t.assigned_to, existing);
  }
  return Array.from(map.entries()).map(([id, s]) => ({
    employee_name: s.name,
    employee_id: id,
    total: s.total,
    completed: s.completed,
    pending: s.pending,
    completion_rate: s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0,
  })).sort((a, b) => b.completion_rate - a.completion_rate);
}

// ─── PACKAGES ───────────────────────────────────────────────────────────────

export async function fetchPackages(): Promise<Package[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("packages")
    .select("*")
    .eq("org_id", getOrgId())
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data || []) as Package[];
}

export async function createPackage(
  pkg: Pick<Package, "name" | "original_price" | "is_active">
): Promise<Package> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("packages")
    .insert({ ...pkg, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as Package;
}

export async function updatePackage(
  id: string,
  updates: Partial<Pick<Package, "name" | "original_price" | "is_active">>
): Promise<Package> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("packages")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Package;
}

export async function deletePackage(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("packages").delete().eq("id", id);
  if (error) throw error;
}

/* ─── Academy Content ─── */

export async function fetchAcademyContent(section?: "menu" | "reservations"): Promise<AcademyContent[]> {
  const supabase = createClient();
  let query = supabase.from("academy_content").select("*").order("sort_order", { ascending: true });
  if (section) query = query.eq("section", section);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as AcademyContent[];
}

export async function createAcademyContent(content: Omit<AcademyContent, "id" | "created_at" | "updated_at">): Promise<AcademyContent> {
  const supabase = createClient();
  const { data, error } = await supabase.from("academy_content").insert(content).select().single();
  if (error) throw error;
  return data as AcademyContent;
}

export async function updateAcademyContent(id: string, updates: Partial<AcademyContent>): Promise<AcademyContent> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("academy_content")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as AcademyContent;
}

export async function deleteAcademyContent(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("academy_content").delete().eq("id", id);
  if (error) throw error;
}

// ─── LEARNING ACADEMY PROGRESS ──────────────────────────────────────────────

export async function fetchLearningProgress(userId: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_progress")
    .select("completed_lessons")
    .eq("user_id", userId)
    .eq("org_id", getOrgId())
    .maybeSingle();
  if (error) throw error;
  return (data?.completed_lessons as string[]) ?? [];
}

export async function saveLearningProgress(userId: string, completedLessons: string[]): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("learning_progress")
    .upsert(
      {
        user_id: userId,
        org_id: getOrgId(),
        completed_lessons: completedLessons,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,org_id" }
    );
  if (error) throw error;
}

export async function fetchAllLearningProgress(): Promise<{ user_id: string; completed_lessons: string[] }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_progress")
    .select("user_id, completed_lessons")
    .eq("org_id", getOrgId());
  if (error) throw error;
  return (data ?? []) as { user_id: string; completed_lessons: string[] }[];
}

export async function fetchLearningProgressByUserIds(userIds: string[]): Promise<{ user_id: string; completed_lessons: string[] }[]> {
  if (userIds.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_progress")
    .select("user_id, completed_lessons")
    .eq("org_id", getOrgId())
    .in("user_id", userIds);
  if (error) throw error;
  return (data ?? []) as { user_id: string; completed_lessons: string[] }[];
}

// ─── LEARNING STAGES ────────────────────────────────────────────────────────

export async function fetchLearningStages(): Promise<LearningStage[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_stages")
    .select("*")
    .eq("org_id", getOrgId())
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LearningStage[];
}

export async function createLearningStage(stage: Omit<LearningStage, "id" | "org_id" | "created_at" | "updated_at">): Promise<LearningStage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_stages")
    .insert({ ...stage, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as LearningStage;
}

export async function updateLearningStage(id: string, updates: Partial<LearningStage>): Promise<LearningStage> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_stages")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as LearningStage;
}

export async function deleteLearningStage(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("learning_stages").delete().eq("id", id).eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── LEARNING LESSONS ───────────────────────────────────────────────────────

export async function fetchLearningLessons(stageId?: string): Promise<LearningLesson[]> {
  const supabase = createClient();
  let query = supabase
    .from("learning_lessons")
    .select("*")
    .eq("org_id", getOrgId())
    .order("sort_order", { ascending: true });
  if (stageId) query = query.eq("stage_id", stageId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LearningLesson[];
}

export async function createLearningLesson(lesson: Omit<LearningLesson, "id" | "org_id" | "created_at" | "updated_at">): Promise<LearningLesson> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_lessons")
    .insert({ ...lesson, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as LearningLesson;
}

export async function updateLearningLesson(id: string, updates: Partial<LearningLesson>): Promise<LearningLesson> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_lessons")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as LearningLesson;
}

export async function deleteLearningLesson(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("learning_lessons").delete().eq("id", id).eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── LEARNING QUIZZES ───────────────────────────────────────────────────────

export async function fetchLearningQuizzes(lessonId?: string): Promise<LearningQuiz[]> {
  const supabase = createClient();
  let query = supabase
    .from("learning_quizzes")
    .select("*")
    .eq("org_id", getOrgId())
    .order("sort_order", { ascending: true });
  if (lessonId) query = query.eq("lesson_id", lessonId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as LearningQuiz[];
}

export async function createLearningQuiz(quiz: Omit<LearningQuiz, "id" | "org_id" | "created_at" | "updated_at">): Promise<LearningQuiz> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_quizzes")
    .insert({ ...quiz, org_id: getOrgId() })
    .select()
    .single();
  if (error) throw error;
  return data as LearningQuiz;
}

export async function updateLearningQuiz(id: string, updates: Partial<LearningQuiz>): Promise<LearningQuiz> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("learning_quizzes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", getOrgId())
    .select()
    .single();
  if (error) throw error;
  return data as LearningQuiz;
}

export async function deleteLearningQuiz(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("learning_quizzes").delete().eq("id", id).eq("org_id", getOrgId());
  if (error) throw error;
}

// ─── SEED LEARNING ACADEMY ─────────────────────────────────────────────────

export async function seedLearningAcademy(): Promise<void> {
  const supabase = createClient();
  const orgId = getOrgId();

  // Check if already seeded
  const { data: existing } = await supabase
    .from("learning_stages")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);
  if (existing && existing.length > 0) return;

  const stagesData = [
    {
      stage_number: 1, title: "اعرف منتجك", icon: "📦", color: "#3B82F6", sort_order: 1,
      lessons: [
        {
          lesson_key: "1-1", title: "منظومة MENU الكاملة", duration: "15 د", sort_order: 1,
          points: [
            "المنيو الإلكتروني: QR → قائمة تفاعلية → طلب للمطبخ",
            "نظام الكاشير: طلبات + فواتير + تقارير",
            "نحجز: حجز طاولات + ولاء رقمي بدون تطبيق",
            "درع: حماية المطعم من خسائر التوصيل والغرامات",
          ],
          quiz: [
            { question: "ما الميزة الأقوى اللي تفرقنا عن المنافسين؟", options: ["السعر الأرخص", "المنظومة المتكاملة", "التصميم", "عدد الموظفين"], correct_answer: 1 },
            { question: "وش يسوي درع للمطعم؟", options: ["تصميم منيو", "يحمي من خسائر التوصيل", "يوظف سائقين", "يصور الأكل"], correct_answer: 1 },
          ],
        },
        {
          lesson_key: "1-2", title: "مين عميلك؟", duration: "10 د", sort_order: 2,
          points: [
            "صاحب مطعم صغير (1-3 فروع): يبي حل بسيط وسعر معقول",
            "مدير عمليات سلسلة (5+ فروع): يبي تقارير مركزية",
            "مطعم جديد: يحتاج كل شيء من الصفر — أسهل عميل",
            "نقاط الألم: فوضى الطلبات، خسائر التوصيل، ما عنده بيانات",
          ],
          quiz: [
            { question: "أي عميل الأسهل في الإغلاق؟", options: ["السلاسل الكبيرة", "اللي عنده نظام ثاني", "المطعم الجديد أو بدون نظام"], correct_answer: 2 },
          ],
        },
      ],
    },
    {
      stage_number: 2, title: "تعلّم تبيع", icon: "🎯", color: "#8B5CF6", sort_order: 2,
      lessons: [
        {
          lesson_key: "2-1", title: "المكالمة الأولى", duration: "15 د", sort_order: 1,
          task: "سوّ 3 مكالمات باردة وسجّل النتائج",
          points: [
            "أول 10 ثواني تحدد كل شيء — لا تبدأ ببيع، ابدأ بسؤال",
            "الافتتاحية: 'كيف تدير طلباتك حالياً؟' بدل 'عندنا نظام ممتاز'",
            "الهدف: لا تبيع بالتلفون — خذ موعد زيارة أو عرض",
            "التعامل مع 'مو مهتم': 'تمام، بس سؤال سريع وش تستخدم حالياً؟'",
          ],
          quiz: [
            { question: "وش أفضل افتتاحية لمكالمة باردة؟", options: ["عندنا عرض خاص", "سؤال عن مشكلته الحالية", "تعريف بالشركة", "ذكر السعر"], correct_answer: 1 },
            { question: "وش هدف المكالمة الأولى؟", options: ["إغلاق البيع", "أخذ موعد عرض", "إرسال عرض سعر", "إضافته بالواتساب"], correct_answer: 1 },
          ],
        },
        {
          lesson_key: "2-2", title: "لما العميل يعترض", duration: "15 د", sort_order: 2,
          task: "سجّل 3 اعتراضات واجهتها وكيف رديت عليها",
          points: [
            "'غالي' → 'خليني أوريك كم تخسر شهرياً بدون نظام'",
            "'عندنا نظام' → 'وش الأشياء اللي تتمنى تتحسن فيه؟'",
            "'مو الوقت' → حدد موعد + أرسل محتوى قيمة",
            "'أحتاج أفكر' → 'تمام، نتواصل يوم الأحد؟' — دايم حدد تاريخ",
          ],
          quiz: [
            { question: "العميل يقول 'غالي'، وش أفضل رد؟", options: ["نعطيك خصم", "أوريك كم توفر شهرياً", "ما عندنا أرخص", "مافي حل"], correct_answer: 1 },
            { question: "العميل يقول 'أفكر فيها'، وش تسوي؟", options: ["تنتظر يرد", "تحدد موعد متابعة", "تتجاهله", "ترسل عرض ثاني"], correct_answer: 1 },
          ],
        },
        {
          lesson_key: "2-3", title: "أغلق الصفقة", duration: "10 د", sort_order: 3,
          points: [
            "اقرأ إشارات الشراء: يسأل عن السعر، التفعيل، التفاصيل = جاهز",
            "إغلاق الافتراض: 'نبدأ بالباقة السنوية ولا نجرب شهري؟'",
            "لا تخصم — أضف قيمة: شهر مجاني، تدريب إضافي",
            "بعد الإغلاق: فعّل فوراً + تابع أول أسبوع",
          ],
          quiz: [
            { question: "العميل يطلب خصم، وش الأفضل؟", options: ["تعطيه خصم", "تضيف قيمة بدل الخصم", "ترفض", "ترجع للمدير"], correct_answer: 1 },
          ],
        },
      ],
    },
    {
      stage_number: 3, title: "كبّر الصفقة", icon: "🚀", color: "#10B981", sort_order: 3,
      lessons: [
        {
          lesson_key: "3-1", title: "فن الـ Upsell", duration: "10 د", sort_order: 1,
          points: [
            "المسار: ابدأ بـ MENU → بعد شهر نجاح اعرض نحجز → ثم درع",
            "لا تعرض كل شيء مرة وحدة — انتظر ما ينجح أول منتج",
            "استخدم أرقام حقيقية: 'عميل مشابه وفّر X ريال بعد إضافة درع'",
            "الحزمة الكاملة: اعرضها بسعر مخفض للعملاء الجادين",
          ],
          quiz: [
            { question: "متى أفضل وقت تعرض منتج إضافي؟", options: ["أول يوم", "بعد شهر نجاح", "بعد سنة", "ما تعرض"], correct_answer: 1 },
          ],
        },
        {
          lesson_key: "3-2", title: "Pipeline صحي", duration: "10 د", sort_order: 2,
          points: [
            "قاعدة 3x: دايم حافظ على 3 أضعاف هدفك في الـ Pipeline",
            "كل أسبوع: حرّك الصفقات الراكدة أو احذفها",
            "60% وقتك استقطاب جديد، 30% متابعة، 10% إداري",
            "التجديدات: ابدأ قبل 60 يوم من انتهاء الاشتراك",
          ],
          quiz: [
            { question: "كم نسبة وقتك المفروض للاستقطاب الجديد؟", options: ["30%", "40%", "60%", "80%"], correct_answer: 2 },
          ],
        },
      ],
    },
  ];

  for (const stageData of stagesData) {
    const { lessons, ...stageFields } = stageData;
    const { data: stage, error: stageErr } = await supabase
      .from("learning_stages")
      .insert({ ...stageFields, org_id: orgId })
      .select()
      .single();
    if (stageErr || !stage) continue;

    for (const lessonData of lessons) {
      const { quiz, ...lessonFields } = lessonData;
      const { data: lesson, error: lessonErr } = await supabase
        .from("learning_lessons")
        .insert({ ...lessonFields, stage_id: stage.id, org_id: orgId })
        .select()
        .single();
      if (lessonErr || !lesson) continue;

      for (let qi = 0; qi < quiz.length; qi++) {
        await supabase
          .from("learning_quizzes")
          .insert({ ...quiz[qi], lesson_id: lesson.id, org_id: orgId, sort_order: qi + 1 });
      }
    }
  }
}

// ─── RECENT UPDATES ─────────────────────────────────────────────────────────

export interface RecentUpdateItem {
  id: string;
  section: string;
  section_label: string;
  section_color: string;
  title: string;
  subtitle?: string;
  user_name?: string;
  modified_by?: string;
  action: "created" | "updated";
  timestamp: string;
}

export async function fetchRecentUpdates(): Promise<RecentUpdateItem[]> {
  const supabase = createClient();
  const orgId = getOrgId();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const sections = [
    { table: "deals", key: "sales", label: "المبيعات", color: "emerald", titleField: "client_name", subtitleField: "assigned_rep_name", userField: "assigned_rep_name" },
    { table: "tickets", key: "support", label: "الدعم", color: "orange", titleField: "client_name", subtitleField: "issue", userField: "assigned_agent_name" },
    { table: "renewals", key: "renewals", label: "التجديدات", color: "sky", titleField: "customer_name", subtitleField: "plan_name", userField: "assigned_rep" },
    { table: "projects", key: "development", label: "التطويرات", color: "indigo", titleField: "name", subtitleField: "status_tag", userField: "team" },
    { table: "partnerships", key: "partnerships", label: "الشراكات", color: "teal", titleField: "name", subtitleField: "type", userField: "manager_name" },
    { table: "employee_tasks", key: "tasks", label: "المهام", color: "indigo", titleField: "title", subtitleField: "assigned_to_name", userField: "assigned_to_name" },
    { table: "reviews", key: "satisfaction", label: "رضا العملاء", color: "rose", titleField: "customer_name", subtitleField: "comment", userField: "" },
    { table: "monthly_expenses", key: "finance", label: "المالية", color: "lime", titleField: "category", subtitleField: "description", userField: "" },
    { table: "target_clients", key: "targeting", label: "الاستهداف", color: "fuchsia", titleField: "client_name", subtitleField: "source", userField: "assigned_rep" },
    { table: "gift_offers", key: "gifts", label: "الهدايا", color: "amber", titleField: "client_name", subtitleField: "gift_title", userField: "created_by" },
    { table: "marketers", key: "marketers", label: "المسوقين", color: "pink", titleField: "name", subtitleField: "notes", userField: "" },
  ] as const;

  // Fetch activity logs for the same period to get the actual user who performed the action
  const { data: logs } = await supabase
    .from("activity_logs")
    .select("entity_id, user_name, section, action, created_at")
    .eq("org_id", orgId)
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false });

  // Build a lookup: entity_id → most recent user_name from logs
  const logLookup = new Map<string, string>();
  if (logs) {
    for (const log of logs) {
      if (log.entity_id && log.user_name && !logLookup.has(log.entity_id)) {
        logLookup.set(log.entity_id, log.user_name);
      }
    }
  }

  const results = await Promise.allSettled(
    sections.map(async (sec) => {
      const { data } = await supabase
        .from(sec.table)
        .select("*")
        .eq("org_id", orgId)
        .gte("updated_at", weekAgo)
        .order("updated_at", { ascending: false })
        .limit(20);

      if (!data) return [];

      return data.map((row: Record<string, unknown>): RecentUpdateItem => {
        const createdAt = row.created_at as string;
        const updatedAt = row.updated_at as string;
        const isNew = createdAt === updatedAt || (new Date(updatedAt).getTime() - new Date(createdAt).getTime()) < 2000;
        const entityId = row.id as string;

        return {
          id: entityId,
          section: sec.key,
          section_label: sec.label,
          section_color: sec.color,
          title: (row[sec.titleField] as string) || "",
          subtitle: sec.subtitleField ? (row[sec.subtitleField] as string) || undefined : undefined,
          user_name: sec.userField ? (row[sec.userField] as string) || undefined : undefined,
          modified_by: logLookup.get(entityId) || undefined,
          action: isNew ? "created" : "updated",
          timestamp: updatedAt,
        };
      });
    })
  );

  const allItems: RecentUpdateItem[] = [];
  for (const r of results) {
    if (r.status === "fulfilled") allItems.push(...r.value);
  }

  allItems.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return allItems;
}

// ─── TRAINING KNOWLEDGE ────────────────────────────────────────────────────

export async function fetchTrainingKnowledge(topicKey?: string): Promise<TrainingKnowledge[]> {
  const supabase = createClient();
  let query = supabase.from("training_knowledge").select("*").eq("org_id", getOrgId()).order("topic_key");
  if (topicKey) query = query.eq("topic_key", topicKey);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as TrainingKnowledge[];
}

export async function upsertTrainingKnowledge(
  topicKey: string,
  updates: { topic_title?: string; topic_prompt?: string; product_knowledge?: string; system_wrapper?: string; updated_by?: string }
): Promise<TrainingKnowledge> {
  const supabase = createClient();
  const orgId = getOrgId();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("training_knowledge")
    .upsert(
      { org_id: orgId, topic_key: topicKey, ...updates, updated_at: now },
      { onConflict: "org_id,topic_key" }
    )
    .select()
    .single();
  if (error) throw error;
  return data as TrainingKnowledge;
}

export async function deleteTrainingKnowledge(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("training_knowledge").delete().eq("id", id);
  if (error) throw error;
}

// ─── PRODUCT FEATURES ──────────────────────────────────────────────────────

export async function fetchProductFeatures(section?: "menu" | "reservations"): Promise<ProductFeature[]> {
  const supabase = createClient();
  let query = supabase.from("product_features").select("*").eq("org_id", getOrgId()).order("sort_order", { ascending: true });
  if (section) query = query.eq("section", section);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ProductFeature[];
}

export async function createProductFeature(feature: Omit<ProductFeature, "id" | "created_at" | "updated_at">): Promise<ProductFeature> {
  const supabase = createClient();
  const { data, error } = await supabase.from("product_features").insert(feature).select().single();
  if (error) throw error;
  return data as ProductFeature;
}

export async function updateProductFeature(id: string, updates: Partial<ProductFeature>): Promise<ProductFeature> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("product_features")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as ProductFeature;
}

export async function deleteProductFeature(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("product_features").delete().eq("id", id);
  if (error) throw error;
}

// ── Quote Commitments ──────────────────────────────────────────────
export async function fetchQuoteCommitments(
  orgId: string,
  quoteDate: string,
  salesType: string
): Promise<{ user_name: string; created_at: string }[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("quote_commitments")
    .select("user_name, created_at")
    .eq("org_id", orgId)
    .eq("quote_date", quoteDate)
    .eq("sales_type", salesType);
  if (error) throw error;
  return data ?? [];
}

export async function addQuoteCommitment(
  orgId: string,
  userName: string,
  quoteDate: string,
  salesType: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("quote_commitments")
    .insert({ org_id: orgId, user_name: userName, quote_date: quoteDate, sales_type: salesType });
  if (error) throw error;
}

export async function removeQuoteCommitment(
  orgId: string,
  userName: string,
  quoteDate: string,
  salesType: string
): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("quote_commitments")
    .delete()
    .eq("org_id", orgId)
    .eq("user_name", userName)
    .eq("quote_date", quoteDate)
    .eq("sales_type", salesType);
  if (error) throw error;
}

// ── Training Session Logs ──────────────────────────────────────────
export async function createTrainingSession(session: {
  org_id: string;
  user_name: string;
  topic_key: string;
  topic_title: string;
  platform: string;
}): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_sessions")
    .insert(session)
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function completeTrainingSession(id: string, messageCount: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("training_sessions")
    .update({ status: "completed", message_count: messageCount, completed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function updateTrainingSessionMessageCount(id: string, messageCount: number): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("training_sessions")
    .update({ message_count: messageCount })
    .eq("id", id);
  if (error) throw error;
}

export async function fetchTrainingSessionLogs(limit = 100): Promise<TrainingSessionLog[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("training_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as TrainingSessionLog[];
}

/* ═══════════════════════════════════════════════════════════════
   Weekly Meetings — CRUD for weekly_meetings table
   ═══════════════════════════════════════════════════════════════ */

export interface WeeklyMeetingRow {
  id: string;
  org_id: string;
  week_label: string;
  week_start: string;
  data: Record<string, unknown>;
  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
}

export async function fetchCurrentWeeklyMeeting(): Promise<WeeklyMeetingRow | null> {
  const supabase = createClient();
  const orgId = getOrgId();
  // Get the most recent weekly meeting for this org
  const { data, error } = await supabase
    .from("weekly_meetings")
    .select("*")
    .eq("org_id", orgId)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as WeeklyMeetingRow | null;
}

export async function fetchWeeklyMeetingHistory(limit = 12): Promise<WeeklyMeetingRow[]> {
  const supabase = createClient();
  const orgId = getOrgId();
  const { data, error } = await supabase
    .from("weekly_meetings")
    .select("*")
    .eq("org_id", orgId)
    .order("week_start", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as WeeklyMeetingRow[];
}

export async function upsertWeeklyMeeting(row: {
  id?: string;
  week_label: string;
  week_start: string;
  data: Record<string, unknown>;
  updated_by?: string;
}): Promise<WeeklyMeetingRow> {
  const supabase = createClient();
  const orgId = getOrgId();
  if (row.id) {
    const { data, error } = await supabase
      .from("weekly_meetings")
      .update({ week_label: row.week_label, data: row.data, updated_by: row.updated_by, updated_at: new Date().toISOString() })
      .eq("id", row.id)
      .select()
      .single();
    if (error) throw error;
    return data as WeeklyMeetingRow;
  }
  const { data, error } = await supabase
    .from("weekly_meetings")
    .insert({ org_id: orgId, week_label: row.week_label, week_start: row.week_start, data: row.data, created_by: row.updated_by, updated_by: row.updated_by })
    .select()
    .single();
  if (error) throw error;
  return data as WeeklyMeetingRow;
}

export async function createNewWeeklyMeeting(weekLabel: string, weekStart: string, data: Record<string, unknown>, createdBy?: string): Promise<WeeklyMeetingRow> {
  const supabase = createClient();
  const orgId = getOrgId();
  const { data: row, error } = await supabase
    .from("weekly_meetings")
    .insert({ org_id: orgId, week_label: weekLabel, week_start: weekStart, data, created_by: createdBy, updated_by: createdBy })
    .select()
    .single();
  if (error) throw error;
  return row as WeeklyMeetingRow;
}
