import { streamText, generateText, convertToModelMessages, tool, stepCountIs } from "ai";
import {
  createGoogleGenerativeAI,
  type GoogleLanguageModelOptions,
} from "@ai-sdk/google";
import { buildKnowledgeContext } from "@/lib/ai/knowledge";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { resolveOrgSession, isConnectedStatus, sendTextFromOrg } from "@/lib/wa/client";
import { computeNextRun, describeSchedule } from "@/lib/tasks/schedule";
import { runTaskAndRecord } from "@/lib/tasks/executor";
import type { ScheduledTask } from "@/types";
import { z } from "zod";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GEMINI_API_KEY!,
});

const AGENT_MODEL = process.env.AGENT_GEMINI_MODEL || "gemini-2.5-flash";
const AGENT_THINKING_BUDGET = Number(process.env.AGENT_THINKING_BUDGET || 512);
const FAST_GOOGLE_OPTIONS = {
  thinkingConfig: {
    thinkingBudget: AGENT_THINKING_BUDGET,
  },
} satisfies GoogleLanguageModelOptions;

const AGENT_SYSTEM_PROMPT = `أنت "المساعد الذكي" — مساعد إدارة أعمال ذكي لشركة RESTAVO، شركة أتمتة مطاعم رائدة في السعودية.

## هويتك:
- اسمك: المساعد الذكي (CommandCenter AI)
- دورك: مستشار أعمال ومحلل بيانات متخصص في قطاع المطاعم
- تعمل ضمن منصة CommandCenter لإدارة المبيعات والدعم والعمليات

## قدراتك:
1. **تحليل المبيعات**: تحليل الصفقات، Pipeline، معدلات الإغلاق، أداء الموظفين
2. **تحليل الدعم الفني**: تتبع التذاكر، أوقات الاستجابة، معدلات الحل
3. **تحليل الفريق**: تقييم الأداء، حمل العمل، نقاط القوة والضعف
4. **التوقعات**: توقع الإيرادات، تحليل الاتجاهات، تحديد المخاطر
5. **التوصيات**: اقتراحات عملية لتحسين الأداء وزيادة المبيعات
6. **المشاريع**: متابعة تقدم المشاريع وتحديد المتأخر منها
7. **الشراكات**: تحليل الشراكات وقيمتها والفرص الجديدة
8. **المالية**: تحليل الإيرادات، المصاريف، هامش الربح، Burn Rate
9. **استعلام قاعدة البيانات**: يمكنك استخدام أداة queryDatabase للاستعلام عن أي جدول في قاعدة البيانات مباشرة
10. **البحث في الويب**: يمكنك استخدام أداة webSearch للبحث في الإنترنت عن معلومات حديثة مثل أخبار السوق، المنافسين، الاتجاهات، أو أي معلومة غير موجودة في بيانات الشركة
11. **إرسال رسائل واتساب**: يمكنك استخدام أداة sendWhatsApp لإرسال رسالة واتساب لعميل من رقم واتساب الشركة المتصل
12. **المهام المجدولة**: يمكنك استخدام أداة scheduleTask لإنشاء مهمة تتكرر تلقائياً (يومياً/أسبوعياً/شهرياً) أو تعمل مرة واحدة، لتذكير أو مراسلة الفريق عبر واتساب. وأدوات listScheduledTasks و updateScheduledTask و deleteScheduledTask و runTaskNow لإدارتها

## تأكيد العمليات الحساسة (مهم):
أدوات الإرسال والجدولة محمية بنظام موافقة في الواجهة — عند استدعائك لها يظهر للمستخدم كرت فيه زر "أوافق" و"رفض". لذلك **لا تطلب التأكيد بنص** ولا تكتب "هل أرسلها؟"؛ فقط استدعِ الأداة مباشرة بالقيم الصحيحة، والواجهة تتكفّل بأخذ الموافقة. بعد تنفيذ الأداة، لخّص النتيجة (نجاح/فشل) للمستخدم.

## أداة sendWhatsApp:
تتيح لك إرسال رسالة نصية عبر واتساب لعميل (مثل متابعة صفقة، تذكير بتجديد، رد على تذكرة دعم).
- احصل على رقم العميل من قاعدة البيانات (deals.client_phone أو renewals.customer_phone أو tickets.client_phone) — لا تختلق أرقاماً
- الرقم بصيغة دولية بأرقام فقط (مثال: 9665XXXXXXXX)
- اكتب رسالة مهنية مهذبة بالعربية ما لم يُطلب غير ذلك
- إذا كان رقم واتساب الشركة غير متصل، اطلب من المستخدم ربطه من صفحة "واتساب"

## أداة scheduleTask:
المهمة = **لمن** (الجمهور) + **ماذا** (نص الرسالة وصورة/رابط اختياري) + **متى** (الجدولة).
- action_type:
  - "notify_underperformers": يحدد الجمهور تلقائياً = الموظفون الذين نتيجتهم أقل من الحد (threshold، الافتراضي 70) للفترة الحالية، ويرسل لكل واحد ملخص أرقامه
  - "custom_message": جمهور محدد (موظفون بالـ id، أو أرقام، أو كل الفريق) برسالة ثابتة
- audience.kind: "underperformers" | "employees" | "phones" | "all_team"
- لاستهداف موظفين بالاسم: اجعل kind="employees" ومرّر أسماءهم في employee_names (مثل ["روان","أمينة"]) — يحوّلها النظام إلى أرقامهم تلقائياً من قاعدة البيانات. لا تحتاج تبحث عن الـ id بنفسك. (شرط أن يكون رقم جوال الموظف مُسجّلاً في صفحة الفريق)
- message.template يدعم متغيرات: {name} {score} {threshold} {gap} {revenue} {deals} {close_rate}
- message.include_image=true لإرفاق كرت صورة بالأرقام (مناسب لـ notify_underperformers)
- frequency: "once" | "daily" | "weekly" | "monthly" مع at_hour/at_minute (بتوقيت السعودية)، و weekday (0=الأحد..6=السبت) للأسبوعي، و day_of_month للشهري، و run_at (ISO) لمرة واحدة
- مثال: "كل أحد الساعة 9 صباحاً ذكّر الموظفين تحت الهدف" → notify_underperformers، weekly، weekday=0، at_hour=9

## أداة queryDatabase:
عندما يسألك المستخدم عن عميل معين أو صفقة أو تذكرة أو أي بيانات محددة، استخدم أداة queryDatabase للحصول على البيانات الدقيقة.
السياق المرفق ملخص إجمالي فقط؛ استخدم الأداة أيضاً عند طلب قائمة أو تفاصيل أو أحدث سجلات.

### الجداول المتاحة:
- **deals**: الصفقات (client_name, client_phone, deal_value, source, stage, probability, assigned_rep_name, cycle_days, deal_date, close_date, loss_reason, notes, month, year)
- **tickets**: تذاكر الدعم (ticket_number, client_name, client_phone, issue, priority, status, assigned_agent_name, open_date, due_date, resolved_date, response_time_minutes, month, year)
- **employees**: الموظفين (name, role, email, phone, status)
- **employee_scores**: تقييم الموظفين (employee_id, month, year, overall_score, close_rate_score, revenue_score, revenue, deals_won, total_deals, close_rate, ai_summary)
- **projects**: المشاريع (name, team, start_date, progress, total_tasks, remaining_tasks, status_tag)
- **partnerships**: الشراكات (name, type, status, value, manager_name, description)
- **kpi_snapshots**: مؤشرات الأداء الشهرية (month, year, total_revenue, total_deals, closed_deals, close_rate, target_revenue)
- **alerts**: التنبيهات (type, category, message, is_read, is_dismissed)
- **renewals**: التجديدات (customer_name, customer_phone, plan_name, plan_price, assigned_rep, status, start_date, renewal_date, cancel_reason, notes)
- **reviews**: تقييمات العملاء (customer_name, stars, type, category, review_date, comment)

### نصائح الاستعلام:
- عند البحث عن عميل بالاسم، استخدم filter مع operator "ilike" وقيمة مثل "%فهد%" للبحث الجزئي
- يمكنك استخدام select لتحديد الأعمدة المطلوبة فقط (مثل "client_name,deal_value,stage")
- استخدم orderBy للترتيب (مثل ترتيب بالقيمة أو التاريخ)
- استخدم limit للحد من النتائج
- يمكنك إرسال عدة استعلامات متتالية لجمع بيانات من جداول مختلفة

## قواعد الرد:
1. أجب دائماً بالعربية السعودية المهنية (مثال: "وش رأيك" بدل "ما رأيك")
2. استخدم الأرقام الفعلية من البيانات — لا تختلق أرقاماً
3. نسّق إجاباتك باستخدام Markdown (عناوين، جداول، قوائم، bold)
4. استخدم الجداول عند المقارنة بين موظفين أو فترات
5. ابدأ بعنوان واضح لكل إجابة
6. اختم كل إجابة بـ 2-3 أسئلة متابعة مقترحة
7. إذا سُئلت عن شيء غير موجود في البيانات، قل ذلك بوضوح
8. استخدم الرموز باعتدال: 📈📉🎯⚠️✅❌💡🔥
9. عند ذكر تغييرات، اذكر النسبة المئوية والاتجاه
10. كن مباشراً — ابدأ بالجواب ثم التفاصيل
11. عند تقديم توصيات، رقّمها وحدد الأولوية (عاجل/مهم/اقتراح)

## تنسيق الإجابة:
\`\`\`
## العنوان 📊

[التحليل المختصر مع أرقام ونسب]

### التفاصيل
[جداول أو قوائم مفصلة]

### التوصيات 💡
1. [توصية عاجلة]
2. [توصية مهمة]
3. [اقتراح]

---
**أسئلة متابعة:**
- سؤال 1؟
- سؤال 2؟
- سؤال 3؟
\`\`\``;

