"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Download, Film, Image as ImageIcon, Link2, Loader2, Pencil, Search, Trash2, Trophy, Upload, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CONTENT_TYPES, PLATFORMS, fmtNum, type ContentType, type Platform } from "@/lib/content-desk/types";
import {
  ASSET_KINDS, assetEngagement, assetViews, fmtSize, isImage, isVideo,
  type AssetKind, type BankAsset, type BankPayload,
} from "@/lib/content-desk/bank";

type Sort = "new" | "views" | "engagement" | "downloads";
const inputCls =
  "w-full rounded-lg border border-border bg-white/[0.06] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan/50";

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/content-desk/bank", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "حدث خطأ");
  return json;
}

/** رفع مباشر لتخزين Supabase برابط موقّع (مع نسبة التقدم). */
function putFile(url: string, file: File, onProgress: (p: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`فشل الرفع (${xhr.status})`)));
    xhr.onerror = () => reject(new Error("انقطع الاتصال أثناء الرفع"));
    xhr.send(file);
  });
}

const guessKind = (f: File): AssetKind => (f.type.startsWith("video/") ? "reel" : "post");
/** رفع متعدد: الشكل المختار ينطبق لو يناسب نوع الملف (فيديو ↔ صورة)، وإلا نخمّن. */
const kindFor = (f: File, chosen: AssetKind): AssetKind => {
  const vid = f.type.startsWith("video/");
  const vidKind = chosen === "reel" || chosen === "video";
  return chosen === "story" || vid === vidKind ? chosen : guessKind(f);
};

