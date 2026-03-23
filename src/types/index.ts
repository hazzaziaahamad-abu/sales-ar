export interface Deal {
  id: string;
  org_id: string;
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
  loss_reason?: string;
  notes?: string;
  month?: number;
  year?: number;
  created_at: string;
  updated_at: string;
}

export interface Ticket {
  id: string;
  org_id: string;
  ticket_number?: number;
  client_name: string;
  client_phone?: string;
  issue: string;
  priority: string;
  status: string;
  assigned_agent_id?: string;
  assigned_agent_name?: string;
  open_date?: string;
  due_date?: string;
  resolved_date?: string;
  response_time?: string;
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
  avg_probability: number;
  target_revenue: number;
  revenue_gap: number;
  stage_contact: number;
  stage_quote: number;
  stage_negotiate: number;
  stage_closed: number;
  total_tickets: number;
  tickets_open: number;
  tickets_in_progress: number;
  tickets_resolved: number;
  tickets_urgent: number;
  tickets_high: number;
  tickets_normal: number;
  resolution_rate: number;
  urgent_rate: number;
  created_at: string;
}

export interface EmployeeScore {
  id: string;
  org_id: string;
  employee_id: string;
  month: number;
  year: number;
  overall_score: number;
  close_rate_score: number;
  revenue_score: number;
  deal_count_score: number;
  cycle_speed_score: number;
  consistency_score: number;
  revenue: number;
  deals_won: number;
  total_deals: number;
  close_rate: number;
  avg_deal_value: number;
  avg_cycle_days: number;
  ai_summary?: string;
  ai_strengths?: { point: string; metric: string; value: string }[];
  ai_improvements?: { point: string; metric: string; value: string; target: string }[];
  ai_tip?: string;
  ai_forecast?: string;
  ai_comparison?: { vs_team_avg: number; vs_last_month: number; rank: number; total_reps: number };
  ai_analyzed_at?: string;
  created_at: string;
}

export interface Project {
  id: string;
  org_id: string;
  name: string;
  team?: string;
  start_date?: string;
  progress: number;
  total_tasks: number;
  remaining_tasks: number;
  status_tag?: string;
  created_at: string;
  updated_at: string;
}

export interface Partnership {
  id: string;
  org_id: string;
  name: string;
  type?: string;
  status?: string;
  value: number;
  manager_name?: string;
  description?: string;
  created_at: string;
  updated_at: string;
}

export interface Review {
  id: string;
  org_id: string;
  customer_name: string;
  avatar?: string;
  stars: number;
  type: "very_satisfied" | "satisfied" | "neutral" | "needs_improvement" | "unsatisfied";
  category?: string;
  review_date?: string;
  comment?: string;
  created_at: string;
  updated_at: string;
}

export interface Renewal {
  id: string;
  org_id: string;
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

export interface Alert {
  id: string;
  org_id: string;
  type: "critical" | "warning" | "opportunity";
  category: string;
  message: string;
  employee_id?: string;
  deal_id?: string;
  ticket_id?: string;
  is_read: boolean;
  is_dismissed: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant";
  content: string;
  suggested_questions?: string[];
  created_at: string;
}

export interface ExcelUpload {
  id: string;
  org_id: string;
  user_id: string;
  filename: string;
  file_url?: string;
  sheets_count: number;
  deals_imported: number;
  tickets_imported: number;
  status: string;
  mapping_result?: Record<string, unknown>;
  error_message?: string;
  created_at: string;
}

export interface AppNotification {
  id: string;
  type: "urgent_ticket" | "overdue_project" | "high_workload" | "near_complete" | "negotiating" | "crud_action";
  icon: string;
  message: string;
  section: string;
  timestamp: string;
  isRead: boolean;
}
