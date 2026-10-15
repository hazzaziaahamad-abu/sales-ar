"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Briefcase, Check, ChevronDown, Lock, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ideaProgress, parentOf, type FocusSlice } from "@/lib/focus-slices";
import { WORK_END_MIN, WORK_START_MIN, fmtDuration, fmtTime } from "@/lib/work-hours";
import { IdeaSlicesPanel, QuickCapture, TodaySlices, useSlices } from "@/components/ideas/slices";
import { FocusStartDialog } from "@/components/focus/focus-overlay";
import { ShutdownPanel, StartCard } from "@/components/work/work-cards";
import { nextDayLabel, topSliceOf, useWorkClock } from "@/components/work/work-clock";

/**
 * «العمل الوظيفي» 💼 — مساحة مستقلة تماماً عن مهام MENU، بنفس آلية الشرائح والتركيز.
 * خلال الدوام (الأحد–الخميس ٧:٠٠–١٥:٣٠ الرياض) كل شي متاح، وخارجه عرض فقط.
 */

interface WorkItem { id: string; title: string; notes: string; done_at: string | null; sort_order: number; created_at: string }

const num = (n: number) => n.toLocaleString("ar-SA");
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
// زر التقاط/حفظ بنفس تدرّج لوحة الأفكار
const CSS = `.ib-cta{background:linear-gradient(135deg,#facc15,#f472b6 55%,#34d399);color:#1e1b16}.ib-cta:hover{filter:brightness(1.08) saturate(1.1)}`;

