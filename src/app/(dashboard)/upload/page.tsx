"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  insertManyDeals,
  insertManyTickets,
  insertManyRenewals,
  saveUploadRecord,
  fetchUploadHistory,
  type UploadRecord,
} from "@/lib/supabase/db";
import { mapStage, mapSource, mapRenewalStatus } from "@/lib/utils/value-maps";
import { TICKET_STATUSES, PRIORITIES } from "@/lib/utils/constants";
import type { Deal, Ticket, Renewal } from "@/types";

/* ─── Types ─── */
type SheetType = "sales" | "support" | "renewals" | "summary" | "skip" | "unknown";

interface SheetInfo {
  name: string;
  type: SheetType;
  headers: string[];
  rowCount: number;
  rows: unknown[][];
}

interface ColumnMapping {
  [field: string]: { column: number; header: string };
}

interface AiSheetMapping {
  name: string;
  type: string;
  confidence: number;
  mappings: ColumnMapping;
  stage_mapping: Record<string, string>;
  source_mapping?: Record<string, string>;
  renewal_status_mapping?: Record<string, string>;
}

interface UploadState {
  status: "idle" | "parsing" | "ai_mapping" | "ready" | "importing" | "done" | "error";
  file: File | null;
  sheets: SheetInfo[];
  aiMappings: AiSheetMapping[] | null;
  error: string | null;
  importResults: { deals: number; tickets: number; renewals: number } | null;
}

/* ─── Sheet name detection ─── */
const SHEET_NAME_RULES: { keywords: string[]; type: SheetType }[] = [
  // Skip first (dashboard, template sheets)
  { keywords: ["لوحة التحكم", "dashboard", "نموذج الإدخال", "نموذج", "template"], type: "skip" },
  // Sales
  { keywords: ["الصفقات", "صفقات", "مبيعات", "sales", "deals"], type: "sales" },
  // Support
  { keywords: ["تذاكر", "دعم", "support", "tickets"], type: "support" },
  // Renewals
  { keywords: ["التجديدات", "تجديدات", "تجديد", "renewals", "اشتراكات"], type: "renewals" },
  // Summary
  { keywords: ["ملخص", "summary"], type: "summary" },
];

function detectTypeFromName(name: string): SheetType | null {
  const nameLower = name.toLowerCase();
  for (const rule of SHEET_NAME_RULES) {
    if (rule.keywords.some((k) => nameLower.includes(k))) return rule.type;
  }
  return null;
}

/* ─── Header-based fallback detection ─── */
const SALES_HEADER_KEYWORDS = ["مرحلة", "صفقة", "قيمة الصفقة", "احتمالية", "مندوب", "stage", "deal", "probability"];
const SUPPORT_HEADER_KEYWORDS = ["مشكلة", "أولوية", "تذكرة", "وكيل", "issue", "ticket", "priority"];
const RENEWAL_HEADER_KEYWORDS = ["تجديد", "تاريخ التجديد", "اشتراك", "renewal", "خطة", "plan_name", "الباقة"];

function detectTypeFromHeaders(headers: string[]): SheetType {
  const joined = headers.join(" ").toLowerCase();
  const salesScore = SALES_HEADER_KEYWORDS.filter((k) => joined.includes(k)).length;
  const supportScore = SUPPORT_HEADER_KEYWORDS.filter((k) => joined.includes(k)).length;
  const renewalScore = RENEWAL_HEADER_KEYWORDS.filter((k) => joined.includes(k)).length;

  const max = Math.max(salesScore, supportScore, renewalScore);
  if (max === 0) return "unknown";
  if (renewalScore === max) return "renewals";
  if (supportScore === max) return "support";
  return "sales";
}

/* ─── Heuristic column patterns ─── */
const SALES_COL_PATTERNS: Record<string, string[]> = {
  client_name:   ["اسم العميل", "العميل", "client_name", "client", "اسم"],
  client_phone:  ["جوال", "الجوال", "رقم الجوال", "phone", "هاتف"],
  deal_value:    ["قيمة الصفقة", "القيمة قبل الضريبة", "القيمة", "value", "amount", "المبلغ"],
  source:        ["المصدر", "مصدر", "source"],
  stage:         ["المرحلة", "مرحلة", "stage"],
  probability:   ["احتمالية", "الاحتمالية", "probability", "prob"],
  assigned_rep:  ["المسؤول", "مندوب المبيعات", "مندوب", "assigned_rep", "rep", "موظف"],
  cycle_days:    ["أيام الدورة", "دورة البيع", "cycle_days", "cycle"],
  deal_date:     ["تاريخ الصفقة", "التاريخ", "تاريخ", "deal_date", "date"],
  close_date:    ["تاريخ الإغلاق", "close_date"],
  plan:          ["الخطة", "الباقة", "plan"],
  loss_reason:   ["سبب الخسارة", "سبب الرفض", "loss_reason"],
  notes:         ["ملاحظات", "notes"],
};

