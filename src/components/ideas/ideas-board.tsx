"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, Plus, Search, Trash2, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { STICKER_KINDS, stickerKind, type IdeaSticker, type StickerKind } from "@/lib/idea-stickers";

const inputCls =
  "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-amber-400/40";

/** أشكال الاستكرات — نفس التصميم المعتمد (نجمة/فكرة خاطفة، ورقة ملاحظة، دائرة). */
const BOARD_CSS = `
.ib-canvas { display:flex; flex-wrap:wrap; gap:20px; padding:32px; background-color:#f8fafc; border-radius:16px; min-height:320px; }
.ib-sticker { position:relative; padding:20px; width:200px; min-height:180px; color:#1e293b;
  box-shadow:4px 6px 15px rgba(0,0,0,0.08); transition:transform .2s ease, opacity .2s ease; cursor:grab; text-align:right; }
.ib-sticker:hover { transform:scale(1.05) rotate(0deg) !important; z-index:10; }
.ib-sticker:active { cursor:grabbing; }
.ib-sticker.ib-dragging { opacity:.35; }
.ib-star { background-color:#fef08a; clip-path:polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%); }
.ib-note { background-color:#fbcfe8; border-radius:4px 20px 4px 4px; }
.ib-circle { background-color:#a7f3d0; border-radius:50%; width:210px; height:210px; min-height:0; padding:28px;
  display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; overflow:hidden; }
.ib-tag { font-size:12px; font-weight:600; opacity:.75; }
.ib-title { font-size:16px; font-weight:800; margin:6px 0 4px; line-height:1.35; word-break:break-word; }
.ib-body { font-size:13px; line-height:1.55; white-space:pre-wrap; word-break:break-word; opacity:.85;
  display:-webkit-box; -webkit-line-clamp:6; -webkit-box-orient:vertical; overflow:hidden; }
.ib-circle .ib-body { -webkit-line-clamp:3; }
.ib-by { font-size:10px; opacity:.55; margin-top:8px; }
`;

/** ميلان كل نوع كما في التصميم، مع عكس بسيط للتنويع بين الاستكرات المتجاورة. */
const TILT: Record<StickerKind, number> = { star: -2, note: 3, circle: -1 };
const tiltOf = (s: IdeaSticker, i: number) => (i % 2 ? -1 : 1) * TILT[s.kind];

type Draft = { kind: StickerKind; tag: string; title: string; body: string };
const emptyDraft = (kind: StickerKind = "star"): Draft => ({ kind, tag: stickerKind(kind).tag, title: "", body: "" });

