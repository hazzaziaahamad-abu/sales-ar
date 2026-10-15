"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Marhey } from "next/font/google";
import { Heart, Search, Trash2, X, Loader2, Dices, Sparkles, GripVertical, Check, CalendarClock, Plus, Rocket, Trophy, BellRing, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { IdeaSlicesPanel, QuickCapture, SliceChip, TodaySlices, useSlices } from "@/components/ideas/slices";
import { STICKER_KINDS, isReminder, stickerKind, timelineOf, type IdeaSticker, type StickerKind, type TimelineStep } from "@/lib/idea-stickers";

// خط يدوي مرح للاستكرات — يعطي إحساس الكتابة بالقلم على ورق لاصق.
const hand = Marhey({ subsets: ["arabic"], weight: ["400", "600", "700"], display: "swap", variable: "--font-hand" });

/**
 * لوحة «أفكار» — استوديو ورقي: لوحة منقّطة فاتحة، استكرات بأشرطة لاصقة ودبابيس،
 * محرر يكتب على الاستكر نفسه، إعجابات، وزر «فاجئني» يسلّط الضوء على فكرة عشوائية.
 */
const CSS = `
.ib-root { --hand: var(--font-hand), var(--font-sans), sans-serif; }
.ib-hand { font-family: var(--hand); }

/* ─── الهيرو ─── */
.ib-hero { position:relative; overflow:hidden; border-radius:22px; padding:28px 28px 24px;
  background:
    radial-gradient(600px 220px at 85% -20%, rgba(250,204,21,.22), transparent 70%),
    radial-gradient(500px 260px at 5% 120%, rgba(244,114,182,.16), transparent 70%),
    radial-gradient(400px 200px at 45% 140%, rgba(52,211,153,.14), transparent 70%),
    linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));
  border:1px solid rgba(255,255,255,.08); }
.ib-bulb { filter: drop-shadow(0 0 18px rgba(250,204,21,.55)); animation: ib-flicker 5s ease-in-out infinite; }
@keyframes ib-flicker { 0%,100%{opacity:1} 46%{opacity:1} 48%{opacity:.55} 50%{opacity:1} 52%{opacity:.75} 54%{opacity:1} }
.ib-squiggle path { stroke-dasharray: 260; stroke-dashoffset: 260; animation: ib-draw 1.2s .3s ease forwards; }
@keyframes ib-draw { to { stroke-dashoffset: 0; } }
.ib-stat { border-radius:14px; padding:10px 14px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.07); min-width:96px; }

/* ─── اللوحة ─── */
.ib-board { position:relative; border-radius:22px; padding:44px 28px 56px; min-height:380px;
  background-color:#f8fafc;
  background-image: radial-gradient(#cbd5e1 1.1px, transparent 1.2px);
  background-size: 22px 22px;
  box-shadow: inset 0 0 0 1px rgba(15,23,42,.06), inset 0 30px 60px -30px rgba(15,23,42,.12), 0 30px 60px -30px rgba(0,0,0,.6); }
.ib-board::before { content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background: radial-gradient(1200px 500px at 50% 0%, rgba(255,255,255,.7), transparent 60%); }
.ib-grid { position:relative; display:flex; flex-wrap:wrap; gap:34px 26px; justify-content:center; align-items:flex-start; }

/* ─── الاستكر ─── */
.ib-slot { position:relative; transition: transform .25s cubic-bezier(.2,.8,.2,1.2); }
.ib-slot.ib-new { animation: ib-slap .55s cubic-bezier(.2,.9,.25,1.25) both; }
@keyframes ib-slap { 0% { transform: translateY(-40px) scale(1.35) rotate(-14deg); opacity:0; } 60% { opacity:1; } 100% { transform:none; } }
.ib-sticker { position:relative; width:212px; min-height:196px; cursor:pointer; text-align:right;
  transition: transform .25s cubic-bezier(.2,.8,.2,1.2), filter .25s ease;
  filter: drop-shadow(3px 6px 6px rgba(15,23,42,.14)) drop-shadow(1px 2px 1px rgba(15,23,42,.08)); }
.ib-slot:hover .ib-sticker, .ib-sticker.ib-lifted { transform: translateY(-6px) scale(1.05) rotate(0deg) !important;
  filter: drop-shadow(8px 18px 16px rgba(15,23,42,.2)) drop-shadow(1px 2px 1px rgba(15,23,42,.08)); z-index:10; }
.ib-slot.ib-dragging .ib-sticker { opacity:.3; }
.ib-paper { position:relative; height:100%; min-height:inherit; padding:26px 20px 16px; display:flex; flex-direction:column; }

.ib-star .ib-paper { background: linear-gradient(165deg, #fef9c3 0%, #fef08a 45%, #fde047 140%);
  clip-path: polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%); }
.ib-note .ib-paper { background:
    repeating-linear-gradient(180deg, transparent 0 25px, rgba(190,24,93,.09) 25px 26px),
    linear-gradient(170deg, #fdf2f8 0%, #fbcfe8 60%, #f9a8d4 160%);
  background-position: 0 30px, 0 0;
  border-radius: 4px 22px 4px 4px; }
.ib-note .ib-paper::after { content:""; position:absolute; left:0; bottom:0; width:30px; height:30px;
  background: linear-gradient(45deg, #f8fafc 50%, #f5a3c7 50%, #fbcfe8 100%);
  border-top-right-radius: 6px; box-shadow: 2px -2px 4px rgba(131,24,67,.12); }
.ib-circle { width:220px; height:220px; min-height:0; }
.ib-circle .ib-paper { border-radius:50%; aspect-ratio:1; padding:34px 30px; align-items:center; justify-content:center; text-align:center;
  background: radial-gradient(circle at 32% 26%, #ecfdf5 0%, #a7f3d0 52%, #6ee7b7 120%); overflow:hidden; }
.ib-circle .ib-paper::before { content:""; position:absolute; inset:9px; border-radius:50%; border:1.5px dashed rgba(6,78,59,.22); pointer-events:none; }

/* شريط لاصق على الفكرة الخاطفة */
.ib-tape { position:absolute; top:-11px; left:50%; width:84px; height:24px; transform:translateX(-50%) rotate(-4deg); z-index:3;
  background: linear-gradient(180deg, rgba(255,255,255,.75), rgba(241,245,249,.55));
  border-left:2px dotted rgba(148,163,184,.35); border-right:2px dotted rgba(148,163,184,.35);
  box-shadow: 0 1px 2px rgba(15,23,42,.08); }
/* دبوس */
.ib-pin { position:absolute; top:-9px; left:50%; width:20px; height:20px; margin-left:-10px; border-radius:50%; z-index:3;
  background: radial-gradient(circle at 35% 30%, #fff 0 2px, var(--pin) 3px 100%);
  box-shadow: 0 4px 5px -1px rgba(15,23,42,.35), inset -2px -3px 4px rgba(0,0,0,.18); transition: transform .3s ease; }
.ib-slot:hover .ib-pin { animation: ib-wiggle .5s ease; }
@keyframes ib-wiggle { 25%{transform:rotate(-14deg)} 60%{transform:rotate(10deg)} 100%{transform:none} }

.ib-stamp { position:absolute; top:10px; left:10px; z-index:4; padding:2px 10px; border-radius:6px; transform:rotate(-12deg);
  font-family: var(--hand); font-weight:700; font-size:14px; color:#047857; border:2px solid #059669; background:rgba(236,253,245,.75); }
.ib-tag { font-size:12px; font-weight:600; opacity:.7; }
.ib-title { font-family: var(--hand); font-size:19px; font-weight:700; line-height:1.4; margin:6px 0 4px; word-break:break-word; }
.ib-body { font-family: var(--hand); font-size:14px; line-height:1.65; white-space:pre-wrap; word-break:break-word; opacity:.86;
  display:-webkit-box; -webkit-line-clamp:5; -webkit-box-orient:vertical; overflow:hidden; }
.ib-circle .ib-body { -webkit-line-clamp:3; font-size:13px; }
.ib-circle .ib-title { font-size:17px; }
.ib-foot { margin-top:auto; padding-top:10px; display:flex; align-items:center; gap:6px; font-size:11px; }
.ib-circle .ib-foot { margin-top:8px; justify-content:center; }
.ib-avatar { width:20px; height:20px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center;
  font-family: var(--font-sans), sans-serif; font-size:10px; font-weight:800; background:rgba(255,255,255,.65); }
.ib-like { display:inline-flex; align-items:center; gap:3px; padding:2px 7px; border-radius:999px; background:rgba(255,255,255,.55);
  font-weight:700; transition: transform .15s ease, background .15s ease; }
.ib-like:hover { background:rgba(255,255,255,.85); transform:scale(1.08); }
.ib-like.ib-on svg { animation: ib-pop .35s ease; }
@keyframes ib-pop { 40% { transform:scale(1.5); } }
.ib-grip { position:absolute; top:8px; right:8px; opacity:0; transition:opacity .2s; z-index:4; }
.ib-slot:hover .ib-grip { opacity:.45; }

/* تسليط الضوء (فاجئني) */
.ib-spot .ib-sticker { animation: ib-spot 1.6s ease 2; }
@keyframes ib-spot { 0%,100% { filter: drop-shadow(0 0 0 rgba(250,204,21,0)); }
  50% { filter: drop-shadow(0 0 22px rgba(250,204,21,.95)) drop-shadow(0 0 6px rgba(250,204,21,.9)); transform: scale(1.1) rotate(0deg); } }

/* ─── الكتابة على الاستكر نفسه ─── */
.ib-field { width:100%; background:transparent; border:0; outline:none; color:inherit; resize:none; text-align:inherit; }
.ib-field::placeholder { color: currentColor; opacity:.38; }
.ib-field:focus { background: rgba(255,255,255,.28); border-radius:6px; }
.ib-pad { position:relative; width:150px; height:46px; border-radius:10px; cursor:pointer; transition: transform .2s ease;
  box-shadow: 0 3px 0 -1px rgba(0,0,0,.08), 0 6px 0 -2px rgba(0,0,0,.06), 0 9px 0 -3px rgba(0,0,0,.05); }
.ib-pad:hover { transform: translateY(-3px) rotate(-2deg); }
.ib-pad.ib-active { transform: translateY(-4px) rotate(-3deg); outline: 2px solid rgba(250,204,21,.8); outline-offset: 3px; }
/* الجوال: استكرات أصغر — عمودين في الصف */
@media (max-width: 640px) {
  .ib-board { padding:30px 10px 40px; }
  .ib-grid { gap:26px 10px; }
  .ib-grid .ib-sticker { width:146px; min-height:150px; }
  .ib-grid .ib-circle { width:150px; height:150px; }
  .ib-grid .ib-paper { padding:20px 13px 11px; }
  .ib-grid .ib-circle .ib-paper { padding:24px 20px; }
  .ib-grid .ib-title { font-size:15px; }
  .ib-grid .ib-body { font-size:12px; -webkit-line-clamp:4; }
  .ib-grid .ib-circle .ib-body { -webkit-line-clamp:2; }
  .ib-grid .ib-tag { font-size:10px; }
  .ib-grid .ib-foot { font-size:10px; }
  .ib-grid .ib-tape { width:62px; height:20px; }
  .ib-pad { width:auto; height:40px; padding:0 14px; font-size:12px; }
}
/* ─── تقدّم التنفيذ على الاستكر ─── */
.ib-prog { display:inline-flex; align-items:center; gap:4px; padding:2px 7px; border-radius:999px; background:rgba(255,255,255,.55); font-weight:700; white-space:nowrap; }
.ib-prog.ib-late { background:#fee2e2; color:#b91c1c; }
.ib-prog.ib-done { background:#d1fae5; color:#065f46; }
.ib-meter { width:26px; height:4px; border-radius:99px; background:rgba(0,0,0,.12); overflow:hidden; }
.ib-meter > i { display:block; height:100%; border-radius:inherit; background:currentColor; }
@media (max-width: 640px) { .ib-grid .ib-meter { display:none; } }

/* ─── تايم لاين التنفيذ (نافذة الفكرة) ─── */
.tl-row { position:relative; display:flex; gap:12px; padding-bottom:16px; }
.tl-row:last-child { padding-bottom:0; }
.tl-row::before { content:""; position:absolute; top:28px; bottom:-2px; right:13px; width:2px; background:rgba(255,255,255,.09); }
.tl-row:last-child::before { display:none; }
.tl-row.tl-done::before { background:#059669; }
.tl-dot { position:relative; z-index:1; flex-shrink:0; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center;
  border:2px solid rgba(255,255,255,.18); background:rgba(255,255,255,.03); color:#fff; transition: transform .15s ease, background .2s ease; }
.tl-done .tl-dot { background:#059669; border-color:#059669; }
.tl-next .tl-dot { border-color:#60a5fa; box-shadow:0 0 0 4px rgba(96,165,250,.15); }
button.tl-dot:not(:disabled):hover { transform:scale(1.1); }
.tl-del { opacity:0; transition:opacity .15s; }
.tl-row:hover .tl-del { opacity:.6; }
@media (hover:none) { .tl-del { opacity:.45; } }

.ib-cta { background: linear-gradient(135deg, #facc15, #f472b6 55%, #34d399); color:#1e1b16; }
.ib-cta:hover { filter: brightness(1.08) saturate(1.1); }
`;

const PIN: Record<StickerKind, string> = { star: "#f97316", note: "#e11d48", circle: "#0d9488" };
const TILT: Record<StickerKind, number> = { star: -2, note: 3, circle: -1 };

/** قيمة ثابتة لكل استكر (من معرّفه) — للميلان والإزاحة العضوية بدون ما تتغير مع كل تحميل. */
const seed = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
};
const tiltOf = (s: { id: string; kind: StickerKind }) => TILT[s.kind] * (seed(s.id) % 2 ? -1 : 1) + ((seed(s.id) >> 3) % 3) - 1;
const dropOf = (id: string) => (seed(id) >> 5) % 22;

