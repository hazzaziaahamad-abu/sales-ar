"use client";

import { useMemo, useState } from "react";
import { Anchor, Check, Copy, Search, Shuffle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { HOOK_LIBRARIES, type HookLibraryKey } from "@/lib/content-plans/hooks";

/**
 * مكتبة «هوك المحتوى» — هوكات جاهزة مفصّلة على نشاط المنظمة.
 * مع onPick: زر «استخدم» يحط الهوك في المحتوى. بدونه: تصفّح ونسخ فقط.
 */
export function HookLibraryModal({ libraryKey, onPick, onClose }: {
  libraryKey: HookLibraryKey;
  onPick?: (text: string) => void;
  onClose: () => void;
}) {
  const lib = HOOK_LIBRARIES[libraryKey];
  const [topic, setTopic] = useState<string>("all");
  const [q, setQ] = useState("");
  const [copied, setCopied] = useState<number | null>(null);
  const [seed, setSeed] = useState(0);

  const hooks = useMemo(() => {
    const term = q.trim();
    const list = lib.hooks.filter((h) => (topic === "all" || h.topic === topic) && (!term || h.text.includes(term)));
    if (!seed) return list;
    // «لخبطها» — ترتيب مختلف مع كل ضغطة يساعد تلقى هوك جديد بسرعة
    const mix = (n: number) => Math.imul(n ^ seed, 2654435761) >>> 0;
    return [...list].sort((a, b) => mix(a.n) - mix(b.n));
  }, [lib, topic, q, seed]);

  const copy = async (n: number, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(n); setTimeout(() => setCopied(null), 1200); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center bg-black/60 backdrop-blur-sm overflow-y-auto p-3" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-[14px] glass-surface border border-border p-5 my-6 space-y-3 hover:translate-y-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2"><Anchor className="w-4 h-4 text-violet-400" /> مكتبة هوك المحتوى</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{lib.label} · {lib.hooks.length} هوك — حطه نص على الشاشة في أول ثانية وقله بصوتك</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.1] text-muted-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ابحث في الهوكات…"
              className="w-full rounded-lg bg-white/[0.06] border border-border pr-8 pl-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-violet-500/50"
            />
          </div>
          <button onClick={() => setSeed((s) => s + 1)} title="ترتيب عشوائي" className="p-2 rounded-lg bg-white/[0.06] border border-border text-muted-foreground hover:text-foreground">
            <Shuffle className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {["all", ...lib.topics].map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={cn("px-3 py-1 rounded-full text-xs font-semibold border transition-colors",
                topic === t ? "bg-violet-500/20 text-violet-300 border-violet-500/40" : "bg-white/[0.03] text-muted-foreground border-border hover:text-foreground")}
            >
              {t === "all" ? `الكل (${lib.hooks.length})` : t}
            </button>
          ))}
        </div>

        <div className="space-y-1.5 max-h-[55vh] overflow-y-auto pl-1">
          {hooks.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">ما فيه هوك يطابق البحث</p>}
          {hooks.map((h) => (
            <div key={h.n} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.03] border border-border hover:border-violet-500/30">
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-relaxed">{h.text}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{h.topic}</p>
              </div>
              <button onClick={() => copy(h.n, h.text)} title="نسخ" className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/[0.06] shrink-0">
                {copied === h.n ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
              {onPick && (
                <button
                  onClick={() => onPick(h.text)}
                  className="px-2.5 py-1 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 text-[11px] font-semibold shrink-0"
                >
                  استخدم
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
