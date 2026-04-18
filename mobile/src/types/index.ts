export interface Deal {
  id: string;
  org_id: string;
  client_code?: string;
  sales_type?: "office" | "support";
  client_name: string;
  client_phone?: string;
  deal_value: number;
  source?: string;
  stage: string;
  probability: number;
  assigned_rep_id?: string;
  assigned_rep_name?: string;
  cycle_days: number;
  deal_date?: string;
  close_date?: string;
  plan?: string;
  marketer_name?: string;
  loss_reason?: string;
  notes?: string;
  last_contact?: string;
  callback_date?: string;
  collection_status?: "محصّل" | "معلق" | "متأخر";
  month?: number;
  year?: number;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  org_id: string;
  ticket_number?: number;
  request_type?: "problem" | "service";
  client_name: string;
  client_phone?: string;
  issue: string;
  issue_category?: string;
  issue_subcategory?: string;
  priority: string;
  status: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  open_date?: string;
  due_date?: string;
  resolved_date?: string;
  response_time_minutes?: number;
  month?: number;
  year?: number;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  org_id: string;
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  status: string;
  avatar_url?: string;
  created_at: string;
}

export interface Renewal {
  id: string;
  org_id: string;
  client_code?: string;
  customer_name: string;
  customer_phone?: string;
  plan_name: string;
  plan_price: number;
  renewal_date: string;
  status: string;
  cancel_reason?: string;
  assigned_rep?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  orgId: string;
  roleId: string;
  roleName: string;
  allowedPages: string[];
  isSuperAdmin: boolean;
}

export interface KPISnapshot {
  id: string;
  org_id: string;
  month: number;
  year: number;
  total_revenue: number;
  total_deals: number;
  closed_deals: number;
  close_rate: number;
  avg_deal_value: number;
  avg_cycle_days: number;
  created_at: string;
}
