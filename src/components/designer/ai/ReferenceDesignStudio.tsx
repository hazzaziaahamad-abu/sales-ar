"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle, ArrowRight, Download, ImagePlus, Loader2, Plus, Save, Share2, Sparkles, Trash2, Wand2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BG_LABEL, BULLET_LABEL, DECOR_LABEL, DESIGN_SIZE, FRAME_LABEL, HEADLINE_LABEL, LAYOUT_LABEL, SHADE_AREA_LABEL, SHADE_COLOR_HEX, SHADE_SWATCHES,
  THEME_LABEL, isPhotoLayout, withDesignDefaults,
  type AiDesign, type DesignDecor, type DesignSize,
} from "@/lib/ai-designs/types";
import { StudioFonts } from "../preview";
import { downloadBlob, fileToDataUrl, renderNodePng, shareFile } from "../export";
import { FLOW_KEY, measureFit, type FitWarnings } from "../measure";
import { AiPoster } from "./AiPoster";

// «صمّم من مرجع»: ارفع تصميم أعجبك → الذكاء يحلله ويطلع اقتراحات مشابهة لكن أفضل بهويتنا → عدّل وصدّر PNG.

const STORE_KEY = "ai-designs:v1";
const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50";
const inputCls =
  "w-full rounded-lg border border-border bg-white/[0.04] px-3 py-2 text-sm text-foreground outline-none focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20";

type RefImage = { dataUrl: string; mimeType: string; data: string };

const toInline = (dataUrl: string): RefImage => {
  const m = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  return { dataUrl, mimeType: m?.[1] ?? "image/png", data: m?.[2] ?? "" };
};

function loadSaved(): AiDesign[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    // تصاميم محفوظة من نسخة أقدم: نكمّل الحقول الجديدة
    return raw
      ? (JSON.parse(raw) as Partial<AiDesign>[]).map(withDesignDefaults)
      : [];
  } catch {
    return [];
  }
}
function storeSaved(list: AiDesign[]): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

// ─── عناصر صغيرة ─────────────────────────────────────────────────────────────

function Chips<T extends string>({ value, options, onChange }: { value: T; options: Record<T, string>; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {(Object.keys(options) as T[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={cn(
            "rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors",
            value === k ? "border-violet-400/60 bg-violet-500/20 text-violet-200" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {options[k]}
        </button>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function Slider({ label, value, onChange, min = 0, max = 100 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <label className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="w-20 shrink-0">{label}</span>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-violet-500" />
    </label>
  );
}

/** لون الظل: مربعات جاهزة + منتقي ألوان حر + كود HEX. */
function ShadeColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {SHADE_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            className={cn("h-7 w-7 rounded-full border-2", value.toLowerCase() === c.toLowerCase() ? "border-violet-400 ring-2 ring-violet-500/40" : "border-white/20")}
            style={{ background: c }}
          />
        ))}
        <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-white/40" title="لون مخصص"
          style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}>
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
        </label>
        <input
          dir="ltr"
          onChange={(e) => { const v = e.target.value.trim(); if (/^#?[0-9a-f]{6}$/i.test(v)) onChange(v.startsWith("#") ? v : `#${v}`); }}
          className="w-24 rounded-md border border-border bg-white/[0.04] px-2 py-1 text-left font-mono text-xs"
          key={value}
          defaultValue={value}
        />
      </div>
    </div>
  );
}

function TextField({ label, value, onChange, multiline, hint, warn }: {
  label: string; value: string; onChange: (v: string) => void; multiline?: boolean; hint?: string; warn?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-muted-foreground">{label}</span>
      {multiline ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "resize-y leading-relaxed", warn && "border-amber-400/60")} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, warn && "border-amber-400/60")} />
      )}
      {hint && <span className="mt-1 block text-[11px] text-muted-foreground">{hint}</span>}
      {warn && <span className="mt-1 flex items-center gap-1 text-xs text-amber-400"><AlertTriangle className="h-3.5 w-3.5" />{warn}</span>}
    </label>
  );
}

