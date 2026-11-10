// تحليل ذكي للعناصر الساكتة قبل ما تنجهز لها مسودات تذكير:
// يقرأ آخر التعليقات ومرحلة العنصر ويقرر هل فعلاً تحتاج إجراء الحين، ويكتب سبب قصير ونص تذكير مناسب.
// لو ما فيه مفتاح API أو فشل الطلب، يرجع null والنظام يكمل بالطريقة القديمة (كل العناصر تنعرض).
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase/admin";

export interface TriageInput {
  id: string;
  source: "support" | "work" | "deal" | "renewal";
  category: string;
  title: string;
  assignee: string;
  female: boolean;
  last_activity: string;
}

export interface TriageResult {
  needs_action: boolean;
  priority: "high" | "normal";
  reason: string;
  message: string;
}

const MODEL = process.env.FOLLOWUP_TRIAGE_MODEL || "claude-opus-5-5";
const BATCH = 30;

const CATEGORY_AR: Record<string, string> = {
  ticket: "تذكرة دعم فني", work: "طلب/تطوير داخلي", office_sales: "صفقة مبيعات المكتب",
  support_sales: "صفقة مبيعات الدعم", renewal: "تجديد اشتراك",
};

const SYSTEM = `أنت مساعد مدير مبيعات ودعم في شركة سعودية. تستلم قائمة عناصر (تذاكر، صفقات، تجديدات، طلبات داخلية) ما تحدّثت من يومين أو أكثر.
مهمتك: تحدد أي عنصر فعلاً يحتاج تذكير للموظف المسؤول الحين، وتستبعد اللي ما يحتاج، عشان المدير ما يزعج الفريق بتذكيرات بلا فايدة.

يحتاج إجراء (needs_action = true) مثلاً:
- ما فيه أي تعليق من موظف، أو آخر تعليق قديم وما فيه خطوة واضحة.
- الموظف وعد بشي (أتصل، أرسل واتساب، أرسل عرض) ومرّ وقت كافي بدون ما يكتب النتيجة.
- العميل ينتظر رد منا، أو فيه سؤال من المدير ما انرد عليه.
- العنصر شكله خلص فعلياً بس حالته ما تقفلت (الإجراء: يحدّث الحالة أو يقفله).
- التعليقات التلقائية من النظام (مثل «📝 تحديث تلقائي» أو تغيير حقل) ما تعتبر متابعة حقيقية.

ما يحتاج إجراء (needs_action = false) مثلاً:
- آخر تعليق يذكر موعد أو تاريخ متفق عليه لسا ما جا (العميل بيرد بعد أسبوع، اجتماع يوم كذا، بعد الراتب...).
- بانتظار شي خارج يد الموظف وموضّح في التعليق (بانتظار الدفع من العميل وتم تذكيره قريب، بانتظار قسم ثاني وتم التصعيد).
- المرحلة تدل إنه مقفل/مرفوض/مؤجل بشكل واضح.

priority = "high" لو فيه عميل ينتظر أو فرصة بيع/تجديد ممكن تضيع، وإلا "normal".
reason: سبب قصير جداً بالعربي (أقل من ١٢ كلمة) يشرح للمدير ليش تحتاج أو ما تحتاج.
message: نص التذكير للموظف بلهجة سعودية خفيفة ومهذبة، جملة وحدة قصيرة، مبني على آخر تعليق لو يفيد (مثل: «أرسلت الواتساب للعميل؟ وش رد؟»).
بدون منشن (@) وبدون اسم العميل. خاطب الموظف بصيغة المؤنث لو female = true وإلا بصيغة المذكر. لو needs_action = false خلّ message فاضي.
لازم ترجع نتيجة لكل id في القائمة.`;

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          needs_action: { type: "boolean" },
          priority: { type: "string", enum: ["high", "normal"] },
          reason: { type: "string" },
          message: { type: "string" },
        },
        required: ["id", "needs_action", "priority", "reason", "message"],
        additionalProperties: false,
      },
    },
  },
  required: ["items"],
  additionalProperties: false,
} as const;

interface Note { author: string | null; body: string; at: string }