const SUPPORT_COL_PATTERNS: Record<string, string[]> = {
  ticket_number:  ["رقم التذكرة", "ticket_number", "#"],
  client_name:    ["اسم العميل", "العميل", "client_name", "client", "اسم"],
  client_phone:   ["جوال", "الجوال", "رقم الجوال", "phone", "هاتف"],
  issue:          ["المشكلة", "الوصف", "وصف المشكلة", "issue", "problem", "مشكلة"],
  priority:       ["الأولوية", "priority", "أولوية"],
  status:         ["الحالة", "status", "حالة"],
  assigned_agent: ["الوكيل", "المسؤول", "assigned_agent", "agent", "موظف"],
  open_date:      ["تاريخ الفتح", "open_date", "تاريخ", "date"],
  due_date:       ["موعد التسليم", "due_date", "deadline"],
  resolved_date:  ["تاريخ الحل", "resolved_date"],
  response_time:  ["وقت الاستجابة", "response_time"],
};

const RENEWAL_COL_PATTERNS: Record<string, string[]> = {
  customer_name:  ["اسم العميل", "العميل", "customer_name", "اسم"],
  customer_phone: ["جوال", "الجوال", "رقم الجوال", "phone", "هاتف"],
  plan_name:      ["اسم الخطة", "الخطة", "الباقة", "plan_name", "plan"],
  plan_price:     ["سعر الخطة", "سعر الخطة قبل الضريبة", "القيمة", "plan_price", "price", "المبلغ"],
  renewal_date:   ["تاريخ التجديد", "renewal_date", "موعد التجديد"],
  status:         ["الحالة", "status", "حالة"],
  cancel_reason:  ["سبب الإلغاء", "cancel_reason"],
  assigned_rep:   ["المسؤول", "مندوب", "assigned_rep", "موظف"],
  notes:          ["ملاحظات", "notes"],
};

function buildHeuristicMapping(
  headers: string[],
  patterns: Record<string, string[]>
): ColumnMapping {
  const mapping: ColumnMapping = {};
  for (const [field, keywords] of Object.entries(patterns)) {
    for (let i = 0; i < headers.length; i++) {
      const h = headers[i].trim().toLowerCase();
      if (!h) continue;
      if (keywords.some((k) => h.includes(k.toLowerCase()) || k.toLowerCase().includes(h))) {
        mapping[field] = { column: i, header: headers[i] };
        break;
      }
    }
  }
  return mapping;
}

/* ─── Cell helpers ─── */
const VALID_PRIORITIES: Set<string> = new Set(PRIORITIES);
const VALID_STATUSES: Set<string> = new Set(TICKET_STATUSES);

function cellStr(row: unknown[], idx: number): string {
  if (idx < 0 || row[idx] === null || row[idx] === undefined || row[idx] === "") return "";
  return String(row[idx]).trim();
}

function toNum(val: unknown): number {
  if (typeof val === "number") return val;
  const n = parseFloat(String(val).replace(/[,$\s]/g, ""));
  return isNaN(n) ? 0 : n;
}

