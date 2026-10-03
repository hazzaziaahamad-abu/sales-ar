"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Sparkles, Plus, Trash2, Copy, Check, Link2, Video, Image as ImageIcon, Layers, Film, Smartphone,
  X, Loader2, RefreshCw, Pencil, Eye, Calendar, ChevronDown, ChevronUp, Wand2, FileText,
  Clock, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONTENT_KINDS, ITEM_STATUSES, PLAN_STATUSES, PLATFORMS, kindLabel, platformLabel, isVideoKind,
  type ContentItem, type ContentKind, type ContentPlan, type ContentSuggestion, type TimelineRow,
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

type PlanPayload = { plan: ContentPlan; items: ContentItem[]; canEdit: boolean; isOwner: boolean };

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

      {canEdit && <AIIdeasPanel api={api} onAdd={addItems} />}

      {/* العناصر */}
      <div className="glass-surface rounded-[14px] border border-border p-5 hover:translate-y-0">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex flex-wrap gap-1.5">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")} label={`الكل (${data.items.length})`} />
            {CONTENT_KINDS.map((k) => (
              <FilterChip key={k.value} active={filter === k.value} onClick={() => setFilter(k.value)} label={k.label} />
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

        {items.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm font-semibold">لا يوجد محتوى بعد</p>
            {canEdit && <p className="text-xs mt-1">أضف فيديو أو بوست، أو خلّ الذكاء الاصطناعي يقترح لك أفكار</p>}
          </div>
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
  const [form, setForm] = useState({
    description: plan.description, audience: plan.audience, related_product: plan.related_product,
    tone: plan.tone, platforms: plan.platforms ?? [],
  });
  const dirty =
    form.description !== plan.description || form.audience !== plan.audience ||
    form.related_product !== plan.related_product || form.tone !== plan.tone ||
    form.platforms.join() !== (plan.platforms ?? []).join();

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
      {canEdit && dirty && (
        <button onClick={() => onSave(form)} className="px-4 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-semibold hover:bg-violet-600">
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

function AIIdeasPanel({ api, onAdd }: { api: ApiFn; onAdd: (items: Partial<ContentItem>[]) => Promise<ContentItem[]> }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ContentKind | "">("");
  const [count, setCount] = useState(5);
  const [hint, setHint] = useState("");
  const [loading, setLoading] = useState(false);
  const [ideas, setIdeas] = useState<(ContentSuggestion & { added?: boolean })[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await api<{ ideas: ContentSuggestion[] }>("/ai", {
        method: "POST",
        body: JSON.stringify({ mode: "ideas", kind: kind || undefined, count, hint }),
      });
      setIdeas(res.ideas);
      setExpanded(null);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const add = async (list: number[]) => {
    try {
      await onAdd(list.map((i) => ({ ...ideas[i], source: "ai" as const, added: undefined })));
      setIdeas((prev) => prev.map((x, i) => (list.includes(i) ? { ...x, added: true } : x)));
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="glass-surface rounded-[14px] border border-violet-500/25 p-4 hover:translate-y-0">
      <button onClick={() => setOpen((v) => !v)} className="w-full flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Sparkles className="w-4 h-4 text-violet-400" /> ولّد أفكار بالذكاء الاصطناعي
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
            {loading ? "جاري التوليد..." : ideas.length ? "ولّد أفكار جديدة" : "ولّد الأفكار"}
          </button>

          {ideas.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">اقتراحات ({ideas.length}) — اختر اللي يعجبك وأضفه للخطة</p>
                {ideas.some((i) => !i.added) && (
                  <button
                    onClick={() => add(ideas.map((_, i) => i).filter((i) => !ideas[i].added))}
                    className="text-xs font-semibold text-violet-400 hover:text-violet-300"
                  >
                    إضافة الكل
                  </button>
                )}
              </div>
              {ideas.map((s, i) => {
                const S = KIND_STYLE[s.kind] ?? KIND_STYLE.video;
                return (
                  <div key={i} className={cn("p-3 rounded-lg border bg-white/[0.03]", s.added ? "border-emerald-500/30 opacity-70" : "border-border")}>
                    <div className="flex items-start gap-2">
                      <span className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", S.color)}><S.icon className="w-3.5 h-3.5" /></span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{kindLabel(s.kind)} · {s.idea}</p>
                        {expanded === i && (
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
                          <button onClick={() => add([i])} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-[11px] font-semibold">
                            <Plus className="w-3 h-3" /> إضافة
                          </button>
                        )}
                        <button onClick={() => setExpanded(expanded === i ? null : i)} className="text-[11px] text-muted-foreground hover:text-foreground">
                          {expanded === i ? "إخفاء التفاصيل" : "عرض السكربت"}
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
        {item.idea && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{item.idea}</p>}
        {item.script && (
          <p className="text-[11px] text-foreground/70 line-clamp-3 bg-black/15 rounded-md p-2 whitespace-pre-wrap">{item.script}</p>
        )}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
          {item.platform && <span>{platformLabel(item.platform)}</span>}
          {item.publish_date && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{item.publish_date}</span>}
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

function ItemEditor({ item, canEdit, api, onClose, onSave, onDelete }: {
  item: ContentItem; canEdit: boolean; api: ApiFn;
  onClose: () => void; onSave: (i: ContentItem) => Promise<void>; onDelete: () => void;
}) {
  // عناصر قديمة قد لا تحمل الحقول الجديدة
  const base = useMemo<ContentItem>(() => ({ ...item, timeline: item.timeline ?? [], focus_points: item.focus_points ?? [] }), [item]);
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
    try { await onSave(form); } catch (e) { alert((e as Error).message); setSaving(false); }
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
        </div>

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