export function IdeasBoard() {
  const [stickers, setStickers] = useState<IdeaSticker[]>([]);
  const [me, setMe] = useState<{ userId: string; isManager: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<StickerKind | "all">("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<IdeaSticker | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const orderBeforeDrag = useRef<string[]>([]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/idea-stickers", { cache: "no-store" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "تعذّر تحميل الأفكار");
      setStickers(json.stickers ?? []);
      setMe({ userId: json.userId, isManager: !!json.isManager });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const canEdit = (s: IdeaSticker) => !!me && (me.isManager || s.created_by === me.userId);

  const add = async () => {
    if (!draft.title.trim() && !draft.body.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/idea-stickers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "تعذّرت الإضافة");
      setStickers((p) => [...p, json.sticker]);
      setDraft(emptyDraft(draft.kind));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  const save = async (id: string, patch: Draft) => {
    const res = await fetch(`/api/idea-stickers/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "تعذّر الحفظ");
    setStickers((p) => p.map((s) => (s.id === id ? json.sticker : s)));
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه الفكرة؟")) return;
    const res = await fetch(`/api/idea-stickers/${id}`, { method: "DELETE" });
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "تعذّر الحذف");
    setStickers((p) => p.filter((s) => s.id !== id));
    setOpen(null);
  };

  // ─── السحب والإفلات: الترتيب يتغير مباشرة أثناء السحب ويُحفظ عند الإفلات ───
  const onDragStart = (id: string) => {
    orderBeforeDrag.current = stickers.map((s) => s.id);
    setDragId(id);
  };
  const onDragOver = (overId: string) => {
    if (!dragId || dragId === overId) return;
    setStickers((p) => {
      const from = p.findIndex((s) => s.id === dragId);
      const to = p.findIndex((s) => s.id === overId);
      if (from < 0 || to < 0) return p;
      const next = [...p];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };
  const onDragEnd = async () => {
    setDragId(null);
    const ids = stickers.map((s) => s.id);
    if (ids.join() === orderBeforeDrag.current.join()) return;
    const res = await fetch("/api/idea-stickers/reorder", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }),
    });
    if (!res.ok) load();
  };

  const visible = useMemo(() => {
    const q = query.trim();
    return stickers.filter(
      (s) => (filter === "all" || s.kind === filter) && (!q || `${s.tag} ${s.title} ${s.body} ${s.created_by_name ?? ""}`.includes(q))
    );
  }, [stickers, filter, query]);
  const filtering = filter !== "all" || !!query.trim();

  return (
    <div className="space-y-5">
      <style>{BOARD_CSS}</style>

      <div>
        <h1 className="text-2xl font-extrabold text-foreground flex items-center gap-2">
          <Lightbulb className="w-6 h-6 text-amber-400" />
          أفكار
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">لوحة أفكار الفريق — الصق فكرتك كاستكر، ورتّب اللوحة بالسحب والإفلات</p>
      </div>

      {/* إضافة استكر */}
      <div className="glass-surface rounded-[14px] border border-border p-4 space-y-3 hover:translate-y-0">
        <div className="flex flex-wrap items-center gap-2">
          {STICKER_KINDS.map((k) => (
            <button
              key={k.value}
              onClick={() => setDraft((d) => ({ ...d, kind: k.value, tag: d.tag === stickerKind(d.kind).tag ? k.tag : d.tag }))}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                draft.kind === k.value ? "border-amber-400/60 bg-amber-400/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              <span
                className={cn("w-3.5 h-3.5 inline-block", k.value === "circle" ? "rounded-full" : k.value === "note" ? "rounded-[2px_6px_2px_2px]" : "rounded-[3px]")}
                style={{ background: k.swatch }}
              />
              {k.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-2">
          <input value={draft.tag} onChange={(e) => setDraft({ ...draft, tag: e.target.value })} className={inputCls} placeholder="الوسم" maxLength={60} />
          <input
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onKeyDown={(e) => e.key === "Enter" && add()}
            className={inputCls}
            placeholder="عنوان الفكرة"
            maxLength={200}
          />
        </div>
        <textarea
          rows={2}
          value={draft.body}
          onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          className={cn(inputCls, "resize-y")}
          placeholder="تفاصيل بسيطة وسريعة للفكرة..."
        />
        <button
          onClick={add}
          disabled={adding || (!draft.title.trim() && !draft.body.trim())}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-400/20 text-amber-300 hover:bg-amber-400/30 border border-amber-400/20 text-sm font-semibold disabled:opacity-50"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} الصق الفكرة
        </button>
      </div>

      {/* الفلاتر */}
      {stickers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {([["all", "الكل"], ...STICKER_KINDS.map((k) => [k.value, k.label])] as [StickerKind | "all", string][]).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setFilter(v)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                filter === v ? "bg-amber-400/15 text-amber-300 border-amber-400/40" : "bg-white/[0.03] text-muted-foreground border-border hover:text-foreground"
              )}
            >
              {label} ({v === "all" ? stickers.length : stickers.filter((s) => s.kind === v).length})
            </button>
          ))}
          <div className="relative mr-auto w-full sm:w-56">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث في الأفكار" className={cn(inputCls, "pr-8 py-1.5")} />
          </div>
        </div>
      )}

      {/* اللوحة */}
      {loading ? (
        <div className="h-64 rounded-2xl bg-white/[0.04] animate-pulse" />
      ) : error ? (
        <p className="text-center py-16 text-muted-foreground">{error}</p>
      ) : visible.length === 0 ? (
        <div className="ib-canvas items-center justify-center">
          <p className="text-slate-500 text-sm">{filtering ? "ما فيه أفكار تطابق البحث" : "اللوحة فاضية — الصق أول فكرة 💡"}</p>
        </div>
      ) : (
        <div className="ib-canvas">
          {visible.map((s, i) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              draggable={!filtering}
              onDragStart={() => onDragStart(s.id)}
              onDragOver={(e) => { e.preventDefault(); onDragOver(s.id); }}
              onDragEnd={onDragEnd}
              onClick={() => setOpen(s)}
              onKeyDown={(e) => e.key === "Enter" && setOpen(s)}
              className={cn("ib-sticker", `ib-${s.kind}`, dragId === s.id && "ib-dragging")}
              style={{ transform: `rotate(${tiltOf(s, i)}deg)` }}
            >
              {s.tag && <span className="ib-tag">{s.tag}</span>}
              {s.title && <h3 className="ib-title">{s.title}</h3>}
              {s.body && <p className="ib-body">{s.body}</p>}
              {s.created_by_name && <p className="ib-by">— {s.created_by_name}</p>}
            </div>
          ))}
        </div>
      )}
      {filtering && visible.length > 0 && <p className="text-[11px] text-muted-foreground">الترتيب بالسحب متاح لما تعرض الكل بدون بحث</p>}

      {open && (
        <StickerDialog
          sticker={open}
          canEdit={canEdit(open)}
          onClose={() => setOpen(null)}
          onSave={async (d) => { await save(open.id, d); setOpen(null); }}
          onDelete={() => remove(open.id)}
        />
      )}
    </div>
  );
}

function StickerDialog({ sticker, canEdit, onClose, onSave, onDelete }: {
  sticker: IdeaSticker; canEdit: boolean;
  onClose: () => void; onSave: (d: Draft) => Promise<void>; onDelete: () => void;
}) {
  const [form, setForm] = useState<Draft>({ kind: sticker.kind, tag: sticker.tag, title: sticker.title, body: sticker.body });
  const [saving, setSaving] = useState(false);
  const dirty = form.kind !== sticker.kind || form.tag !== sticker.tag || form.title !== sticker.title || form.body !== sticker.body;

  const submit = async () => {
    setSaving(true);
    try { await onSave(form); } catch (e) { alert((e as Error).message); setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3" onClick={onClose}>
      <div className="w-full max-w-md rounded-[14px] glass-surface border border-border p-5 space-y-3 hover:translate-y-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground">{canEdit ? "تعديل الفكرة" : "الفكرة"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.1] text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            {STICKER_KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => setForm((f) => ({ ...f, kind: k.value, tag: f.tag === stickerKind(f.kind).tag ? k.tag : f.tag }))}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border",
                  form.kind === k.value ? "border-amber-400/60 bg-amber-400/10 text-foreground" : "border-border text-muted-foreground"
                )}
              >
                <span className={cn("w-3 h-3 inline-block", k.value === "circle" ? "rounded-full" : "rounded-[3px]")} style={{ background: k.swatch }} />
                {k.label}
              </button>
            ))}
          </div>
        )}
        <input disabled={!canEdit} value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} className={inputCls} placeholder="الوسم" maxLength={60} />
        <input disabled={!canEdit} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={cn(inputCls, "font-bold")} placeholder="عنوان الفكرة" maxLength={200} />
        <textarea disabled={!canEdit} rows={5} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} className={cn(inputCls, "resize-y")} placeholder="التفاصيل" />
        <p className="text-[11px] text-muted-foreground">
          {sticker.created_by_name ? `أضافها ${sticker.created_by_name} · ` : ""}
          {new Date(sticker.created_at).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long", year: "numeric" })}
        </p>
        <div className="flex items-center gap-2 pt-1">
          {canEdit ? (
            <>
              <button
                onClick={submit}
                disabled={saving || !dirty || (!form.title.trim() && !form.body.trim())}
                className="px-5 py-2 rounded-lg bg-amber-400 text-slate-900 font-semibold text-sm hover:bg-amber-300 disabled:opacity-50"
              >
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
              <button onClick={onDelete} className="mr-auto flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" /> حذف
              </button>
            </>
          ) : (
            <button onClick={onClose} className="px-5 py-2 rounded-lg bg-white/[0.06] text-muted-foreground font-semibold text-sm">إغلاق</button>
          )}
        </div>
      </div>
    </div>
  );
}
