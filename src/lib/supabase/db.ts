import { createClient } from "./client";
import type { Deal, Ticket, Employee, Project, Partnership, KPISnapshot, Review, Renewal } from "@/types";

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

// ─── EXCEL UPLOAD HISTORY ────────────────────────────────────────────────────

export interface UploadRecord {
  id: string;
  filename: string;
  deals_imported: number;
  tickets_imported: number;
  status: string;
  created_at: string;
}

export async function saveUploadRecord(record: {
  filename: string;
  sheets_count: number;
  deals_imported: number;
  tickets_imported: number;
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
    .select("id, filename, deals_imported, tickets_imported, status, created_at")
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