export default function ContentBank() {
  const [data, setData] = useState<BankPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<AssetKind | "all">("all");
  const [sort, setSort] = useState<Sort>("new");
  const [editing, setEditing] = useState<BankAsset | null>(null);
  const [pending, setPending] = useState<File[] | null>(null);
  const [viewing, setViewing] = useState<BankAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/content-desk/bank", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذّر التحميل");
      setData(json); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const list = useMemo(() => {
    if (!data) return [];
    const s = q.trim().toLowerCase();
    const xs = data.assets.filter((a) =>
      (kind === "all" || a.kind === kind) &&
      (!s || a.title.toLowerCase().includes(s) || a.tags.some((t) => t.toLowerCase().includes(s)) || (a.note ?? "").toLowerCase().includes(s)));
    const key: Record<Sort, (a: BankAsset) => number> = {
      new: (a) => Date.parse(a.created_at), views: (a) => assetViews(a) ?? -1,
      engagement: (a) => assetEngagement(a) ?? -1, downloads: (a) => a.downloads,
    };
    return [...xs].sort((a, b) => key[sort](b) - key[sort](a));
  }, [data, q, kind, sort]);

  // أفضل ٣ بالمشاهدات = شارة «الأعلى نتائج»
  const top = useMemo(() => {
    const ranked = (data?.assets ?? []).filter((a) => (assetViews(a) ?? 0) > 0).sort((a, b) => (assetViews(b) ?? 0) - (assetViews(a) ?? 0));
    return new Map(ranked.slice(0, 3).map((a, i) => [a.id, i + 1]));
  }, [data]);

  const download = async (a: BankAsset) => {
    try {
      const { url } = await api({ action: "download", id: a.id });
      const link = document.createElement("a");
      link.href = url; link.rel = "noopener"; document.body.appendChild(link); link.click(); link.remove();
      setData((d) => d && ({ ...d, assets: d.assets.map((x) => (x.id === a.id ? { ...x, downloads: x.downloads + 1 } : x)) }));
    } catch (e) { setError((e as Error).message); }
  };

  if (error && !data) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>;
  if (!data) return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-5" dir="rtl" lang="ar">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">بنك المحتوى</h1>
          <p className="text-xs text-muted-foreground">كل بوست وريلز وستوري وفيديو نصممه — ارفعه هنا، اربطه بمنشور الخطة، ونعرف أي محتوى جاب نتائج أكثر</p>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,video/*" className="hidden"
          onChange={(e) => { const fs = Array.from(e.target.files ?? []); if (fs.length) setPending(fs); e.target.value = ""; }} />
        <button className="flex items-center gap-1.5 rounded-xl bg-cyan px-4 py-2 text-sm font-bold text-[#07090F]" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" /> رفع محتوى
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}<button onClick={() => setError(null)} aria-label="إغلاق"><X className="h-4 w-4" /></button>
        </div>
      )}

      <Insights assets={data.assets} />

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input className={cn(inputCls, "ps-9")} placeholder="ابحث بالاسم أو الوسم" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-1 rounded-xl bg-white/[0.04] p-1" role="group" aria-label="النوع">
          {([["all", "الكل"], ...Object.entries(ASSET_KINDS)] as [AssetKind | "all", string][]).map(([k, l]) => (
            <button key={k} onClick={() => setKind(k)} aria-pressed={kind === k}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-bold", kind === k ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:text-foreground")}>{l}</button>
          ))}
        </div>
        <select className="rounded-xl border border-border bg-card px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="الترتيب">
          <option value="new">الأحدث</option>
          <option value="views">الأعلى مشاهدات</option>
          <option value="engagement">الأعلى تفاعل</option>
          <option value="downloads">الأكثر تحميلاً</option>
        </select>
      </div>

      {list.length === 0 ? (
        <button onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border py-16 text-sm text-muted-foreground hover:border-cyan/50">
          <Upload className="h-6 w-6" />
          {data.assets.length ? "ما فيه نتائج للبحث" : "البنك فاضي — ارفع أول تصميم"}
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {list.map((a) => <AssetCard key={a.id} a={a} rank={top.get(a.id)} onOpen={() => setViewing(a)} onDownload={() => download(a)} onEdit={() => setEditing(a)} />)}
        </div>
      )}

      {pending && (
        <UploadModal files={pending} linkable={data.linkable} onClose={() => setPending(null)}
          onDone={() => { setPending(null); load(); }} />
      )}
      {editing && (
        <EditModal asset={editing} linkable={data.linkable}
          canDelete={editing.uploaded_by === data.me.id || data.me.isManager}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }} />
      )}
      {viewing && <Viewer a={viewing} onClose={() => setViewing(null)} onDownload={() => download(viewing)} />}
    </div>
  );
}

type Grp = { label: string; n: number; avg: number; er: number };

function Block({ title, rows }: { title: string; rows: Grp[] }) {
  const max = Math.max(1, ...rows.map((r) => r.avg));
  return (
    <div className="min-w-0 space-y-2 rounded-xl border border-border bg-card p-4">
      <h3 className="text-xs font-bold text-muted-foreground">{title}</h3>
      {rows.length === 0 ? <p className="text-xs text-muted-foreground">لسا ما فيه أرقام — اربط المحتوى بمنشورات الخطة</p> : rows.map((r, i) => (
        <div key={r.label} className="space-y-1">
          <div className="flex items-center justify-between gap-2 text-xs">
            <span className={cn("font-bold", i === 0 && "text-cyan")}>{i === 0 && "🏆 "}{r.label} <span className="font-normal text-muted-foreground">({r.n})</span></span>
            <span className="text-muted-foreground"><b className="font-mono text-foreground" dir="ltr">{fmtNum(r.avg)}</b> متوسط مشاهدات · تفاعل <span className="font-mono" dir="ltr">{r.er.toFixed(1)}%</span></span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className={cn("h-full rounded-full", i === 0 ? "bg-cyan" : "bg-white/25")} style={{ width: `${(r.avg / max) * 100}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

// ─── مين جاب نتائج أكثر ─────────────────────────────────────────────────
function Insights({ assets }: { assets: BankAsset[] }) {
  const withViews = assets.filter((a) => assetViews(a) != null);
  const group = <K extends string>(keyOf: (a: BankAsset) => K | null, labels: Record<K, string>): Grp[] => {
    const m = new Map<K, { n: number; views: number; eng: number }>();
    for (const a of withViews) {
      const k = keyOf(a); if (!k) continue;
      const g = m.get(k) ?? { n: 0, views: 0, eng: 0 };
      g.n++; g.views += assetViews(a) ?? 0; g.eng += assetEngagement(a) ?? 0;
      m.set(k, g);
    }
    return [...m.entries()].map(([k, g]) => ({ label: labels[k], n: g.n, avg: Math.round(g.views / g.n), er: g.views ? (g.eng / g.views) * 100 : 0 }))
      .sort((a, b) => b.avg - a.avg);
  };
  const byKind = group((a) => a.kind, ASSET_KINDS);
  const byType = group((a) => a.content_type, Object.fromEntries(Object.entries(CONTENT_TYPES).map(([k, v]) => [k, v.label])) as Record<ContentType, string>);
  const linked = assets.filter((a) => a.desk_item_id).length;


  return (
    <section aria-label="النتائج" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_200px]">
      <Block title="أي شكل يجيب مشاهدات أكثر" rows={byKind} />
      <Block title="أي نوع محتوى يجيب نتائج أكثر" rows={byType} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">ملفات البنك</div>
          <b className="font-mono text-2xl" dir="ltr">{assets.length}</b>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs text-muted-foreground">مربوطة بالخطة</div>
          <b className="font-mono text-2xl" dir="ltr">{linked}</b>
        </div>
      </div>
    </section>
  );
}

function Thumb({ a, className }: { a: BankAsset; className?: string }) {
  if (a.preview_url && isImage(a)) return <img src={a.preview_url} alt="" loading="lazy" className={cn("h-full w-full object-cover", className)} />;
  if (a.preview_url && isVideo(a)) return <video src={`${a.preview_url}#t=0.5`} preload="metadata" muted playsInline className={cn("h-full w-full object-cover", className)} />;
  return <div className="grid h-full w-full place-items-center text-muted-foreground"><ImageIcon className="h-8 w-8" /></div>;
}

function AssetCard({ a, rank, onOpen, onDownload, onEdit }: { a: BankAsset; rank?: number; onOpen: () => void; onDownload: () => void; onEdit: () => void }) {
  const views = assetViews(a), eng = assetEngagement(a);
  return (
    <article className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <button onClick={onOpen} className="relative aspect-[4/5] overflow-hidden bg-black/30" aria-label={`عرض ${a.title}`}>
        <Thumb a={a} />
        {isVideo(a) && <span className="absolute bottom-2 start-2 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><Film className="h-3.5 w-3.5" /></span>}
        <span className="absolute top-2 start-2 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] font-bold text-white">{ASSET_KINDS[a.kind]}</span>
        {rank && <span className="absolute top-2 end-2 flex items-center gap-1 rounded-md bg-amber-400 px-1.5 py-0.5 text-[11px] font-extrabold text-black"><Trophy className="h-3 w-3" />#{rank}</span>}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-3">
        <h3 className="line-clamp-2 text-sm font-bold">{a.title}</h3>
        <div className="flex flex-wrap gap-1 text-[11px]">
          <span className="rounded-md bg-white/[0.06] px-1.5 py-px text-muted-foreground">{PLATFORMS[a.platform]}</span>
          {a.content_type && <span className="rounded-md bg-white/[0.06] px-1.5 py-px text-muted-foreground">{CONTENT_TYPES[a.content_type].label}</span>}
          {a.tags.slice(0, 3).map((t) => <span key={t} className="rounded-md bg-cyan/10 px-1.5 py-px text-cyan">#{t}</span>)}
        </div>
        <div className="mt-auto grid grid-cols-3 gap-1 rounded-lg bg-white/[0.04] p-2 text-center text-[11px] text-muted-foreground">
          <span>مشاهدات<b className="block font-mono text-sm text-foreground" dir="ltr">{fmtNum(views)}</b></span>
          <span>تفاعل<b className="block font-mono text-sm text-foreground" dir="ltr">{fmtNum(eng)}</b></span>
          <span>تحميل<b className="block font-mono text-sm text-foreground" dir="ltr">{a.downloads}</b></span>
        </div>
        {a.linked ? (
          <p className="flex items-center gap-1 truncate text-[11px] text-emerald-400" title={a.linked.idea}><Link2 className="h-3 w-3 shrink-0" />{a.linked.idea}</p>
        ) : (
          <p className="text-[11px] text-amber-400">غير مربوط بمنشور</p>
        )}
        <div className="flex gap-1.5">
          <button onClick={onDownload} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-cyan/15 py-1.5 text-xs font-bold text-cyan"><Download className="h-3.5 w-3.5" /> تنزيل</button>
          <button onClick={onEdit} className="grid w-9 place-items-center rounded-lg border border-border" aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></button>
        </div>
      </div>
    </article>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface Meta { title: string; kind: AssetKind; platform: Platform; content_type: ContentType | ""; tags: string; note: string; desk_item_id: string; views: string; engagement: string }

function MetaFields({ m, set, linkable }: { m: Meta; set: (p: Partial<Meta>) => void; linkable: BankPayload["linkable"] }) {
  return (
    <div className="space-y-3">
      <label className="block space-y-1 text-xs font-bold">الاسم<input className={inputCls} value={m.title} onChange={(e) => set({ title: e.target.value })} placeholder="مثال: ريلز عرض رمضان" /></label>
      <div className="grid grid-cols-3 gap-2">
        <label className="space-y-1 text-xs font-bold">الشكل
          <select className={inputCls} value={m.kind} onChange={(e) => set({ kind: e.target.value as AssetKind })}>
            {Object.entries(ASSET_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold">المنصة
          <select className={inputCls} value={m.platform} onChange={(e) => set({ platform: e.target.value as Platform })}>
            {Object.entries(PLATFORMS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-xs font-bold">النوع
          <select className={inputCls} value={m.content_type} onChange={(e) => set({ content_type: e.target.value as ContentType | "" })}>
            <option value="">—</option>
            {Object.entries(CONTENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>
      <label className="block space-y-1 text-xs font-bold">ربط بمنشور في الخطة <span className="font-normal text-muted-foreground">(نجيب منه المشاهدات والتفاعل)</span>
        <select className={inputCls} value={m.desk_item_id} onChange={(e) => set({ desk_item_id: e.target.value })}>
          <option value="">بدون ربط</option>
          {linkable.map((i) => (
            <option key={i.id} value={i.id}>{i.item_date} · {i.idea.slice(0, 50)}{i.owner_name ? ` — ${i.owner_name}` : ""}{i.actual_views != null ? ` (${fmtNum(i.actual_views)} مشاهدة)` : ""}</option>
          ))}
        </select>
      </label>
      {!m.desk_item_id && (
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1 text-xs font-bold">مشاهدات (يدوي)<input className={inputCls} inputMode="numeric" dir="ltr" value={m.views} onChange={(e) => set({ views: e.target.value.replace(/\D/g, "") })} /></label>
          <label className="space-y-1 text-xs font-bold">تفاعل (يدوي)<input className={inputCls} inputMode="numeric" dir="ltr" value={m.engagement} onChange={(e) => set({ engagement: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
      )}
      <label className="block space-y-1 text-xs font-bold">وسوم <span className="font-normal text-muted-foreground">(افصل بفاصلة)</span><input className={inputCls} value={m.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="رمضان، عروض، صالونات" /></label>
      <label className="block space-y-1 text-xs font-bold">ملاحظة<textarea className={inputCls} rows={2} value={m.note} onChange={(e) => set({ note: e.target.value })} /></label>
    </div>
  );
}

const metaBody = (m: Meta) => ({
  title: m.title, kind: m.kind, platform: m.platform, content_type: m.content_type || null, tags: m.tags, note: m.note,
  desk_item_id: m.desk_item_id || null, views: m.desk_item_id ? null : m.views, engagement: m.desk_item_id ? null : m.engagement,
});

function UploadModal({ files, linkable, onClose, onDone }: { files: File[]; linkable: BankPayload["linkable"]; onClose: () => void; onDone: () => void }) {
  const base = files[0].name.replace(/\.[^.]+$/, "");
  const [m, setM] = useState<Meta>({ title: files.length === 1 ? base : "", kind: guessKind(files[0]), platform: "ig", content_type: "", tags: "", note: "", desk_item_id: "", views: "", engagement: "" });
  const [progress, setProgress] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const bad = files.find((f) => !/^(image|video)\//.test(f.type));

  const go = async () => {
    setErr(null);
    if (files.length === 1 && !m.title.trim()) return setErr("اكتب اسم المحتوى");
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const { path, signedUrl } = await api({ action: "upload_url", file_name: f.name, mime_type: f.type, size_bytes: f.size });
        await putFile(signedUrl, f, (p) => setProgress((i + p) / files.length));
        const title = files.length === 1 ? m.title : `${m.title.trim() ? `${m.title.trim()} — ` : ""}${f.name.replace(/\.[^.]+$/, "")}`;
        await api({ action: "create", path, file_name: f.name, mime_type: f.type, size_bytes: f.size, ...metaBody(m), title, kind: files.length > 1 ? kindFor(f, m.kind) : m.kind });
      }
      onDone();
    } catch (e) { setErr((e as Error).message); setProgress(null); }
  };

  return (
    <Modal title={files.length === 1 ? "رفع للبنك" : `رفع ${files.length} ملفات للبنك`} onClose={progress == null ? onClose : () => {}}>
      <ul className="mb-4 space-y-1 rounded-lg bg-white/[0.04] p-2 text-xs">
        {files.map((f) => <li key={f.name} className="flex justify-between gap-2"><span className="truncate">{f.name}</span><span className="shrink-0 font-mono text-muted-foreground" dir="ltr">{fmtSize(f.size)}</span></li>)}
      </ul>
      {bad ? <p className="text-sm text-red-400">«{bad.name}» مو صورة ولا فيديو</p> : (
        <>
          <MetaFields m={m} set={(p) => setM((x) => ({ ...x, ...p }))} linkable={linkable} />
          {files.length > 1 && <p className="mt-2 text-[11px] text-muted-foreground">الاسم يصير بادئة لاسم كل ملف، ونفس الإعدادات تنطبق على الكل.</p>}
          {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
          {progress != null && (
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-cyan transition-[width]" style={{ width: `${progress * 100}%` }} /></div>
          )}
          <button disabled={progress != null} onClick={go} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan py-2.5 text-sm font-extrabold text-[#07090F] disabled:opacity-60">
            {progress != null ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري الرفع {Math.round(progress * 100)}%</> : <><Upload className="h-4 w-4" /> رفع</>}
          </button>
        </>
      )}
    </Modal>
  );
}

function EditModal({ asset, linkable, canDelete, onClose, onSaved }: { asset: BankAsset; linkable: BankPayload["linkable"]; canDelete: boolean; onClose: () => void; onSaved: () => void }) {
  const [m, setM] = useState<Meta>({
    title: asset.title, kind: asset.kind, platform: asset.platform, content_type: asset.content_type ?? "", tags: asset.tags.join("، "), note: asset.note ?? "",
    desk_item_id: asset.desk_item_id ?? "", views: asset.views?.toString() ?? "", engagement: asset.engagement?.toString() ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try { await api({ id: asset.id, ...body }); onSaved(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Modal title="تعديل المحتوى" onClose={onClose}>
      <MetaFields m={m} set={(p) => setM((x) => ({ ...x, ...p }))} linkable={linkable} />
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <div className="mt-4 flex gap-2">
        <button disabled={busy} onClick={() => run({ action: "update", ...metaBody(m) })} className="flex-1 rounded-xl bg-cyan py-2.5 text-sm font-extrabold text-[#07090F] disabled:opacity-60">حفظ</button>
        {canDelete && (
          <button disabled={busy} onClick={() => confirm("حذف الملف من البنك نهائياً؟") && run({ action: "delete" })}
            className="flex items-center gap-1 rounded-xl border border-red-500/40 px-4 text-sm font-bold text-red-400"><Trash2 className="h-4 w-4" /> حذف</button>
        )}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">رفعه {asset.uploader_name ?? "—"} · {asset.created_at.slice(0, 10)} · {fmtSize(asset.size_bytes)}</p>
    </Modal>
  );
}

function Viewer({ a, onClose, onDownload }: { a: BankAsset; onClose: () => void; onDownload: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90 p-4" onClick={onClose} dir="rtl">
      <div className="mb-3 flex items-center justify-between gap-3 text-white" onClick={(e) => e.stopPropagation()}>
        <h2 className="truncate text-sm font-bold">{a.title}</h2>
        <div className="flex gap-2">
          <button onClick={onDownload} className="flex items-center gap-1 rounded-lg bg-cyan px-3 py-1.5 text-xs font-bold text-[#07090F]"><Download className="h-3.5 w-3.5" /> تنزيل</button>
          <button onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center" onClick={(e) => e.stopPropagation()}>
        {a.preview_url && isVideo(a) ? <video src={a.preview_url} controls autoPlay playsInline className="max-h-full max-w-full rounded-lg" />
          : a.preview_url ? <img src={a.preview_url} alt={a.title} className="max-h-full max-w-full rounded-lg object-contain" />
          : <p className="text-sm text-white/70">ما فيه معاينة</p>}
      </div>
    </div>
  );
}
