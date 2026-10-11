"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles, Plus, Trash2, Copy, Check, Link2, Video, Image as ImageIcon, Layers, Film, Smartphone,
  X, Loader2, RefreshCw, Pencil, Eye, Calendar, ChevronDown, ChevronUp, Wand2, FileText,
  Clock, Target, ListChecks, CalendarDays, ExternalLink, LayoutGrid, StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTENT_KINDS, ITEM_STATUSES, PLAN_STATUSES, PLAN_TYPES, PLATFORMS, kindLabel, platformLabel, isVideoKind,
  planTypeOf, defaultStepTitles, makeStep,
  type ContentItem, type ContentKind, type ContentPlan, type SavedSuggestion, type TimelineRow, type ContentStep,
} from "@/lib/content-plans/types";

const KIND_STYLE: Record<ContentKind, { icon: typeof Video; color: string }> = {
  video: { icon: Video, color: "text-red-400 bg-red-500/15" },
  reel: { icon: Film, color: "text-pink-400 bg-pink-500/15" },
  post: { icon: ImageIcon, color: "text-blue-400 bg-blue-500/15" },
  carousel: { icon: Layers, color: "text-amber-400 bg-amber-500/15" },
  story: { icon: Smartphone, color: "text-emerald-400 bg-emerald-500/15" },
};

const inputCls =
  "w-full rounded-lg bg-white/[0.06] border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 disabled:opacity-70";

type PlanPayload = { plan: ContentPlan; items: ContentItem[]; suggestions: SavedSuggestion[]; canEdit: boolean; isOwner: boolean };

/**
 * محرر خطة المحتوى. يعمل في لوحة التحكم (apiBase = /api/content-plans/<id>)
 * وفي الرابط العام (apiBase = /api/public/content-plan/<token>) بنفس الواجهة.
 */