export function WorkView() {
  const clock = useWorkClock();
  const readOnly = clock.phase !== "on";
  const api = useSlices("work");
  const [items, setItems] = useState<WorkItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [focusing, setFocusing] = useState<FocusSlice | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/work-items", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "تعذّر التحميل");
      setItems(json.items ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const titleOf = useCallback((id: string | null) => items.find((i) => i.id === id)?.title ?? "بند محذوف", [items]);
  const open = (id: string) => {
    setOpenId(id);
    setTimeout(() => document.getElementById(`wi-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
  };

  const add = async (title: string) => {
    const res = await fetch("/api/work-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { alert(json.error || "تعذّرت الإضافة"); return false; }
    setItems((p) => [...p, json.item]);
    setOpenId(json.item.id);
    return true;
  };
  const patchItem = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/work-items/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return alert(json.error || "تعذّر الحفظ");
    setItems((p) => p.map((i) => (i.id === id ? json.item : i)));
  };
  const removeItem = async (it: WorkItem) => {
    if (!confirm(`حذف «${it.title}» وكل شرائحه؟`)) return;
    const res = await fetch(`/api/work-items/${it.id}`, { method: "DELETE" });
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "تعذّر الحذف");
    setItems((p) => p.filter((i) => i.id !== it.id));
    api.reload();
  };

  const top = topSliceOf(api.slices, api.today || clock.today);
  const active = useMemo(() => items.filter((i) => !i.done_at), [items]);
  const doneItems = useMemo(() => items.filter((i) => i.done_at), [items]);
  const nextLabel = nextDayLabel(clock);

  const phaseChip = {
    on: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-400/30", text: `🟢 وقت الدوام · باقي ${fmtDuration(clock.minutesLeft)}` },
    before: { cls: "bg-white/[0.05] text-muted-foreground border-border", text: `⏳ الدوام يبدأ ${fmtTime(hhmm(WORK_START_MIN))} — عرض فقط` },
    after: { cls: "bg-violet-500/15 text-violet-200 border-violet-400/30", text: "🔚 انتهى الدوام — عرض فقط" },
    off: { cls: "bg-white/[0.05] text-muted-foreground border-border", text: "🌴 إجازة — عرض فقط" },
  }[clock.phase];

  return (
    <div className="space-y-5">
      <style>{CSS}</style>

      {/* ─── الهيرو ─── */}
      <section className="glass-surface rounded-[22px] border border-border p-5 hover:translate-y-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-300 flex items-center justify-center"><Briefcase className="w-6 h-6" /></span>
            <div>
              <h1 className="text-2xl font-extrabold text-foreground">العمل الوظيفي 💼</h1>
              <p className="text-xs text-muted-foreground">مساحة مستقلة عن MENU · الأحد–الخميس {fmtTime(hhmm(WORK_START_MIN))}–{fmtTime(hhmm(WORK_END_MIN))}</p>
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <span className={cn("inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full border", phaseChip.cls)}>
            {readOnly && <Lock className="w-3 h-3" />} {phaseChip.text}
          </span>
          {clock.phase === "on" && (
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-l from-emerald-300 to-emerald-600 transition-all" style={{ width: `${clock.progress * 100}%` }} />
            </div>
          )}
        </div>
      </section>

      {error && <p className="text-center text-sm text-muted-foreground">{error}</p>}

      {/* ─── بداية الدوام / إغلاقه ─── */}
      {clock.phase === "on" && api.loaded && (
        <StartCard slice={top} parent={top ? titleOf(parentOf(top)) : ""}
          onSetTime={(v) => api.patch(top!.id, { session_at: v })}
          onFocus={() => top && setFocusing(top)} />
      )}
      {clock.phase === "after" && api.loaded && api.slices.some((s) => s.planned_for === api.today) && (
        <ShutdownPanel slices={api.slices} today={api.today} nextLabel={nextLabel} />
      )}

      {!readOnly && <QuickCapture onAdd={add} placeholder="مهمة شغل؟ اكتبها بسطر واحد واضغط Enter" />}

      <TodaySlices api={api} parentTitle={titleOf} onOpenParent={open} readOnly={readOnly} icon="💼" nextLabel={nextLabel}
        emptyHint="أضف بند شغل واضغط «قطّع ✂️» — يتحول لشرائح تختار منها شغل يومك" />

      {/* ─── بنود العمل ─── */}
      <section className="space-y-2">
        <h2 className="text-sm font-extrabold text-foreground px-1">📋 بنود العمل ({num(active.length)})</h2>
        {active.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6 rounded-2xl border border-dashed border-border">
            {readOnly ? "ما فيه بنود" : "التقط أول بند شغل من الصندوق فوق"}
          </p>
        )}
        {active.map((it) => (
          <WorkItemRow key={it.id} item={it} slices={api.byParent.get(it.id) ?? []} open={openId === it.id} readOnly={readOnly}
            onToggle={() => setOpenId((x) => (x === it.id ? null : it.id))}
            onDone={() => patchItem(it.id, { done: true })}
            onDelete={() => removeItem(it)}>
            <IdeaSlicesPanel ideaId={it.id} api={api} suggestUrl={`/api/work-items/${it.id}/slice`} readOnly={readOnly} className="w-full" />
          </WorkItemRow>
        ))}

        {doneItems.length > 0 && (
          <div>
            <button onClick={() => setShowDone((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-border text-xs font-bold text-muted-foreground hover:text-foreground">
              <span>✅ بنود منجزة ({num(doneItems.length)})</span>
              <ChevronDown className={cn("w-4 h-4 transition-transform", showDone && "rotate-180")} />
            </button>
            {showDone && (
              <div className="mt-2 space-y-1">
                {doneItems.map((it) => (
                  <div key={it.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span className="flex-1 truncate line-through">{it.title}</span>
                    {!readOnly && <button onClick={() => patchItem(it.id, { done: false })} className="text-[11px] font-bold hover:text-foreground">إرجاع</button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {focusing && <FocusStartDialog slice={focusing} parent={titleOf(parentOf(focusing))} onClose={() => setFocusing(null)} />}
    </div>
  );
}

function WorkItemRow({ item, slices, open, readOnly, onToggle, onDone, onDelete, children }: {
  item: WorkItem; slices: FocusSlice[]; open: boolean; readOnly: boolean;
  onToggle: () => void; onDone: () => void; onDelete: () => void; children: React.ReactNode;
}) {
  const pct = ideaProgress(slices);
  return (
    <div id={`wi-${item.id}`} className={cn("rounded-2xl border transition", open ? "border-emerald-400/30 bg-white/[0.03]" : "border-border bg-white/[0.015]")}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button onClick={onToggle} className="flex-1 min-w-0 flex items-center gap-2 text-right">
          <ChevronDown className={cn("w-4 h-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
          <span className="flex-1 min-w-0 text-sm font-bold text-foreground truncate">{item.title}</span>
          {pct !== null && (
            <span className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <span className="w-12 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                <span className="block h-full bg-emerald-400" style={{ width: `${pct}%` }} />
              </span>
              {num(pct)}٪
            </span>
          )}
        </button>
        {!readOnly && (
          <>
            <button onClick={onDone} title="البند منجز" className="shrink-0 p-1.5 rounded-full text-muted-foreground hover:text-emerald-300"><Check className="w-4 h-4" /></button>
            <button onClick={onDelete} title="حذف" className="shrink-0 p-1.5 rounded-full text-muted-foreground/60 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
          </>
        )}
      </div>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  );
}
