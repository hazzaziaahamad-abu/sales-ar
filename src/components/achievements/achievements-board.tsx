"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trophy, Plus, ChevronRight, ChevronLeft, Loader2, Send, Trash2, UserRound, Copy, Share2 } from "lucide-react";
import { formatMoneyFull, todayLocal } from "@/lib/utils/format";
import {
  SOURCE_LABELS, SOURCE_ICONS, SOURCE_COLORS, CATEGORY_LABELS, ACHIEVEMENT_CATEGORIES, ACHIEVEMENT_SOURCES,
  type AchievementItem, type AchievementSource, type AchievementCategory,
} from "@/lib/achievements";

type Period = "week" | "month";
const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const inputCls = "w-full rounded-[10px] bg-white/[0.04] border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/40";

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
/** حدود الفترة: أسبوع (الأحد–السبت) أو شهر ميلادي، مع إزاحة offset للخلف. */
function periodRange(period: Period, offset: number, today: string): { from: string; to: string; label: string } {
  if (period === "week") {
    const d = new Date(`${today}T00:00:00Z`);
    const from = addDays(today, -d.getUTCDay() + 7 * offset);
    const to = addDays(from, 6);
    const fmt = (s: string) => new Date(`${s}T12:00:00Z`).toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" });
    return { from, to, label: offset === 0 ? "هذا الأسبوع" : `${fmt(from)} — ${fmt(to)}` };
  }
  const [y, m] = today.split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 1 + offset, 1));
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0));
  const label = offset === 0 ? "هذا الشهر" : first.toLocaleDateString("ar-SA-u-ca-gregory", { month: "long", year: "numeric" });
  return { from: first.toISOString().slice(0, 10), to: last.toISOString().slice(0, 10), label };
}
function dayHeader(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  return `${DAY_NAMES[d.getUTCDay()]} · ${d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "long" })}`;
}