function toDateStr(val: unknown): string | undefined {
  if (!val && val !== 0) return undefined;
  if (typeof val === "number") {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const s = String(val).trim();
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d.toISOString().slice(0, 10);
}

function normProb(val: unknown): number {
  const n = toNum(val);
  if (n === 0) return 50;
  return Math.min(100, Math.max(0, n > 1 ? Math.round(n) : Math.round(n * 100)));
}

/* ─── Page ─── */
export default function UploadPage() {
  const [state, setState] = useState<UploadState>({
    status: "idle", file: null, sheets: [], aiMappings: null, error: null, importResults: null,
  });
  const { activeOrgId: orgId } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [history, setHistory] = useState<UploadRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    setHistoryLoading(true);
    fetchUploadHistory()
      .then(setHistory)
      .catch(console.error)
      .finally(() => setHistoryLoading(false));
  }, [orgId]);

  /* ─── Parse + AI map ─── */
  const handleFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setState((s) => ({ ...s, error: "الرجاء رفع ملف Excel (.xlsx, .xls) أو CSV" }));
      return;
    }

    setState({ status: "parsing", file, sheets: [], aiMappings: null, error: null, importResults: null });

    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });

      const sheets: SheetInfo[] = workbook.SheetNames.map((name) => {
        const ws = workbook.Sheets[name];
        const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as unknown[][];

        // Determine header row: if row 1 has many non-empty cells → row 0 is a title
        const headerRowIdx =
          json.length > 1 && (json[1] as unknown[]).filter((c) => c !== "").length >= 3
            ? 1
            : 0;

        const headers = ((json[headerRowIdx] ?? []) as unknown[]).map(String);

        // Take rows until first fully-empty row (summary sections follow after a blank row)
        const rawRows = json.slice(headerRowIdx + 1);
        const rows: unknown[][] = [];
        for (const r of rawRows) {
          const cells = r as unknown[];
          if (!cells.some((c) => c !== "" && c != null)) break; // stop at empty row
          rows.push(cells);
        }

        // Detect type: sheet name first, then headers as fallback
        const type: SheetType = detectTypeFromName(name) ?? detectTypeFromHeaders(headers);

        return { name, type, headers, rowCount: rows.length, rows };
      });

      // Call AI column mapping (non-blocking — if it fails we use heuristics)
      setState((s) => ({ ...s, status: "ai_mapping", sheets }));

      let aiMappings: AiSheetMapping[] | null = null;
      try {
        const res = await fetch("/api/ai/map-columns", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sheets: sheets
              .filter((s) => s.type !== "skip" && s.type !== "summary")
              .map((s) => ({
                name: s.name, type: s.type,
                headers: s.headers,
                sample_rows: s.rows.slice(0, 3),
              })),
          }),
        });
        if (res.ok) {
          const body = await res.json();
          aiMappings = body.sheets ?? null;
        }
      } catch (e) {
        console.warn("AI mapping unavailable, using heuristics:", e);
      }

      // Merge AI type detection back into sheets
      const finalSheets = sheets.map((sh) => {
        const ai = aiMappings?.find((a) => a.name === sh.name);
        if (ai && ai.type && ai.type !== "unknown" && sh.type === "unknown") {
          return { ...sh, type: ai.type as SheetType };
        }
        // AI says skip → respect it
        if (ai && ai.type === "skip") {
          return { ...sh, type: "skip" as SheetType };
        }
        return sh;
      });

      setState((s) => ({ ...s, status: "ready", sheets: finalSheets, aiMappings }));
    } catch (err) {
      console.error(err);
      setState((s) => ({ ...s, status: "error", error: "خطأ في قراءة الملف" }));
    }
  }, []);

  /* ─── Real import to Supabase ─── */
  const handleImport = async () => {
    const { sheets, aiMappings, file } = state;
    if (!sheets.length) return;

    setState((s) => ({ ...s, status: "importing" }));
    let dealsImported = 0;
    let ticketsImported = 0;
    let renewalsImported = 0;

    try {
      for (const sheet of sheets) {
        if (sheet.type === "skip" || sheet.type === "summary" || sheet.type === "unknown") continue;

        // Build final column mapping: AI first, heuristic fallback
        const ai = aiMappings?.find((a) => a.name === sheet.name);
        const aiMappingResult: ColumnMapping = ai?.mappings ?? {};
        const aiStageMap: Record<string, string> = ai?.stage_mapping ?? {};
        const aiSourceMap: Record<string, string> = ai?.source_mapping ?? {};
        const aiRenewalStatusMap: Record<string, string> = ai?.renewal_status_mapping ?? {};

        const heuristic =
          sheet.type === "sales"
            ? buildHeuristicMapping(sheet.headers, SALES_COL_PATTERNS)
            : sheet.type === "support"
            ? buildHeuristicMapping(sheet.headers, SUPPORT_COL_PATTERNS)
            : sheet.type === "renewals"
            ? buildHeuristicMapping(sheet.headers, RENEWAL_COL_PATTERNS)
            : {};

        // Merge: AI takes priority, heuristic fills gaps
        const mapping: ColumnMapping = { ...heuristic, ...aiMappingResult };
        const col = (f: string) => mapping[f]?.column ?? -1;

        if (sheet.type === "sales") {
          const batch: Omit<Deal, "id" | "org_id" | "created_at" | "updated_at">[] = [];
          for (const rawRow of sheet.rows) {
            const row = rawRow as unknown[];
            const clientName = cellStr(row, col("client_name"));
            if (!clientName) continue;

            const rawStage = cellStr(row, col("stage")) || "تواصل";
            const stage = mapStage(rawStage, aiStageMap);

            const rawSource = cellStr(row, col("source")) || "اخرى";
            const source = aiSourceMap[rawSource]
              ? mapSource(aiSourceMap[rawSource])
              : mapSource(rawSource);

            const dealDate =
              toDateStr(col("deal_date") >= 0 ? row[col("deal_date")] : undefined) ??
              new Date().toISOString().slice(0, 10);
            const d = new Date(dealDate);

            batch.push({
              client_name: clientName,
              client_phone: cellStr(row, col("client_phone")) || undefined,
              deal_value: toNum(col("deal_value") >= 0 ? row[col("deal_value")] : 0),
              source,
              stage,
              probability: normProb(col("probability") >= 0 ? row[col("probability")] : 50),
              assigned_rep_name: cellStr(row, col("assigned_rep")) || undefined,
              cycle_days: toNum(col("cycle_days") >= 0 ? row[col("cycle_days")] : 0),
              deal_date: dealDate,
              close_date: toDateStr(col("close_date") >= 0 ? row[col("close_date")] : undefined),
              plan: cellStr(row, col("plan")) || undefined,
              loss_reason: cellStr(row, col("loss_reason")) || undefined,
              notes: cellStr(row, col("notes")) || undefined,
              month: d.getMonth() + 1,
              year: d.getFullYear(),
            });
          }
          dealsImported += await insertManyDeals(batch);

        } else if (sheet.type === "support") {
          const batch: Omit<Ticket, "id" | "org_id" | "created_at" | "updated_at">[] = [];
          for (const rawRow of sheet.rows) {
            const row = rawRow as unknown[];
            const clientName = cellStr(row, col("client_name"));
            if (!clientName) continue;

            const rawPriority = cellStr(row, col("priority")) || "عادي";
            const priority = VALID_PRIORITIES.has(rawPriority) ? rawPriority : "عادي";

            const rawStatus = cellStr(row, col("status")) || "مفتوح";
            const status = VALID_STATUSES.has(rawStatus) ? rawStatus : "مفتوح";

            const rawNum = col("ticket_number") >= 0 ? row[col("ticket_number")] : undefined;

            const openDate = toDateStr(col("open_date") >= 0 ? row[col("open_date")] : undefined);
            const od = openDate ? new Date(openDate) : new Date();

            batch.push({
              ticket_number: rawNum ? toNum(rawNum) || undefined : undefined,
              client_name: clientName,
              client_phone: cellStr(row, col("client_phone")) || undefined,
              issue: cellStr(row, col("issue")) || "—",
              priority,
              status,
              assigned_agent_name: cellStr(row, col("assigned_agent")) || undefined,
              open_date: openDate,
              due_date: toDateStr(col("due_date") >= 0 ? row[col("due_date")] : undefined),
              resolved_date: toDateStr(col("resolved_date") >= 0 ? row[col("resolved_date")] : undefined),
              month: od.getMonth() + 1,
              year: od.getFullYear(),
            });
          }
          ticketsImported += await insertManyTickets(batch);

        } else if (sheet.type === "renewals") {
          const batch: Omit<Renewal, "id" | "org_id" | "created_at" | "updated_at">[] = [];
          for (const rawRow of sheet.rows) {
            const row = rawRow as unknown[];
            const customerName = cellStr(row, col("customer_name"));
            if (!customerName) continue;

            const rawStatus = cellStr(row, col("status")) || "مجدول";
            const status = aiRenewalStatusMap[rawStatus]
              ? mapRenewalStatus(aiRenewalStatusMap[rawStatus])
              : mapRenewalStatus(rawStatus);

            batch.push({
              customer_name: customerName,
              customer_phone: cellStr(row, col("customer_phone")) || undefined,
              plan_name: cellStr(row, col("plan_name")) || "الاساسية",
              plan_price: toNum(col("plan_price") >= 0 ? row[col("plan_price")] : 0),
              renewal_date: toDateStr(col("renewal_date") >= 0 ? row[col("renewal_date")] : undefined)
                ?? new Date().toISOString().slice(0, 10),
              status,
              cancel_reason: cellStr(row, col("cancel_reason")) || undefined,
              assigned_rep: cellStr(row, col("assigned_rep")) || undefined,
              notes: cellStr(row, col("notes")) || undefined,
            });
          }
          renewalsImported += await insertManyRenewals(batch);
        }
      }

      // Persist record to Supabase
      await saveUploadRecord({
        filename: file?.name ?? "ملف",
        sheets_count: sheets.length,
        deals_imported: dealsImported,
        tickets_imported: ticketsImported,
        renewals_imported: renewalsImported,
        status: "done",
      });

      // Refresh history
      fetchUploadHistory().then(setHistory).catch(console.error);

      setState((s) => ({
        ...s,
        status: "done",
        importResults: { deals: dealsImported, tickets: ticketsImported, renewals: renewalsImported },
      }));
    } catch (err) {
      console.error("Import error:", err);
      await saveUploadRecord({
        filename: file?.name ?? "ملف",
        sheets_count: sheets.length,
        deals_imported: dealsImported,
        tickets_imported: ticketsImported,
        renewals_imported: renewalsImported,
        status: "error",
      }).catch(() => {});
      fetchUploadHistory().then(setHistory).catch(console.error);

      setState((s) => ({
        ...s,
        status: "error",
        error: `خطأ في الاستيراد: ${err instanceof Error ? err.message : "خطأ غير معروف"}`,
      }));
    }
  };

  const resetUpload = () =>
    setState({ status: "idle", file: null, sheets: [], aiMappings: null, error: null, importResults: null });

  const { status, sheets, error, importResults } = state;
  const isProcessing = ["parsing", "ai_mapping", "importing"].includes(status);
  const importableSheets = sheets.filter((s) => s.type === "sales" || s.type === "support" || s.type === "renewals");

  /* ─── Render ─── */
  return (
    <div className="max-w-3xl mx-auto space-y-6">

      {/* Upload Zone */}
      {(status === "idle" || status === "error") && (
        <Card
          className={`border-2 border-dashed p-12 text-center transition-colors cursor-pointer ${
            dragActive ? "border-cyan bg-cyan-dim" : "border-border hover:border-cyan/50"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault(); setDragActive(false);
            const f = e.dataTransfer.files[0];
            if (f) handleFile(f);
          }}
          onClick={() => document.getElementById("file-input")?.click()}
        >
          <input
            id="file-input" type="file" accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-bold text-foreground mb-2">اسحب ملف Excel هنا</h3>
          <p className="text-sm text-muted-foreground">أو اضغط لاختيار ملف — يدعم xlsx, xls, csv</p>
          <p className="text-xs text-muted-foreground mt-2">يدعم استيراد المبيعات والدعم والتجديدات تلقائياً</p>
        </Card>
      )}

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 bg-red-dim p-4 rounded-xl border border-cc-red/30 text-cc-red text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="flex-1">{error}</span>
          <button onClick={resetUpload}><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Processing spinner */}
      {isProcessing && (
        <div className="text-center py-12 space-y-3">
          <Loader2 className="w-8 h-8 text-cyan animate-spin mx-auto" />
          <p className="text-sm font-medium text-foreground">
            {status === "parsing"    && "جاري قراءة الملف..."}
            {status === "ai_mapping" && "جاري تحليل الأعمدة بالذكاء الاصطناعي..."}
            {status === "importing"  && "جاري استيراد البيانات..."}
          </p>
          {status === "importing" && (
            <p className="text-xs text-muted-foreground">قد يستغرق بضع ثوانٍ حسب حجم الملف</p>
          )}
        </div>
      )}

      {/* Ready — sheet preview + import button */}
      {status === "ready" && sheets.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              {sheets.length} ورقة في الملف — {importableSheets.length} قابلة للاستيراد
            </h3>
            <Button variant="ghost" size="sm" onClick={resetUpload} className="text-muted-foreground">
              رفع ملف آخر
            </Button>
          </div>

          {sheets.map((sheet, i) => {
            const badgeStyle =
              sheet.type === "sales"    ? "bg-cyan-dim text-cyan" :
              sheet.type === "support"  ? "bg-green-dim text-cc-green" :
              sheet.type === "renewals" ? "bg-purple-dim text-cc-purple" :
              sheet.type === "skip"     ? "bg-muted text-muted-foreground" :
              sheet.type === "summary"  ? "bg-amber-dim text-amber" :
                                          "bg-muted text-muted-foreground";
            const badgeLabel =
              sheet.type === "sales"    ? "مبيعات ✓" :
              sheet.type === "support"  ? "دعم ✓" :
              sheet.type === "renewals" ? "تجديدات ✓" :
              sheet.type === "skip"     ? "تجاهل" :
              sheet.type === "summary"  ? "ملخص" : "غير محدد";

            return (
              <Card key={i} className={`p-4 ${sheet.type === "skip" ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-8 h-8 text-cc-green shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-foreground">{sheet.name}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${badgeStyle}`}>
                        {badgeLabel}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {sheet.rowCount} صف &bull; {sheet.headers.filter(Boolean).length} عمود
                    </p>
                    {sheet.type !== "skip" && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {sheet.headers.filter(Boolean).slice(0, 8).map((h, hi) => (
                          <span key={hi} className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">
                            {h}
                          </span>
                        ))}
                        {sheet.headers.filter(Boolean).length > 8 && (
                          <span className="text-[10px] text-muted-foreground">
                            +{sheet.headers.filter(Boolean).length - 8} أعمدة أخرى
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}

          {sheets.some((s) => s.type === "unknown") && (
            <p className="text-xs text-amber text-center">
              الأوراق غير المحددة النوع لن يتم استيرادها
            </p>
          )}

          {importableSheets.length > 0 ? (
            <Button onClick={handleImport} className="w-full bg-cyan text-background hover:bg-cyan/90">
              <CheckCircle className="w-4 h-4 ml-2" />
              استيراد البيانات إلى قاعدة البيانات
            </Button>
          ) : (
            <p className="text-xs text-cc-red text-center">
              لا توجد أوراق قابلة للاستيراد في هذا الملف
            </p>
          )}
        </div>
      )}

      {/* Done */}
      {status === "done" && importResults && (
        <div className="text-center py-8 space-y-4">
          <CheckCircle className="w-16 h-16 text-cc-green mx-auto" />
          <h3 className="text-lg font-bold text-foreground">تم الاستيراد بنجاح!</h3>
          <div className="flex justify-center gap-10">
            {importResults.deals > 0 && (
              <div>
                <p className="text-3xl font-bold text-cyan">{importResults.deals}</p>
                <p className="text-sm text-muted-foreground">صفقة مبيعات</p>
              </div>
            )}
            {importResults.tickets > 0 && (
              <div>
                <p className="text-3xl font-bold text-cc-green">{importResults.tickets}</p>
                <p className="text-sm text-muted-foreground">تذكرة دعم</p>
              </div>
            )}
            {importResults.renewals > 0 && (
              <div>
                <p className="text-3xl font-bold text-cc-purple">{importResults.renewals}</p>
                <p className="text-sm text-muted-foreground">تجديد</p>
              </div>
            )}
            {importResults.deals === 0 && importResults.tickets === 0 && importResults.renewals === 0 && (
              <p className="text-sm text-muted-foreground">
                لم يُستورد شيء — تحقق من محتوى الملف
              </p>
            )}
          </div>
          <Button onClick={resetUpload} variant="outline" className="border-cyan/30 text-cyan hover:bg-cyan/10">
            رفع ملف آخر
          </Button>
        </div>
      )}

      {/* Upload History (from Supabase) */}
      <div className="cc-card rounded-xl p-5">
        <h3 className="text-sm font-bold text-foreground mb-4">سجل الرفع</h3>
        {historyLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm">جاري التحميل...</div>
        ) : history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">لا يوجد سجل رفع سابق</div>
        ) : (
          <div className="space-y-3">
            {history.map((entry) => (
              <div key={entry.id} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                <FileSpreadsheet className="w-5 h-5 text-cc-green shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{entry.filename}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {[
                      entry.deals_imported > 0   && `${entry.deals_imported} صفقة`,
                      entry.tickets_imported > 0 && `${entry.tickets_imported} تذكرة`,
                    ].filter(Boolean).join(" • ") || "لا بيانات"}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">
                  {new Date(entry.created_at).toLocaleDateString("ar-SA", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                </span>
                {entry.status === "done"
                  ? <CheckCircle className="w-4 h-4 text-cc-green shrink-0" />
                  : <AlertCircle className="w-4 h-4 text-cc-red shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
