"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Copy, Download, FileArchive, Loader2, Pencil, Plus, Save, Share2, Trash2, Undo2, X, CloudOff, Cloud,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostData, TemplateId } from "@/lib/package-posts/types";
import { TEMPLATE_IDS, TEMPLATE_LABEL, TEMPLATE_SIZE } from "@/lib/package-posts/types";
import { makeDefaultPost, newId } from "@/lib/package-posts/defaults";
import { deletePost, listPosts, savePost, type StorageMode } from "@/lib/package-posts/storage";
import { ExportStage, ScaledPreview, StudioFonts } from "./preview";
import { PostEditor } from "./PostEditor";
import { measureFit, type FitWarnings } from "./measure";
import { downloadBlob, fileNameFor, renderPng, shareFile, zipPngs } from "./export";

type Toast = { msg: string; tone?: "ok" | "err"; action?: { label: string; run: () => void } };

const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";

export function PackagePostsStudio() {
  const [posts, setPosts] = useState<PostData[]>([]);
  const [mode, setMode] = useState<StorageMode>("cloud");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<PostData | null>(null);
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<null | "save" | "png" | "share" | "zip">(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [mobileTab, setMobileTab] = useState<"edit" | "preview">("edit");
  const [warnings, setWarnings] = useState<FitWarnings>({});
  const [fontsReady, setFontsReady] = useState(false);
  const [zipPosts, setZipPosts] = useState<PostData[] | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const zipStageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const saved = useMemo(() => posts.find((p) => p.id === editingId) ?? null, [posts, editingId]);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved);

  const notify = useCallback((t: Toast) => {
    setToast(t);
    if (!t.action) setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 3500);
  }, []);
  const onFontsReady = useCallback(() => setFontsReady(true), []);

  useEffect(() => {
    listPosts()
      .then(({ posts, mode }) => { setPosts(posts); setMode(mode); })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "تعذّر تحميل البوستات"))
      .finally(() => setLoading(false));
  }, []);

  // تحذير قبل الخروج مع تعديلات غير محفوظة
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  // قياس طول النصوص في القالب الحقيقي بعد كل تعديل
  useEffect(() => {
    if (!draft) return;
    const id = setTimeout(() => requestAnimationFrame(() => setWarnings(measureFit(stageRef.current))), 120);
    return () => clearTimeout(id);
  }, [draft, fontsReady]);

  const openEditor = (p: PostData) => {
    setEditingId(p.id);
    setDraft(structuredClone(p));
    setMobileTab("edit");
    window.scrollTo({ top: 0 });
  };
  const closeEditor = () => {
    if (dirty && !confirm("فيه تعديلات غير محفوظة. تطلع بدون حفظ؟")) return;
    setEditingId(null);
    setDraft(null);
    setWarnings({});
  };

  const persist = async (p: PostData): Promise<PostData | null> => {
    try {
      const out = await savePost(p);
      setPosts((all) => (all.some((x) => x.id === out.id) ? all.map((x) => (x.id === out.id ? out : x)) : [...all, out]));
      return out;
    } catch (e) {
      notify({ msg: e instanceof Error ? e.message : "تعذّر الحفظ", tone: "err" });
      return null;
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    setBusy("save");
    const out = await persist(draft);
    if (out) { setDraft(structuredClone(out)); notify({ msg: "انحفظ البوست", tone: "ok" }); }
    setBusy(null);
  };

  const duplicate = async (src: PostData) => {
    const copy: PostData = { ...structuredClone(src), id: newId(), title: `${src.title} — نسخة` };
    const out = await persist(copy);
    if (out) { openEditor(out); notify({ msg: "انعملت نسخة جديدة — تقدر تعدّلها لعرض أو حملة", tone: "ok" }); }
  };

  const create = async (t: TemplateId) => {
    setPicking(false);
    const out = await persist(makeDefaultPost(t, `${TEMPLATE_LABEL[t]} (جديد)`));
    if (out) openEditor(out);
  };

  const remove = async (p: PostData) => {
    if (!confirm(`حذف «${p.title}»؟`)) return;
    try {
      await deletePost(p.id);
      setPosts((all) => all.filter((x) => x.id !== p.id));
    } catch (e) {
      notify({ msg: e instanceof Error ? e.message : "تعذّر الحذف", tone: "err" });
    }
  };

  const currentPng = async () => {
    if (!draft || !stageRef.current) throw new Error("البوست مو جاهز");
    return renderPng(stageRef.current, draft);
  };

  const handlePng = async () => {
    if (!draft) return;
    setBusy("png");
    try {
      downloadBlob(await currentPng(), fileNameFor(draft));
      const { w, h } = TEMPLATE_SIZE[draft.template];
      notify({ msg: `تم التصدير ${w}×${h}`, tone: "ok" });
    } catch {
      notify({ msg: "تعذّر تصدير الصورة", tone: "err" });
    } finally {
      setBusy(null);
    }
  };

  const handleShare = async () => {
    if (!draft) return;
    setBusy("share");
    try {
      const file = new File([await currentPng()], fileNameFor(draft), { type: "image/png" });
      const r = await shareFile(file);
      if (r === "downloaded") notify({ msg: "جهازك ما يدعم المشاركة المباشرة — نزّلنا الصورة، شاركها من الاستديو", tone: "ok" });
      if (r === "needs-gesture") {
        notify({
          msg: "الصورة جاهزة",
          action: { label: "مشاركة الآن", run: () => { setToast(null); shareFile(file).catch(() => undefined); } },
        });
      }
    } catch {
      notify({ msg: "تعذّرت المشاركة", tone: "err" });
    } finally {
      setBusy(null);
    }
  };

  // تصدير الكل: نركّب كل البوستات بمقاسها الحقيقي خارج الشاشة ثم نلتقطها واحد واحد
  const handleZip = () => {
    if (!posts.length) return;
    setBusy("zip");
    zipStageRefs.current = {};
    setZipPosts(posts);
  };
  useEffect(() => {
    if (!zipPosts) return;
    let alive = true;
    (async () => {
      try {
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        const entries: { name: string; blob: Blob }[] = [];
        for (const p of zipPosts) {
          const node = zipStageRefs.current[p.id];
          if (node) entries.push({ name: fileNameFor(p), blob: await renderPng(node, p) });
        }
        if (!alive) return;
        downloadBlob(await zipPngs(entries), "بوستات-الباقات.zip");
        notify({ msg: `تم تصدير ${entries.length} بوست`, tone: "ok" });
      } catch {
        notify({ msg: "تعذّر تصدير الملف المضغوط", tone: "err" });
      } finally {
        if (alive) { setZipPosts(null); setBusy(null); }
      }
    })();
    return () => { alive = false; };
  }, [zipPosts, notify]);

  // ─── العرض ──────────────────────────────────────────────────────────────────

  const modeBadge = (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold", mode === "cloud" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400")}>
      {mode === "cloud" ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
      {mode === "cloud" ? "محفوظ في السحابة" : "محفوظ على هذا الجهاز مؤقتاً"}
    </span>
  );

  let body: React.ReactNode;
  if (loading) {
    body = <div className="flex items-center gap-2 py-20 text-muted-foreground justify-center"><Loader2 className="h-5 w-5 animate-spin" /> جاري تحميل البوستات…</div>;
  } else if (loadError) {
    body = <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-6 text-center text-rose-300">{loadError}</div>;
  } else if (draft && saved) {
    const warnCount = Object.keys(warnings).length;
    body = (
      <div className="space-y-4">
        {/* شريط الأدوات */}
        <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/90 p-2 backdrop-blur">
          <button onClick={closeEditor} className={cn(btn, "text-muted-foreground hover:text-foreground")}><ArrowRight className="h-4 w-4" /> البوستات</button>
          <div className="min-w-0 flex-1 truncate text-sm font-bold">
            {draft.title}
            {dirty && <span className="mr-2 text-xs font-semibold text-amber-400">● غير محفوظ</span>}
            {warnCount > 0 && <span className="mr-2 text-xs font-semibold text-amber-400">⚠ {warnCount} تنبيه</span>}
          </div>
          <button onClick={handleSave} disabled={!dirty || busy !== null} className={cn(btn, "bg-violet-600 text-white hover:bg-violet-500")}>
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ
          </button>
          <button onClick={() => setDraft(structuredClone(saved))} disabled={!dirty} className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")} title="رجوع لآخر نسخة محفوظة">
            <Undo2 className="h-4 w-4" /> <span className="hidden sm:inline">آخر نسخة محفوظة</span>
          </button>
          <button onClick={() => duplicate(draft)} disabled={busy !== null} className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")} title="تكرار البوست">
            <Copy className="h-4 w-4" /> <span className="hidden sm:inline">تكرار</span>
          </button>
          <button onClick={handlePng} disabled={busy !== null} className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")}>
            {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PNG
          </button>
          <button onClick={handleShare} disabled={busy !== null} className={cn(btn, "bg-emerald-600 text-white hover:bg-emerald-500")}>
            {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} مشاركة
          </button>
        </div>

        {/* تبويبات الجوال */}
        <div className="flex gap-1 rounded-xl border border-border bg-white/[0.04] p-1 lg:hidden">
          {(["edit", "preview"] as const).map((k) => (
            <button key={k} onClick={() => setMobileTab(k)} className={cn("flex-1 rounded-lg py-2 text-sm font-semibold", mobileTab === k ? "bg-violet-500/20 text-violet-300" : "text-muted-foreground")}>
              {k === "edit" ? "تعديل" : "معاينة"}
            </button>
          ))}
        </div>

        {/* تعديل يمين + معاينة يسار */}
        <div className="grid gap-5 lg:grid-cols-[minmax(340px,440px)_1fr]">
          <div className={cn(mobileTab !== "edit" && "hidden lg:block")}>
            <PostEditor post={draft} onChange={setDraft} warnings={warnings} onError={(m) => notify({ msg: m, tone: "err" })} />
          </div>
          <div className={cn("lg:sticky lg:top-20 lg:self-start", mobileTab !== "preview" && "hidden lg:block")}>
            <ScaledPreview post={draft} maxHeight={typeof window !== "undefined" ? Math.max(420, window.innerHeight - 170) : 800} />
            <p className="mt-2 text-center text-xs text-muted-foreground" dir="ltr">
              {TEMPLATE_SIZE[draft.template].w}×{TEMPLATE_SIZE[draft.template].h}
            </p>
          </div>
        </div>

        <ExportStage ref={stageRef} post={draft} />
      </div>
    );
  } else {
    body = (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => setPicking(true)} className={cn(btn, "bg-violet-600 text-white hover:bg-violet-500")}><Plus className="h-4 w-4" /> بوست جديد</button>
          <button onClick={handleZip} disabled={busy !== null || !posts.length} className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")}>
            {busy === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileArchive className="h-4 w-4" />} تصدير الكل ZIP
          </button>
          <div className="flex-1" />
          {modeBadge}
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {posts.map((p) => (
            <div key={p.id} className="group rounded-xl border border-border bg-card/60 p-2.5 transition-colors hover:border-violet-400/40">
              <button onClick={() => openEditor(p)} className="block w-full" aria-label={`تعديل ${p.title}`}>
                <ScaledPreview post={p} />
              </button>
              <div className="mt-2.5 flex flex-col gap-1 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{p.title || TEMPLATE_LABEL[p.template]}</div>
                  <div className="text-[11px] text-muted-foreground">{TEMPLATE_LABEL[p.template]}</div>
                </div>
                <div className="flex shrink-0 justify-end">
                  <button onClick={() => openEditor(p)} className="rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label="تعديل"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => duplicate(p)} className="rounded p-1.5 text-muted-foreground hover:text-foreground" aria-label="تكرار"><Copy className="h-4 w-4" /></button>
                  <button onClick={() => remove(p)} className="rounded p-1.5 text-muted-foreground hover:text-rose-400" aria-label="حذف"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {zipPosts?.map((p) => (
          <ExportStage key={p.id} post={p} ref={(el) => { zipStageRefs.current[p.id] = el; }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <StudioFonts onReady={onFontsReady} />
      {body}

      {/* اختيار القالب */}
      {picking && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={() => setPicking(false)}>
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-background p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">اختر القالب</h3>
              <button onClick={() => setPicking(false)} className="rounded p-1 text-muted-foreground hover:text-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {TEMPLATE_IDS.map((t) => (
                <button key={t} onClick={() => create(t)} className="rounded-xl border border-border p-2 text-center transition-colors hover:border-violet-400/60">
                  <ScaledPreview post={makeDefaultPost(t)} />
                  <div className="mt-2 text-xs font-bold">{TEMPLATE_LABEL[t]}</div>
                  <div className="text-[10px] text-muted-foreground" dir="ltr">{TEMPLATE_SIZE[t].w}×{TEMPLATE_SIZE[t].h}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={cn("fixed bottom-5 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold shadow-xl",
          toast.tone === "err" ? "bg-rose-600 text-white" : "bg-zinc-900 text-white border border-white/10")}>
          {toast.msg}
          {toast.action && (
            <button onClick={toast.action.run} className="rounded-lg bg-emerald-500 px-3 py-1.5 text-white">{toast.action.label}</button>
          )}
          <button onClick={() => setToast(null)} className="opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}