export async function POST(req: Request) {
  const requestStartedAt = performance.now();

  try {
    const { messages, orgId } = await req.json();
    const ORG_ID = orgId || "00000000-0000-0000-0000-000000000001";

    const knowledgeStartedAt = performance.now();
    const knowledgeContext = await buildKnowledgeContext(ORG_ID);
    const knowledgeDurationMs = Math.round(performance.now() - knowledgeStartedAt);
    const modelMessages = await convertToModelMessages(messages);

    const supabase = await createServerSupabaseClient();

    const queryDbParams = z.object({
      table: z.enum([
        "deals", "tickets", "employees", "employee_scores",
        "projects", "partnerships", "kpi_snapshots", "alerts",
        "renewals", "reviews",
      ]).describe("The table to query"),
      select: z.string().default("*").describe("Columns to select, e.g. 'client_name,deal_value,stage' or '*' for all"),
      filters: z.array(z.object({
        column: z.string().describe("Column name to filter on"),
        operator: z.enum([
          "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in",
        ]).describe("Filter operator: eq (equals), ilike (case-insensitive partial match — use %keyword%), gt (greater than), etc."),
        value: z.string().describe("Value to filter by. For ilike use %keyword% pattern. Numbers should be passed as strings."),
      })).default([]).describe("Filters to apply"),
      orderColumn: z.string().optional().describe("Column name to order results by"),
      orderAscending: z.boolean().default(false).describe("Whether to order ascending (true) or descending (false)"),
      limit: z.number().default(50).describe("Max number of rows to return"),
    });

    const result = streamText({
      model: google(AGENT_MODEL),
      providerOptions: {
        google: FAST_GOOGLE_OPTIONS,
      },
      system: `${AGENT_SYSTEM_PROMPT}\n\n---\n\n## بيانات الشركة الحالية:\n${knowledgeContext}`,
      messages: modelMessages,
      stopWhen: stepCountIs(8),
      abortSignal: AbortSignal.timeout(45_000),
      onFinish: ({ usage, finishReason }) => {
        console.info("[agent] response completed", {
          orgId: ORG_ID,
          model: AGENT_MODEL,
          thinkingBudget: AGENT_THINKING_BUDGET,
          durationMs: Math.round(performance.now() - requestStartedAt),
          knowledgeDurationMs,
          finishReason,
          usage,
        });
      },
      onError: ({ error }) => {
        console.error("[agent] stream failed", {
          orgId: ORG_ID,
          model: AGENT_MODEL,
          thinkingBudget: AGENT_THINKING_BUDGET,
          durationMs: Math.round(performance.now() - requestStartedAt),
          error,
        });
      },
      tools: {
        webSearch: tool({
          description: "Search the web for current information. Use this for market trends, competitor info, industry news, restaurant tech updates, or any information not available in the company database.",
          inputSchema: z.object({
            query: z.string().describe("The search query in Arabic or English"),
          }),
          execute: async ({ query }) => {
            try {
              const searchResult = await generateText({
                model: google(AGENT_MODEL),
                providerOptions: {
                  google: FAST_GOOGLE_OPTIONS,
                },
                prompt: query,
                tools: {
                  googleSearch: google.tools.googleSearch({}),
                },
              });
              return {
                success: true as const,
                result: searchResult.text,
                query,
              };
            } catch (err) {
              return {
                success: false as const,
                error: err instanceof Error ? err.message : "Search failed",
                query,
              };
            }
          },
        }),
        queryDatabase: tool({
          description: "Query any table in the Supabase database. Use this to look up specific clients, deals, tickets, employees, or any other data. Always use this when the user asks about a specific record.",
          inputSchema: queryDbParams,
          execute: async ({ table, select, filters, orderColumn, orderAscending, limit }) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let query = supabase.from(table).select(select).eq("org_id", ORG_ID).limit(limit) as any;

            for (const filter of filters) {
              if (filter.operator === "in") {
                const values = filter.value.split(",").map((v: string) => v.trim());
                query = query.in(filter.column, values);
              } else if (filter.operator === "is") {
                query = query.is(filter.column, null);
              } else {
                query = query.filter(filter.column, filter.operator, filter.value);
              }
            }

            if (orderColumn) {
              query = query.order(orderColumn, { ascending: orderAscending });
            }

            const { data, error } = await query;

            if (error) {
              return { success: false as const, error: error.message, data: null, count: 0 };
            }

            return {
              success: true as const,
              data: data ?? [],
              count: (data as unknown[])?.length ?? 0,
              table,
            };
          },
        }),
        sendWhatsApp: tool({
          description: "Send a WhatsApp text message to a client from the organization's connected WhatsApp number. Use phone numbers fetched from the database (e.g. deals.client_phone), never invented ones. The UI shows the user an approval card before sending — do NOT ask for confirmation in text.",
          needsApproval: true,
          inputSchema: z.object({
            to: z.string().describe("Recipient phone number in international format, digits only (e.g. 9665XXXXXXXX). No spaces or symbols."),
            message: z.string().describe("The message text to send. Should be a professional, polite Arabic message unless the user requested otherwise."),
          }),
          execute: async ({ to, message }) => {
            const phone = to.replace(/[^\d]/g, "");
            if (phone.length < 8) {
              return { success: false as const, error: "رقم الهاتف غير صالح", to };
            }
            try {
              const session = await resolveOrgSession(ORG_ID);
              if (!session) {
                return { success: false as const, error: "لا يوجد رقم واتساب مربوط لهذه الشركة. اربط رقماً من صفحة واتساب أولاً.", to: phone };
              }
              if (!isConnectedStatus(session.status)) {
                return { success: false as const, error: "رقم واتساب الشركة غير متصل حالياً. تحقق من صفحة واتساب.", to: phone };
              }
              await sendTextFromOrg(ORG_ID, phone, message);
              return { success: true as const, to: phone, message };
            } catch (err) {
              return {
                success: false as const,
                error: err instanceof Error ? err.message : "فشل إرسال الرسالة",
                to: phone,
              };
            }
          },
        }),
        scheduleTask: tool({
          description: "Create a scheduled/routine task that messages the team over WhatsApp on a schedule (once/daily/weekly/monthly). The UI shows an approval card before saving — do NOT ask for confirmation in text. Resolve employee ids/phones from the database first when needed.",
          needsApproval: true,
          inputSchema: z.object({
            title: z.string().describe("Short Arabic title for the task"),
            description: z.string().optional().describe("Optional longer description"),
            action_type: z.enum(["notify_underperformers", "custom_message"]),
            audience: z.object({
              kind: z.enum(["underperformers", "employees", "phones", "all_team"]),
              employee_names: z.array(z.string()).optional().describe("employee names (kind=employees) — resolved to phones automatically; prefer this when the user names people"),
              employee_ids: z.array(z.string()).optional().describe("employee UUIDs (kind=employees) — only if you already have exact ids"),
              phones: z.array(z.string()).optional().describe("raw phone numbers (kind=phones)"),
              threshold: z.number().optional().describe("underperformer score cutoff, default 70"),
            }),
            message: z.object({
              template: z.string().describe("Message text; supports {name} {score} {threshold} {gap} {revenue} {deals} {close_rate}"),
              include_image: z.boolean().optional().describe("attach a generated numbers card"),
              image_template: z.enum(["performance", "announcement", "reminder"]).optional(),
              link: z.string().optional().describe("optional link appended to the message"),
            }),
            frequency: z.enum(["once", "daily", "weekly", "monthly"]),
            at_hour: z.number().min(0).max(23).default(9),
            at_minute: z.number().min(0).max(59).default(0),
            weekday: z.number().min(0).max(6).optional().describe("0=Sunday..6=Saturday (weekly)"),
            day_of_month: z.number().min(1).max(31).optional().describe("(monthly)"),
            run_at: z.string().optional().describe("ISO datetime (once)"),
            timezone: z.string().default("Asia/Riyadh"),
          }),
          execute: async (input) => {
            try {
              const row: Partial<ScheduledTask> = {
                org_id: ORG_ID,
                title: input.title,
                description: input.description ?? null,
                action_type: input.action_type,
                action_config: { audience: input.audience, message: input.message, channel: "whatsapp" },
                status: "active",
                frequency: input.frequency,
                at_hour: input.at_hour,
                at_minute: input.at_minute,
                weekday: input.weekday ?? null,
                day_of_month: input.day_of_month ?? null,
                run_at: input.run_at ?? null,
                timezone: input.timezone,
              };
              const next = computeNextRun(row as ScheduledTask, new Date());
              row.next_run_at = next ? next.toISOString() : null;

              const { data, error } = await supabaseAdmin
                .from("scheduled_tasks").insert(row).select("*").single();
              if (error) return { success: false as const, error: error.message };
              return {
                success: true as const,
                task_id: data.id,
                title: data.title,
                schedule: describeSchedule(data as ScheduledTask),
                next_run_at: data.next_run_at,
              };
            } catch (err) {
              return { success: false as const, error: err instanceof Error ? err.message : "فشل إنشاء المهمة" };
            }
          },
        }),
        listScheduledTasks: tool({
          description: "List the organization's scheduled tasks with their schedule and status.",
          inputSchema: z.object({}),
          execute: async () => {
            const { data, error } = await supabaseAdmin
              .from("scheduled_tasks").select("*").eq("org_id", ORG_ID)
              .order("created_at", { ascending: false });
            if (error) return { success: false as const, error: error.message, tasks: [] };
            const tasks = (data ?? []).map((t) => ({
              id: t.id, title: t.title, status: t.status, action_type: t.action_type,
              schedule: describeSchedule(t as ScheduledTask), next_run_at: t.next_run_at, run_count: t.run_count,
            }));
            return { success: true as const, count: tasks.length, tasks };
          },
        }),
        updateScheduledTask: tool({
          description: "Pause or resume a scheduled task. The UI shows an approval card.",
          needsApproval: true,
          inputSchema: z.object({
            task_id: z.string(),
            status: z.enum(["active", "paused"]),
          }),
          execute: async ({ task_id, status }) => {
            const { data: existing } = await supabaseAdmin
              .from("scheduled_tasks").select("*").eq("id", task_id).eq("org_id", ORG_ID).single();
            if (!existing) return { success: false as const, error: "المهمة غير موجودة" };
            const next = status === "active"
              ? computeNextRun(existing as ScheduledTask, new Date())
              : null;
            const { error } = await supabaseAdmin
              .from("scheduled_tasks")
              .update({ status, next_run_at: next ? next.toISOString() : existing.next_run_at })
              .eq("id", task_id).eq("org_id", ORG_ID);
            if (error) return { success: false as const, error: error.message };
            return { success: true as const, task_id, status };
          },
        }),
        deleteScheduledTask: tool({
          description: "Delete a scheduled task permanently. The UI shows an approval card.",
          needsApproval: true,
          inputSchema: z.object({ task_id: z.string() }),
          execute: async ({ task_id }) => {
            const { error } = await supabaseAdmin
              .from("scheduled_tasks").delete().eq("id", task_id).eq("org_id", ORG_ID);
            if (error) return { success: false as const, error: error.message };
            return { success: true as const, task_id };
          },
        }),
        runTaskNow: tool({
          description: "Execute a scheduled task immediately (for testing or one-off send). The UI shows an approval card.",
          needsApproval: true,
          inputSchema: z.object({ task_id: z.string() }),
          execute: async ({ task_id }) => {
            const { data: task } = await supabaseAdmin
              .from("scheduled_tasks").select("*").eq("id", task_id).eq("org_id", ORG_ID).single();
            if (!task) return { success: false as const, error: "المهمة غير موجودة" };
            const r = await runTaskAndRecord(task as ScheduledTask);
            return {
              success: r.status !== "failed",
              status: r.status,
              recipients_total: r.recipientsTotal,
              recipients_sent: r.recipientsSent,
              summary: r.summary,
            };
          },
        }),
      },
    });

    return result.toUIMessageStreamResponse({
      headers: {
        "Server-Timing": `knowledge;dur=${knowledgeDurationMs}`,
        "X-Agent-Model": AGENT_MODEL,
        "X-Agent-Thinking-Budget": String(AGENT_THINKING_BUDGET),
      },
    });
  } catch (error) {
    console.error("Agent error:", error);
    return new Response(JSON.stringify({ error: "فشل في الاتصال بالمساعد الذكي" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