type Draft = { kind: StickerKind; tag: string; title: string; body: string };
type Sort = "board" | "likes" | "new";
type View = "board" | "done";
/** تذكير مكتمل — مكانه لوحة «المنجزات» لا اللوحة الرئيسية. */
const isDone = (s: IdeaSticker) => isReminder(s) && !!s.completed_at;
const emptyDraft = (kind: StickerKind = "star"): Draft => ({ kind, tag: stickerKind(kind).tag, title: "", body: "" });
const initial = (name?: string | null) => (name ?? "").trim().charAt(0) || "؟";
const swapKind = (d: Draft, kind: StickerKind): Draft => ({ ...d, kind, tag: d.tag === stickerKind(d.kind).tag ? stickerKind(kind).tag : d.tag });

export function IdeasBoard() {
  const [stickers, setStickers] = useState<IdeaSticker[]>([]);
  const [me, setMe] = useState<{ userId: string; isManager: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [adding, setAdding] = useState(false);
  const [filter, setFilter] = useState<StickerKind | "all">("all");
  const [sort, setSort] = useState<Sort>("board");
  const [view, setView] = useState<View>("board");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<IdeaSticker | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  const [spotId, setSpotId] = useState<string | null>(null);
  const orderBeforeDrag = useRef<string[]>([]);
  const slotRefs = useRef(new Map<string, HTMLDivElement>());
  const slices = useSlices("ideas");
  // الورقة المفصّلة (نوع ووسم وتفاصيل) مطوية افتراضياً — الالتقاط السريع يكفي غالباً
  const [detailed, setDetailed] = useState(false);
  useEffect(() => {
    try { setDetailed(localStorage.getItem("ib_detailed") === "1"); } catch { /* ignore */ }
  }, []);
  const toggleDetailed = () => setDetailed((v) => {
    try { localStorage.setItem("ib_detailed", v ? "0" : "1"); } catch { /* ignore */ }
    return !v;
  });

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
  const replace = (s: IdeaSticker) => setStickers((p) => p.map((x) => (x.id === s.id ? s : x)));

  /** لصق استكر — من الورقة المفصّلة أو من الالتقاط السريع (سطر واحد بدون تصنيف). */
  const add = async (quick?: string) => {
    const payload = quick !== undefined ? emptyDraft("star") : draft;
    if (quick !== undefined) payload.title = quick;
    if (!payload.title.trim() && !payload.body.trim()) return false;
    setAdding(true);
    try {
      const res = await fetch("/api/idea-stickers", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "تعذّرت الإضافة");
      setStickers((p) => [...p, json.sticker]);
      setFreshId(json.sticker.id);
      if (quick === undefined) setDraft(emptyDraft(draft.kind));
      setFilter("all");
      setQuery("");
      setView("board");
      setTimeout(() => slotRefs.current.get(json.sticker.id)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
      return true;
    } catch (e) {
      alert((e as Error).message);
      return false;
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
    replace(json.sticker);
  };

  const remove = async (id: string) => {
    if (!confirm("حذف هذه الفكرة من اللوحة؟")) return;
    const res = await fetch(`/api/idea-stickers/${id}`, { method: "DELETE" });
    if (!res.ok) return alert((await res.json().catch(() => ({}))).error || "تعذّر الحذف");
    setStickers((p) => p.filter((s) => s.id !== id));
    setOpen(null);
  };

  const toggleLike = async (s: IdeaSticker) => {
    if (!me) return;
    const liked = (s.likes ?? []).includes(me.userId);
    const optimistic = { ...s, likes: liked ? s.likes.filter((u) => u !== me.userId) : [...(s.likes ?? []), me.userId] };
    replace(optimistic);
    setOpen((o) => (o?.id === s.id ? optimistic : o));
    const res = await fetch(`/api/idea-stickers/${s.id}/like`, { method: "POST" });
    const json = await res.json().catch(() => ({}));
    if (res.ok) replace(json.sticker);
    else replace(s);
  };

  /** تحديث تايم لاين التنفيذ — يرجع الاستكر المحدّث ويحدّث اللوحة والنافذة. */
  const updateTimeline = async (id: string, body: Record<string, unknown>) => {
    const res = await fetch(`/api/idea-stickers/${id}/timeline`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || "تعذّر تحديث التنفيذ");
    replace(json.sticker);
    setOpen((o) => (o?.id === id ? json.sticker : o));
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

  const onBoard = useMemo(() => stickers.filter((s) => !isDone(s)), [stickers]);
  const doneCount = stickers.length - onBoard.length;

  const visible = useMemo(() => {
    const q = query.trim();
    const matches = (s: IdeaSticker) => !q || `${s.tag} ${s.title} ${s.body} ${s.created_by_name ?? ""}`.includes(q);
    if (view === "done") {
      return stickers.filter((s) => isDone(s) && matches(s)).sort((a, b) => b.completed_at!.localeCompare(a.completed_at!));
    }
    const list = onBoard.filter((s) => (filter === "all" || s.kind === filter) && matches(s));
    if (sort === "likes") return [...list].sort((a, b) => (b.likes?.length ?? 0) - (a.likes?.length ?? 0));
    if (sort === "new") return [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
    return list;
  }, [stickers, onBoard, filter, query, sort, view]);
  const canDrag = view === "board" && filter === "all" && !query.trim() && sort === "board";

  const surprise = () => {
    if (!visible.length) return;
    const pick = visible[Math.floor(Math.random() * visible.length)];
    setSpotId(null);
    requestAnimationFrame(() => setSpotId(pick.id));
    slotRefs.current.get(pick.id)?.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => setSpotId((x) => (x === pick.id ? null : x)), 3400);
  };

  const stats = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86_400_000;
    const top = [...stickers].sort((a, b) => (b.likes?.length ?? 0) - (a.likes?.length ?? 0))[0];
    const people = new Set(stickers.map((s) => s.created_by).filter(Boolean)).size;
    return {
      total: stickers.length,
      week: stickers.filter((s) => new Date(s.created_at).getTime() > weekAgo).length,
      people,
      top: top && (top.likes?.length ?? 0) > 0 ? top : null,
    };
  }, [stickers]);

  return (
    <div className={cn("ib-root space-y-6", hand.variable)}>
      <style>{CSS}</style>

      {/* ─── الهيرو ─── */}
      <section className="ib-hero">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex items-start gap-4">
            <BulbArt />
            <div>
              <h1 className="ib-hand text-4xl sm:text-5xl font-bold text-foreground leading-tight">
                أفكار
                <svg className="ib-squiggle block -mt-1" width="150" height="16" viewBox="0 0 150 16" fill="none" aria-hidden>
                  <path d="M3 10 C 22 2, 34 15, 52 8 S 84 2, 100 9 S 132 14, 147 5" stroke="#facc15" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </h1>
              <p className="text-muted-foreground text-sm mt-2">كل فكرة كبيرة بدأت باستكر صغير — الصقها، وخلّ الفريق يكمّلها</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Stat label="فكرة على اللوحة" value={stats.total} />
            <Stat label="هذا الأسبوع" value={stats.week} accent="text-amber-300" />
            <Stat label="مساهم" value={stats.people} accent="text-emerald-300" />
            {stats.top && (
              <button onClick={() => { setSort("board"); setFilter("all"); setQuery(""); setOpen(stats.top); }} className="ib-stat text-right max-w-[200px] hover:bg-white/[0.07]">
                <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Heart className="w-3 h-3 fill-rose-400 text-rose-400" /> الأكثر حباً</p>
                <p className="ib-hand text-sm font-bold text-foreground truncate">{stats.top.title || stats.top.body}</p>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ─── الالتقاط السريع + شرائح اليوم ─── */}
      <QuickCapture onAdd={(t) => add(t)} detailed={detailed} onToggleDetailed={toggleDetailed} />
      <TodaySlices
        api={slices}
        parentTitle={(id) => { const s = stickers.find((x) => x.id === id); return s ? s.title || s.body.slice(0, 60) || "فكرة" : "فكرة محذوفة"; }}
        onOpenParent={(id) => { const s = stickers.find((x) => x.id === id); if (s) setOpen(s); }}
      />

      {/* ─── الصق فكرة: الكتابة على الاستكر نفسه ─── */}
      {detailed && (
      <section className="glass-surface rounded-[22px] border border-border p-5 hover:translate-y-0">
        <div className="flex flex-col lg:flex-row gap-6 items-center lg:items-stretch">
          <div className="flex lg:flex-col gap-2.5 sm:gap-3 justify-center lg:justify-start flex-wrap">
            <p className="hidden lg:block text-xs font-semibold text-muted-foreground mb-1">اختر الورقة</p>
            {STICKER_KINDS.map((k) => (
              <button
                key={k.value}
                onClick={() => setDraft((d) => swapKind(d, k.value))}
                className={cn("ib-pad flex items-center justify-center gap-2 text-sm font-bold", draft.kind === k.value && "ib-active",
                  k.value === "circle" && "rounded-full")}
                style={{ background: k.swatch, color: k.ink }}
              >
                {k.tag}
              </button>
            ))}
          </div>

          <div className="flex-1 flex flex-col sm:flex-row items-center justify-center gap-6 py-3">
            <div className="ib-slot" style={{ transform: "rotate(-1.5deg)" }}>
              <StickerShape kind={draft.kind} className="ib-lifted">
                <input
                  value={draft.tag}
                  onChange={(e) => setDraft({ ...draft, tag: e.target.value })}
                  className="ib-field ib-tag"
                  placeholder="الوسم"
                  maxLength={60}
                />
                <textarea
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }}
                  rows={2}
                  className="ib-field ib-title"
                  placeholder="اكتب فكرتك هنا..."
                  maxLength={200}
                  autoFocus
                />
                <textarea
                  value={draft.body}
                  onChange={(e) => setDraft({ ...draft, body: e.target.value })}
                  rows={draft.kind === "circle" ? 2 : 3}
                  className="ib-field ib-body"
                  style={{ display: "block" }}
                  placeholder="تفاصيل بسيطة وسريعة..."
                />
              </StickerShape>
            </div>
            <div className="flex flex-col items-center sm:items-start gap-2 max-w-[220px] text-center sm:text-right">
              <p className="ib-hand text-lg text-foreground">اكتب على الورقة مباشرة ✍️</p>
              <p className="hidden sm:block text-xs text-muted-foreground">Enter للصق السريع · Shift+Enter لسطر جديد</p>
              <button
                onClick={() => add()}
                disabled={adding || (!draft.title.trim() && !draft.body.trim())}
                className="ib-cta mt-2 flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-extrabold shadow-lg shadow-amber-500/10 disabled:opacity-40 disabled:saturate-0 transition"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} الصق على اللوحة
              </button>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* ─── شريط الأدوات ─── */}
      {stickers.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {([["all", "الكل", "conic-gradient(#fef08a 0 33%, #fbcfe8 0 66%, #a7f3d0 0)"], ...STICKER_KINDS.map((k) => [k.value, k.label, k.swatch])] as [StickerKind | "all", string, string][]).map(([v, label, color]) => (
            <button
              key={v}
              onClick={() => { setFilter(v); setView("board"); }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
                view === "board" && filter === v ? "bg-white/[0.09] text-foreground border-white/20" : "bg-white/[0.02] text-muted-foreground border-border hover:text-foreground"
              )}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
              {label}
              <span className="opacity-60">{v === "all" ? onBoard.length : onBoard.filter((s) => s.kind === v).length}</span>
            </button>
          ))}
          <button
            onClick={() => setView("done")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors",
              view === "done" ? "bg-emerald-500/15 text-emerald-300 border-emerald-400/30" : "bg-white/[0.02] text-muted-foreground border-border hover:text-foreground"
            )}
            title="التذكيرات المكتملة"
          >
            <Trophy className="w-3.5 h-3.5" />
            المنجزات
            <span className="opacity-60">{doneCount}</span>
          </button>
          <span className="w-px h-5 bg-border mx-1 hidden sm:block" />
          <div className={cn("flex gap-0.5", view === "done" && "hidden")}>
          <div className="flex gap-0.5 p-0.5 rounded-full bg-white/[0.03] border border-border">
            {([["board", "ترتيب اللوحة"], ["likes", "الأكثر حباً"], ["new", "الأحدث"]] as [Sort, string][]).map(([v, label]) => (
              <button key={v} onClick={() => setSort(v)}
                className={cn("px-3 py-1 rounded-full text-[11px] font-semibold", sort === v ? "bg-white/[0.1] text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {label}
              </button>
            ))}
          </div>
          </div>
          <div className="flex items-center gap-2 mr-auto w-full sm:w-auto">
            <div className="relative flex-1 sm:w-52">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="دوّر على فكرة..."
                className="w-full rounded-full bg-white/[0.04] border border-border pr-8 pl-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-amber-400/40" />
            </div>
            <button onClick={surprise} title="فكرة عشوائية"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-400/15 text-amber-300 border border-amber-400/25 hover:bg-amber-400/25">
              <Dices className="w-3.5 h-3.5" /> فاجئني
            </button>
          </div>
        </div>
      )}

      {/* ─── اللوحة ─── */}
      {loading ? (
        <div className="h-80 rounded-[22px] bg-white/[0.04] animate-pulse" />
      ) : error ? (
        <p className="text-center py-16 text-muted-foreground">{error}</p>
      ) : (
        <section className="ib-board">
          {visible.length === 0 ? (
            view === "done" ? (
              <EmptyDone filtering={doneCount > 0} />
            ) : (
              <EmptyBoard filtering={onBoard.length > 0} />
            )
          ) : (
            <div className="ib-grid">
              {visible.map((s) => {
                const liked = !!me && (s.likes ?? []).includes(me.userId);
                return (
                  <div
                    key={s.id}
                    ref={(el) => { if (el) slotRefs.current.set(s.id, el); else slotRefs.current.delete(s.id); }}
                    className={cn("ib-slot", dragId === s.id && "ib-dragging", freshId === s.id && "ib-new", spotId === s.id && "ib-spot")}
                    style={{ marginTop: dropOf(s.id) }}
                    draggable={canDrag}
                    onDragStart={() => onDragStart(s.id)}
                    onDragOver={(e) => { e.preventDefault(); onDragOver(s.id); }}
                    onDragEnd={onDragEnd}
                  >
                    <StickerShape
                      kind={s.kind}
                      style={{ transform: `rotate(${tiltOf(s)}deg)` }}
                      onClick={() => setOpen(s)}
                    >
                      {canDrag && <GripVertical className="ib-grip w-4 h-4" />}
                      {isDone(s) && <span className="ib-stamp">تم ✓</span>}
                      {s.tag && <span className="ib-tag">{s.tag}</span>}
                      {s.title && <h3 className="ib-title">{s.title}</h3>}
                      {s.body && <p className="ib-body">{s.body}</p>}
                      <div className="ib-foot">
                        {s.created_by_name && (
                          <>
                            <span className="ib-avatar">{initial(s.created_by_name)}</span>
                            <span className="opacity-70 truncate max-w-[70px] ml-auto">{s.created_by_name}</span>
                          </>
                        )}
                        {!s.created_by_name && <span className="ml-auto" />}
                        <ProgressChip sticker={s} />
                        <SliceChip slices={slices.byParent.get(s.id)} />
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleLike(s); }}
                          className={cn("ib-like", liked && "ib-on")}
                          title={liked ? "إلغاء الإعجاب" : "أعجبتني"}
                        >
                          <Heart className={cn("w-3.5 h-3.5", liked ? "fill-rose-500 text-rose-500" : "opacity-60")} />
                          {(s.likes?.length ?? 0) > 0 && s.likes.length}
                        </button>
                      </div>
                    </StickerShape>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
      {view === "board" && !canDrag && visible.length > 1 && (
        <p className="text-[11px] text-muted-foreground text-center">ترتيب اللوحة بالسحب متاح في «ترتيب اللوحة» بدون فلتر أو بحث</p>
      )}

      {open && (
        <StickerDialog
          sticker={open}
          canEdit={canEdit(open)}
          liked={!!me && (open.likes ?? []).includes(me.userId)}
          onLike={() => toggleLike(open)}
          onClose={() => setOpen(null)}
          onSave={async (d) => { await save(open.id, d); setOpen(null); }}
          onDelete={() => remove(open.id)}
          onTimeline={(body) => updateTimeline(open.id, body)}
          slicesPanel={<IdeaSlicesPanel ideaId={open.id} api={slices} />}
        />
      )}
    </div>
  );
}

// ─── شكل الاستكر (مشترك بين اللوحة والمحرر) ─────────────────────────────────

function StickerShape({ kind, className, style, onClick, children }: {
  kind: StickerKind; className?: string; style?: React.CSSProperties; onClick?: () => void; children: React.ReactNode;
}) {
  const k = stickerKind(kind);
  return (
    <div
      className={cn("ib-sticker", `ib-${kind}`, className)}
      style={{ color: k.ink, ...style }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onClick(); } : undefined}
    >
      {kind === "star" ? <span className="ib-tape" /> : <span className="ib-pin" style={{ ["--pin" as string]: PIN[kind] }} />}
      <div className="ib-paper">{children}</div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <div className="ib-stat">
      <p className={cn("ib-hand text-2xl font-bold leading-none", accent ?? "text-foreground")}>{value.toLocaleString("ar-SA")}</p>
      <p className="text-[10px] text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

/** لمبة مرسومة باليد تومض بخفّة. */
function BulbArt() {
  return (
    <svg className="ib-bulb shrink-0" width="58" height="66" viewBox="0 0 58 66" fill="none" aria-hidden>
      <path d="M29 6c-11 0-19 8.4-19 18.7 0 7.3 4 11.6 7 15 2 2.3 3 4.4 3 7.3h18c0-2.9 1-5 3-7.3 3-3.4 7-7.7 7-15C48 14.4 40 6 29 6Z" fill="#fde047" stroke="#ca8a04" strokeWidth="2.2" strokeLinejoin="round" />
      <path d="M23 47v6.5c0 1.4 1.1 2.5 2.5 2.5h7c1.4 0 2.5-1.1 2.5-2.5V47" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="2.2" />
      <path d="M23 51.5h12" stroke="#94a3b8" strokeWidth="2" />
      <path d="M25 33c1.6-3 2.6-3 4 0s2.4 3 4 0" stroke="#ca8a04" strokeWidth="2" strokeLinecap="round" />
      <path d="M21 17c2-3 5-4.6 8.5-5" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".8" />
      <g stroke="#facc15" strokeWidth="2.6" strokeLinecap="round">
        <path d="M4 22H0.5" /><path d="M57.5 22H54" /><path d="M8 6.5 5.5 4" /><path d="M50 6.5 52.5 4" /><path d="M29 2V0" />
      </g>
    </svg>
  );
}

function EmptyBoard({ filtering }: { filtering: boolean }) {
  return (
    <div className="relative flex flex-col items-center justify-center text-center py-14 text-slate-500">
      <div className="relative mb-5 h-28 w-48">
        <div className="absolute right-6 top-3 w-24 h-24 rounded-md bg-[#fbcfe8] rotate-[8deg] shadow-md" />
        <div className="absolute left-6 top-1 w-24 h-24 rounded-full bg-[#a7f3d0] -rotate-6 shadow-md" />
        <div className="absolute left-1/2 -translate-x-1/2 top-4 w-24 h-24 bg-[#fef08a] -rotate-2 shadow-lg"
          style={{ clipPath: "polygon(10% 0%, 90% 0%, 100% 10%, 100% 90%, 90% 100%, 10% 100%, 0% 90%, 0% 10%)" }} />
      </div>
      <p className="ib-hand text-xl font-bold text-slate-700">{filtering ? "ما لقينا شي بهالبحث" : "اللوحة تنتظر أول فكرة"}</p>
      <p className="text-sm mt-1">{filtering ? "جرّب كلمة ثانية أو اعرض الكل" : "اكتب على الورقة فوق والصقها هنا 💡"}</p>
    </div>
  );
}

function EmptyDone({ filtering }: { filtering: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 text-slate-500">
      <Trophy className="w-12 h-12 text-emerald-500/70 mb-3" />
      <p className="ib-hand text-xl font-bold text-slate-700">{filtering ? "ما لقينا شي بهالبحث" : "لا توجد منجزات بعد"}</p>
      <p className="text-sm mt-1">{filtering ? "جرّب كلمة ثانية" : "أي تذكير تعلّمه «مكتمل» ينتقل هنا 🏆"}</p>
    </div>
  );
}

// ─── نافذة الاستكر: نفس الشكل بحجم أكبر، والكتابة عليه مباشرة ─────────────────

function StickerDialog({ sticker, canEdit, liked, onLike, onClose, onSave, onDelete, onTimeline, slicesPanel }: {
  sticker: IdeaSticker; canEdit: boolean; liked: boolean; onLike: () => void;
  onClose: () => void; onSave: (d: Draft) => Promise<void>; onDelete: () => void;
  onTimeline: (body: Record<string, unknown>) => Promise<void>; slicesPanel?: React.ReactNode;
}) {
  const [form, setForm] = useState<Draft>({ kind: sticker.kind, tag: sticker.tag, title: sticker.title, body: sticker.body });
  const [saving, setSaving] = useState(false);
  const dirty = form.kind !== sticker.kind || form.tag !== sticker.tag || form.title !== sticker.title || form.body !== sticker.body;
  const likes = sticker.likes?.length ?? 0;

  const submit = async () => {
    setSaving(true);
    try { await onSave(form); } catch (e) { alert((e as Error).message); setSaving(false); }
  };
  const close = () => { if (!dirty || confirm("فيه تعديلات غير محفوظة. إغلاق بدون حفظ؟")) onClose(); };

  return (
    <div className={cn("ib-root fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 overflow-y-auto", hand.variable)} onClick={close}>
      <div className="relative flex flex-col items-center gap-6 my-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={close} className="absolute -top-2 -left-2 sm:-left-10 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 z-20"><X className="w-4 h-4" /></button>

        <div style={{ transform: "scale(1.45)", margin: "70px 0 60px" }}>
          <div className="ib-slot ib-new">
          <StickerShape kind={form.kind} className="ib-lifted">
            {canEdit ? (
              <>
                <input value={form.tag} onChange={(e) => setForm({ ...form, tag: e.target.value })} className="ib-field ib-tag" placeholder="الوسم" maxLength={60} />
                <textarea value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} rows={2} className="ib-field ib-title" placeholder="عنوان الفكرة" maxLength={200} />
                <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={form.kind === "circle" ? 2 : 4}
                  className="ib-field ib-body" style={{ display: "block", WebkitLineClamp: "unset" }} placeholder="التفاصيل" />
              </>
            ) : (
              <>
                {sticker.tag && <span className="ib-tag">{sticker.tag}</span>}
                {sticker.title && <h3 className="ib-title">{sticker.title}</h3>}
                {sticker.body && <p className="ib-body" style={{ WebkitLineClamp: "unset" }}>{sticker.body}</p>}
              </>
            )}
          </StickerShape>
          </div>
        </div>

        <div className="w-[min(92vw,420px)] rounded-2xl glass-surface border border-border p-4 space-y-3 hover:translate-y-0">
          {canEdit && (
            <div className="flex flex-wrap justify-center gap-2">
              {STICKER_KINDS.map((k) => (
                <button key={k.value} onClick={() => setForm((f) => swapKind(f, k.value))}
                  className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition",
                    form.kind === k.value ? "border-white/30 bg-white/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground")}>
                  <span className={cn("w-3 h-3 inline-block", k.value === "circle" ? "rounded-full" : "rounded-[3px]")} style={{ background: k.swatch }} />
                  {k.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {sticker.created_by_name ? `${sticker.created_by_name} · ` : ""}
              {new Date(sticker.created_at).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <button onClick={onLike} className={cn("flex items-center gap-1 px-2.5 py-1 rounded-full border font-bold transition",
              liked ? "border-rose-400/40 bg-rose-500/15 text-rose-300" : "border-border hover:text-foreground")}>
              <Heart className={cn("w-3.5 h-3.5", liked && "fill-rose-400")} /> {likes > 0 ? likes : "أعجبتني"}
            </button>
          </div>
          {canEdit && (
            <div className="flex items-center gap-2">
              <button onClick={submit} disabled={saving || !dirty || (!form.title.trim() && !form.body.trim())}
                className="ib-cta px-6 py-2 rounded-full text-sm font-extrabold disabled:opacity-40 disabled:saturate-0">
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </button>
              <button onClick={onDelete} className="mr-auto flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-red-400">
                <Trash2 className="w-3.5 h-3.5" /> حذف
              </button>
            </div>
          )}
        </div>

        {slicesPanel}

        {isReminder(sticker) ? (
          <ReminderPanel sticker={sticker} canEdit={canEdit} onTimeline={onTimeline} />
        ) : (
          <TimelinePanel sticker={sticker} canEdit={canEdit} onTimeline={onTimeline} />
        )}
      </div>
    </div>
  );
}

// ─── تايم لاين التنفيذ ────────────────────────────────────────────────────────

const DAY = 86_400_000;
const fmtStamp = (iso: string) =>
  new Date(iso).toLocaleString("ar-SA-u-ca-gregory", { day: "numeric", month: "long", hour: "numeric", minute: "2-digit" });
const fmtDate = (ymd: string) =>
  new Date(`${ymd}T00:00:00`).toLocaleDateString("ar-SA-u-ca-gregory", { weekday: "long", day: "numeric", month: "long" });
const num = (n: number) => n.toLocaleString("ar-SA");
const days = (n: number) => (n === 1 ? "يوم" : n === 2 ? "يومين" : `${num(n)} ${n <= 10 ? "أيام" : "يوم"}`);

/** حالة الالتزام بالموعد: باقي / اليوم / متأخرة / تمت في الموعد / تمت متأخرة. */
function dueStatus(due: string | null | undefined, steps: TimelineStep[]) {
  const allDone = steps.every((s) => s.done_at);
  return dueStatusAt(due, allDone ? Math.max(...steps.map((s) => new Date(s.done_at!).getTime())) : null);
}

/** نفس حالة الموعد لكن بوقت إنجاز مباشر (للتذكير) — null = لسا ما اكتمل. */
function dueStatusAt(due: string | null | undefined, finished: number | null) {
  if (!due) return null;
  const end = new Date(`${due}T23:59:59`).getTime();
  if (finished !== null) {
    const late = Math.ceil((finished - end) / DAY);
    return late > 0
      ? { tone: "late" as const, text: `اكتملت متأخرة ${days(late)}` }
      : { tone: "ok" as const, text: "اكتملت في الموعد ✓" };
  }
  const left = Math.floor((end - Date.now()) / DAY);
  if (left < 0) return { tone: "late" as const, text: `متأخرة ${days(-left)}` };
  if (left === 0) return { tone: "warn" as const, text: "الموعد اليوم" };
  return { tone: left <= 2 ? ("warn" as const) : ("ok" as const), text: `باقي ${days(left)}` };
}

function ProgressChip({ sticker }: { sticker: IdeaSticker }) {
  if (isReminder(sticker)) return <ReminderChip sticker={sticker} />;
  const steps = timelineOf(sticker);
  const done = steps.filter((s) => s.done_at).length;
  if (done <= 1 && !sticker.due_at) return null; // فكرة لسا مطروحة فقط — لا نزحم الاستكر
  const status = dueStatus(sticker.due_at, steps);
  const complete = done === steps.length;
  return (
    <span className={cn("ib-prog", status?.tone === "late" && !complete && "ib-late", complete && "ib-done")} title={status?.text ?? "تقدّم التنفيذ"}>
      {complete ? <Check className="w-3 h-3" /> : <Rocket className="w-3 h-3" />}
      {num(done)}/{num(steps.length)}
      {!complete && <span className="ib-meter"><i style={{ width: `${(done / steps.length) * 100}%` }} /></span>}
    </span>
  );
}

/** شارة التذكير على الاستكر: الموعد المتبقي أو «مكتمل». */
function ReminderChip({ sticker }: { sticker: IdeaSticker }) {
  const complete = !!sticker.completed_at;
  if (!complete && !sticker.due_at) return null;
  const status = dueStatusAt(sticker.due_at, complete ? new Date(sticker.completed_at!).getTime() : null);
  return (
    <span className={cn("ib-prog", status?.tone === "late" && !complete && "ib-late", complete && "ib-done")} title={status?.text ?? "مكتمل"}>
      {complete ? <Check className="w-3 h-3" /> : <CalendarClock className="w-3 h-3" />}
      {complete ? "مكتمل" : status?.text}
    </span>
  );
}

/** التذكير: موعد الإنجاز + الحالة (مكتمل / غير مكتمل) بدل خطوات التنفيذ. */
function ReminderPanel({ sticker, canEdit, onTimeline }: {
  sticker: IdeaSticker; canEdit: boolean; onTimeline: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const complete = !!sticker.completed_at;
  const status = dueStatusAt(sticker.due_at, complete ? new Date(sticker.completed_at!).getTime() : null);

  const run = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag);
    try { await onTimeline(body); } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  };

  return (
    <div className="w-[min(92vw,420px)] rounded-2xl glass-surface border border-border p-4 space-y-4 hover:translate-y-0 text-right">
      {/* موعد الإنجاز */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">موعد الإنجاز</p>
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
          <span className="w-9 h-9 rounded-full bg-pink-500/15 text-pink-300 flex items-center justify-center shrink-0"><CalendarClock className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0">
            {canEdit ? (
              <input type="date" value={sticker.due_at ?? ""} disabled={busy === "due"}
                onChange={(e) => run("due", { action: "due", due_at: e.target.value || null })}
                className="bg-transparent text-sm font-bold text-foreground focus:outline-none [color-scheme:dark] max-w-full" />
            ) : (
              <p className="text-sm font-bold text-foreground">{sticker.due_at ? fmtDate(sticker.due_at) : "غير محدد"}</p>
            )}
            {canEdit && sticker.due_at && <p className="text-[11px] text-muted-foreground">{fmtDate(sticker.due_at)}</p>}
          </div>
          {status && (
            <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap",
              status.tone === "late" ? "bg-red-500/15 text-red-300" : status.tone === "warn" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>
              {status.text}
            </span>
          )}
        </div>
      </div>

      {/* الحالة */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">الحالة</p>
        <div className={cn("flex items-center gap-3 rounded-xl border p-3",
          complete ? "bg-emerald-500/[0.08] border-emerald-400/25" : "bg-white/[0.02] border-white/[0.06]")}>
          <span className={cn("w-9 h-9 rounded-full flex items-center justify-center shrink-0",
            complete ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/15 text-amber-300")}>
            {complete ? <Trophy className="w-4 h-4" /> : <BellRing className="w-4 h-4" />}
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{complete ? "مكتمل 🎉" : "غير مكتمل"}</p>
            <p className="text-[11px] text-muted-foreground truncate">
              {complete
                ? `${fmtStamp(sticker.completed_at!)}${sticker.completed_by ? ` · ${sticker.completed_by}` : ""} — في «المنجزات»`
                : "إذا خلّصته علّمه مكتمل وينتقل للمنجزات"}
            </p>
          </div>
        </div>
        {canEdit && (
          <button onClick={() => run("complete", { action: "complete" })} disabled={!!busy}
            className={cn("mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-extrabold border transition disabled:opacity-50",
              complete
                ? "bg-white/[0.03] text-muted-foreground border-border hover:text-foreground"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-400/30 hover:bg-emerald-500/25")}>
            {busy === "complete" ? <Loader2 className="w-4 h-4 animate-spin" /> : complete ? <Undo2 className="w-4 h-4" /> : <Check className="w-4 h-4" strokeWidth={3} />}
            {complete ? "إرجاعه غير مكتمل" : "تم الإنجاز"}
          </button>
        )}
      </div>
    </div>
  );
}

function TimelinePanel({ sticker, canEdit, onTimeline }: {
  sticker: IdeaSticker; canEdit: boolean; onTimeline: (body: Record<string, unknown>) => Promise<void>;
}) {
  const steps = timelineOf(sticker);
  const [busy, setBusy] = useState<string | null>(null);
  const [newStep, setNewStep] = useState("");
  const done = steps.filter((s) => s.done_at).length;
  const nextIdx = steps.findIndex((s) => !s.done_at);
  const last = [...steps].filter((s) => s.done_at).sort((a, b) => b.done_at!.localeCompare(a.done_at!))[0];
  const status = dueStatus(sticker.due_at, steps);

  const run = async (tag: string, body: Record<string, unknown>) => {
    setBusy(tag);
    try { await onTimeline(body); } catch (e) { alert((e as Error).message); } finally { setBusy(null); }
  };
  const addStep = async () => {
    const label = newStep.trim();
    if (!label) return;
    await run("add", { action: "add", label });
    setNewStep("");
  };

  return (
    <div className="w-[min(92vw,420px)] rounded-2xl glass-surface border border-border p-4 space-y-4 hover:translate-y-0 text-right">
      {/* الحالة الحالية */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">حالة التنفيذ</p>
        <div className="flex items-center gap-3">
          <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", done === steps.length ? "bg-emerald-400" : "bg-blue-400")} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">{done === steps.length ? "اكتمل التنفيذ 🎉" : last ? last.label : "لم يبدأ"}</p>
            {nextIdx >= 0 && <p className="text-[11px] text-muted-foreground truncate">التالي: {steps[nextIdx].label}</p>}
          </div>
          <span className="ib-hand text-xl font-bold text-foreground">{num(Math.round((done / steps.length) * 100))}٪</span>
        </div>
        <div className="mt-2.5 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <div className="h-full rounded-full bg-gradient-to-l from-emerald-400 to-emerald-600 transition-all duration-500" style={{ width: `${(done / steps.length) * 100}%` }} />
        </div>
      </div>

      {/* خطوات التنفيذ */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-3">خطوات التنفيذ</p>
        <div className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-3.5">
          {steps.map((s, i) => {
            return (
              <div key={s.key} className={cn("tl-row", s.done_at && "tl-done", i === nextIdx && "tl-next")}>
                <button
                  type="button"
                  onClick={() => run(s.key, { action: "toggle", key: s.key })}
                  disabled={!canEdit || !!busy}
                  title={canEdit ? (s.done_at ? "تراجع عن الإنجاز" : "تم إنجاز الخطوة") : undefined}
                  className={cn("tl-dot", !canEdit && "cursor-default")}
                >
                  {busy === s.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : s.done_at ? <Check className="w-4 h-4" strokeWidth={3} /> : null}
                </button>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className={cn("text-sm font-bold", s.done_at || i === nextIdx ? "text-foreground" : "text-muted-foreground")}>{s.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {s.done_at ? `${fmtStamp(s.done_at)}${s.done_by ? ` · ${s.done_by}` : ""}` : i === nextIdx ? "الخطوة الحالية" : "بانتظار التنفيذ"}
                  </p>
                </div>
                {canEdit && steps.length > 1 && (
                  <button onClick={() => { if (confirm(`حذف خطوة «${s.label}»؟`)) run(`del-${s.key}`, { action: "remove", key: s.key }); }}
                    disabled={!!busy} className="tl-del self-start p-1 text-muted-foreground hover:text-red-400" title="حذف الخطوة">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
          {canEdit && (
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-white/[0.06]">
              <input value={newStep} onChange={(e) => setNewStep(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addStep(); }}
                placeholder="أضف خطوة..." maxLength={80}
                className="flex-1 min-w-0 rounded-full bg-white/[0.04] border border-border px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-emerald-400/40" />
              <button onClick={addStep} disabled={!newStep.trim() || !!busy}
                className="p-1.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-400/25 disabled:opacity-40">
                {busy === "add" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* الالتزام بموعد التنفيذ */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground mb-2">الالتزام بموعد التنفيذ</p>
        <div className="flex items-center gap-3 rounded-xl bg-white/[0.02] border border-white/[0.06] p-3">
          <span className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-300 flex items-center justify-center shrink-0"><CalendarClock className="w-4 h-4" /></span>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground">الموعد المستهدف</p>
            {canEdit ? (
              <input type="date" value={sticker.due_at ?? ""} disabled={busy === "due"}
                onChange={(e) => run("due", { action: "due", due_at: e.target.value || null })}
                className="bg-transparent text-sm font-bold text-foreground focus:outline-none [color-scheme:dark] max-w-full" />
            ) : (
              <p className="text-sm font-bold text-foreground">{sticker.due_at ? fmtDate(sticker.due_at) : "غير محدد"}</p>
            )}
            {canEdit && sticker.due_at && <p className="text-[11px] text-muted-foreground">{fmtDate(sticker.due_at)}</p>}
          </div>
          {status && (
            <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap",
              status.tone === "late" ? "bg-red-500/15 text-red-300" : status.tone === "warn" ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300")}>
              {status.text}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