export function AchievementsBoard({ embedded = false }: { embedded?: boolean }) {
  const today = todayLocal();
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<AchievementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [source, setSource] = useState<AchievementSource | "all">("all");
  const [showForm, setShowForm] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const range = periodRange(period, offset, today);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/achievements?from=${range.from}&to=${range.to}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.items ?? []);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [range.from, range.to]);

  useEffect(() => { load(); }, [load]);

  function flash(msg: string, ok = true) {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  }
  function go(p: Period, o: number) {
    setLoading(true);
    setPeriod(p);
    setOffset(o);
  }

  async function remove(item: AchievementItem) {
    if (!confirm(`حذف «${item.title}»؟`)) return;
    try {
      const res = await fetch(`/api/achievements/${item.id.replace("manual:", "")}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch {
      flash("تعذّر الحذف", false);
    }
  }

  const counts = useMemo(() => {
    const c = Object.fromEntries(ACHIEVEMENT_SOURCES.map((s) => [s, 0])) as Record<AchievementSource, number>;
    for (const i of items) c[i.source]++;
    return c;
  }, [items]);
  const revenue = useMemo(() => items.reduce((s, i) => s + (i.value ?? 0), 0), [items]);

  // أكثر الأشخاص إنجازاً في الفترة
  const leaders = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of items) {
      if (!i.who || i.source === "meeting") continue;
      const name = i.who.trim();
      m.set(name, (m.get(name) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [items]);

  const visible = useMemo(() => items.filter((i) => source === "all" || i.source === source), [items, source]);
  const grouped = useMemo(() => {
    const m = new Map<string, AchievementItem[]>();
    for (const i of visible) {
      const list = m.get(i.day) ?? [];
      list.push(i);
      m.set(i.day, list);
    }
    return Array.from(m.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [visible]);

  function shareText(): string {
    const lines = [`🏆 *إنجازات ${range.label}*`, ""];
    for (const s of ACHIEVEMENT_SOURCES) if (counts[s]) lines.push(`${SOURCE_ICONS[s]} ${SOURCE_LABELS[s]}: ${counts[s]}`);
    if (revenue) lines.push(`💵 الإيراد: ${formatMoneyFull(revenue)}`);
    const manual = items.filter((i) => i.source === "manual");
    if (manual.length) {
      lines.push("", "*⭐ أبرز الإنجازات:*");
      manual.slice(0, 10).forEach((i) => lines.push(`• ${i.title}${i.who ? ` — ${i.who}` : ""}`));
    }
    if (leaders.length) lines.push("", `*👏 الأكثر إنجازاً:* ${leaders.map(([n, c]) => `${n} (${c})`).join("، ")}`);
    return lines.join("\n");
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/15 text-yellow-300 ring-1 ring-yellow-500/20 shrink-0">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            {embedded
              ? <h2 className="text-base font-extrabold text-foreground">الإنجازات</h2>
              : <h1 className="text-xl font-extrabold text-foreground">الإنجازات</h1>}
            <p className="text-[12px] text-muted-foreground mt-0.5">كل اللي انجز — تلقائياً من النظام + اللي يسجّله الفريق.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { navigator.clipboard.writeText(shareText()); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            disabled={loading || items.length === 0}
            className="flex items-center gap-1.5 rounded-[12px] bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground px-3 py-2.5 text-[12px] font-bold disabled:opacity-40"
          >
            <Copy className="w-3.5 h-3.5" /> {copied ? "تم النسخ" : "نسخ"}
          </button>
          <button
            onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareText())}`, "_blank")}
            disabled={loading || items.length === 0}
            className="flex items-center gap-1.5 rounded-[12px] bg-white/[0.04] border border-white/[0.08] text-muted-foreground hover:text-foreground px-3 py-2.5 text-[12px] font-bold disabled:opacity-40"
          >
            <Share2 className="w-3.5 h-3.5" /> واتساب
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-2 rounded-[12px] bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-200 border border-yellow-500/20 px-4 py-2.5 text-sm font-bold transition-colors"
          >
            <Plus className="w-4 h-4" /> سجّل إنجاز
          </button>
        </div>
      </div>

      {toast && (
        <div className={`rounded-[12px] px-4 py-3 text-sm border ${toast.ok ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300" : "bg-red-500/10 border-red-500/20 text-red-300"}`}>
          {toast.msg}
        </div>
      )}

      {showForm && (
        <AchievementForm
          today={today}
          onCancel={() => setShowForm(false)}
          onSaved={(day) => {
            setShowForm(false);
            flash("تم تسجيل الإنجاز ⭐");
            if (day >= range.from && day <= range.to) load();
          }}
          onError={(m) => flash(m, false)}
        />
      )}

      {/* Period */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button onClick={() => go(period, offset - 1)} title="السابق" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
          <span className="text-[13px] font-bold text-foreground px-2 min-w-[130px] text-center">{range.label}</span>
          <button onClick={() => go(period, offset + 1)} disabled={offset >= 0} title="التالي" className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.05] text-muted-foreground hover:text-foreground disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.04] border border-white/[0.06] p-0.5">
          {([["week", "أسبوعي"], ["month", "شهري"]] as const).map(([p, l]) => (
            <button
              key={p}
              onClick={() => go(p, 0)}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-colors ${period === p ? "bg-yellow-500/20 text-yellow-200" : "text-muted-foreground hover:text-foreground"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : loadError ? (
        <p className="text-sm text-red-400 text-center py-8">تعذّر تحميل الإنجازات</p>
      ) : (
        <>
          {/* Summary tiles (اضغط للفلترة) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <SummaryTile active={source === "all"} onClick={() => setSource("all")} icon="🏆" label="كل الإنجازات" value={String(items.length)} sub={revenue ? formatMoneyFull(revenue) : undefined} tone="text-yellow-300" />
            {ACHIEVEMENT_SOURCES.map((s) => (
              <SummaryTile key={s} active={source === s} onClick={() => setSource(source === s ? "all" : s)} icon={SOURCE_ICONS[s]} label={SOURCE_LABELS[s]} value={String(counts[s])} tone={SOURCE_COLORS[s]} />
            ))}
          </div>

          {leaders.length > 0 && (
            <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3">
              <p className="text-[12px] font-bold text-muted-foreground mb-2">👏 الأكثر إنجازاً في {range.label}</p>
              <div className="flex flex-wrap gap-1.5">
                {leaders.map(([name, c], i) => (
                  <span key={name} className={`text-[12px] px-2.5 py-1 rounded-lg border ${i === 0 ? "bg-yellow-500/15 text-yellow-200 border-yellow-500/25" : "bg-white/[0.03] text-foreground border-white/[0.06]"}`}>
                    {i === 0 ? "🥇 " : ""}{name} · {c}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Timeline */}
          {grouped.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
              ما فيه إنجازات في هالفترة بعد.
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map(([day, list]) => (
                <div key={day}>
                  <p className={`text-[12px] font-bold mb-1.5 ${day === today ? "text-yellow-300" : "text-muted-foreground"}`}>
                    {day === today ? "اليوم · " : ""}{dayHeader(day)} <span className="font-normal opacity-70">({list.length})</span>
                  </p>
                  <div className="space-y-1.5">
                    {list.map((i) => (
                      <div key={i.id} className={`flex items-start gap-3 rounded-xl px-3 py-2.5 border ${i.source === "manual" ? "bg-yellow-500/[0.05] border-yellow-500/20" : "bg-white/[0.02] border-white/[0.06]"}`}>
                        <span className="text-base leading-none mt-0.5">{SOURCE_ICONS[i.source]}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[13px] font-bold text-foreground">{i.title}</span>
                            <span className={`text-[10px] ${SOURCE_COLORS[i.source]}`}>{i.source === "manual" && i.category ? CATEGORY_LABELS[i.category] : SOURCE_LABELS[i.source]}</span>
                          </div>
                          {i.detail && <p className="text-[12px] text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">{i.detail}</p>}
                          {i.who && <p className="text-[11px] text-muted-foreground/80 mt-0.5 flex items-center gap-1"><UserRound className="w-3 h-3" /> {i.who}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {i.value ? <span className="text-[13px] font-bold font-mono text-emerald-400">{formatMoneyFull(i.value)}</span> : null}
                          {i.can_delete && (
                            <button onClick={() => remove(i)} title="حذف" className="text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryTile({ active, onClick, icon, label, value, sub, tone }: {
  active: boolean; onClick: () => void; icon: string; label: string; value: string; sub?: string; tone: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-right rounded-xl p-2.5 border transition-colors ${active ? "bg-yellow-500/10 border-yellow-500/30" : "bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]"}`}
    >
      <p className="text-[10px] text-muted-foreground">{icon} {label}</p>
      <p className={`text-lg font-extrabold font-mono mt-0.5 ${tone}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
    </button>
  );
}

function AchievementForm({ today, onCancel, onSaved, onError }: {
  today: string;
  onCancel: () => void;
  onSaved: (day: string) => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [category, setCategory] = useState<AchievementCategory>("other");
  const [day, setDay] = useState(today);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/achievements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description, owner_name: owner, category, achieved_on: day }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "تعذّر الحفظ");
      onSaved(day);
    } catch (e) {
      onError(e instanceof Error ? e.message : "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-[14px] glass-surface border border-border p-4 space-y-3">
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">وش الإنجاز؟</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: إطلاق باقة نحجز الجديدة" className={inputCls} />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground mb-1.5">التفاصيل <span className="font-normal">(اختياري)</span></label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="وش الأثر؟ أرقام، نتيجة، وش تغيّر..." className={`${inputCls} resize-y`} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">صاحب الإنجاز</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="اسمك أو اسم الفريق" className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">التصنيف</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as AchievementCategory)} className={inputCls}>
            {ACHIEVEMENT_CATEGORIES.map((c) => <option key={c} value={c} className="bg-card">{CATEGORY_LABELS[c]}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground mb-1.5">التاريخ</label>
          <input type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
        <button onClick={onCancel} className="rounded-[10px] px-4 py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">إلغاء</button>
        <button
          onClick={save}
          disabled={!title.trim() || saving}
          className="flex items-center gap-2 rounded-[10px] bg-yellow-500/20 hover:bg-yellow-500/30 disabled:opacity-40 text-yellow-100 border border-yellow-500/30 px-5 py-2.5 text-sm font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          تسجيل
        </button>
      </div>
    </div>
  );
}