/** آخر ٤ تعليقات لكل عنصر (ملاحظات المتابعة + أحداث الطلبات الداخلية). */
async function recentNotes(ids: string[]): Promise<Map<string, Note[]>> {
  const out = new Map<string, Note[]>();
  const push = (id: string, n: Note) => out.set(id, [...(out.get(id) ?? []), n]);
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const [notes, events] = await Promise.all([
      supabaseAdmin.from("follow_up_notes").select("entity_id, author_name, note, created_at")
        .in("entity_id", chunk).order("created_at", { ascending: false }).limit(chunk.length * 6),
      supabaseAdmin.from("work_ticket_events").select("ticket_id, actor_name, body, created_at")
        .in("ticket_id", chunk).not("body", "is", null).order("created_at", { ascending: false }).limit(chunk.length * 6),
    ]);
    for (const n of notes.data ?? []) push(n.entity_id as string, { author: n.author_name as string | null, body: String(n.note ?? ""), at: n.created_at as string });
    for (const e of events.data ?? []) push(e.ticket_id as string, { author: e.actor_name as string | null, body: String(e.body ?? ""), at: e.created_at as string });
  }
  for (const [id, list] of out) out.set(id, list.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 4).reverse());
  return out;
}

async function stages(ids: string[]): Promise<Map<string, string>> {
  const m = new Map<string, string>();
  for (let i = 0; i < ids.length; i += 300) {
    const { data } = await supabaseAdmin.rpc("followup_item_stages", { p_ids: ids.slice(i, i + 300) });
    for (const r of (data ?? []) as { item_id: string; stage: string | null }[]) if (r.stage) m.set(r.item_id, r.stage);
  }
  return m;
}

const days = (iso: string, now: number) => Math.floor((now - new Date(iso).getTime()) / 86_400_000);

async function triageBatch(client: Anthropic, items: TriageInput[], notes: Map<string, Note[]>, stageById: Map<string, string>) {
  const now = Date.now();
  const today = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { dateStyle: "full", timeZone: "Asia/Riyadh" }).format(new Date());
  const payload = items.map((it) => ({
    id: it.id,
    type: CATEGORY_AR[it.category] ?? it.category,
    title: it.title,
    stage: stageById.get(it.id) ?? null,
    assignee: it.assignee,
    female: it.female,
    days_without_update: days(it.last_activity, now),
    notes: (notes.get(it.id) ?? []).map((n) => ({ by: n.author ?? "—", days_ago: days(n.at, now), text: n.body.slice(0, 500) })),
  }));

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 16000,
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: `تاريخ اليوم: ${today}\n\nالعناصر:\n${JSON.stringify(payload)}` }],
  });
  if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") throw new Error(`triage stopped: ${res.stop_reason}`);
  const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return (JSON.parse(text) as { items: (TriageResult & { id: string })[] }).items;
}

/** يحلل العناصر ويرجع قرار لكل id. null = التحليل غير متاح (بدون مفتاح أو فشل كامل). */
export async function triageItems(items: TriageInput[]): Promise<Map<string, TriageResult> | null> {
  if (!process.env.ANTHROPIC_API_KEY || !items.length) return null;
  const client = new Anthropic({ maxRetries: 2, timeout: 50_000 });
  const ids = items.map((i) => i.id);
  const [notes, stageById] = await Promise.all([recentNotes(ids), stages(ids)]);

  const out = new Map<string, TriageResult>();
  const batches: TriageInput[][] = [];
  for (let i = 0; i < items.length; i += BATCH) batches.push(items.slice(i, i + BATCH));
  const results = await Promise.allSettled(batches.map((b) => triageBatch(client, b, notes, stageById)));
  let ok = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") { console.error("followup triage failed:", r.reason); continue; }
    ok++;
    for (const it of r.value) {
      out.set(it.id, {
        needs_action: !!it.needs_action,
        priority: it.priority === "high" ? "high" : "normal",
        reason: String(it.reason ?? "").trim().slice(0, 200),
        message: String(it.message ?? "").replace(/@\S+/g, "").trim().slice(0, 300),
      });
    }
  }
  return ok ? out : null;
}
