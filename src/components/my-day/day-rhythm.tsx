"use client";

// شريط إيقاع اليوم — يوضح «وش وقته الحين» حسب الشفت (١ الظهر – ١٠ م). إرشاد فقط، ما يقفل شي.
import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { SHIFT_END_HOUR, SHIFT_START_HOUR } from "@/lib/team-reminders";

interface Block { from: number; to: number; label: string; hint: string }

const hm = (h: number, m = 0) => h * 60 + m;
const BLOCKS: Block[] = [
  { from: hm(12, 40), to: hm(SHIFT_START_HOUR), label: "الاجتماع اليومي", hint: "١٠ دقائق: أمس، أولوياتك ★ اليوم، وأي عائق" },
  { from: hm(SHIFT_START_HOUR), to: hm(15), label: "الفلوس أولاً", hint: "أولوياتك ★ وعملاء «انتظار الدفع» و«تجريبي»" },
  { from: hm(15), to: hm(17, 30), label: "القائمة والتذاكر", hint: "مرّ على المستحق بالترتيب وسجّل نتيجة كل واحد" },
  { from: hm(17, 30), to: hm(18), label: "فحص منتصف الشفت", hint: "شوف «نتيجة يومي»: كم باقي للهدف؟" },
  { from: hm(18), to: hm(21, 30), label: "إعادة الاتصال والاستهداف", hint: "اللي ما ردوا + المواعيد + عملاء جدد" },
  { from: hm(21, 30), to: hm(SHIFT_END_HOUR), label: "إغلاق اليوم", hint: "سجّل النتائج واضغط «أنهِ مهام اليوم»" },
];

const fmt = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h > 12 ? h - 12 : h}:${String(m).padStart(2, "0")}`;
};

function riyadhMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Riyadh", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return h * 60 + m;
}

export function DayRhythm() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(riyadhMinutes());
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return null;

  const current = BLOCKS.find((b) => now >= b.from && now < b.to);
  const next = BLOCKS.find((b) => b.from > now);
  const headline = current
    ? { tag: "الحين", block: current }
    : next
      ? { tag: `يبدأ ${fmt(next.from)}`, block: next }
      : null;

  return (
    <section className="rounded-2xl border border-violet-500/20 bg-violet-500/[0.05] p-3 space-y-2">
      {headline ? (
        <div className="flex items-start gap-2">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-violet-400" />
          <div className="min-w-0">
            <div className="text-sm font-bold text-foreground">
              <span className="text-violet-300">{headline.tag}:</span> {headline.block.label}
            </div>
            <div className="text-xs text-muted-foreground">{headline.block.hint}</div>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 text-violet-400" /> انتهى الشفت — يعطيك العافية 🌙
        </div>
      )}
      <div className="flex gap-1">
        {BLOCKS.map((b) => {
          const state = now >= b.to ? "done" : now >= b.from ? "now" : "later";
          return (
            <div key={b.from} className="min-w-0 flex-1" title={`${fmt(b.from)} – ${fmt(b.to)} · ${b.label}`}>
              <div className={`h-1.5 rounded-full ${state === "now" ? "bg-violet-400" : state === "done" ? "bg-violet-400/30" : "bg-white/[0.08]"}`} />
              <div className={`mt-1 truncate text-center text-[9px] ${state === "now" ? "font-bold text-violet-300" : "text-muted-foreground/70"}`}>{fmt(b.from)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
