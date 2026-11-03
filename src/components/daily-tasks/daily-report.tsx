"use client";

import { formatMoneyFull } from "@/lib/utils/format";
import { DEPT_LABEL, OUTCOME_LABEL, type DailyPlan, type Department, type Outcome } from "@/lib/daily-tasks/shared";

const n = (x: number) => Math.round(x).toLocaleString("en-US");
const t = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleTimeString("ar-SA", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "2-digit" }) : "—";

function Line({ k, v, flag }: { k: string; v: React.ReactNode; flag?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-border py-1.5 text-sm last:border-0">
      <span className="text-muted-foreground">{k}</span>
      <b className={`text-left ${flag ? "text-amber-400" : ""}`}>{v}</b>
    </div>
  );
}

/** تقرير اليوم — مولَّد من السجلات. يُستخدم في شريط الموظف وفي مركز الإعدادات للمدير. */
export function DailyReportView({ plan, showName = false }: { plan: DailyPlan; showName?: boolean }) {
  const r = plan.report;
  if (!r) return null;
  const outcomes = Object.entries(r.outcomes ?? {}) as [Outcome, number][];
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="font-extrabold">{showName ? plan.user_name : "تقرير اليوم"}</span>
        <span className="text-[11px] text-muted-foreground">مولَّد من السجلات · {plan.departments.map((d) => DEPT_LABEL[d as Department]).join("، ")}</span>
      </div>
      <Line k="البدء" v={t(r.started_at)} />
      <Line k="أول نشاط فعلي" v={t(r.first_activity_at)} />
      {r.gap_minutes !== null && r.gap_minutes > 30 && <Line k="بين البدء وأول نشاط" v={`${n(r.gap_minutes)} د (أكثر من ٣٠)`} flag />}
      <Line k="آخر نشاط" v={t(r.last_activity_at)} />
      <Line k="الإنهاء" v={t(r.finished_at)} />
      <Line k="الطابور" v={`${n(r.queue_done)} من ${n(r.queue_total)}`} />
      {Object.entries(r.by_department ?? {}).length > 1 && Object.entries(r.by_department).map(([d, v]) => (
        <Line key={d} k={`· ${DEPT_LABEL[d as Department]}`} v={`${n(v!.done)} من ${n(v!.total)}`} />
      ))}
      <Line k="الأولويات الثلاث" v={`${n(r.priorities_done)} من ${n(r.priorities_total)}`} />
      <Line k="المهام المضافة" v={`${n(r.extras_done)} من ${n(r.extras_total)}`} />
      {plan.departments.includes("office") && <Line k="الاستهداف" v={`${n(r.prospect_added)} رقم جديد`} />}
      <Line k="الاجتماعات" v={`${n(r.meetings_held)} منفذ · ${n(r.meetings_booked)} حُجز`} />
      <Line k="مدفوعات اليوم" v={`${n(r.paid_count)} · ${formatMoneyFull(r.paid_amount)}`} />
      {outcomes.length > 0 && <Line k="النتائج" v={outcomes.map(([k, c]) => `${OUTCOME_LABEL[k]} ${n(c)}`).join(" · ")} />}
      {r.unfinished_reason && <Line k="سبب ما لم يكتمل" v={r.unfinished_reason} flag />}
      {r.blocker_note && <Line k="العائق" v={r.blocker_note} flag />}
      {r.pending.length > 0 && (
        <details className="pt-1 text-xs text-muted-foreground">
          <summary className="cursor-pointer">بلا نتيجة ({n(r.pending.length)})</summary>
          <div className="mt-1">{r.pending.map((p) => p.title).join("، ")}</div>
        </details>
      )}
    </div>
  );
}