/** معاينة مصغّرة لأي تصميم: يُرسم بمقاسه الحقيقي ثم يُصغّر. */
function DesignPreview({ design, maxHeight }: { design: AiDesign; maxHeight?: number }) {
  const { w, h } = DESIGN_SIZE[design.size];
  const box = useRef<HTMLDivElement>(null);
  const [avail, setAvail] = useState(0);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setAvail(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const scale = avail ? Math.min(avail / w, maxHeight ? maxHeight / h : Infinity) : 0;
  return (
    <div ref={box} style={{ width: "100%" }}>
      <div
        style={{
          position: "relative", width: w * scale, height: h * scale, overflow: "hidden", margin: "0 auto",
          borderRadius: 10, boxShadow: "0 10px 30px rgba(0,0,0,0.25)", visibility: scale ? "visible" : "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 0, left: 0, width: w, height: h, transform: `scale(${scale})`, transformOrigin: "0 0" }}>
          <AiPoster design={design} />
        </div>
      </div>
    </div>
  );
}

function ImagePicker({ onPick, label, multiple, className }: { onPick: (files: File[]) => void; label: ReactNode; multiple?: boolean; className?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" onClick={() => ref.current?.click()} className={className}>{label}</button>
      <input
        ref={ref}
        type="file"
        accept="image/*"
        multiple={multiple}
        className="hidden"
        onChange={(e) => { onPick(Array.from(e.target.files ?? [])); e.target.value = ""; }}
      />
    </>
  );
}

// ─── الاستوديو ───────────────────────────────────────────────────────────────

export function ReferenceDesignStudio() {
  const [refs, setRefs] = useState<RefImage[]>([]);
  const [brief, setBrief] = useState("");
  const [size, setSize] = useState<DesignSize>("portrait");
  const [count, setCount] = useState(3);
  const [productImage, setProductImage] = useState<string | undefined>();
  /** صورة خلفية حقيقية يرفعها المستخدم — تنحط في كل الاقتراحات بدل توليد صورة. */
  const [bgPhoto, setBgPhoto] = useState<string | undefined>();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState("");
  const [results, setResults] = useState<AiDesign[]>([]);
  const [saved, setSaved] = useState<AiDesign[]>([]);
  const [draft, setDraft] = useState<AiDesign | null>(null);
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState<null | "refine" | "png" | "share">(null);
  const [toast, setToast] = useState<{ msg: string; tone?: "ok" | "err" } | null>(null);
  const [warnings, setWarnings] = useState<FitWarnings>({});
  const [fontsReady, setFontsReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [autoPhotos, setAutoPhotos] = useState(true);
  /** معرّفات التصاميم اللي صورتها قيد التوليد. */
  const [photoBusy, setPhotoBusy] = useState<Record<string, boolean>>({});
  const stageRef = useRef<HTMLDivElement>(null);

  const onFontsReady = useCallback(() => setFontsReady(true), []);
  const notify = useCallback((msg: string, tone?: "ok" | "err") => {
    const t = { msg, tone };
    setToast(t);
    setTimeout(() => setToast((cur) => (cur === t ? null : cur)), 3500);
  }, []);

  useEffect(() => { setSaved(loadSaved()); }, []);

  const addRefs = useCallback(async (files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    try {
      const out = await Promise.all(imgs.slice(0, 3).map((f) => fileToDataUrl(f, 1400)));
      setRefs((cur) => [...cur, ...out.map(toInline)].slice(0, 3));
    } catch {
      notify("تعذّر قراءة الصورة", "err");
    }
  }, [notify]);

  // لصق صورة من الحافظة (Ctrl+V) لما نكون بصفحة الإدخال
  useEffect(() => {
    if (draft) return;
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (files.length) { e.preventDefault(); addRefs(files); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [draft, addRefs]);

  // قياس هل المحتوى أطول من البوست
  useEffect(() => {
    if (!draft) return;
    const id = setTimeout(() => requestAnimationFrame(() => setWarnings(measureFit(stageRef.current))), 150);
    return () => clearTimeout(id);
  }, [draft, fontsReady]);

  const pickProduct = async (files: File[]) => {
    if (!files[0]) return;
    try {
      const url = await fileToDataUrl(files[0], 1400);
      setProductImage(url);
      if (draft) setDraft({ ...draft, image: url, imageFrame: draft.imageFrame === "none" ? "phone" : draft.imageFrame });
    } catch {
      notify("تعذّر قراءة الصورة", "err");
    }
  };

  /** يطلب صورة خلفية من نموذج الصور ويصغّرها (WebP) عشان الحفظ والتصدير يكونون خفاف. */
  const requestPhoto = useCallback(async (d: AiDesign): Promise<string> => {
    const res = await fetch("/api/ai/design-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: d.photoPrompt,
        size: d.size,
        textSide: d.layout === "photoBottom" ? "bottom" : d.layout === "photoSplit" ? "none" : "top",
        screen: productImage ? toInline(productImage) : undefined,
        styleRef: refs[0] ? { mimeType: refs[0].mimeType, data: refs[0].data } : undefined,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "تعذّر توليد الصورة");
    const blob = await (await fetch(json.image)).blob();
    return fileToDataUrl(new File([blob], "photo", { type: blob.type }), 1600);
  }, [productImage, refs]);

  const fillPhotos = useCallback(async (designs: AiDesign[]) => {
    const targets = designs.filter((d) => isPhotoLayout(d.layout) && d.photoPrompt && !d.photo);
    setPhotoBusy((b) => ({ ...b, ...Object.fromEntries(targets.map((d) => [d.id, true])) }));
    await Promise.all(targets.map(async (d) => {
      try {
        const photo = await requestPhoto(d);
        setResults((all) => all.map((x) => (x.id === d.id ? { ...x, photo } : x)));
        setDraft((cur) => (cur && cur.id === d.id && !cur.photo ? { ...cur, photo } : cur));
      } catch (e) {
        notify(e instanceof Error ? e.message : "تعذّر توليد الصورة", "err");
      } finally {
        setPhotoBusy((b) => ({ ...b, [d.id]: false }));
      }
    }));
  }, [requestPhoto, notify]);

  const regenPhoto = async () => {
    if (!draft?.photoPrompt) return notify("اكتب وصف الصورة أول", "err");
    setPhotoBusy((b) => ({ ...b, [draft.id]: true }));
    try {
      const photo = await requestPhoto(draft);
      setDraft((cur) => (cur ? { ...cur, photo } : cur));
    } catch (e) {
      notify(e instanceof Error ? e.message : "تعذّر توليد الصورة", "err");
    } finally {
      setPhotoBusy((b) => ({ ...b, [draft.id]: false }));
    }
  };

  const uploadPhoto = async (files: File[]) => {
    if (!files[0] || !draft) return;
    try {
      const url = await fileToDataUrl(files[0], 1600);
      setDraft({ ...draft, photo: url, layout: isPhotoLayout(draft.layout) ? draft.layout : "photo" });
    } catch {
      notify("تعذّر قراءة الصورة", "err");
    }
  };

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/design-from-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: refs.map(({ mimeType, data }) => ({ mimeType, data })),
          brief, size, count, hasProductImage: !!productImage,
          hasBackgroundPhoto: !!bgPhoto,
          backgroundPhoto: bgPhoto ? (({ mimeType, data }) => ({ mimeType, data }))(toInline(bgPhoto)) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل التوليد");
      setAnalysis(json.analysis || "");
      const designs = (json.designs as AiDesign[]).map((d) => ({
        ...d, image: productImage,
        ...(bgPhoto ? { photo: bgPhoto, layout: isPhotoLayout(d.layout) ? d.layout : ("photo" as const) } : {}),
      }));
      setResults(designs);
      if (autoPhotos) fillPhotos(designs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "فشل التوليد");
    } finally {
      setGenerating(false);
    }
  };

  const refine = async () => {
    if (!draft || !instruction.trim()) return;
    setBusy("refine");
    try {
      const res = await fetch("/api/ai/design-from-reference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "refine", current: draft, instruction, size: draft.size, hasProductImage: !!draft.image,
          images: refs.slice(0, 1).map(({ mimeType, data }) => ({ mimeType, data })),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "فشل التعديل");
      const next = json.design as AiDesign;
      const keepPhoto = next.photoPrompt === draft.photoPrompt || !next.photoPrompt;
      setDraft({
        ...next, id: draft.id, image: draft.image, name: next.name || draft.name,
        photo: keepPhoto ? draft.photo : undefined, photoPrompt: next.photoPrompt || draft.photoPrompt,
        photoX: draft.photoX, photoY: draft.photoY, photoZoom: draft.photoZoom, spotX: draft.spotX, spotY: draft.spotY,
        shadeHex: draft.shadeHex, shadeHex2: draft.shadeHex2, shadeSoft: draft.shadeSoft, shadeAngle: draft.shadeAngle,
      });
      if (!keepPhoto) notify("الذكاء غيّر وصف الصورة — اضغط «ولّد صورة» لو تبي صورة جديدة");
      else notify("تم التعديل", "ok");
      setInstruction("");
    } catch (e) {
      notify(e instanceof Error ? e.message : "فشل التعديل", "err");
    } finally {
      setBusy(null);
    }
  };

  const set = <K extends keyof AiDesign>(k: K, v: AiDesign[K]) => setDraft((d) => (d ? { ...d, [k]: v, updatedAt: new Date().toISOString() } : d));

  const saveDraft = () => {
    if (!draft) return;
    const next = [draft, ...saved.filter((s) => s.id !== draft.id)].slice(0, 30);
    if (storeSaved(next)) { setSaved(next); notify("انحفظ في «تصاميمي» على هذا الجهاز", "ok"); }
    else if (storeSaved(next.map((d) => ({ ...d, image: undefined })))) {
      setSaved(next.map((d) => ({ ...d, image: undefined })));
      notify("انحفظ — بدون الصور لأن مساحة المتصفح امتلت", "ok");
    } else notify("تعذّر الحفظ في المتصفح", "err");
  };

  const removeSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    storeSaved(next);
    setSaved(next);
  };

  const png = async () => {
    if (!draft || !stageRef.current) throw new Error("التصميم مو جاهز");
    const { w, h } = DESIGN_SIZE[draft.size];
    return renderNodePng(stageRef.current, w, h);
  };
  const fileName = (d: AiDesign) => `${(d.name || "تصميم").replace(/[\\/:*?"<>|]+/g, "-")}.png`;

  const handlePng = async () => {
    if (!draft) return;
    setBusy("png");
    try {
      downloadBlob(await png(), fileName(draft));
      const { w, h } = DESIGN_SIZE[draft.size];
      notify(`تم التصدير ${w}×${h}`, "ok");
    } catch {
      notify("تعذّر تصدير الصورة", "err");
    } finally {
      setBusy(null);
    }
  };
  const handleShare = async () => {
    if (!draft) return;
    setBusy("share");
    try {
      const blob = await png();
      const r = await shareFile(new File([blob], fileName(draft), { type: "image/png" }));
      if (r === "needs-gesture") notify("الصورة جاهزة — اضغط «مشاركة» مرة ثانية");
      if (r === "downloaded") notify("تم تنزيل الصورة", "ok");
    } catch {
      notify("تعذّرت المشاركة", "err");
    } finally {
      setBusy(null);
    }
  };

  const toastEl = toast && (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-xl",
        toast.tone === "err" ? "bg-rose-600 text-white" : toast.tone === "ok" ? "bg-emerald-600 text-white" : "bg-zinc-800 text-white"
      )}
    >
      {toast.msg}
    </div>
  );

  // ─── شاشة التعديل ───
  if (draft) {
    const warnCount = Object.keys(warnings).length;
    const toggleDecor = (k: DesignDecor) =>
      set("decor", draft.decor.includes(k) ? draft.decor.filter((x) => x !== k) : [...draft.decor, k].slice(0, 3));
    return (
      <div className="space-y-4">
        <StudioFonts onReady={onFontsReady} />
        <div className="sticky top-0 z-20 -mx-1 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-background/90 p-2 backdrop-blur">
          <button onClick={() => setDraft(null)} className={cn(btn, "text-muted-foreground hover:text-foreground")}><ArrowRight className="h-4 w-4" /> الاقتراحات</button>
          <div className="min-w-0 flex-1 truncate text-sm font-bold">
            {draft.name}
            {warnCount > 0 && <span className="mr-2 text-xs font-semibold text-amber-400">⚠ {warnCount} تنبيه</span>}
          </div>
          <button onClick={saveDraft} className={cn(btn, "bg-violet-600 text-white hover:bg-violet-500")}><Save className="h-4 w-4" /> حفظ</button>
          <button onClick={handlePng} disabled={busy !== null} className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")}>
            {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} PNG
          </button>
          <button onClick={handleShare} disabled={busy !== null} className={cn(btn, "bg-emerald-600 text-white hover:bg-emerald-500")}>
            {busy === "share" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />} مشاركة
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(340px,440px)_1fr]">
          <div className="space-y-3">
            {/* تعديل بالذكاء */}
            <div className="rounded-xl border border-violet-500/30 bg-violet-500/[0.06] p-3">
              <span className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-violet-300"><Wand2 className="h-3.5 w-3.5" /> اطلب تعديل بالكلام</span>
              <div className="flex gap-2">
                <input
                  value={instruction}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") refine(); }}
                  placeholder="مثلاً: خلّه داكن وأجرأ، واختصر العنوان، وركّز على الطلب من الطاولة"
                  className={inputCls}
                />
                <button onClick={refine} disabled={busy !== null || !instruction.trim()} className={cn(btn, "shrink-0 bg-violet-600 text-white hover:bg-violet-500")}>
                  {busy === "refine" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {warnings[FLOW_KEY] && (
              <p className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0" /> {warnings[FLOW_KEY]}
              </p>
            )}

            <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
              <h3 className="text-sm font-bold">الكلام</h3>
              <TextField label="عبارة فوق العنوان" value={draft.eyebrow ?? ""} onChange={(v) => set("eyebrow", v || undefined)} warn={warnings.eyebrow} />
              <TextField label="العنوان" value={draft.headline} onChange={(v) => set("headline", v)} multiline hint="كل سطر بسطر (Enter) · ميّز كلمة باللون بكتابتها بين [[ ]] · الكشيدة «ـــ» تمد الكلمة" />
              <TextField label="السطر الداعم" value={draft.subheadline ?? ""} onChange={(v) => set("subheadline", v || undefined)} multiline />
              <Row label="النقاط (كل سطر نقطة)">
                <textarea
                  rows={4}
                  value={draft.bullets.join("\n")}
                  onChange={(e) => set("bullets", e.target.value.split("\n").slice(0, 6))}
                  onBlur={() => set("bullets", draft.bullets.map((b) => b.trim()).filter(Boolean))}
                  className={cn(inputCls, "resize-y leading-relaxed")}
                />
              </Row>
              <div className="grid grid-cols-2 gap-2">
                <TextField label="رقم بارز" value={draft.stat?.value ?? ""} onChange={(v) => set("stat", v ? { value: v, label: draft.stat?.label ?? "" } : undefined)} />
                <TextField label="وصف الرقم" value={draft.stat?.label ?? ""} onChange={(v) => draft.stat && set("stat", { ...draft.stat, label: v })} />
              </div>
              <TextField label="زر الدعوة (CTA)" value={draft.cta ?? ""} onChange={(v) => set("cta", v || undefined)} warn={warnings.cta} multiline hint="سطرين = كبسولتين كبار (ذهبي + أبيض)" />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={draft.showContact} onChange={(e) => set("showContact", e.target.checked)} className="accent-violet-500" />
                إظهار أرقام التواصل
              </label>
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
              <h3 className="text-sm font-bold">صورة الخلفية</h3>
              <div className="flex flex-wrap items-center gap-2">
                {draft.photo && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={draft.photo} alt="" className="h-14 w-14 rounded-lg object-cover" />
                )}
                <ImagePicker onPick={uploadPhoto} label={<><ImagePlus className="h-4 w-4" /> {draft.photo ? "تغيير بصورة حقيقية" : "ارفع صورة حقيقية"}</>} className={cn(btn, "bg-violet-600 text-white hover:bg-violet-500")} />
                {draft.photo && <button onClick={() => set("photo", undefined)} className={cn(btn, "text-rose-400 hover:bg-rose-500/10")}><Trash2 className="h-4 w-4" /> حذف</button>}
              </div>
              {!isPhotoLayout(draft.layout) && (
                <p className="text-[11px] text-muted-foreground">رفع صورة يحوّل التصميم لتخطيط «صورة كاملة» تلقائياً.</p>
              )}

              {isPhotoLayout(draft.layout) && (
                <>
                  <details className="rounded-lg border border-border px-3 py-2">
                    <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">أو ولّدها بالذكاء</summary>
                    <div className="mt-2 space-y-2">
                      <TextField
                        label="وصف الصورة (يفضّل بالإنجليزي)"
                        value={draft.photoPrompt ?? ""}
                        onChange={(v) => set("photoPrompt", v)}
                        multiline
                        hint="مثلاً: Saudi man in white thobe holding a phone showing a menu, warm restaurant, blurred background"
                      />
                      <button onClick={regenPhoto} disabled={!!photoBusy[draft.id]} className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")}>
                        {photoBusy[draft.id] ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        {draft.photo ? "ولّد صورة ثانية" : "ولّد الصورة"}
                      </button>
                      <p className="text-[11px] text-muted-foreground">لو رفعت لقطة شاشة المنيو، الذكاء يحطها على شاشة الجوال داخل الصورة.</p>
                    </div>
                  </details>

                  {draft.photo && (
                    <div className="grid gap-2">
                      <Slider label="يمين/يسار" value={draft.photoX} onChange={(v) => set("photoX", v)} />
                      <Slider label="فوق/تحت" value={draft.photoY} onChange={(v) => set("photoY", v)} />
                      <Slider label="تكبير" value={Math.round(((draft.photoZoom ?? 1) - 1) / 1.5 * 100)} onChange={(v) => set("photoZoom", 1 + (v / 100) * 1.5)} />
                    </div>
                  )}

                  <div className="space-y-2 border-t border-border pt-3">
                    <h4 className="text-xs font-bold">تضليل جزء من الصورة</h4>
                    <Chips value={draft.shadeArea ?? "auto"} options={SHADE_AREA_LABEL} onChange={(v) => set("shadeArea", v)} />
                    {draft.shadeArea !== "none" && (
                      <>
                        <ShadeColorPicker
                          label="لون الظل"
                          value={draft.shadeHex || SHADE_COLOR_HEX[draft.shadeColor ?? "dark"]}
                          onChange={(v) => set("shadeHex", v)}
                        />
                        <label className="flex items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={!!draft.shadeHex2}
                            onChange={(e) => set("shadeHex2", e.target.checked ? "#4A2C9F" : undefined)}
                            className="accent-violet-500"
                          />
                          تدرّج لونين
                        </label>
                        {draft.shadeHex2 && (
                          <ShadeColorPicker label="اللون الثاني" value={draft.shadeHex2} onChange={(v) => set("shadeHex2", v)} />
                        )}
                        <Slider label={`قوة الظل ${Math.round(draft.shade * 100)}%`} value={Math.round(draft.shade * 100)} onChange={(v) => set("shade", v / 100)} />
                        {draft.shadeArea !== "auto" && draft.shadeArea !== "full" && (
                          <>
                            <Slider label={draft.shadeArea === "spot" ? "حجم الدائرة" : `المساحة ${draft.shadeSize ?? 55}%`} min={15} value={draft.shadeSize ?? 55} onChange={(v) => set("shadeSize", v)} />
                            <Slider label={`النعومة ${draft.shadeSoft ?? 60}%`} value={draft.shadeSoft ?? 60} onChange={(v) => set("shadeSoft", v)} />
                          </>
                        )}
                        {(draft.shadeArea === "angle" || (draft.shadeArea === "full" && draft.shadeHex2)) && (
                          <Slider label={`الزاوية ${draft.shadeAngle ?? 180}°`} max={359} value={draft.shadeAngle ?? 180} onChange={(v) => set("shadeAngle", v)} />
                        )}
                        {draft.shadeArea === "spot" && (
                          <>
                            <Slider label="الدائرة ←→" value={draft.spotX ?? 50} onChange={(v) => set("spotX", v)} />
                            <Slider label="الدائرة ↑↓" value={draft.spotY ?? 60} onChange={(v) => set("spotY", v)} />
                          </>
                        )}
                      </>
                    )}
                    <p className="text-[11px] text-muted-foreground">
                      اختر الجزء اللي تبيه يغمق عشان يبان الكلام فوقه — أو «كل شي إلا دائرة» عشان تبرز الشخص أو الجوال.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-border bg-card/60 p-4">
              <h3 className="text-sm font-bold">الشكل</h3>
              <Row label="المقاس"><Chips value={draft.size} options={{ square: DESIGN_SIZE.square.label, portrait: DESIGN_SIZE.portrait.label, story: DESIGN_SIZE.story.label }} onChange={(v) => set("size", v)} /></Row>
              <Row label="التخطيط"><Chips value={draft.layout} options={LAYOUT_LABEL} onChange={(v) => set("layout", v)} /></Row>
              <Row label="شكل العنوان"><Chips value={draft.headlineStyle} options={HEADLINE_LABEL} onChange={(v) => set("headlineStyle", v)} /></Row>
              <Row label="الثيم"><Chips value={draft.theme} options={THEME_LABEL} onChange={(v) => set("theme", v)} /></Row>
              <Row label="الخلفية"><Chips value={draft.background} options={BG_LABEL} onChange={(v) => set("background", v)} /></Row>
              <Row label="المحاذاة"><Chips value={draft.align} options={{ center: "منتصف", start: "يمين" }} onChange={(v) => set("align", v)} /></Row>
              <Row label="شكل النقاط"><Chips value={draft.bulletStyle} options={BULLET_LABEL} onChange={(v) => set("bulletStyle", v)} /></Row>
              <Row label="زخارف">
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(DECOR_LABEL) as DesignDecor[]).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleDecor(k)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-semibold",
                        draft.decor.includes(k) ? "border-violet-400/60 bg-violet-500/20 text-violet-200" : "border-border text-muted-foreground"
                      )}
                    >
                      {DECOR_LABEL[k]}
                    </button>
                  ))}
                </div>
              </Row>
              <Row label="صورة المنتج / الشاشة">
                <div className="space-y-2">
                  <Chips value={draft.imageFrame} options={FRAME_LABEL} onChange={(v) => set("imageFrame", v)} />
                  <div className="flex items-center gap-2">
                    {draft.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.image} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    )}
                    <ImagePicker onPick={pickProduct} label={<><ImagePlus className="h-4 w-4" /> {draft.image ? "تغيير" : "رفع صورة"}</>} className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")} />
                    {draft.image && <button onClick={() => set("image", undefined)} className={cn(btn, "text-rose-400 hover:bg-rose-500/10")}><Trash2 className="h-4 w-4" /></button>}
                  </div>
                </div>
              </Row>
            </div>
          </div>

          <div className="lg:sticky lg:top-20 lg:self-start">
            <DesignPreview design={draft} maxHeight={760} />
            <p className="mt-2 text-center text-xs text-muted-foreground" dir="ltr">
              {DESIGN_SIZE[draft.size].w}×{DESIGN_SIZE[draft.size].h}
            </p>
          </div>
        </div>

        {/* مسرح التصدير بالمقاس الحقيقي خارج الشاشة */}
        <div aria-hidden style={{ position: "fixed", top: 0, left: -30000, pointerEvents: "none", zIndex: -1 }}>
          <div ref={stageRef} style={{ width: DESIGN_SIZE[draft.size].w, height: DESIGN_SIZE[draft.size].h }}>
            <AiPoster design={draft} />
          </div>
        </div>
        {toastEl}
      </div>
    );
  }

  // ─── شاشة الإدخال + الاقتراحات ───
  return (
    <div className="space-y-6">
      <StudioFonts onReady={onFontsReady} />
      <div className="grid gap-5 lg:grid-cols-[minmax(340px,460px)_1fr]">
        <div className="space-y-4 rounded-2xl border border-border bg-card/60 p-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-extrabold"><Sparkles className="h-4 w-4 text-violet-400" /> صمّم من مرجع</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              ارفع تصميم أعجبك من أي براند، واكتب عن ايش البوست — ونطلع لك اقتراحات مشابهة لكن أقوى، بهوية قائمة الطلبات وكلامنا.
            </p>
          </div>

          <Row label="1 · التصميم المرجعي (حتى 3 صور — تقدر تلصقها Ctrl+V)">
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addRefs(Array.from(e.dataTransfer.files)); }}
              className={cn(
                "rounded-xl border-2 border-dashed p-3 transition-colors",
                dragOver ? "border-violet-400 bg-violet-500/10" : "border-border"
              )}
            >
              <div className="flex flex-wrap gap-2">
                {refs.map((r, i) => (
                  <div key={i} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.dataUrl} alt="" className="h-24 w-24 rounded-lg object-cover" />
                    <button
                      onClick={() => setRefs((cur) => cur.filter((_, j) => j !== i))}
                      className="absolute -left-1.5 -top-1.5 rounded-full bg-rose-600 p-0.5 text-white"
                      aria-label="حذف"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {refs.length < 3 && (
                  <ImagePicker
                    multiple
                    onPick={addRefs}
                    label={<><ImagePlus className="h-5 w-5" /><span className="text-[11px]">رفع / سحب</span></>}
                    className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg bg-white/[0.04] text-muted-foreground hover:bg-white/[0.08] hover:text-foreground"
                  />
                )}
              </div>
            </div>
          </Row>

          <Row label="2 · عن ايش البوست؟">
            <textarea
              rows={4}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="مثلاً: عرض اليوم الوطني خصم 20% على باقة VIP لين نهاية الشهر — أو: ميزة الطلب من باركود الطاولة"
              className={cn(inputCls, "resize-y leading-relaxed")}
            />
          </Row>

          <Row label="3 · المقاس">
            <Chips value={size} options={{ square: DESIGN_SIZE.square.label, portrait: DESIGN_SIZE.portrait.label, story: DESIGN_SIZE.story.label }} onChange={setSize} />
          </Row>

          <Row label="صورة خلفية حقيقية (اختياري — صورة مطعمك/فريقك/منتجك بدل صورة الذكاء)">
            <div className="flex items-center gap-2">
              {bgPhoto && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={bgPhoto} alt="" className="h-12 w-12 rounded-lg object-cover" />
              )}
              <ImagePicker
                onPick={async (files) => {
                  if (!files[0]) return;
                  try { setBgPhoto(await fileToDataUrl(files[0], 1600)); } catch { notify("تعذّر قراءة الصورة", "err"); }
                }}
                label={<><ImagePlus className="h-4 w-4" /> {bgPhoto ? "تغيير" : "رفع صورة"}</>}
                className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")}
              />
              {bgPhoto && <button onClick={() => setBgPhoto(undefined)} className={cn(btn, "text-rose-400 hover:bg-rose-500/10")}><Trash2 className="h-4 w-4" /></button>}
            </div>
          </Row>

          <Row label="لقطة شاشة المنيو / المنتج (اختياري — تنحط على الجوال في الصورة)">
            <div className="flex items-center gap-2">
              {productImage && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={productImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
              )}
              <ImagePicker onPick={pickProduct} label={<><ImagePlus className="h-4 w-4" /> {productImage ? "تغيير" : "رفع صورة"}</>} className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")} />
              {productImage && <button onClick={() => setProductImage(undefined)} className={cn(btn, "text-rose-400 hover:bg-rose-500/10")}><Trash2 className="h-4 w-4" /></button>}
            </div>
          </Row>

          <Row label="عدد الاقتراحات">
            <Chips value={String(count) as "2" | "3" | "4"} options={{ "2": "2", "3": "3", "4": "4" }} onChange={(v) => setCount(Number(v))} />
          </Row>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoPhotos} onChange={(e) => setAutoPhotos(e.target.checked)} className="accent-violet-500" />
            ولّد صور فوتوغرافية بالذكاء (شخص/مطعم/جوال) للتصاميم اللي فيها صورة
          </label>
          <button
            onClick={generate}
            disabled={generating || (!refs.length && !brief.trim())}
            className={cn(btn, "w-full justify-center bg-violet-600 py-3 text-base text-white hover:bg-violet-500")}
          >
            {generating ? <><Loader2 className="h-5 w-5 animate-spin" /> جاري تحليل المرجع والتصميم…</> : <><Wand2 className="h-5 w-5" /> ولّد التصاميم</>}
          </button>
          {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">{error}</p>}
        </div>

        <div className="space-y-4">
          {analysis && (
            <div className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-sm leading-relaxed">
              <span className="font-bold text-violet-300">تحليل المرجع: </span>{analysis}
            </div>
          )}
          {results.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {results.map((d) => (
                <button
                  key={d.id}
                  onClick={() => { setDraft(structuredClone(d)); window.scrollTo({ top: 0 }); }}
                  className="group space-y-2 rounded-2xl border border-border bg-card/60 p-3 text-right transition-colors hover:border-violet-400/60"
                >
                  <div className="relative">
                    <DesignPreview design={d} maxHeight={420} />
                    {photoBusy[d.id] && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="flex items-center gap-1.5 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" /> نصوّر المشهد…
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-bold group-hover:text-violet-300">{d.name}</div>
                  {d.note && <div className="text-xs leading-relaxed text-muted-foreground">{d.note}</div>}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
              {generating ? <Loader2 className="h-8 w-8 animate-spin text-violet-400" /> : <Sparkles className="h-8 w-8 text-violet-400/60" />}
              {generating ? "نحلل التصميم ونكتب الكلام…" : "الاقتراحات بتطلع هنا. اضغط على أي واحد عشان تعدّله وتصدّره."}
            </div>
          )}
        </div>
      </div>

      {saved.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-bold">تصاميمي المحفوظة</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {saved.map((d) => (
              <div key={d.id} className="group relative space-y-1.5 rounded-xl border border-border bg-card/60 p-2">
                <button onClick={() => { setDraft(structuredClone(d)); window.scrollTo({ top: 0 }); }} className="block w-full text-right">
                  <DesignPreview design={d} maxHeight={240} />
                  <div className="mt-1.5 truncate text-xs font-bold">{d.name}</div>
                </button>
                <button
                  onClick={() => { if (confirm(`حذف «${d.name}»؟`)) removeSaved(d.id); }}
                  className="absolute left-3 top-3 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="حذف"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={() => setDraft({
          id: crypto.randomUUID(), name: "تصميم يدوي", size, layout: "photo", theme: "dark", background: "solid", align: "center",
          decor: [], headline: "منيو واضح\nعميل مرتاح\nمبيـــعات أعلى", headlineStyle: "marker", bullets: [], bulletStyle: "tags",
          showContact: true, imageFrame: "none", image: productImage, cta: "", photoX: 50, photoY: 50, shade: 0.55,
          shadeArea: "auto", shadeSize: 55, shadeColor: "dark", shadeSoft: 60, shadeAngle: 180, spotX: 50, spotY: 60, photoZoom: 1, photo: bgPhoto,
          photoPrompt: "Close-up of a hand holding a smartphone showing a restaurant digital menu, a QR code table stand on a wooden table, cozy modern Saudi restaurant with warm bokeh lights",
          updatedAt: new Date().toISOString(),
        })}
        className={cn(btn, "bg-white/[0.06] hover:bg-white/[0.1]")}
      >
        <Plus className="h-4 w-4" /> ابدأ تصميم فاضي بدون ذكاء
      </button>
      {toastEl}
    </div>
  );
}
