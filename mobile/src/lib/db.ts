import { supabase } from "./supabase";
import type { Deal, Ticket, Employee, Renewal } from "../types";
import * as SecureStore from "expo-secure-store";

const DEFAULT_ORG = "00000000-0000-0000-0000-000000000001";

export async function getOrgId(): Promise<string> {
  const stored = await SecureStore.getItemAsync("cc_org_id");
  return stored || DEFAULT_ORG;
}

export async function setOrgId(orgId: string): Promise<void> {
  await SecureStore.setItemAsync("cc_org_id", orgId);
}

// ─── DEALS ──────────────────────────────────────────────────────────────────

export async function fetchDeals(salesType?: "office" | "support"): Promise<Deal[]> {
  const orgId = await getOrgId();
  let query = supabase.from("deals").select("*").eq("org_id", orgId);
  if (salesType) query = query.eq("sales_type", salesType);
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Deal[];
}

export async function createDeal(
  deal: Omit<Deal, "id" | "org_id" | "created_at" | "updated_at">
): Promise<Deal> {
  const orgId = await getOrgId();
  const prefix = deal.sales_type === "support" ? "D" : "S";
  const client_code = await getNextClientCode("deals", prefix);
  const { data, error } = await supabase
    .from("deals")
    .insert({
      ...deal,
      client_name: deal.client_name?.trim(),
      assigned_rep_name: deal.assigned_rep_name?.trim(),
      org_id: orgId,
      client_code,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function updateDeal(
  id: string, deal: Partial<Omit<Deal, "id" | "org_id">>
): Promise<Deal> {
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("deals")
    .update({ ...deal, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("org_id", orgId)
    .select()
    .single();
  if (error) throw error;
  return data as Deal;
}

export async function deleteDeal(id: string): Promise<void> {
  const orgId = await getOrgId();
  const { error } = await supabase.from("deals").delete().eq("id", id).eq("org_id", orgId);
  if (error) throw error;
}

// ─── TICKETS ────────────────────────────────────────────────────────────────

export async function fetchTickets(): Promise<Ticket[]> {
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("tickets")
    .select("*")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Ticket[];
}

// ─── EMPLOYEES ──────────────────────────────────────────────────────────────

export async function fetchEmployees(): Promise<Employee[]> {
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("org_id", orgId)
    .order("name");
  if (error) throw error;
  return (data ?? []) as Employee[];
}

// ─── RENEWALS ───────────────────────────────────────────────────────────────

export async function fetchRenewals(): Promise<Renewal[]> {
  const orgId = await getOrgId();
  const { data, error } = await supabase
    .from("renewals")
    .select("*")
    .eq("org_id", orgId)
    .order("renewal_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Renewal[];
}

// ─── HELPERS ────────────────────────────────────────────────────────────────

async function getNextClientCode(table: "deals" | "renewals", prefix: "S" | "R" | "D"): Promise<string> {
  const orgId = await getOrgId();
  let query = supabase
    .from(table)
    .select("client_code")
    .eq("org_id", orgId)
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
