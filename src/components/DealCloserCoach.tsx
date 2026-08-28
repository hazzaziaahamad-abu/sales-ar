"use client";

import { useRef, useState } from "react";
import { Bot, ImagePlus, Send, Loader2, X, Copy, Check, Flame, MessageSquare, Target, TrendingUp, AlertTriangle } from "lucide-react";

type Coach = {
  diagnosis: string;
  real_objection: string;
  recommended_reply: string;
  closing_question: string;
  next_step: string;
  risk: string;
};

type Img = { mimeType: string; data: string; preview: string };

// تصغير الصورة قبل الإرسال لتقليل الحجم
function fileToImg(file: File): Promise<Img> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const el = new window.Image();
      el.onload = () => {
        const maxW = 1100;
        const scale = Math.min(1, maxW / el.width);
        const w = Math.round(el.width * scale);
        const h = Math.round(el.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("no ctx"));
        ctx.drawImage(el, 0, 0, w, h);
        const url = canvas.toDataURL("image/jpeg", 0.82);
        resolve({ mimeType: "image/jpeg", data: url.split(",")[1], preview: url });
      };
      el.onerror = () => reject(new Error("img error"));
      el.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("read error"));
    reader.readAsDataURL(file);
  });
}

export function DealCloserCoach({ context }: { context: Record<string, unknown> }) {
  const [text, setText] = useState("");
  const [images, setImages] = useState<Img[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Coach | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFiles(files: FileList | null) {
    if (!files) return;
    try {
      const arr = await Promise.all(Array.from(files).slice(0, 4).map(fileToImg));
      setImages((prev) => [...prev, ...arr].slice(0, 4));
    } catch { /* ignore */ }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function analyze() {
    if (!text.trim() && images.length === 0) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const r = await fetch("/api/ai/deal-coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          context,
          conversation: text,
          images: images.map((i) => ({ mimeType: i.mimeType, data: i.data })),
        }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.error || "فشل التحليل");
      else setResult(j as Coach);
    } catch {
      setError("تعذّر الاتصال — حاول مرة ثانية");
    }
    setLoading(false);
  }

  function copyReply() {
    if (!result) return;
    navigator.clipboard?.writeText(result.recommended_reply).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }

  return (
    <div className="rounded-xl border border-violet-500/25 bg-gradient-to-bl from-violet-500/[0.06] to-transparent p-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <Bot className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <p className="text-xs font-bold text-foreground">مساعد الإغلاق الذكي</p>
          <p className="text-[11px] text-muted-foreground">الصق رسالة العميل أو ارفع صورة المحادثة — يعطيك الرد الأمثل</p>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="مثال: العميل يقول «السعر غالي عليّ»… أو الصق المحادثة كاملة"
        className="w-full rounded-lg bg-background/60 border border-border/50 text-xs text-foreground p-2.5 outline-none focus:border-violet-500/40 resize-y"
      />

      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {images.map((im, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={im.preview} alt="محادثة" className="h-16 w-16 object-cover rounded-lg border border-border/50" />
              <button
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-cc-red text-white flex items-center justify-center"
                aria-label="حذف"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-2">
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 text-[12px] px-2.5 py-1.5 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ImagePlus className="w-3.5 h-3.5" /> صورة المحادثة
        </button>
        <button
          onClick={analyze}
          disabled={loading || (!text.trim() && images.length === 0)}
          className="flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors disabled:opacity-50 mr-auto"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          حلّل وأعطني الرد
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-cc-red">{error}</p>}

      {result && (
        <div className="mt-3 space-y-2">
          <CoachBox icon={<Target className="w-3.5 h-3.5" />} label="التشخيص" color="text-cyan" body={result.diagnosis} />
          {result.real_objection && (
            <CoachBox icon={<Flame className="w-3.5 h-3.5" />} label="الاعتراض الحقيقي" color="text-amber-400" body={result.real_objection} />
          )}
          <div className="rounded-lg border border-cc-green/30 bg-cc-green/[0.06] p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="flex items-center gap-1 text-[12px] font-black text-cc-green"><MessageSquare className="w-3.5 h-3.5" /> الرد المقترح — أرسله الآن</span>
              <button onClick={copyReply} className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-cc-green/30 text-cc-green hover:bg-cc-green/10">
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} {copied ? "نُسخ" : "نسخ"}
              </button>
            </div>
            <p className="text-[13px] leading-relaxed text-foreground whitespace-pre-wrap">{result.recommended_reply}</p>
          </div>
          <CoachBox icon={<TrendingUp className="w-3.5 h-3.5" />} label="سؤال الإغلاق" color="text-cc-purple" body={result.closing_question} />
          <CoachBox icon={<Send className="w-3.5 h-3.5" />} label="الخطوة التالية" color="text-foreground" body={result.next_step} />
          {result.risk && (
            <CoachBox icon={<AlertTriangle className="w-3.5 h-3.5" />} label="انتبه" color="text-cc-red" body={result.risk} />
          )}
        </div>
      )}
    </div>
  );
}

function CoachBox({ icon, label, color, body }: { icon: React.ReactNode; label: string; color: string; body: string }) {
  return (
    <div className="rounded-lg border border-border/40 bg-white/[0.02] p-2.5">
      <div className={`flex items-center gap-1 text-[12px] font-black mb-0.5 ${color}`}>{icon} {label}</div>
      <p className="text-[12px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