export default function ContentPlanEditor({ apiBase }: { apiBase: string }) {
  const [data, setData] = useState<PlanPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ContentKind | "all">("all");
  const [editing, setEditing] = useState<ContentItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [view, setView] = useState<"cards" | "schedule" | null>(null);

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const res = await fetch(apiBase + path, {
        ...init,
        headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
        cache: "no-store",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "حدث خطأ");
      return json as T;
    },
    [apiBase]
  );

  const load = useCallback(
    () =>
      api<PlanPayload>("")
        .then((d) => { setData(d); setError(null); })
        .catch((e: Error) => setError(e.message)),
    [api]
  );

  useEffect(() => {
    load();
  }, [load]);

  const updatePlan = async (patch: Partial<ContentPlan> & { regenerate_token?: boolean }) => {
    if (!data) return;
    setData({ ...data, plan: { ...data.plan, ...patch } as ContentPlan });
    try {
      const { plan } = await api<{ plan: ContentPlan }>("", { method: "PATCH", body: JSON.stringify(patch) });
      setData((d) => (d ? { ...d, plan } : d));
    } catch (e) {
      alert((e as Error).message);
      load();
    }
  };

  const addItems = async (items: Partial<ContentItem>[]) => {
    const res = await api<{ items: ContentItem[] }>("/items", { method: "POST", body: JSON.stringify({ items }) });
    setData((d) => (d ? { ...d, items: [...d.items, ...res.items] } : d));
    return res.items;
  };

  const saveItem = async (item: ContentItem) => {
    const res = await api<{ item: ContentItem }>("/items", { method: "PATCH", body: JSON.stringify(item) });
    setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === item.id ? res.item : i)) } : d));
    return res.item;
  };

  const deleteItem = async (id: string) => {
    if (!confirm("حذف هذا العنصر؟")) return;
    await api(`/items?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    setData((d) => (d ? { ...d, items: d.items.filter((i) => i.id !== id) } : d));
    setEditing(null);
  };

  /** حفظ مراحل التنفيذ مباشرة (بدون زر حفظ) — الخادم يختم وقت الإكمال واسم المنفّذ. */
  const saveSteps = async (itemId: string, steps: ContentStep[]) => {
    const res = await api<{ item: ContentItem }>("/items", { method: "PATCH", body: JSON.stringify({ id: itemId, steps }) });
    setData((d) => (d ? { ...d, items: d.items.map((i) => (i.id === itemId ? res.item : i)) } : d));
    return res.item;
  };

  const quickStatus = async (item: ContentItem, status: ContentItem["status"]) => {
    try { await saveItem({ ...item, status }); } catch (e) { alert((e as Error).message); }
  };

  const items = useMemo(
    () => (data?.items ?? []).filter((i) => filter === "all" || i.kind === filter),
    [data, filter]
  );

  if (error) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="font-semibold">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-28 rounded-[14px] bg-white/[0.04] animate-pulse" />
        <div className="h-40 rounded-[14px] bg-white/[0.04] animate-pulse" />
      </div>
    );
  }

  const { plan, canEdit, isOwner } = data;
  const planType = planTypeOf(plan);
  const typeInfo = PLAN_TYPES.find((t) => t.value === planType) ?? PLAN_TYPES[0];
  const currentView = view ?? (planType === "publishing" ? "schedule" : "cards");
  const counts = CONTENT_KINDS.map((k) => ({ ...k, n: data.items.filter((i) => i.kind === k.value).length }));

  return (
    <div className="space-y-5">
      {/* رأس الخطة */}
      <div className="glass-surface rounded-[14px] border border-border p-5 hover:translate-y-0">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex-1 min-w-[220px]">
            {canEdit ? (
              <input
                defaultValue={plan.title}
                key={plan.title}
                onBlur={(e) => e.target.value.trim() && e.target.value !== plan.title && updatePlan({ title: e.target.value })}
                className="w-full bg-transparent text-xl font-extrabold text-foreground focus:outline-none focus:bg-white/[0.04] rounded-lg px-1 -mx-1"
              />
            ) : (
              <h1 className="text-xl font-extrabold text-foreground">{plan.title}</h1>
            )}
            {plan.description && !showDetails && (
              <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-2">{plan.description}</p>
            )}
            <div className="flex flex-wrap gap-2 mt-2">
              {canEdit ? (
                <select
                  value={plan.status}
                  onChange={(e) => updatePlan({ status: e.target.value as ContentPlan["status"] })}
                  className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/[0.06] border border-border text-foreground"
                >
                  {PLAN_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) : (
                <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", PLAN_STATUSES.find((s) => s.value === plan.status)?.color)}>
                  {PLAN_STATUSES.find((s) => s.value === plan.status)?.label}
                </span>
              )}
              <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", typeInfo.color)}>{typeInfo.label}</span>
              {plan.platforms?.map((p) => (
                <span key={p} className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-violet-500/15 text-violet-400">{platformLabel(p)}</span>
              ))}
              {!canEdit && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-500/20 text-slate-300 flex items-center gap-1">
                  <Eye className="w-3 h-3" /> عرض فقط
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowDetails((v) => !v)}
            className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            تفاصيل الخطة {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {showDetails && <PlanDetails plan={plan} canEdit={canEdit} onSave={updatePlan} />}

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-4">
          {counts.map((k) => {
            const S = KIND_STYLE[k.value];
            return (
              <div key={k.value} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.03]">
                <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center", S.color)}><S.icon className="w-3.5 h-3.5" /></span>
                <div>
                  <p className="text-[10px] text-muted-foreground">{k.label}</p>
                  <p className="text-sm font-bold text-foreground">{k.n}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {isOwner && <SharePanel plan={plan} onUpdate={updatePlan} />}

      {canEdit && (
        <AIIdeasPanel
          api={api}
          suggestions={data.suggestions ?? []}
          setSuggestions={(fn) => setData((d) => (d ? { ...d, suggestions: fn(d.suggestions ?? []) } : d))}
          onItemsAdded={(added) => setData((d) => (d ? { ...d, items: [...d.items, ...added] } : d))}
        />
      )}

      {/* العناصر */}
      <div className="glass-surface rounded-[14px] border border-border p-5 hover:translate-y-0">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`الكل (${data.items.length})`} />
            {CONTENT_KINDS.map((k) => (
              <FilterChip key={k.value} active={filter === k.value} onClick={() => setFilter(k.value)} label={k.label} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="flex gap-1 p-0.5 rounded-lg bg-white/[0.04] border border-border">
              {([["cards", "البطاقات", LayoutGrid], ["schedule", "جدول النشر", CalendarDays]] as const).map(([v, label, Icon]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn("flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-semibold",
                    currentView === v ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground hover:text-foreground")}
                >
                  <Icon className="w-3.5 h-3.5" /> {label}
                </button>
              ))}
            </div>
          {canEdit && (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  try {
                    const [it] = await addItems([{ kind: "video", title: "فكرة فيديو جديدة" }]);
                    if (it) setEditing(it);
                  } catch (e) { alert((e as Error).message); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 text-red-400 hover:bg-red-500/25 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> فيديو
              </button>
              <button
                onClick={async () => {
                  try {
                    const [it] = await addItems([{ kind: "post", title: "تصميم بوست جديد" }]);
                    if (it) setEditing(it);
                  } catch (e) { alert((e as Error).message); }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/15 text-blue-400 hover:bg-blue-500/25 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> بوست
              </button>
            </div>
          )}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold">لا يوجد محتوى بعد</p>
            {canEdit && <p className="text-xs mt-1">أضف فيديو أو بوست، أو خلّ الذكاء الاصطناعي يقترح لك أفكار</p>}
          </div>
        ) : currentView === "schedule" ? (
          <ScheduleView items={items} onOpen={setEditing} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {items.map((item, idx) => (
              <ItemCard
                key={item.id}
                index={idx + 1}
                item={item}
                canEdit={canEdit}
                onOpen={() => setEditing(item)}
                onDelete={() => deleteItem(item.id)}
                onStatus={(s) => quickStatus(item, s)}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <ItemEditor
          item={editing}
          canEdit={canEdit}
          api={api}
          stepTitles={defaultStepTitles(planType, editing.kind, plan.step_template)}
          onSaveSteps={(steps) => saveSteps(editing.id, steps)}
          onClose={() => setEditing(null)}
          onSave={async (it) => { await saveItem(it); setEditing(null); }}
          onDelete={() => deleteItem(editing.id)}
        />
      )}
    </div>
  );
}

// ─── تفاصيل الخطة ─────────────────────────────────────────────────────────────

function PlanDetails({ plan, canEdit, onSave }: { plan: ContentPlan; canEdit: boolean; onSave: (p: Partial<ContentPlan>) => void }) {
  const templateText = (plan.step_template ?? []).join("\n");
  const [form, setForm] = useState({
    description: plan.description, audience: plan.audience, related_product: plan.related_product,
    tone: plan.tone, platforms: plan.platforms ?? [], template: templateText,
  });
  const dirty =
    form.description !== plan.description || form.audience !== plan.audience ||
    form.related_product !== plan.related_product || form.tone !== plan.tone ||
    form.platforms.join() !== (plan.platforms ?? []).join() || form.template !== templateText;
  const defaults = planTypeOf(plan) === "publishing"
    ? defaultStepTitles("publishing", "post")
    : defaultStepTitles("creation", "video");

  return (
    <div className="mt-4 pt-4 border-t border-border/40 space-y-3">
      <Field label="الهدف / وصف الخطة">
        <textarea rows={2} disabled={!canEdit} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={cn(inputCls, "resize-y")} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="الجمهور المستهدف">
          <input disabled={!canEdit} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} className={inputCls} placeholder="مثال: أصحاب الكافيهات" />
        </Field>
        <Field label="المنتج">
          <input disabled={!canEdit} value={form.related_product} onChange={(e) => setForm({ ...form, related_product: e.target.value })} className={inputCls} />
        </Field>
        <Field label="نبرة المحتوى">
          <input disabled={!canEdit} value={form.tone} onChange={(e) => setForm({ ...form, tone: e.target.value })} className={inputCls} placeholder="مثال: عفوية وخفيفة" />
        </Field>
      </div>
      <Field label="المنصات">
        <div className="flex flex-wrap gap-1.5">
          {PLATFORMS.map((p) => {
            const on = form.platforms.includes(p.value);
            return (
              <button
                key={p.value}
                disabled={!canEdit}
                onClick={() => setForm({ ...form, platforms: on ? form.platforms.filter((x) => x !== p.value) : [...form.platforms, p.value] })}
                className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors",
                  on ? "bg-violet-500/20 text-violet-300 border-violet-500/40" : "bg-white/[0.03] text-muted-foreground border-border")}
              >
                {p.label}
              </button>
            );
          })}
        </div>
      </Field>
      <Field label="مراحل التنفيذ الافتراضية (مرحلة في كل سطر) — تُضاف تلقائياً لكل محتوى جديد">
        <textarea
          rows={5}
          disabled={!canEdit}
          value={form.template}
          onChange={(e) => setForm({ ...form, template: e.target.value })}
          className={cn(inputCls, "resize-y leading-relaxed")}
          placeholder={"فاضي = القالب الافتراضي حسب نوع المحتوى:\n" + defaults.join("\n")}
        />
      </Field>
      {canEdit && dirty && (
        <button
          onClick={() => {
            const { template, ...rest } = form;
            onSave({ ...rest, step_template: template.split("\n").map((t) => t.trim()).filter(Boolean) });
          }}
          className="px-4 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600">
          حفظ التفاصيل
        </button>
      )}
    </div>
  );
}

// ─── المشاركة ─────────────────────────────────────────────────────────────────

function SharePanel({ plan, onUpdate }: { plan: ContentPlan; onUpdate: (p: Partial<ContentPlan> & { regenerate_token?: boolean }) => void }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window !== "undefined" ? `${window.location.origin}/content/${plan.share_token}` : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      prompt("انسخ الرابط:", url);
    }
  };

  return (
    <div className="glass-surface rounded-[14px] border border-cyan-500/20 p-4 hover:translate-y-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-cyan-400" />
          <span className="text-sm font-bold text-foreground">رابط المشاركة</span>
          <span className="text-xs text-muted-foreground">(يفتح بدون تسجيل دخول)</span>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
          <input type="checkbox" checked={plan.share_enabled} onChange={(e) => onUpdate({ share_enabled: e.target.checked })} className="accent-cyan-500 w-4 h-4" />
          {plan.share_enabled ? "المشاركة مفعّلة" : "المشاركة متوقفة"}
        </label>
      </div>

      {plan.share_enabled && (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <input readOnly value={url} dir="ltr" onFocus={(e) => e.target.select()} className={cn(inputCls, "font-mono text-xs")} />
            <button onClick={copy} className="shrink-0 flex items-center gap-1 px-3 rounded-lg bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 text-xs font-semibold">
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "تم النسخ" : "نسخ"}
            </button>
          </div>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-1.5">
              {([["view", "عرض فقط", Eye], ["edit", "عرض وتعديل + AI", Pencil]] as const).map(([mode, label, Icon]) => (
                <button
                  key={mode}
                  onClick={() => onUpdate({ share_mode: mode })}
                  className={cn("flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border",
                    plan.share_mode === mode ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40" : "bg-white/[0.03] text-muted-foreground border-border")}
                >
                  <Icon className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => confirm("سيتوقف الرابط الحالي عن العمل. متابعة؟") && onUpdate({ regenerate_token: true })}
              className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-red-400"
            >
              <RefreshCw className="w-3 h-3" /> رابط جديد
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── توليد الأفكار بالذكاء الاصطناعي ────────────────────────────────────────

type ApiFn = <T>(path: string, init?: RequestInit) => Promise<T>;

function AIIdeasPanel({ api, suggestions, setSuggestions, onItemsAdded }: {
  api: ApiFn;
  suggestions: SavedSuggestion[];
  setSuggestions: (fn: (prev: SavedSuggestion[]) => SavedSuggestion[]) => void;
  onItemsAdded: (items: ContentItem[]) => void;
}) {
  const [open, setOpen] = useState(suggestions.some((s) => !s.added));
  const [kind, setKind] = useState<ContentKind | "">("");
  const [count, setCount] = useState(5);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [showAdded, setShowAdded] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<string[]>([]);

  const pending = suggestions.filter((s) => !s.added);
  const addedCount = suggestions.length - pending.length;
  const visible = showAdded ? suggestions : pending;

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api<{ suggestions: SavedSuggestion[] }>("/ai", {
        method: "POST",
        body: JSON.stringify({ mode: "ideas", kind: kind || undefined, count, hint }),
      });
      // الجديدة فوق، والقديمة تبقى تحتها
      setSuggestions((prev) => [...res.suggestions, ...prev]);
      setFreshIds(res.suggestions.map((x) => x.id));
      setExpanded(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const add = async (list: SavedSuggestion[]) => {
    try {
      const res = await api<{ items: ContentItem[] }>("/items", {
        method: "POST",
        body: JSON.stringify({
          items: list.map((x) => ({
            kind: x.kind, title: x.title, idea: x.idea, script: x.script, caption: x.caption,
            timeline: x.timeline, focus_points: x.focus_points, source: "ai", suggestion_id: x.id,
          })),
        }),
      });
      onItemsAdded(res.items);
      const ids = list.map((x) => x.id);
      setSuggestions((prev) => prev.map((x) => (ids.includes(x.id) ? { ...x, added: true } : x)));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const dismiss = async (query: string, keep: (x: SavedSuggestion) => boolean) => {
    try {
      await api(`/suggestions?${query}`, { method: "DELETE" });
      setSuggestions((prev) => prev.filter(keep));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="glass-surface rounded-[14px] border border-violet-500/25 p-4 hover:translate-y-0">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Sparkles className="w-4 h-4 text-violet-400" /> ولّد أفكار بالذكاء الاصطناعي
          {pending.length > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300">{pending.length} فكرة محفوظة</span>
          )}
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <select value={kind} onChange={(e) => setKind(e.target.value as ContentKind | "")} className={inputCls}>
              <option value="">كل الأنواع (منوّع)</option>
              {CONTENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
            <select value={count} onChange={(e) => setCount(Number(e.target.value))} className={inputCls}>
              {[3, 5, 8, 10].map((n) => <option key={n} value={n}>{n} أفكار</option>)}
            </select>
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && generate()}
              placeholder="توجيه اختياري: مثال عروض اليوم الوطني"
              className={cn(inputCls, "col-span-2")}
            />
          </div>
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-500 text-white text-sm font-semibold hover:bg-violet-600 disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "جاري التوليد..." : suggestions.length ? "ولّد أفكار جديدة غيرها" : "ولّد الأفكار"}
          </button>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-xs text-muted-foreground">
                  الأفكار المحفوظة ({pending.length}) — تبقى هنا لين تضيفها أو تتجاهلها
                </p>
                <div className="flex items-center gap-3">
                  {addedCount > 0 && (
                    <button onClick={() => setShowAdded((v) => !v)} className="text-[11px] text-muted-foreground hover:text-foreground">
                      {showAdded ? "إخفاء المضافة" : `عرض المضافة (${addedCount})`}
                    </button>
                  )}
                  {pending.length > 0 && (
                    <button onClick={() => add(pending)} className="text-xs font-semibold text-violet-400 hover:text-violet-300">
                      إضافة الكل
                    </button>
                  )}
                  <button
                    onClick={() => confirm("مسح كل الأفكار المحفوظة؟ (العناصر المضافة للخطة ما تنحذف)") && dismiss("scope=all", () => false)}
                    className="text-[11px] text-muted-foreground hover:text-red-400"
                  >
                    مسح الكل
                  </button>
                </div>
              </div>
              {visible.length === 0 && (
                <p className="text-xs text-muted-foreground py-2">كل الأفكار أُضيفت للخطة — ولّد أفكار جديدة</p>
              )}
              {visible.map((s) => {
                const S = KIND_STYLE[s.kind] ?? KIND_STYLE.video;
                const isOpen = expanded === s.id;
                return (
                  <div key={s.id} className={cn("p-3 rounded-lg border bg-white/[0.03]",
                    s.added ? "border-emerald-500/30 opacity-70" : freshIds.includes(s.id) ? "border-violet-500/40" : "border-border")}>
                    <div className="flex items-start gap-2">
                      <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", S.color)}><S.icon className="w-3.5 h-3.5" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">
                          {s.title}
                          {freshIds.includes(s.id) && <span className="mr-2 text-[10px] font-bold text-violet-300">جديدة</span>}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{kindLabel(s.kind)} · {s.idea}</p>
                        {isOpen && (
                          <div className="mt-2 space-y-2">
                            <pre className="whitespace-pre-wrap font-sans text-xs text-foreground/90 bg-black/20 rounded-lg p-2.5 leading-relaxed">{s.script}</pre>
                            {s.timeline?.length > 0 && <TimelineEditor rows={s.timeline} canEdit={false} onChange={() => {}} />}
                            {s.focus_points?.length > 0 && <FocusPointsEditor points={s.focus_points} canEdit={false} onChange={() => {}} />}
                            {s.caption && <p className="text-xs text-muted-foreground whitespace-pre-wrap">📝 {s.caption}</p>}
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        {s.added ? (
                          <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1"><Check className="w-3 h-3" /> أُضيفت</span>
                        ) : (
                          <div className="flex items-center gap-1">
                            <button onClick={() => add([s])} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-[11px] font-semibold">
                              <Plus className="w-3 h-3" /> إضافة
                            </button>
                            <button
                              onClick={() => dismiss(`id=${encodeURIComponent(s.id)}`, (x) => x.id !== s.id)}
                              title="تجاهل"
                              className="p-1 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                        <button onClick={() => setExpanded(isOpen ? null : s.id)} className="text-[11px] text-muted-foreground hover:text-foreground">
                          {isOpen ? "إخفاء التفاصيل" : "عرض السكربت"}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── بطاقة العنصر ─────────────────────────────────────────────────────────────

function ItemCard({ item, index, canEdit, onOpen, onDelete, onStatus }: {
  item: ContentItem; index: number; canEdit: boolean;
  onOpen: () => void; onDelete: () => void; onStatus: (s: ContentItem["status"]) => void;
}) {
  const S = KIND_STYLE[item.kind] ?? KIND_STYLE.video;
  const st = ITEM_STATUSES.find((s) => s.value === item.status) ?? ITEM_STATUSES[0];
  return (
    <div className="p-4 rounded-[12px] bg-white/[0.03] border border-border hover:border-violet-500/30 transition-colors group relative">
      {canEdit && (
        <button onClick={onDelete} className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-all">
          <Trash2 className="w-3 h-3" />
        </button>
      )}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] font-mono text-muted-foreground">#{index}</span>
        <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center", S.color)}><S.icon className="w-3.5 h-3.5" /></span>
        <span className="text-[11px] font-semibold text-muted-foreground">{kindLabel(item.kind)}</span>
        {item.source === "ai" && <Sparkles className="w-3 h-3 text-violet-400" />}
        {canEdit ? (
          <select
            value={item.status}
            onChange={(e) => onStatus(e.target.value as ContentItem["status"])}
            className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full mr-auto ml-5 border-0 cursor-pointer", st.color)}
          >
            {ITEM_STATUSES.map((s) => <option key={s.value} value={s.value} className="bg-background text-foreground">{s.label}</option>)}
          </select>
        ) : (
          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full mr-auto", st.color)}>{st.label}</span>
        )}
      </div>
      <button onClick={onOpen} className="block w-full text-right">
        <h4 className="text-sm font-bold text-foreground mb-1">{item.title || "بدون عنوان"}</h4>
        <StepsProgress steps={item.steps ?? []} />
        {item.idea && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.idea}</p>}
        {item.script && (
          <p className="text-[11px] text-foreground/70 line-clamp-3 bg-black/15 rounded-md p-2 whitespace-pre-wrap">{item.script}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          {item.platform && <span>{platformLabel(item.platform)}</span>}
          {item.publish_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.publish_date}{item.publish_time && ` · ${item.publish_time}`}</span>}
          {(item.timeline?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{item.timeline.length} مشاهد</span>}
          {(item.focus_points?.length ?? 0) > 0 && <span className="flex items-center gap-1"><Target className="w-3 h-3" />{item.focus_points.length} نقاط تركيز</span>}
          <span className="mr-auto text-violet-400 font-semibold flex items-center gap-1">
            {canEdit ? <><Pencil className="w-3 h-3" /> فتح وتعديل</> : <><Eye className="w-3 h-3" /> عرض</>}
          </span>
        </div>
      </button>
    </div>
  );
}

// ─── محرر العنصر ──────────────────────────────────────────────────────────────

function ItemEditor({ item, canEdit, api, stepTitles, onSaveSteps, onClose, onSave, onDelete }: {
  item: ContentItem; canEdit: boolean; api: ApiFn; stepTitles: string[];
  onSaveSteps: (steps: ContentStep[]) => Promise<ContentItem>;
  onClose: () => void; onSave: (i: ContentItem) => Promise<void>; onDelete: () => void;
}) {
  // عناصر قديمة قد لا تحمل الحقول الجديدة
  const base = useMemo<ContentItem>(
    () => ({ ...item, timeline: item.timeline ?? [], focus_points: item.focus_points ?? [], publish_time: item.publish_time ?? "", post_url: item.post_url ?? "" }),
    [item]
  );
  // المراحل تُحفظ فوراً عند كل تغيير، منفصلة عن نموذج الحفظ
  const [steps, setSteps] = useState<ContentStep[]>(item.steps ?? []);
  const changeSteps = async (next: ContentStep[]) => {
    const prev = steps;
    setSteps(next);
    try {
      const saved = await onSaveSteps(next);
      setSteps(saved.steps ?? next);
    } catch (e) {
      alert((e as Error).message);
      setSteps(prev);
    }
  };
  const [form, setForm] = useState<ContentItem>(base);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const scriptLabel = CONTENT_KINDS.find((k) => k.value === form.kind)?.scriptLabel ?? "السكربت";
  const set = <K extends keyof ContentItem>(k: K, v: ContentItem[K]) => setForm((f) => ({ ...f, [k]: v }));

  const writeScript = async () => {
    if (form.script.trim() && !instruction.trim() && !confirm("سيتم استبدال السكربت الحالي بنسخة محسّنة. متابعة؟")) return;
    setAiLoading(true);
    try {
      const res = await api<{ script: string; caption: string; timeline: TimelineRow[]; focus_points: string[] }>("/ai", {
        method: "POST",
        body: JSON.stringify({ mode: "script", item: form, instruction }),
      });
      setForm((f) => ({
        ...f,
        script: res.script || f.script,
        caption: res.caption || f.caption,
        timeline: res.timeline?.length ? res.timeline : f.timeline,
        focus_points: res.focus_points?.length ? res.focus_points : f.focus_points,
      }));
      setInstruction("");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1200); } catch { /* ignore */ }
  };

  const save = async () => {
    setSaving(true);
    // المراحل لها حفظها الخاص — لا نرسلها هنا حتى لا نرجّع حالة قديمة
    try { await onSave({ ...form, steps: undefined } as unknown as ContentItem); } catch (e) { alert((e as Error).message); setSaving(false); }
  };

  const dirty = JSON.stringify(form) !== JSON.stringify(base);
  const video = isVideoKind(form.kind);
  const close = () => { if (!dirty || confirm("فيه تعديلات غير محفوظة. إغلاق بدون حفظ؟")) onClose(); };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-3" onClick={close}>
      <div className="w-full max-w-3xl rounded-[14px] glass-surface border border-border p-5 my-6 space-y-4 hover:translate-y-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{canEdit ? "تعديل المحتوى" : "تفاصيل المحتوى"}</h3>
          <button onClick={close} className="p-1 rounded-lg hover:bg-white/[0.1] text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Field label="النوع">
            <select disabled={!canEdit} value={form.kind} onChange={(e) => set("kind", e.target.value as ContentKind)} className={inputCls}>
              {CONTENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </Field>
          <Field label="الحالة">
            <select disabled={!canEdit} value={form.status} onChange={(e) => set("status", e.target.value as ContentItem["status"])} className={inputCls}>
              {ITEM_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </Field>
          <Field label="المنصة">
            <select disabled={!canEdit} value={form.platform} onChange={(e) => set("platform", e.target.value)} className={inputCls}>
              <option value="">—</option>
              {PLATFORMS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </Field>
          <Field label="تاريخ النشر">
            <input type="date" disabled={!canEdit} value={form.publish_date ?? ""} onChange={(e) => set("publish_date", e.target.value || null)} className={inputCls} />
          </Field>
          <Field label="وقت النشر">
            <input type="time" disabled={!canEdit} value={form.publish_time} onChange={(e) => set("publish_time", e.target.value)} className={inputCls} />
          </Field>
        </div>

        <Field label="مراحل التنفيذ" action={<span className="text-[10px] text-muted-foreground">تُحفظ تلقائياً</span>}>
          <StepsTimeline steps={steps} canEdit={canEdit} defaultTitles={stepTitles} onChange={changeSteps} />
        </Field>

        <Field label="العنوان">
          <input disabled={!canEdit} value={form.title} onChange={(e) => set("title", e.target.value)} className={inputCls} />
        </Field>

        <Field label="الفكرة">
          <textarea disabled={!canEdit} rows={3} value={form.idea} onChange={(e) => set("idea", e.target.value)} className={cn(inputCls, "resize-y")} placeholder="وش الفكرة؟ وش الزاوية؟ وش الهدف منها؟" />
        </Field>

        <Field
          label={scriptLabel}
          action={
            form.script ? (
              <button onClick={() => copy("script", form.script)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                {copied === "script" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} نسخ
              </button>
            ) : null
          }
        >
          <textarea
            disabled={!canEdit}
            rows={10}
            value={form.script}
            onChange={(e) => set("script", e.target.value)}
            className={cn(inputCls, "resize-y leading-relaxed")}
            placeholder={form.kind === "video" || form.kind === "reel" ? "[المشهد 1] ...\n[صوت] ...\n[نص على الشاشة] ..." : "العنوان الرئيسي على التصميم...\n• نقطة\n• نقطة"}
          />
        </Field>

        {canEdit && (
          <div className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg bg-violet-500/5 border border-violet-500/15">
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              placeholder={form.script ? "تعليمات للتحسين: خلّه أقصر، أضف خطاف أقوى..." : "تعليمات اختيارية للذكاء الاصطناعي"}
              className={cn(inputCls, "flex-1")}
            />
            <button
              onClick={writeScript}
              disabled={aiLoading}
              className="shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-xs font-semibold disabled:opacity-60"
            >
              {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              {form.script ? "حسّن بالذكاء الاصطناعي" : "اكتب السكربت بالذكاء الاصطناعي"}
              {video && " + التايم لاين"}
            </button>
          </div>
        )}

        {video && (
          <>
            <Field
              label="التايم لاين"
              action={
                form.timeline.length ? (
                  <button onClick={() => copy("timeline", timelineToText(form.timeline))} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                    {copied === "timeline" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} نسخ
                  </button>
                ) : null
              }
            >
              <TimelineEditor rows={form.timeline} canEdit={canEdit} onChange={(rows) => set("timeline", rows)} />
            </Field>
            <Field label="نقاط التركيز أثناء التصوير">
              <FocusPointsEditor points={form.focus_points} canEdit={canEdit} onChange={(pts) => set("focus_points", pts)} />
            </Field>
          </>
        )}

        <Field
          label="الكابشن"
          action={
            form.caption ? (
              <button onClick={() => copy("caption", form.caption)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
                {copied === "caption" ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} نسخ
              </button>
            ) : null
          }
        >
          <textarea disabled={!canEdit} rows={3} value={form.caption} onChange={(e) => set("caption", e.target.value)} className={cn(inputCls, "resize-y")} />
        </Field>

        <Field
          label="رابط المنشور (بعد النشر)"
          action={
            form.post_url && /^https?:\/\//.test(form.post_url) ? (
              <a href={form.post_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300">
                <ExternalLink className="w-3 h-3" /> فتح
              </a>
            ) : null
          }
        >
          <input disabled={!canEdit} dir="ltr" value={form.post_url} onChange={(e) => set("post_url", e.target.value)} className={cn(inputCls, "text-left")} placeholder="https://..." />
        </Field>

        <div className="flex items-center gap-2 pt-1">
          {canEdit ? (
            <>
              <button onClick={save} disabled={saving || !dirty} className="px-5 py-2 rounded-lg bg-violet-500 text-white font-semibold text-sm hover:bg-violet-600 disabled:opacity-50">
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
              <button onClick={close} className="px-5 py-2 rounded-lg bg-white/[0.06] text-muted-foreground font-semibold text-sm">إلغاء</button>
              <button onClick={onDelete} className="mr-auto flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" /> حذف
              </button>
            </>
          ) : (
            <button onClick={onClose} className="px-5 py-2 rounded-lg bg-white/[0.06] text-muted-foreground font-semibold text-sm">إغلاق</button>
          )}
          {item.updated_by_name && (
            <span className="text-[10px] text-muted-foreground mr-auto">آخر تعديل: {item.updated_by_name}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── مراحل التنفيذ ────────────────────────────────────────────────────────────

const fmtStepTime = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long" });
  const time = d.toLocaleTimeString("ar-SA-u-ca-gregory", { hour: "numeric", minute: "2-digit" });
  return `${day}، ${time}`;
};

/** شريط تقدّم مختصر للبطاقة: كم مرحلة اكتملت + المرحلة الحالية. */
function StepsProgress({ steps }: { steps: ContentStep[] }) {
  if (!steps.length) return null;
  const done = steps.filter((s) => s.done).length;
  const current = steps.find((s) => !s.done);
  const pct = Math.round((done / steps.length) * 100);
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-[10px] mb-1">
        <span className="flex items-center gap-1 text-muted-foreground">
          <ListChecks className="w-3 h-3" />
          {current ? <>المرحلة الحالية: <b className="text-foreground">{current.title || "بدون اسم"}</b></> : <b className="text-emerald-400">اكتملت كل المراحل</b>}
        </span>
        <span className="font-mono text-muted-foreground">{done}/{steps.length}</span>
      </div>
      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", done === steps.length ? "bg-emerald-500" : "bg-violet-500")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/**
 * مراحل التنفيذ بشكل خط زمني عمودي: دائرة خضراء ✓ للمكتملة مع وقت الإكمال ومن أكملها،
 * والمرحلة الحالية مميّزة. كل مرحلة اسمها وملاحظتها نص حر، ويمكن الإضافة والحذف والترتيب.
 */
function StepsTimeline({ steps, canEdit, defaultTitles, onChange }: {
  steps: ContentStep[]; canEdit: boolean; defaultTitles: string[];
  onChange: (steps: ContentStep[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [noteOpen, setNoteOpen] = useState<string | null>(null);
  const currentId = steps.find((s) => !s.done)?.id;
  const done = steps.filter((s) => s.done).length;

  const patch = (id: string, p: Partial<ContentStep>) => onChange(steps.map((s) => (s.id === id ? { ...s, ...p } : s)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...steps, makeStep(t)]);
    setDraft("");
  };

  if (!steps.length && !canEdit) return <p className="text-xs text-muted-foreground">لا توجد مراحل تنفيذ</p>;

  return (
    <div className="rounded-[12px] bg-white/[0.02] border border-border p-4">
      {steps.length > 0 && (
        <div className="flex items-center justify-between mb-3 text-[11px]">
          <span className="text-muted-foreground">خطوات التنفيذ</span>
          <span className={cn("font-bold", done === steps.length ? "text-emerald-400" : "text-violet-300")}>
            {done === steps.length ? "مكتملة ✓" : `${done} من ${steps.length}`}
          </span>
        </div>
      )}

      {steps.length === 0 && canEdit && (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground mb-2">ما فيه مراحل لهذا المحتوى بعد</p>
          <button
            onClick={() => onChange(defaultTitles.map(makeStep))}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-xs font-semibold"
          >
            <ListChecks className="w-3.5 h-3.5" /> إضافة المراحل الافتراضية ({defaultTitles.length})
          </button>
        </div>
      )}

      <ol>
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const isCurrent = s.id === currentId;
          return (
            <li key={s.id} className="relative flex gap-3 group">
              {/* الخط الواصل بين المراحل */}
              {!last && (
                <span className={cn("absolute top-9 bottom-0 right-[15px] w-0.5", s.done ? "bg-emerald-600" : "bg-border")} />
              )}
              <button
                disabled={!canEdit}
                onClick={() => patch(s.id, { done: !s.done })}
                title={canEdit ? (s.done ? "إلغاء الإكمال" : "تعليم كمكتملة") : undefined}
                className={cn(
                  "relative z-10 shrink-0 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors",
                  s.done
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : isCurrent
                      ? "border-violet-400 bg-violet-500/10 text-violet-300"
                      : "border-border bg-background text-muted-foreground",
                  canEdit && !s.done && "hover:border-emerald-500 hover:text-emerald-400"
                )}
              >
                {s.done ? <Check className="w-4 h-4" strokeWidth={3} /> : <span className="text-[11px] font-bold">{i + 1}</span>}
              </button>

              <div className={cn("flex-1 min-w-0", last ? "pb-1" : "pb-5")}>
                <div className="flex items-start gap-2 min-h-8">
                  {canEdit && editingId === s.id ? (
                    <input
                      autoFocus
                      defaultValue={s.title}
                      onBlur={(e) => { setEditingId(null); if (e.target.value.trim() && e.target.value !== s.title) patch(s.id, { title: e.target.value.trim() }); }}
                      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); if (e.key === "Escape") setEditingId(null); }}
                      className="flex-1 rounded-md bg-white/[0.06] border border-border px-2 py-1 text-sm font-bold text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
                    />
                  ) : (
                    <button
                      disabled={!canEdit}
                      onClick={() => setEditingId(s.id)}
                      className={cn("flex-1 text-right text-sm font-bold pt-1.5 leading-snug",
                        s.done ? "text-foreground" : isCurrent ? "text-violet-200" : "text-foreground/70")}
                    >
                      {s.title || "بدون اسم"}
                      {isCurrent && <span className="mr-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 align-middle">الحالية</span>}
                    </button>
                  )}
                  {canEdit && (
                    <div className="flex items-center gap-0.5 pt-1 opacity-60 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => setNoteOpen(noteOpen === s.id ? null : s.id)} title="ملاحظة" className={cn("p-1 rounded hover:text-foreground", s.note ? "text-amber-400" : "text-muted-foreground")}>
                        <StickyNote className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => move(i, 1)} disabled={last} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
                      <button
                        onClick={() => (!s.done || confirm("حذف مرحلة مكتملة؟")) && onChange(steps.filter((x) => x.id !== s.id))}
                        className="p-1 rounded text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {s.done && s.done_at && (
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {fmtStepTime(s.done_at)}{s.done_by && <> · {s.done_by}</>}
                  </p>
                )}
                {noteOpen === s.id && canEdit ? (
                  <textarea
                    autoFocus
                    rows={2}
                    defaultValue={s.note}
                    onBlur={(e) => { setNoteOpen(null); if (e.target.value !== s.note) patch(s.id, { note: e.target.value }); }}
                    placeholder="ملاحظة على هذه المرحلة..."
                    className="mt-1.5 w-full rounded-md bg-white/[0.05] border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-y"
                  />
                ) : s.note ? (
                  <p className="text-[11px] text-amber-300/90 mt-1 whitespace-pre-wrap">{s.note}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>

      {canEdit && (
        <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="أضف مرحلة: مثال اعتماد العميل، تجهيز الموقع للتصوير..."
            className="flex-1 rounded-md bg-white/[0.05] border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          />
          <button onClick={add} disabled={!draft.trim()} className="flex items-center gap-1 px-3 rounded-md bg-violet-500/20 text-violet-300 text-xs font-semibold disabled:opacity-50">
            <Plus className="w-3.5 h-3.5" /> إضافة
          </button>
        </div>
      )}
    </div>
  );
}

// ─── جدول النشر ───────────────────────────────────────────────────────────────

/** عرض المحتوى مجمّعاً حسب تاريخ النشر (مرتب بالوقت)، وغير المجدول في الأسفل. */
function ScheduleView({ items, onOpen }: { items: ContentItem[]; onOpen: (i: ContentItem) => void }) {
  const today = new Date().toLocaleDateString("en-CA");
  const groups = useMemo(() => {
    const map = new Map<string, ContentItem[]>();
    for (const it of items) {
      const k = it.publish_date || "";
      map.set(k, [...(map.get(k) ?? []), it]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (!a ? 1 : !b ? -1 : a.localeCompare(b)))
      .map(([date, list]) => [date, list.sort((x, y) => (x.publish_time || "99").localeCompare(y.publish_time || "99"))] as const);
  }, [items]);

  const dayLabel = (d: string) =>
    new Date(d + "T00:00:00").toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="space-y-4">
      {groups.map(([date, list]) => (
        <div key={date || "none"}>
          <div className={cn("flex items-center gap-2 mb-2 text-xs font-bold",
            !date ? "text-muted-foreground" : date === today ? "text-emerald-400" : date < today ? "text-muted-foreground" : "text-foreground")}>
            <CalendarDays className="w-3.5 h-3.5" />
            {date ? dayLabel(date) : "بدون موعد نشر"}
            {date === today && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/20">اليوم</span>}
            <span className="text-muted-foreground font-normal">({list.length})</span>
          </div>
          <div className="space-y-1.5">
            {list.map((it) => {
              const S = KIND_STYLE[it.kind] ?? KIND_STYLE.video;
              const st = ITEM_STATUSES.find((x) => x.value === it.status) ?? ITEM_STATUSES[0];
              const steps = it.steps ?? [];
              const doneN = steps.filter((x) => x.done).length;
              return (
                <button
                  key={it.id}
                  onClick={() => onOpen(it)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white/[0.03] border border-border hover:border-violet-500/30 text-right transition-colors"
                >
                  <span className="w-12 shrink-0 text-center font-mono text-xs font-bold text-violet-300" dir="ltr">{it.publish_time || "—"}</span>
                  <span className={cn("w-7 h-7 shrink-0 rounded-lg flex items-center justify-center", S.color)}><S.icon className="w-3.5 h-3.5" /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-semibold text-foreground truncate">{it.title || "بدون عنوان"}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {kindLabel(it.kind)}{it.platform && ` · ${platformLabel(it.platform)}`}
                      {steps.length > 0 && ` · ${doneN}/${steps.length} مراحل`}
                    </span>
                  </span>
                  {it.post_url && <ExternalLink className="w-3.5 h-3.5 text-cyan-400 shrink-0" />}
                  <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0", st.color)}>{st.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── عناصر صغيرة ──────────────────────────────────────────────────────────────

function Field({ label, action, children }: { label: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-xs font-semibold text-muted-foreground">{label}</label>
        {action}
      </div>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
        active ? "bg-violet-500/20 text-violet-300 border-violet-500/40" : "bg-white/[0.03] text-muted-foreground border-border hover:text-foreground")}
    >
      {label}
    </button>
  );
}

// ─── تايم لاين الفيديو ونقاط التركيز ─────────────────────────────────────────

function timelineToText(rows: TimelineRow[]) {
  return rows
    .map((r) => [`⏱ ${r.time}`, r.shot && `🎬 ${r.shot}`, r.voice && `🎙 ${r.voice}`, r.text && `🔤 ${r.text}`].filter(Boolean).join("\n"))
    .join("\n\n");
}

/** يقترح وقت المشهد التالي بعد آخر مشهد (مثال: بعد "3-8ث" → "8-13ث"). */
function nextTime(rows: TimelineRow[]) {
  if (!rows.length) return "0-3ث";
  const m = rows[rows.length - 1].time.match(/(\d+)\D*$/);
  if (!m) return "";
  const start = Number(m[1]);
  return `${start}-${start + 5}ث`;
}

function TimelineEditor({ rows, canEdit, onChange }: { rows: TimelineRow[]; canEdit: boolean; onChange: (rows: TimelineRow[]) => void }) {
  const update = (i: number, k: keyof TimelineRow, v: string) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  if (!canEdit) {
    if (!rows.length) return <p className="text-xs text-muted-foreground">لا يوجد تايم لاين</p>;
    return (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="hidden sm:grid grid-cols-[70px_1fr_1fr_0.8fr] gap-2 px-3 py-1.5 bg-white/[0.04] text-[10px] font-bold text-muted-foreground">
          <span>الوقت</span><span>اللقطة</span><span>الكلام</span><span>نص على الشاشة</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[70px_1fr_1fr_0.8fr] gap-1 sm:gap-2 px-3 py-2 border-t border-border/50 text-xs first:border-t-0 sm:first:border-t">
            <span className="font-mono font-bold text-violet-300" dir="ltr">{r.time}</span>
            <span className="text-foreground whitespace-pre-wrap">{r.shot && <span className="sm:hidden text-muted-foreground">🎬 </span>}{r.shot}</span>
            <span className="text-foreground/90 whitespace-pre-wrap">{r.voice && <span className="sm:hidden text-muted-foreground">🎙 </span>}{r.voice}</span>
            <span className="text-amber-300/90 whitespace-pre-wrap">{r.text && <span className="sm:hidden text-muted-foreground">🔤 </span>}{r.text}</span>
          </div>
        ))}
      </div>
    );
  }

  const cell = "w-full rounded-md bg-white/[0.05] border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50 resize-y";
  return (
    <div className="space-y-2">
      {rows.length > 0 && (
        <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_0.8fr_52px] gap-2 px-1 text-[10px] font-bold text-muted-foreground">
          <span>الوقت</span><span>اللقطة / المشهد</span><span>الكلام / التعليق</span><span>نص على الشاشة</span><span />
        </div>
      )}
      {rows.map((r, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[80px_1fr_1fr_0.8fr_52px] gap-2 p-2 sm:p-0 rounded-lg bg-white/[0.02] sm:bg-transparent border border-border sm:border-0">
          <input value={r.time} onChange={(e) => update(i, "time", e.target.value)} placeholder="0-3ث" dir="ltr" className={cn(cell, "font-mono text-center")} />
          <textarea rows={2} value={r.shot} onChange={(e) => update(i, "shot", e.target.value)} placeholder="لقطة قريبة للجوال..." className={cell} />
          <textarea rows={2} value={r.voice} onChange={(e) => update(i, "voice", e.target.value)} placeholder="وش يقول المقدّم؟" className={cell} />
          <textarea rows={2} value={r.text} onChange={(e) => update(i, "text", e.target.value)} placeholder="نص يظهر على الشاشة" className={cell} />
          <div className="flex sm:flex-col items-center justify-end sm:justify-start gap-1">
            <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-1 rounded text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown className="w-3.5 h-3.5" /></button>
            <button onClick={() => onChange(rows.filter((_, idx) => idx !== i))} className="p-1 rounded text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
          </div>
        </div>
      ))}
      <button
        onClick={() => onChange([...rows, { time: nextTime(rows), shot: "", voice: "", text: "" }])}
        className="flex items-center gap-1 text-xs font-semibold text-violet-400 hover:text-violet-300"
      >
        <Plus className="w-3.5 h-3.5" /> إضافة مشهد
      </button>
    </div>
  );
}

function FocusPointsEditor({ points, canEdit, onChange }: { points: string[]; canEdit: boolean; onChange: (p: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...points, draft.trim()]);
    setDraft("");
  };

  return (
    <div className="space-y-1.5 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
      {points.length === 0 && !canEdit && <p className="text-xs text-muted-foreground">لا توجد نقاط تركيز</p>}
      {points.map((p, i) => (
        <div key={i} className="flex items-start gap-2 group">
          <Target className="w-3.5 h-3.5 text-amber-400 mt-1 shrink-0" />
          {canEdit ? (
            <>
              <input
                value={p}
                onChange={(e) => onChange(points.map((x, idx) => (idx === i ? e.target.value : x)))}
                className="flex-1 bg-transparent text-sm text-foreground focus:outline-none focus:bg-white/[0.04] rounded px-1"
              />
              <button onClick={() => onChange(points.filter((_, idx) => idx !== i))} className="p-0.5 text-muted-foreground hover:text-red-400 opacity-60 group-hover:opacity-100">
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <span className="text-sm text-foreground">{p}</span>
          )}
        </div>
      ))}
      {canEdit && (
        <div className="flex gap-2 pt-1">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="أضف نقطة تركيز: مثال وضّح الخطّاف في أول 3 ثواني"
            className="flex-1 rounded-md bg-white/[0.05] border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/50"
          />
          <button onClick={add} disabled={!draft.trim()} className="px-3 rounded-md bg-amber-500/20 text-amber-300 text-xs font-semibold disabled:opacity-50">إضافة</button>
        </div>
      )}
    </div>
  );
}
