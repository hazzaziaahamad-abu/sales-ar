"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Rocket, CalendarClock, MessageCircle, BarChart3, TrendingUp, HeartHandshake, Receipt, MoonStar,
  Sun, Moon, Maximize2, Minimize2, Printer, Link2, Check, Sparkles, Coffee, UserCheck, Flower2,
  Calculator, Crown, Gem, Plus, Trash2, X, Send, Copy, RotateCcw, Users, Footprints, Clock,
  PlayCircle, CheckCircle2, Hourglass, Wand2, Scissors, Palette, Brush, Hand, Star, BellRing,
  Store, Trophy, Repeat, Zap, Gift, UserPlus, Cloud, CloudOff, Loader2, Database, LogIn, ShieldX, Stethoscope,
} from "lucide-react";
import {
  ADDONS, DEFAULT_SETTINGS, RETENTION_TARGET, SERVICES, SLEEP_DAYS, STAFF, TEMPLATE_DEFAULTS,
  addonsTotal, applyStatus, clientAfterVisit, computeMetrics, daysSince, intlPhone, invoice,
  isSaudiMobile, isSleeping, localDateKey, winbackSent,
  type Addon, type ApptKind, type ApptRow, type ApptStatus, type ClientRow, type Metrics, type MembershipRow, type PlanIcon,
  type SettingKey, type Settings, type TplKey,
} from "@/lib/salon-growth";
import DiagnosisTab from "@/components/offer/SalonDiagnosis";
import BackToPlatform from "@/components/offer/BackToPlatform";

/* ──────────────────────────── أدوات عامة ──────────────────────────── */

const LOCALE = "ar-SA-u-ca-gregory";
const fmt = (n: number) => Math.round(n).toLocaleString(LOCALE);
const sar = (n: number) => `${fmt(n)} ر.س`;
const pct = (n: number | null) => (n === null ? "—" : `${fmt(n)}٪`);
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${fmt(Math.abs(n))}٪`;
const GOLD = "#D4AF37";

const waTo = (phone: string, msg: string) => `https://wa.me/${intlPhone(phone)}?text=${encodeURIComponent(msg)}`;
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" });
const firstName = (n: string) => n.split(" ")[0];

function countdown(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(r)}` : `${p(m)}:${p(r)}`;
}

async function api<T = Record<string, unknown>>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/salon-growth${path}`, {
    method, headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(json.error || "تعذّر الحفظ"), { status: res.status });
  return json as T;
}

/* ──────────────────────────── المظاهر ──────────────────────────── */

type ThemeKey = "brand" | "night";

// «هوية الصالون»: برقوقي عميق + ذهبي دافئ على خلفية كريمية
const THEMES: Record<ThemeKey, Record<string, string>> = {
  brand: {
    "--bg": "#FAF5EF", "--surface": "#FFFFFF", "--surface-2": "#F5ECE2", "--hover": "#F3E8DC",
    "--line": "#EADDCF", "--line-strong": "#D8C5B2", "--ink": "#2A1018", "--body": "#4B3840",
    "--muted": "#7A6570", "--faint": "#A8939B", "--glass": "rgba(253,251,247,.9)", "--grid": "rgba(88,24,69,.05)",
    "--shadow": "0 1px 2px rgba(42,16,24,.04), 0 14px 34px -18px rgba(74,21,37,.22)", "--glow": "18%",
    "--acc": "#581845", "--acc-deep": "#4A1525", "--on-acc": "#FFFFFF", "--rose": "#C76B8A", "--sand": "#E0A96D",
  },
  night: {
    "--bg": "#14080D", "--surface": "rgba(255,255,255,.035)", "--surface-2": "rgba(255,255,255,.065)", "--hover": "rgba(255,255,255,.06)",
    "--line": "rgba(255,255,255,.09)", "--line-strong": "rgba(255,255,255,.2)", "--ink": "#FFF7F0", "--body": "#E6D6DA",
    "--muted": "#B39EA6", "--faint": "#7F6A72", "--glass": "rgba(20,8,13,.82)", "--grid": "rgba(255,255,255,.035)",
    "--shadow": "none", "--glow": "30%",
    "--acc": "#E0A96D", "--acc-deep": "#A9683A", "--on-acc": "#2A1018", "--rose": "#E58FAE", "--sand": "#B05A7A",
  },
};

const card = "rounded-3xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow)]";
const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold text-[var(--on-acc)] transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:pointer-events-none disabled:opacity-50";
const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-full border border-[var(--line)] px-4 py-2 text-sm font-bold text-[var(--body)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)] disabled:pointer-events-none disabled:opacity-50";
const accGrad = { background: "linear-gradient(135deg, var(--acc), var(--acc-deep))" };
const input =
  "w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)]";

/* ──────────────────────────── ثوابت العرض ──────────────────────────── */

const TABS = [
  { id: "diagnosis", label: "التشخيص الأولي", short: "التشخيص", icon: Stethoscope },
  { id: "growth", label: "مفاتيح التغيير والنمو", short: "مفاتيح النمو", icon: Rocket },
  { id: "booking", label: "جدول المواعيد والحجز الذكي", short: "المواعيد", icon: CalendarClock },
  { id: "automation", label: "رسائل التواصل الآلي والولاء", short: "الرسائل", icon: MessageCircle },
  { id: "analytics", label: "تقارير الأداء والزيادة", short: "التقارير", icon: BarChart3 },
] as const;
type TabId = (typeof TABS)[number]["id"];

const ADDON_ICON: Record<string, LucideIcon> = {
  "حمام زيت مغذّي": Flower2, "قناع كولاجين للوجه": Sparkles, "تنظيف بشرة سريع": Wand2,
  "رسم وتشذيب الحواجب": Brush, "بديكير سريع": Hand, "سيروم لمعان للشعر": Gem,
};

const RECEPTION = [
  { id: "scent", title: "العطر المميّز للصالون مفعّل", hint: "الفوّاحة تعمل قبل فتح الأبواب بـ ١٥ دقيقة", icon: Flower2 },
  { id: "drink", title: "مشروب الترحيب مقدَّم", hint: "قهوة عربية أو مشروب بارد خلال أول دقيقة", icon: Coffee },
  { id: "name", title: "الترحيب باسم العميلة خلال ٣ دقائق", hint: "الاستقبال يراجع اسمها من الحجز قبل وصولها", icon: UserCheck },
  { id: "consult", title: "استشارة الـ ٥ دقائق قبل الخدمة", hint: "الخبيرة تفحص الشعر/البشرة وتقترح الإضافة المناسبة", icon: Sparkles },
  { id: "photo", title: "صورة «قبل وبعد» بإذن العميلة", hint: "تُرسل لها مع رسالة المتابعة وتُستخدم في المحتوى", icon: Star },
];

const PLAN_ICON: Record<PlanIcon, LucideIcon> = { crown: Crown, gem: Gem, gift: Gift };

const STATUS_META: Record<ApptStatus, { label: string; color: string; icon: LucideIcon }> = {
  waiting: { label: "في الانتظار", color: "#D9A21B", icon: Hourglass },
  in_progress: { label: "جاري تقديم الخدمة", color: "#3B82F6", icon: PlayCircle },
  done: { label: "مكتملة", color: "#16A34A", icon: CheckCircle2 },
};
const NEXT_STATUS: Record<ApptStatus, ApptStatus> = { waiting: "in_progress", in_progress: "done", done: "done" };

const TEMPLATE_META: { key: TplKey; title: string; when: string; icon: LucideIcon }[] = [
  { key: "reminder", title: "رسالة التذكير بالموعد", when: "قبل الموعد بـ ٢٤ ساعة", icon: BellRing },
  { key: "followup", title: "رسالة المتابعة والتقييم", when: "بعد الخدمة بـ ٢٤ ساعة", icon: Star },
  { key: "winback", title: "رسالة العودة للعميلة النائمة", when: `بعد ${fmt(SLEEP_DAYS)} يوماً من آخر زيارة`, icon: MoonStar },
];
const TAGS = ["{اسم_العميلة}", "{اسم_الخدمة}", "{اسم_الخبيرة}", "{وقت_الموعد}", "{اسم_الصالون}", "{نسبة_الخصم}", "{رابط_الحجز}"];

type Vars = Partial<Record<"client" | "service" | "staff" | "time" | "salon" | "discount" | "link", string>>;
function fill(tpl: string, v: Vars) {
  return tpl
    .replaceAll("{اسم_العميلة}", v.client ?? "")
    .replaceAll("{اسم_الخدمة}", v.service ?? "")
    .replaceAll("{اسم_الخبيرة}", v.staff ?? "")
    .replaceAll("{وقت_الموعد}", v.time ?? "")
    .replaceAll("{اسم_الصالون}", v.salon ?? "")
    .replaceAll("{نسبة_الخصم}", v.discount ?? "")
    .replaceAll("{رابط_الحجز}", v.link ?? "");
}

const CAT_STYLE: Record<string, { color: string; icon: LucideIcon }> = {
  "صبغات": { color: "var(--acc)", icon: Palette },
  "عناية بالشعر": { color: GOLD, icon: Scissors },
  "أظافر": { color: "var(--rose)", icon: Hand },
  "مكياج وبشرة": { color: "var(--sand)", icon: Brush },
  "أخرى": { color: "var(--faint)", icon: Sparkles },
};

/* ──────────────────────────── البيانات والعمليات ──────────────────────────── */

type Data = { clients: ClientRow[]; appts: ApptRow[]; memberships: MembershipRow[]; settings: Settings };
type Mode = "loading" | "live" | "login" | "denied" | "error";
type NewAppt = { client_name: string; phone: string; service: string; staff: string; starts_at: string; duration_minutes: number; price: number; kind: ApptKind };
type NewPlan = Omit<MembershipRow, "id" | "sort_order" | "members" | "active">;

type Ops = {
  setStatus: (a: ApptRow, s: ApptStatus) => Promise<void>;
  addAddon: (a: ApptRow, o: Addon) => Promise<void>;
  remind: (a: ApptRow, msg: string) => Promise<void>;
  cancel: (a: ApptRow) => Promise<void>;
  create: (f: NewAppt) => Promise<boolean>;
  winback: (c: ClientRow, msg: string) => Promise<void>;
  patchPlan: (m: MembershipRow, patch: Partial<MembershipRow>) => Promise<void>;
  addPlan: (p: NewPlan) => Promise<boolean>;
  deletePlan: (m: MembershipRow) => Promise<void>;
};
type SetSetting = <K extends SettingKey>(key: K, value: Settings[K]) => void;

/* ──────────────────────────── الصفحة ──────────────────────────── */

const noop = () => () => {};

// الصفحة تعتمد على ساعة جهاز العارض (العدّادات والمواعيد) — نرسمها على المتصفح فقط
export default function SalonGrowth() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <div className="min-h-screen bg-[#FAF5EF]" />;
  return <SalonGrowthInner />;
}

function SalonGrowthInner() {
  const params = useSearchParams();
  const [theme, setTheme] = useState<ThemeKey>(() => {
    const q = params.get("theme");
    if (q === "night" || q === "brand") return q;
    try { return localStorage.getItem("sg-theme") === "night" ? "night" : "brand"; } catch { return "brand"; }
  });
  const toggleTheme = () => {
    const next = theme === "brand" ? "night" : "brand";
    setTheme(next);
    try { localStorage.setItem("sg-theme", next); } catch { /* ignore */ }
  };
  const [tab, setTab] = useState<TabId>(() => {
    const q = params.get("tab");
    return TABS.some((t) => t.id === q) ? (q as TabId) : "growth";
  });
  const [fullscreen, setFullscreen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // ─── البيانات من Supabase — الصفحة خاصة بالسوبر أدمن فقط (يتحقق منها الـ API) ───
  const [mode, setMode] = useState<Mode>("loading");
  const [data, setData] = useState<Data>(() => ({ clients: [], appts: [], memberships: [], settings: DEFAULT_SETTINGS }));
  const [isManager, setIsManager] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const live = mode === "live";

  const load = useCallback(() =>
    api<Data & { me: { isManager: boolean } }>("", "GET").then(
      (res) => {
        setData({ clients: res.clients, appts: res.appts, memberships: res.memberships, settings: res.settings });
        setIsManager(res.me.isManager);
        setMode("live");
      },
      (e) => {
        const status = (e as { status?: number }).status;
        setMode(status === 401 ? "login" : status === 403 ? "denied" : "error");
      },
    ), []);
  useEffect(() => { load(); }, [load]);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 3500 : 2200);
  }, []);
  const copy = async (text: string, msg = "تم النسخ") => {
    try { await navigator.clipboard.writeText(text); notify(msg); } catch { notify("تعذّر النسخ", true); }
  };

  // يحفظ على السيرفر؛ عند الفشل يرجّع البيانات من السيرفر
  const persist = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    if (!live) return null;
    try { return await fn(); } catch (e) {
      notify((e as Error).message, true);
      load();
      return null;
    }
  }, [live, load, notify]);

  // ─── الإعدادات (حفظ مؤجّل لكل مفتاح) ───
  const settingTimers = useRef<Partial<Record<SettingKey, ReturnType<typeof setTimeout>>>>({});
  const setSetting: SetSetting = useCallback((key, value) => {
    setData((d) => ({ ...d, settings: { ...d.settings, [key]: value } }));
    if (!live) return;
    clearTimeout(settingTimers.current[key]);
    settingTimers.current[key] = setTimeout(() => { persist(() => api("/settings", "PUT", { key, value })); }, 600);
  }, [live, persist]);

  const upsertClient = (c: ClientRow | null) => c && setData((d) => ({
    ...d, clients: d.clients.some((x) => x.id === c.id) ? d.clients.map((x) => (x.id === c.id ? c : x)) : [...d.clients, c],
  }));
  const replaceAppt = (a: ApptRow) => setData((d) => ({ ...d, appts: d.appts.map((x) => (x.id === a.id ? a : x)) }));
  const replacePlan = (m: MembershipRow) => setData((d) => ({ ...d, memberships: d.memberships.map((x) => (x.id === m.id ? m : x)) }));

  // ─── العمليات: تحديث فوري للواجهة، ثم الحفظ ───
  const ops: Ops = {
    setStatus: async (a, status) => {
      const nowIso = new Date().toISOString();
      const next = applyStatus(a, status, nowIso);
      replaceAppt(next);
      if (a.status !== "done" && status === "done") {
        const c = data.clients.find((x) => x.id === a.client_id);
        if (c) upsertClient(clientAfterVisit(c, next, nowIso));
      }
      const res = await persist(() => api<{ appointment: ApptRow; client: ClientRow | null }>(`/appointments/${a.id}`, "PATCH", { status }));
      if (res) { replaceAppt(res.appointment); upsertClient(res.client); }
    },
    addAddon: async (a, o) => {
      const addons = [...a.addons, o];
      replaceAppt({ ...a, addons });
      notify(`+${sar(o.price)} — ${o.name}`);
      const res = await persist(() => api<{ appointment: ApptRow }>(`/appointments/${a.id}`, "PATCH", { addons }));
      if (res) replaceAppt(res.appointment);
    },
    remind: async (a, msg) => {
      window.open(waTo(a.phone, msg), "_blank", "noopener,noreferrer");
      replaceAppt({ ...a, reminded_at: new Date().toISOString() });
      notify(`فُتح تذكير واتساب لـ ${a.client_name}`);
      await persist(() => api(`/appointments/${a.id}`, "PATCH", { reminded: true }));
    },
    cancel: async (a) => {
      setData((d) => ({ ...d, appts: d.appts.filter((x) => x.id !== a.id) }));
      notify(`أُلغي موعد ${a.client_name}`);
      await persist(() => api(`/appointments/${a.id}`, "DELETE"));
    },
    create: async (f) => {
      const res = await persist(() => api<{ appointment: ApptRow; client: ClientRow }>("/appointments", "POST", f));
      if (!res) return false;
      upsertClient(res.client);
      setData((d) => ({ ...d, appts: [...d.appts, res.appointment] }));
      notify(`أُضيفت ${f.client_name}`);
      return true;
    },
    winback: async (c, msg) => {
      window.open(waTo(c.phone, msg), "_blank", "noopener,noreferrer");
      upsertClient({ ...c, winback_sent_at: new Date().toISOString() });
      notify(`فُتح واتساب لـ ${c.name}`);
      const res = await persist(() => api<{ client: ClientRow }>(`/clients/${c.id}`, "PATCH", { winback_sent: true }));
      if (res) upsertClient(res.client);
    },
    patchPlan: async (m, patch) => {
      replacePlan({ ...m, ...patch });
      const res = await persist(() => api<{ membership: MembershipRow }>(`/memberships/${m.id}`, "PATCH", patch));
      if (res) replacePlan(res.membership);
    },
    addPlan: async (p) => {
      const res = await persist(() => api<{ membership: MembershipRow }>("/memberships", "POST", p));
      if (!res) return false;
      setData((d) => ({ ...d, memberships: [...d.memberships, res.membership] }));
      notify(`أُضيفت باقة «${p.name}»`);
      return true;
    },
    deletePlan: async (m) => {
      setData((d) => ({ ...d, memberships: d.memberships.filter((x) => x.id !== m.id) }));
      notify(`حُذفت باقة «${m.name}»`);
      await persist(() => api(`/memberships/${m.id}`, "DELETE"));
    },
  };

  const seed = async () => {
    setSeeding(true);
    try {
      const res = await api<Data>("", "POST", { action: "seed" });
      setData({ clients: res.clients, appts: res.appts, memberships: res.memberships, settings: res.settings });
      notify("تمت التعبئة ببيانات تجريبية");
    } catch (e) { notify((e as Error).message, true); }
    setSeeding(false);
  };

  // مزامنة الرابط ليصير قابل للمشاركة
  useEffect(() => {
    const q = new URLSearchParams();
    q.set("tab", tab);
    window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  }, [tab]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);
  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // الحسابات تتحدّث كل دقيقة أو عند تغيّر البيانات (مو كل ثانية)
  const minute = Math.floor(now / 60000);
  const metrics = useMemo(() => computeMetrics(data.clients, data.appts, minute * 60000), [data.clients, data.appts, minute]);

  const S = data.settings;
  const salonName = S.salon_name.trim() || "صالونك";
  const bookingLink = S.booking_link.trim() || `${window.location.origin}/offer/nahjez`;
  const vars = (v: Vars): Vars => ({ salon: salonName, discount: `${fmt(S.discount)}٪`, link: bookingLink, ...v });
  const empty = live && !data.clients.length && !data.appts.length && !data.memberships.length;

  return (
    <div
      dir="rtl"
      className="sg-root min-h-screen w-full overflow-x-hidden bg-[var(--bg)] text-[var(--body)]"
      style={{ ...THEMES[theme], colorScheme: theme === "night" ? "dark" : "light", fontFamily: "var(--font-tajawal), system-ui, sans-serif" } as React.CSSProperties}
    >
      <style>{`
        .sg-root ::selection { background: var(--acc); color: var(--on-acc); }
        .sg-glow { background: radial-gradient(60% 70% at 50% 0%, color-mix(in srgb, var(--acc) var(--glow), transparent), transparent 70%); }
        .sg-grid { background-image: linear-gradient(var(--grid) 1px, transparent 1px), linear-gradient(90deg, var(--grid) 1px, transparent 1px); background-size: 44px 44px; mask-image: radial-gradient(70% 70% at 50% 20%, black, transparent); }
        .sg-range { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 999px; outline: none; }
        .sg-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 999px; background: white; border: 4px solid var(--acc); cursor: pointer; box-shadow: 0 0 0 6px color-mix(in srgb, var(--acc) 18%, transparent); }
        .sg-range::-moz-range-thumb { width: 14px; height: 14px; border-radius: 999px; background: white; border: 4px solid var(--acc); cursor: pointer; }
        @keyframes sg-pop { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.12); } 100% { transform: scale(1); opacity: 1; } }
        .sg-pop { animation: sg-pop .32s ease-out both; }
        @keyframes sg-in { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
        .sg-in { animation: sg-in .45s ease-out both; }
        @keyframes sg-shine { from { transform: translateX(120%) skewX(-20deg); } to { transform: translateX(-220%) skewX(-20deg); } }
        .sg-shine { position: relative; overflow: hidden; }
        .sg-shine::after { content: ""; position: absolute; inset: 0; width: 40%; background: linear-gradient(90deg, transparent, rgba(255,255,255,.28), transparent); animation: sg-shine 3.5s ease-in-out infinite; }
        @media print {
          .sg-noprint { display: none !important; }
          .sg-root { background: white !important; color: #111 !important; }
          .sg-root * { color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      {/* ─── شريط علوي ─── */}
      <header className="sg-noprint sticky inset-x-0 top-0 z-50 border-b border-[var(--line)] bg-[var(--glass)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <BackToPlatform />
          <div className="flex min-w-0 items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--on-acc)]" style={accGrad}>
              <Flower2 size={18} />
            </span>
            <div className="min-w-0 leading-tight">
              <div className="truncate text-sm font-black text-[var(--ink)]">الخطة التسويقية للصالونات</div>
              <div className="hidden truncate text-[11px] text-[var(--faint)] sm:block">{S.salon_name.trim() || "المبيعات والاحتفاظ بالعميلات"}</div>
            </div>
          </div>
          <div className="ms-auto flex items-center gap-1.5">
            <ConnChip mode={mode} />
            <span className="hidden items-center gap-1.5 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs text-[var(--muted)] md:flex">
              <Clock size={13} /> {new Date(now).toLocaleTimeString(LOCALE, { hour: "numeric", minute: "2-digit" })}
            </span>
            <IconBtn onClick={() => copy(window.location.href, "تم نسخ رابط اللوحة")} title="نسخ الرابط"><Link2 size={16} /></IconBtn>
            <span className="hidden sm:contents"><IconBtn onClick={() => window.print()} title="طباعة / PDF"><Printer size={16} /></IconBtn></span>
            <IconBtn onClick={toggleTheme} title={theme === "brand" ? "المظهر الليلي" : "هوية الصالون"}>{theme === "brand" ? <Moon size={16} /> : <Sun size={16} />}</IconBtn>
            <span className="hidden sm:contents"><IconBtn onClick={toggleFs} title="وضع العرض">{fullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</IconBtn></span>
          </div>
        </div>
        {live && <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2.5 sm:px-6 [scrollbar-width:none]" role="tablist">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => { setTab(t.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all sm:text-sm"
                style={on ? { ...accGrad, color: "var(--on-acc)" } : { color: "var(--muted)" }}
              >
                <t.icon size={14} />
                <span className="sm:hidden">{t.short}</span>
                <span className="hidden sm:inline">{t.label}</span>
              </button>
            );
          })}
        </nav>}
      </header>

      {mode === "loading" ? (
        <div className="grid min-h-[60vh] place-items-center text-[var(--muted)]">
          <Loader2 className="animate-spin" size={28} />
        </div>
      ) : !live ? (
        <AccessGate mode={mode} onRetry={() => { setMode("loading"); load(); }} />
      ) : (
        <>
          {/* ─── المؤشرات السريعة ─── */}
          <section className="relative overflow-hidden px-4 pb-6 pt-8 sm:px-6 sm:pt-10">
            <div className="sg-glow pointer-events-none absolute inset-0" />
            <div className="sg-grid pointer-events-none absolute inset-0" />
            <div className="relative mx-auto max-w-7xl">
              {empty && (
                <div className="sg-noprint mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-sm">
                  <Database size={16} style={{ color: "var(--acc)" }} />
                  <span className="min-w-[14rem] flex-1 font-bold text-[var(--body)]">اللوحة مربوطة بقاعدة البيانات وما فيها بيانات بعد — ابدأ بإضافة المواعيد، أو عبّها ببيانات تجريبية لتجربة كل المزايا.</span>
                  <button onClick={seed} disabled={seeding} className={btnPrimary} style={accGrad}>
                    {seeding ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />} تعبئة ببيانات تجريبية
                  </button>
                </div>
              )}

              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--surface)] px-4 py-1.5 text-xs font-bold">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{ background: GOLD }} />
                    {new Date(now).toLocaleDateString(LOCALE, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  </div>
                  <h1 className="text-3xl font-black leading-tight text-[var(--ink)] sm:text-5xl">
                    الخطة التسويقية{" "}
                    <span className="bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(90deg, var(--acc), ${GOLD})` }}>للصالونات</span>
                  </h1>
                  <div className="mt-3 flex items-center gap-2 text-sm font-bold text-[var(--muted)]">
                    الصالون:
                    <input
                      value={S.salon_name}
                      onChange={(e) => setSetting("salon_name", e.target.value.slice(0, 60))}
                      placeholder="اسم الصالون"
                      className="sg-noprint w-48 max-w-full rounded-xl border border-dashed border-[var(--line-strong)] bg-transparent px-2 py-1 font-black outline-none placeholder:text-[var(--faint)] focus:border-[var(--acc)]"
                      style={{ color: "var(--acc)" }}
                    />
                    <span className="hidden print:inline" style={{ color: "var(--acc)" }}>{salonName}</span>
                  </div>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--muted)] sm:text-base">
                    أربعة مفاتيح سرّية ترفع الفاتورة وتُرجع العميلات: الاستقبال الفاخر، استشارة الـ ٥ دقائق، العضويات المغلقة، وصيد العميلات النائمات.
                  </p>
                </div>
                {metrics.upsellCountToday > 0 && (
                  <div className="sg-pop rounded-2xl border px-4 py-3 text-sm font-bold" style={{ borderColor: `${GOLD}66`, background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }}>
                    <Zap size={14} className="inline" style={{ color: GOLD }} /> إضافات اليوم: {fmt(metrics.upsellCountToday)} خدمة · <span style={{ color: GOLD }}>+{sar(metrics.upsellToday)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
                <MetricCard
                  icon={TrendingUp} label="إجمالي مبيعات الشهر" value={sar(metrics.monthSales)}
                  badge={metrics.monthChange === null ? "شهر جديد" : signed(metrics.monthChange)}
                  sub="مقارنة بنفس الفترة من الشهر الماضي" good={metrics.monthChange !== null && metrics.monthChange >= 0}
                />
                <MetricCard
                  icon={HeartHandshake} label="معدل احتفاظ العميلات" value={pct(metrics.retention)} badge={`الهدف > ${fmt(RETENTION_TARGET)}٪`}
                  sub={metrics.retention === null ? "يحتاج سجل زيارات أقدم من ٩٠ يوماً" : metrics.retention >= RETENTION_TARGET ? `فوق المستهدف بـ ${fmt(metrics.retention - RETENTION_TARGET)} نقطة` : `تحت المستهدف بـ ${fmt(RETENTION_TARGET - metrics.retention)} نقطة`}
                  good={(metrics.retention ?? 0) >= RETENTION_TARGET} progress={(metrics.retention ?? 0) / 100} target={RETENTION_TARGET / 100}
                />
                <MetricCard
                  icon={Receipt} label="متوسط قيمة الفاتورة (AOV)" value={sar(metrics.aov)}
                  badge={metrics.aovPrev ? signed(((metrics.aov - metrics.aovPrev) / metrics.aovPrev) * 100) : "—"}
                  sub={metrics.aovPrev ? `الشهر الماضي ${sar(metrics.aovPrev)}` : "بما فيها البيع الإضافي"}
                  good={!!metrics.aovPrev && metrics.aov >= metrics.aovPrev}
                />
                <MetricCard
                  icon={MoonStar} label="العميلات النائمات" value={`${fmt(metrics.sleepingCount - metrics.sleepingSent)} عميلة`}
                  badge={metrics.sleepingSent ? `أُرسل ${fmt(metrics.sleepingSent)}` : "مستهدف الإعادة"}
                  sub={`آخر زيارة قبل أكثر من ${fmt(SLEEP_DAYS)} يوماً`} onClick={() => setTab("growth")}
                />
              </div>
            </div>
          </section>

          <main key={tab} className="sg-in mx-auto max-w-7xl px-4 pb-24 sm:px-6">
            {tab === "diagnosis" && <DiagnosisTab data={data} now={now} setSetting={setSetting} copy={copy} salonName={salonName} />}
            {tab === "growth" && <GrowthTab data={data} now={now} ops={ops} setSetting={setSetting} vars={vars} canDelete={isManager} />}
            {tab === "booking" && <BookingTab appts={data.appts} now={now} ops={ops} reminderTpl={S.templates.reminder} vars={vars} />}
            {tab === "automation" && <AutomationTab settings={S} setSetting={setSetting} vars={vars} copy={copy} notify={notify} />}
            {tab === "analytics" && <AnalyticsTab metrics={metrics} />}
          </main>
        </>
      )}

      {toast && (
        <div className={`sg-noprint sg-pop fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-bold shadow-2xl ${toast.error ? "bg-red-600 text-white" : "text-[var(--on-acc)]"}`} style={toast.error ? {} : accGrad}>
          {toast.error ? <X size={14} className="me-1 inline" /> : <Check size={14} className="me-1 inline" />} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════ تبويب ١: مفاتيح النمو ══════════════════════════ */

function GrowthTab({ data, now, ops, setSetting, vars, canDelete }: {
  data: Data; now: number; ops: Ops; setSetting: SetSetting; vars: (v: Vars) => Vars; canDelete: boolean;
}) {
  const S = data.settings;
  // بروتوكول الاستقبال يتصفّر تلقائياً كل يوم
  const todayKey = localDateKey(now);
  const checks = S.reception.date === todayKey ? S.reception.checks : {};
  const doneCount = RECEPTION.filter((r) => checks[r.id]).length;
  const allDone = doneCount === RECEPTION.length;
  const setChecks = (c: Record<string, boolean>) => setSetting("reception", { date: todayKey, checks: c });

  const [calc, setCalc] = useState({ clients: 30, upsell: 90, conv: 40, days: 26 });
  const baseAov = useMemo(() => {
    const done = data.appts.filter((a) => a.status === "done");
    return done.length ? done.reduce((s, a) => s + Number(a.price || 0), 0) / done.length : 250;
  }, [data.appts]);
  const perDay = calc.clients * (calc.conv / 100) * calc.upsell;
  const monthly = perDay * calc.days;
  const yearly = monthly * 12;
  const aovAfter = baseAov + calc.upsell * (calc.conv / 100);

  const [planModal, setPlanModal] = useState(false);
  const plans = data.memberships;
  const activePlans = plans.filter((p) => p.active);

  const [sortBy, setSortBy] = useState<"days" | "spent">("spent");
  const [limit, setLimit] = useState(12);
  const hour = Math.floor(now / 3_600_000);
  const sleepers = useMemo(
    () => data.clients.filter((c) => isSleeping(c, hour * 3_600_000)).sort((a, b) =>
      sortBy === "days" ? Date.parse(a.last_visit_at!) - Date.parse(b.last_visit_at!) : b.total_spent - a.total_spent),
    [data.clients, sortBy, hour],
  );
  const sentCount = sleepers.filter(winbackSent).length;
  const recoverable = sleepers.filter((c) => !winbackSent(c)).reduce((s, c) => s + (c.visits ? c.total_spent / c.visits : 0), 0);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      {/* ─── ١. بروتوكول الاستقبال ─── */}
      <Panel n={1} icon={Store} title="بروتوكول الاستقبال الـ ٣ دقائق" lead="أول ٣ دقائق تحدّد هل العميلة بترجع أو لا. القائمة تتصفّر تلقائياً كل صباح.">
        <div className="mb-4 flex items-center gap-4">
          <Ring value={doneCount / RECEPTION.length} />
          <div className="flex-1">
            <div className="text-sm font-black text-[var(--ink)]">
              {allDone ? "الاستقبال جاهز — تجربة ٥ نجوم ✨" : `${fmt(doneCount)} من ${fmt(RECEPTION.length)} جاهزة`}
            </div>
            <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
              الصالونات اللي تلتزم بالبروتوكول ترفع معدل العودة حتى ٢٠٪ بدون أي خصومات.
            </p>
            <button onClick={() => setChecks({})} className={`${btnGhost} mt-3 !px-3 !py-1.5 !text-xs`} disabled={doneCount === 0}>
              <RotateCcw size={12} /> تصفير لوردية جديدة
            </button>
          </div>
        </div>
        <ul className="space-y-2">
          {RECEPTION.map((r) => {
            const on = !!checks[r.id];
            return (
              <li key={r.id}>
                <button
                  onClick={() => setChecks({ ...checks, [r.id]: !on })}
                  className="flex w-full items-center gap-3 rounded-2xl border p-3 text-right transition-all hover:-translate-y-0.5"
                  style={{ borderColor: on ? "var(--acc)" : "var(--line)", background: on ? "color-mix(in srgb, var(--acc) 7%, transparent)" : "transparent" }}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--surface-2)]" style={{ color: on ? "var(--acc)" : "var(--muted)" }}>
                    <r.icon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm font-bold ${on ? "text-[var(--ink)]" : "text-[var(--body)]"}`}>{r.title}</span>
                    <span className="block text-[11px] text-[var(--faint)]">{r.hint}</span>
                  </span>
                  <Toggle on={on} />
                </button>
              </li>
            );
          })}
        </ul>
      </Panel>

      {/* ─── ٢. حاسبة الاستشارة ─── */}
      <Panel n={2} icon={Calculator} title="حاسبة مبيعات الاستشارة (٥ دقائق)" lead="خمس دقائق تفحص فيها الخبيرة الشعر أو البشرة وتقترح إضافة واحدة — شوفي أثرها على الشهر.">
        <div className="space-y-4">
          <Slider label="عدد العميلات يومياً" unit="عميلة" min={5} max={150} step={1} value={calc.clients} onChange={(v) => setCalc((c) => ({ ...c, clients: v }))} />
          <Slider label="متوسط قيمة الإضافة" unit="ر.س" min={20} max={500} step={10} value={calc.upsell} onChange={(v) => setCalc((c) => ({ ...c, upsell: v }))} />
          <Slider label="نسبة العميلات اللي يوافقن" unit="٪" min={5} max={100} step={5} value={calc.conv} onChange={(v) => setCalc((c) => ({ ...c, conv: v }))} />
          <Slider label="أيام العمل في الشهر" unit="يوم" min={15} max={31} step={1} value={calc.days} onChange={(v) => setCalc((c) => ({ ...c, days: v }))} />
        </div>
        <div className="sg-shine mt-5 rounded-3xl p-5 text-[var(--on-acc)]" style={accGrad}>
          <div className="text-xs font-bold opacity-80">الإيراد الإضافي المتوقع شهرياً</div>
          <div className="mt-1 text-4xl font-black tracking-tight">{sar(monthly)}</div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
            <div className="rounded-xl bg-white/10 p-2"><div className="opacity-75">يومياً</div><div className="mt-0.5 text-sm font-black">{sar(perDay)}</div></div>
            <div className="rounded-xl bg-white/10 p-2"><div className="opacity-75">سنوياً</div><div className="mt-0.5 text-sm font-black">{sar(yearly)}</div></div>
            <div className="rounded-xl bg-white/10 p-2"><div className="opacity-75">الفاتورة تصير</div><div className="mt-0.5 text-sm font-black">{sar(aovAfter)}</div></div>
          </div>
        </div>
      </Panel>

      {/* ─── ٣. العضويات ─── */}
      <Panel
        n={3} icon={Crown} title="إدارة العضويات المغلقة (VIP)" lead="سيولة مقدّمة + عميلة ملتزمة. فعّلي أو أوقفي أي باقة بضغطة."
        className="lg:col-span-2"
        action={<button onClick={() => setPlanModal(true)} className={btnPrimary} style={accGrad}><Plus size={16} /> إضافة باقة عضوية جديدة</button>}
      >
        <div className="mb-4 grid grid-cols-3 gap-3">
          <MiniStat label="باقات مفعّلة" value={fmt(activePlans.length)} />
          <MiniStat label="عضوات حاليات" value={fmt(activePlans.reduce((s, p) => s + p.members, 0))} />
          <MiniStat label="سيولة العضويات" value={sar(activePlans.reduce((s, p) => s + p.members * p.price, 0))} gold />
        </div>
        {plans.length === 0 ? (
          <EmptyState icon={Crown} text="ما فيه باقات عضوية بعد — أضيفي أول باقة." />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {plans.map((p, i) => {
              const Icon = PLAN_ICON[p.icon] ?? Gem;
              const featured = i === 0;
              return (
                <div
                  key={p.id}
                  className={`${card} group relative flex flex-col p-5 transition-all hover:-translate-y-1 ${p.active ? "" : "opacity-60 grayscale"}`}
                  style={featured && p.active ? { borderColor: `${GOLD}88`, boxShadow: `0 20px 50px -25px ${GOLD}` } : {}}
                >
                  {featured && <span className="absolute -top-3 right-5 rounded-full px-3 py-1 text-[11px] font-black text-[#2A1018]" style={{ background: GOLD }}>الأكثر ربحية</span>}
                  <div className="flex items-start gap-3">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl transition-transform group-hover:scale-110" style={{ background: `color-mix(in srgb, ${featured ? GOLD : "var(--acc)"} 16%, transparent)`, color: featured ? GOLD : "var(--acc)" }}>
                      <Icon size={22} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-lg font-black text-[var(--ink)]">{p.name}</div>
                      <div className="text-sm"><b className="text-xl text-[var(--ink)]">{fmt(p.price)}</b> <span className="text-[var(--muted)]">ر.س · {p.period}</span></div>
                    </div>
                    <button onClick={() => ops.patchPlan(p, { active: !p.active })} title={p.active ? "إيقاف" : "تفعيل"} aria-label={p.active ? "إيقاف الباقة" : "تفعيل الباقة"}>
                      <Toggle on={p.active} />
                    </button>
                  </div>
                  <ul className="mt-4 flex-1 space-y-1.5">
                    {p.perks.map((k) => (
                      <li key={k} className="flex items-start gap-2 text-sm text-[var(--body)]"><Check size={14} className="mt-0.5 shrink-0" style={{ color: "var(--acc)" }} />{k}</li>
                    ))}
                  </ul>
                  <div className="mt-4 flex items-center justify-between border-t border-[var(--line)] pt-3 text-xs text-[var(--muted)]">
                    <span><Users size={12} className="inline" /> {fmt(p.members)} عضوة</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => ops.patchPlan(p, { members: Math.max(0, p.members - 1) })} className="rounded-full border border-[var(--line)] px-2.5 py-1 font-bold hover:bg-[var(--hover)] disabled:opacity-40" disabled={!p.active || p.members === 0} aria-label="إنقاص عضوة">−</button>
                      <button onClick={() => ops.patchPlan(p, { members: p.members + 1 })} className="rounded-full border border-[var(--line)] px-2.5 py-1 font-bold hover:bg-[var(--hover)] disabled:opacity-40" disabled={!p.active}>+ عضوة</button>
                      {canDelete && (
                        <button onClick={() => { if (confirm(`حذف باقة «${p.name}»؟`)) ops.deletePlan(p); }} className="grid h-7 w-7 place-items-center rounded-full text-red-500 hover:bg-red-500/10" aria-label="حذف الباقة">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* ─── ٤. العميلات النائمات ─── */}
      <Panel
        n={4} icon={MoonStar} title={`حملة صيد العميلات النائمات (${fmt(SLEEP_DAYS)} يوم)`} lead={`كل عميلة غابت أكثر من ${fmt(SLEEP_DAYS)} يوماً. رسالة واحدة شخصية تكفي لإرجاع ثلثهن.`}
        className="lg:col-span-2"
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-[var(--line)] px-3 py-1.5 text-xs">
            <span className="text-[var(--muted)]">خصم العرض</span>
            {[10, 15, 20, 25].map((d) => (
              <button key={d} onClick={() => setSetting("discount", d)} className="rounded-full px-2.5 py-0.5 font-bold transition-colors" style={S.discount === d ? { ...accGrad, color: "var(--on-acc)" } : { color: "var(--body)" }}>
                {fmt(d)}٪
              </button>
            ))}
          </div>
          <div className="flex rounded-full border border-[var(--line)] p-0.5 text-xs font-bold">
            {(["spent", "days"] as const).map((k) => (
              <button key={k} onClick={() => setSortBy(k)} className="rounded-full px-3 py-1 transition-colors" style={sortBy === k ? { background: "var(--surface-2)", color: "var(--ink)" } : { color: "var(--muted)" }}>
                {k === "spent" ? "الأعلى إنفاقاً" : "الأطول غياباً"}
              </button>
            ))}
          </div>
          <div className="ms-auto text-xs text-[var(--muted)]">
            أُرسل <b className="text-[var(--ink)]">{fmt(sentCount)}</b> من {fmt(sleepers.length)} · إيراد قابل للاسترجاع ≈ <b style={{ color: GOLD }}>{sar(recoverable)}</b>
          </div>
        </div>
        {sleepers.length === 0 ? (
          <EmptyState icon={MoonStar} text={`ما فيه عميلات نائمات — كل عميلاتك زرنك خلال آخر ${fmt(SLEEP_DAYS)} يوم 🎉`} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {sleepers.slice(0, limit).map((c) => {
                const days = daysSince(c.last_visit_at, now);
                const sent = winbackSent(c);
                const msg = fill(S.templates.winback, vars({ client: firstName(c.name), service: c.favorite_service ?? "خدمتك المفضّلة" }));
                return (
                  <div key={c.id} className={`flex items-center gap-3 rounded-2xl border p-3 transition-all ${sent ? "border-green-500/40 bg-green-500/5" : "border-[var(--line)] hover:border-[var(--line-strong)]"}`}>
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-black text-[var(--ink)]">{c.name}</span>
                        <Badge color={days > 90 ? "#DC2626" : "#D9A21B"}>{fmt(days)} يوم</Badge>
                      </div>
                      <div className="mt-0.5 truncate text-[11px] text-[var(--muted)]">آخر خدمة: {c.favorite_service ?? "—"} · إجمالي الإنفاق {sar(c.total_spent)}</div>
                    </div>
                    {sent ? (
                      <button onClick={() => ops.winback(c, msg)} className="flex shrink-0 items-center gap-1 rounded-full px-3 py-2 text-xs font-bold text-green-600" title="إعادة الإرسال">
                        <CheckCircle2 size={14} /> أُرسل
                      </button>
                    ) : (
                      <button onClick={() => ops.winback(c, msg)} className="flex shrink-0 items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-2 text-xs font-extrabold text-white transition-transform hover:-translate-y-0.5">
                        <MessageCircle size={14} /> <span className="hidden sm:inline">إرسال عرض الاسترجاع عبر الواتساب</span><span className="sm:hidden">إرسال العرض</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {sleepers.length > limit && (
              <div className="mt-4 text-center">
                <button onClick={() => setLimit((l) => l + 12)} className={btnGhost}>عرض المزيد ({fmt(sleepers.length - limit)})</button>
              </div>
            )}
          </>
        )}
      </Panel>

      {planModal && (
        <PlanModal onClose={() => setPlanModal(false)} onSave={async (p) => { if (await ops.addPlan(p)) setPlanModal(false); }} />
      )}
    </div>
  );
}

function PlanModal({ onClose, onSave }: { onClose: () => void; onSave: (p: NewPlan) => Promise<void> }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState(1000);
  const [period, setPeriod] = useState("شهرياً");
  const [icon, setIcon] = useState<PlanIcon>("gem");
  const [perks, setPerks] = useState("خصم ٢٠٪ على كل الخدمات\nأولوية في الحجز\nهدية ترحيبية");
  const [saving, setSaving] = useState(false);
  const valid = name.trim().length > 1 && price > 0;
  return (
    <Modal title="إضافة باقة عضوية جديدة" onClose={onClose}>
      <div className="space-y-3">
        <Field label="اسم الباقة"><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: عضوية البشرة الذهبية" className={input} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="السعر (ر.س)"><input type="number" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} className={input} /></Field>
          <Field label="المدة">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className={input}>
              {["شهرياً", "ربع سنوي", "سنوياً", "رصيد مسبق", "باقة كاملة"].map((x) => <option key={x}>{x}</option>)}
            </select>
          </Field>
        </div>
        <Field label="الأيقونة" group>
          <div className="flex gap-2">
            {(Object.keys(PLAN_ICON) as PlanIcon[]).map((k) => {
              const I = PLAN_ICON[k];
              return (
                <button key={k} onClick={() => setIcon(k)} className="grid h-11 w-11 place-items-center rounded-xl border transition-colors" style={icon === k ? { borderColor: "var(--acc)", color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 10%, transparent)" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                  <I size={18} />
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="المزايا (ميزة في كل سطر)"><textarea rows={4} value={perks} onChange={(e) => setPerks(e.target.value)} className={`${input} resize-none leading-relaxed`} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>إلغاء</button>
        <button
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            await onSave({ name: name.trim(), price, period, icon, perks: perks.split("\n").map((s) => s.trim()).filter(Boolean) });
            setSaving(false);
          }}
          className={btnPrimary} style={accGrad}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} حفظ الباقة
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════ تبويب ٢: المواعيد ══════════════════════════ */

function BookingTab({ appts, now, ops, reminderTpl, vars }: {
  appts: ApptRow[]; now: number; ops: Ops; reminderTpl: string; vars: (v: Vars) => Vars;
}) {
  const [view, setView] = useState<ApptKind>("booking");
  const [statusFilter, setStatusFilter] = useState<ApptStatus | "all">("all");
  const [upsellFor, setUpsellFor] = useState<string | null>(null);
  const [newModal, setNewModal] = useState(false);

  const todayKey = localDateKey(now);
  const today = appts.filter((a) => localDateKey(Date.parse(a.starts_at)) === todayKey);
  const ofView = today.filter((a) => a.kind === view);
  const list = ofView.filter((a) => statusFilter === "all" || a.status === statusFilter).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  const counts = {
    waiting: ofView.filter((a) => a.status === "waiting").length,
    in_progress: ofView.filter((a) => a.status === "in_progress").length,
    done: ofView.filter((a) => a.status === "done").length,
  };
  const dayRevenue = today.filter((a) => a.status === "done").reduce((s, a) => s + invoice(a), 0);
  const upsellAppt = appts.find((a) => a.id === upsellFor) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex w-full rounded-full border border-[var(--line)] bg-[var(--surface)] p-1 text-xs font-bold sm:w-auto sm:text-sm">
          {([["booking", "مواعيد اليوم", CalendarClock], ["walkin", "الحضور المباشر", Footprints]] as const).map(([k, l, I]) => (
            <button key={k} onClick={() => { setView(k); setStatusFilter("all"); }} className="flex min-w-0 flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-full px-2 py-2 transition-all sm:flex-none sm:gap-1.5 sm:px-4" style={view === k ? { ...accGrad, color: "var(--on-acc)" } : { color: "var(--muted)" }}>
              <I size={15} /> {l}
              <span className="rounded-full bg-black/10 px-1.5 text-[11px]">{fmt(today.filter((a) => a.kind === k && a.status !== "done").length)}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip on={statusFilter === "all"} onClick={() => setStatusFilter("all")}>الكل</FilterChip>
          {(Object.keys(STATUS_META) as ApptStatus[]).map((s) => (
            <FilterChip key={s} on={statusFilter === s} color={STATUS_META[s].color} onClick={() => setStatusFilter(s)}>
              {STATUS_META[s].label} · {fmt(counts[s])}
            </FilterChip>
          ))}
        </div>
        <div className="ms-auto flex items-center gap-2">
          <span className="hidden text-xs text-[var(--muted)] sm:inline">إيراد المكتمل اليوم: <b className="text-[var(--ink)]">{sar(dayRevenue)}</b></span>
          <button onClick={() => setNewModal(true)} className={btnPrimary} style={accGrad}><UserPlus size={15} /> {view === "walkin" ? "إضافة حضور مباشر" : "حجز جديد"}</button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState icon={CalendarClock} text={ofView.length ? "لا توجد مواعيد بهذا التصنيف" : view === "walkin" ? "ما فيه حضور مباشر اليوم" : "ما فيه مواعيد اليوم — أضيفي أول حجز"} />
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {list.map((a) => {
            const meta = STATUS_META[a.status];
            const extra = addonsTotal(a);
            const at = Date.parse(a.starts_at);
            const diff = (at - now) / 1000;
            let timer: { text: string; color: string; pct?: number };
            if (a.status === "done") timer = { text: "انتهت الخدمة", color: "#16A34A" };
            else if (a.status === "in_progress") {
              const start = a.started_at ? Date.parse(a.started_at) : at;
              const left = (start + a.duration_minutes * 60000 - now) / 1000;
              const p = Math.min(1, Math.max(0, (now - start) / (a.duration_minutes * 60000)));
              timer = left > 0 ? { text: `متبقٍ ${countdown(left)}`, color: "#3B82F6", pct: p } : { text: `تجاوزت الوقت ${countdown(-left)}`, color: "#DC2626", pct: 1 };
            } else if (a.kind === "walkin") timer = { text: `تنتظر منذ ${countdown(-diff)}`, color: -diff > 15 * 60 ? "#DC2626" : "#D9A21B" };
            else timer = diff > 0 ? { text: `يبدأ بعد ${countdown(diff)}`, color: diff < 15 * 60 ? "#D9A21B" : "var(--muted)" } : { text: `متأخرة ${countdown(-diff)}`, color: "#DC2626" };

            return (
              <div key={a.id} className={`${card} group flex flex-col p-4 transition-all hover:-translate-y-0.5 hover:border-[var(--line-strong)]`}>
                <div className="flex items-start gap-3">
                  <Avatar name={a.client_name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-black text-[var(--ink)]">{a.client_name}</div>
                    <div className="truncate text-xs text-[var(--muted)]">{a.service} · مع <b className="text-[var(--body)]">{a.staff}</b></div>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-black text-[var(--ink)]">{timeLabel(a.starts_at)}</div>
                    <div className="text-[11px] text-[var(--faint)]">{fmt(a.duration_minutes)} د</div>
                  </div>
                  {a.status === "waiting" && (
                    <button onClick={() => { if (confirm(`إلغاء موعد ${a.client_name}؟`)) ops.cancel(a); }} className="-me-1 -mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[var(--faint)] transition-colors hover:bg-red-500/10 hover:text-red-500" aria-label="إلغاء الموعد" title="إلغاء الموعد">
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <button onClick={() => ops.setStatus(a, NEXT_STATUS[a.status])} disabled={a.status === "done"} className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-transform hover:scale-105 disabled:hover:scale-100" style={{ color: meta.color, background: `color-mix(in srgb, ${meta.color} 13%, transparent)` }} title={a.status === "done" ? "" : "اضغطي للانتقال للحالة التالية"}>
                    <meta.icon size={13} /> {meta.label}
                    {a.status !== "done" && <span className="opacity-60">←</span>}
                  </button>
                  <span className="font-mono text-xs font-bold tabular-nums" style={{ color: timer.color }}>{timer.text}</span>
                </div>
                {timer.pct !== undefined && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${timer.pct * 100}%`, background: timer.color }} />
                  </div>
                )}

                {a.addons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {a.addons.map((o, i) => (
                      <span key={i} className="sg-pop inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ color: GOLD, background: `color-mix(in srgb, ${GOLD} 13%, transparent)` }}>
                        <Zap size={10} /> {o.name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between border-t border-[var(--line)] pt-3 text-sm">
                  <span className="text-[var(--muted)]">الفاتورة</span>
                  <span className="font-black text-[var(--ink)]">
                    {sar(invoice(a))}
                    {extra > 0 && <span className="ms-1 text-xs" style={{ color: GOLD }}>(+{fmt(extra)})</span>}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button onClick={() => setUpsellFor(a.id)} disabled={a.status === "done"} className="flex items-center justify-center gap-1.5 rounded-xl border px-2 py-2 text-xs font-extrabold transition-colors hover:bg-[var(--hover)] disabled:opacity-40" style={{ borderColor: `${GOLD}88`, color: GOLD }}>
                    <Plus size={14} /> إضافة خدمة (Upsell)
                  </button>
                  <button
                    onClick={() => ops.remind(a, fill(reminderTpl, vars({ client: firstName(a.client_name), service: a.service, staff: a.staff, time: timeLabel(a.starts_at) })))}
                    className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-extrabold transition-colors ${a.reminded_at ? "border border-green-500/40 text-green-600 hover:bg-green-500/5" : "bg-[#25D366] text-white hover:brightness-105"}`}
                  >
                    {a.reminded_at ? <CheckCircle2 size={14} /> : <MessageCircle size={14} />} {a.reminded_at ? "تم التذكير" : "تذكير واتساب"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {upsellAppt && (
        <UpsellModal appt={upsellAppt} onClose={() => setUpsellFor(null)} onAdd={(o) => { ops.addAddon(upsellAppt, o); setUpsellFor(null); }} />
      )}
      {newModal && (
        <NewApptModal kind={view} onClose={() => setNewModal(false)} onSave={async (f) => { if (await ops.create(f)) setNewModal(false); }} />
      )}
    </div>
  );
}

function UpsellModal({ appt, onClose, onAdd }: { appt: ApptRow; onClose: () => void; onAdd: (o: Addon) => void }) {
  const [custom, setCustom] = useState("");
  const [customPrice, setCustomPrice] = useState(100);
  return (
    <Modal title={`إضافة خدمة لـ ${appt.client_name}`} onClose={onClose}>
      <p className="mb-4 text-sm text-[var(--muted)]">نص مقترح للخبيرة: «شعرك يحتاج ترطيب بسيط، أضيف لك {ADDONS[0].name} بـ {fmt(ADDONS[0].price)} ريال بس؟ بيفرق معك كثير 💕»</p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {ADDONS.map((o) => {
          const taken = appt.addons.some((x) => x.name === o.name);
          const I = ADDON_ICON[o.name] ?? Sparkles;
          return (
            <button key={o.name} disabled={taken} onClick={() => onAdd(o)} className="flex items-center gap-3 rounded-2xl border border-[var(--line)] p-3 text-right transition-all hover:-translate-y-0.5 hover:border-[var(--acc)] disabled:opacity-40 disabled:hover:translate-y-0">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ color: GOLD, background: `color-mix(in srgb, ${GOLD} 13%, transparent)` }}><I size={16} /></span>
              <span className="flex-1 text-sm font-bold text-[var(--ink)]">{o.name}</span>
              <span className="text-sm font-black" style={{ color: "var(--acc)" }}>{taken ? "مضافة" : `+${fmt(o.price)}`}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 flex gap-2 border-t border-[var(--line)] pt-4">
        <input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="خدمة أخرى…" className={input} />
        <input type="number" min={1} value={customPrice} onChange={(e) => setCustomPrice(Number(e.target.value))} className={`${input} !w-24`} aria-label="السعر" />
        <button disabled={!custom.trim() || customPrice <= 0} onClick={() => onAdd({ name: custom.trim(), price: customPrice })} className={`${btnPrimary} shrink-0`} style={accGrad} aria-label="إضافة"><Plus size={15} /></button>
      </div>
    </Modal>
  );
}

function NewApptModal({ kind, onClose, onSave }: { kind: ApptKind; onClose: () => void; onSave: (f: NewAppt) => Promise<void> }) {
  const [client, setClient] = useState("");
  const [phone, setPhone] = useState("");
  const [si, setSi] = useState(3);
  const [staff, setStaff] = useState(STAFF[0]);
  const [inMins, setInMins] = useState(30);
  const [saving, setSaving] = useState(false);
  const valid = client.trim().length > 1 && isSaudiMobile(phone);
  return (
    <Modal title={kind === "walkin" ? "إضافة حضور مباشر" : "حجز موعد جديد"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="اسم العميلة"><input autoFocus value={client} onChange={(e) => setClient(e.target.value)} className={input} /></Field>
          <Field label="رقم الجوال"><input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" className={`${input} text-left`} /></Field>
        </div>
        <Field label="الخدمة">
          <select value={si} onChange={(e) => setSi(Number(e.target.value))} className={input}>
            {SERVICES.map((s, i) => <option key={s.name} value={i}>{s.name} — {fmt(s.price)} ر.س</option>)}
          </select>
        </Field>
        <Field label="الخبيرة" group>
          <div className="flex flex-wrap gap-1.5">
            {STAFF.map((s) => (
              <button key={s} onClick={() => setStaff(s)} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors" style={staff === s ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--body)" }}>{s}</button>
            ))}
          </div>
        </Field>
        {kind === "booking" && (
          <Slider label="الموعد بعد" unit="دقيقة" min={5} max={480} step={5} value={inMins} onChange={setInMins} />
        )}
        {!valid && phone && <p className="text-xs text-red-500">أدخلي رقم جوال سعودي صحيح</p>}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>إلغاء</button>
        <button
          disabled={!valid || saving}
          onClick={async () => {
            setSaving(true);
            await onSave({
              client_name: client.trim(), phone, service: SERVICES[si].name, staff,
              starts_at: new Date(kind === "walkin" ? Date.now() : Date.now() + inMins * 60000).toISOString(),
              duration_minutes: SERVICES[si].mins, price: SERVICES[si].price, kind,
            });
            setSaving(false);
          }}
          className={btnPrimary} style={accGrad}
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} حفظ
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════ تبويب ٣: الرسائل ══════════════════════════ */

function AutomationTab({ settings, setSetting, vars, copy, notify }: {
  settings: Settings; setSetting: SetSetting; vars: (v: Vars) => Vars; copy: (t: string, m?: string) => void; notify: (m: string, e?: boolean) => void;
}) {
  const templates = settings.templates;
  const [sample, setSample] = useState({ client: "نورة", service: "صبغة كاملة", staff: "ريم", time: "٥:٠٠ م" });
  const [testPhone, setTestPhone] = useState("");
  const refs = useRef<Partial<Record<TplKey, HTMLTextAreaElement | null>>>({});
  const setTpl = (k: TplKey, v: string) => setSetting("templates", { ...templates, [k]: v.slice(0, 2000) });

  const insertTag = (k: TplKey, tag: string) => {
    const el = refs.current[k];
    const cur = templates[k];
    const s = el?.selectionStart ?? cur.length;
    const e = el?.selectionEnd ?? cur.length;
    setTpl(k, cur.slice(0, s) + tag + cur.slice(e));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s + tag.length, s + tag.length); });
  };

  const sendTest = (k: TplKey) => {
    if (!isSaudiMobile(testPhone)) { notify("أدخلي رقم جوال للتجربة أولاً", true); return; }
    window.open(waTo(testPhone, fill(templates[k], vars(sample))), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-5">
      <div className={`${card} grid grid-cols-1 gap-4 p-5 lg:grid-cols-[1fr_auto_auto]`}>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-black text-[var(--ink)]"><Sparkles size={16} style={{ color: "var(--acc)" }} /> بيانات المعاينة</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <input value={sample.client} onChange={(e) => setSample({ ...sample, client: e.target.value })} className={input} aria-label="اسم العميلة" />
            <select value={sample.service} onChange={(e) => setSample({ ...sample, service: e.target.value })} className={input} aria-label="الخدمة">
              {SERVICES.map((s) => <option key={s.name}>{s.name}</option>)}
            </select>
            <select value={sample.staff} onChange={(e) => setSample({ ...sample, staff: e.target.value })} className={input} aria-label="الخبيرة">
              {STAFF.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input value={sample.time} onChange={(e) => setSample({ ...sample, time: e.target.value })} className={input} aria-label="وقت الموعد" />
          </div>
        </div>
        <div>
          <div className="mb-3 text-sm font-black text-[var(--ink)]">رابط الحجز {"{رابط_الحجز}"}</div>
          <input dir="ltr" value={settings.booking_link} onChange={(e) => setSetting("booking_link", e.target.value.slice(0, 300))} placeholder="https://…" className={`${input} text-left lg:w-64`} />
        </div>
        <div>
          <div className="mb-3 text-sm font-black text-[var(--ink)]">رقم الإرسال التجريبي</div>
          <input dir="ltr" value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="05xxxxxxxx" className={`${input} text-left lg:w-44`} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {TEMPLATE_META.map((m) => {
          const k = m.key;
          const preview = fill(templates[k], vars(sample));
          const changed = templates[k] !== TEMPLATE_DEFAULTS[k];
          const on = settings.auto_on[k];
          return (
            <div key={k} className={`${card} flex flex-col p-5`}>
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}><m.icon size={20} /></span>
                <div className="min-w-0 flex-1">
                  <div className="font-black text-[var(--ink)]">{m.title}</div>
                  <div className="text-xs text-[var(--muted)]"><Repeat size={11} className="inline" /> {m.when}</div>
                </div>
                <button onClick={() => { setSetting("auto_on", { ...settings.auto_on, [k]: !on }); notify(on ? "أُوقف الإرسال التلقائي" : "فُعّل الإرسال التلقائي"); }} aria-label="الإرسال التلقائي" title="الإرسال التلقائي">
                  <Toggle on={on} />
                </button>
              </div>

              <textarea
                ref={(el) => { refs.current[k] = el; }}
                value={templates[k]}
                onChange={(e) => setTpl(k, e.target.value)}
                rows={6}
                className={`${input} mt-4 resize-y leading-relaxed`}
              />
              <div className="mt-2 flex flex-wrap gap-1">
                {TAGS.map((t) => (
                  <button key={t} onClick={() => insertTag(k, t)} className="rounded-md border border-dashed border-[var(--line-strong)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--muted)] transition-colors hover:border-[var(--acc)] hover:text-[var(--acc)]">
                    {t}
                  </button>
                ))}
              </div>

              {/* معاينة بشكل فقاعة واتساب */}
              <div className="mt-4 rounded-2xl p-3" style={{ backgroundColor: "color-mix(in srgb, #25D366 6%, var(--surface-2))" }}>
                <div className="mr-auto max-w-[92%] whitespace-pre-line break-words rounded-2xl rounded-tl-sm bg-[#DCF8C6] p-3 text-[13px] leading-relaxed text-[#111B21] shadow-sm">
                  {preview}
                  <div className="mt-1 text-left text-[10px] text-[#667781]">✓✓ الآن</div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button onClick={() => copy(preview, "تم نسخ النص")} className={btnGhost}><Copy size={14} /> نسخ النص</button>
                <button onClick={() => sendTest(k)} className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-2 text-sm font-extrabold text-white transition-transform hover:-translate-y-0.5">
                  <Send size={14} /> إرسال تجريبي عبر الواتساب
                </button>
                {changed && (
                  <button onClick={() => setTpl(k, TEMPLATE_DEFAULTS[k])} className={`${btnGhost} !px-3`} title="استرجاع النص الأصلي" aria-label="استرجاع النص الأصلي"><RotateCcw size={14} /></button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ══════════════════════════ تبويب ٤: التقارير ══════════════════════════ */

function AnalyticsTab({ metrics }: { metrics: Metrics }) {
  const [hover, setHover] = useState<number | null>(null);
  const cats = metrics.byCategory;
  const total = cats.reduce((s, x) => s + x.value, 0);
  const staffRows = metrics.staffUpsell;
  const maxRev = Math.max(1, ...staffRows.map((r) => r.revenue));

  // دونات بالـ SVG
  const r = 70;
  const C = 2 * Math.PI * r;
  const arcs = cats.map((s, i) => {
    const before = cats.slice(0, i).reduce((x, y) => x + y.value, 0);
    return { len: total ? (s.value / total) * C : 0, offset: total ? (before / total) * C : 0 };
  });

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Panel icon={Palette} title="توزيع المبيعات حسب نوع الخدمة" lead="مبيعات هذا الشهر (المواعيد المكتملة) — مرّري على أي قسم لعرض تفاصيله.">
        <div className="flex flex-col items-center gap-6 sm:flex-row">
          <div className="relative h-48 w-48 shrink-0">
            <svg viewBox="0 0 180 180" className="h-full w-full -rotate-90">
              <circle cx="90" cy="90" r={r} fill="none" stroke="var(--line)" strokeWidth="22" />
              {cats.map((s, i) => {
                const { len, offset } = arcs[i];
                if (!len) return null;
                return (
                  <circle
                    key={s.name} cx="90" cy="90" r={r} fill="none" stroke={(CAT_STYLE[s.name] ?? CAT_STYLE["أخرى"]).color}
                    strokeWidth={hover === i ? 28 : 22} strokeDasharray={`${Math.max(0, len - 2)} ${C - len + 2}`} strokeDashoffset={-offset}
                    className="cursor-pointer transition-all duration-200" style={{ opacity: hover === null || hover === i ? 1 : 0.35 }}
                    onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
                  />
                );
              })}
            </svg>
            <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
              <div>
                <div className="text-[11px] text-[var(--faint)]">{hover === null ? "الإجمالي" : cats[hover].name}</div>
                <div className="text-xl font-black text-[var(--ink)]">{sar(hover === null ? total : cats[hover].value)}</div>
                {hover !== null && total > 0 && <div className="text-xs font-bold" style={{ color: "var(--acc)" }}>{fmt((cats[hover].value / total) * 100)}٪</div>}
              </div>
            </div>
          </div>
          <ul className="w-full flex-1 space-y-2">
            {cats.map((s, i) => {
              const st = CAT_STYLE[s.name] ?? CAT_STYLE["أخرى"];
              return (
                <li key={s.name} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-[var(--hover)]">
                  <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${st.color} 18%, transparent)`, color: st.color }}><st.icon size={15} /></span>
                  <span className="flex-1 text-sm font-bold text-[var(--body)]">{s.name}</span>
                  <span className="text-sm font-black text-[var(--ink)]">{sar(s.value)}</span>
                  <span className="w-10 text-left text-xs text-[var(--faint)]">{total ? fmt((s.value / total) * 100) : 0}٪</span>
                </li>
              );
            })}
          </ul>
        </div>
      </Panel>

      <Panel icon={Trophy} title="ترتيب الخبيرات الأعلى في البيع المتقاطع" lead="الإضافات (Upsell) هذا الشهر — يتحدّث مباشرة مع كل إضافة في جدول المواعيد.">
        <ol className="space-y-3">
          {staffRows.map((s, i) => {
            const top = i === 0 && s.revenue > 0;
            return (
              <li key={s.name} className="flex items-center gap-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-black" style={top ? { background: GOLD, color: "#2A1018" } : { background: "var(--surface-2)", color: "var(--muted)" }}>
                  {top ? <Crown size={14} /> : fmt(i + 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-bold text-[var(--ink)]">
                      {s.name}
                      {s.today > 0 && <span className="sg-pop ms-1.5 rounded-full px-1.5 text-[10px] font-black" style={{ color: GOLD, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}>+{fmt(s.today)} اليوم</span>}
                    </span>
                    <span className="text-xs text-[var(--muted)]">{fmt(s.count)} إضافة · <b className="text-[var(--ink)]">{sar(s.revenue)}</b></span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
                    <div className="h-full rounded-full transition-all duration-700" style={{ width: `${(s.revenue / maxRev) * 100}%`, background: top ? `linear-gradient(90deg, ${GOLD}, var(--sand))` : "linear-gradient(90deg, var(--acc), var(--rose))" }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Panel>

      <Panel icon={Repeat} title="معدل عودة العميلات خلال ٣٠ / ٦٠ / ٩٠ يوماً" lead="من زيارات قبل ٣–٦ أشهر: كم زيارة رجعت صاحبتها لزيارة ثانية خلال الفترة." className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {metrics.returnRates.map((rr) => {
            const rate = rr.rate ?? 0;
            const hit = rate >= RETENTION_TARGET;
            return (
              <div key={rr.days} className="rounded-2xl border border-[var(--line)] p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-[var(--muted)]">خلال {fmt(rr.days)} يوماً</span>
                  <span className="text-[11px] text-[var(--faint)]">من {fmt(rr.sample)} زيارة</span>
                </div>
                <div className="mt-1 text-4xl font-black text-[var(--ink)]">{pct(rr.rate)}</div>
                <div className="relative mt-4 flex h-32 items-end justify-center border-b border-[var(--line)]">
                  <div className="pointer-events-none absolute inset-x-0 border-t border-dashed" style={{ bottom: `${RETENTION_TARGET}%`, borderColor: GOLD }}>
                    <span className="absolute -top-4 left-0 text-[10px] font-bold" style={{ color: GOLD }}>الهدف {fmt(RETENTION_TARGET)}٪</span>
                  </div>
                  <div className="flex h-full w-14 flex-col justify-end">
                    <div className="rounded-t-lg transition-all duration-700" style={{ height: `${rate}%`, ...(hit ? accGrad : { background: "var(--rose)" }) }} />
                  </div>
                </div>
                <div className={`mt-2 text-center text-xs font-bold ${hit ? "text-green-600" : "text-[var(--muted)]"}`}>
                  {rr.rate === null ? "لا توجد زيارات كافية بعد" : hit ? "فوق المستهدف ✓" : `يحتاج ${fmt(RETENTION_TARGET - rate)} نقطة للهدف`}
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

/* ──────────────────────────── مكوّنات مساعدة ──────────────────────────── */

function AccessGate({ mode, onRetry }: { mode: Mode; onRetry: () => void }) {
  const meta = mode === "login"
    ? { icon: LogIn, title: "سجّل الدخول للمتابعة", text: "هذه الصفحة خاصة — سجّل الدخول بحساب المسؤول لعرضها." }
    : mode === "denied"
      ? { icon: ShieldX, title: "لا تملك صلاحية الوصول", text: "الخطة التسويقية للصالونات متاحة للمسؤول فقط." }
      : { icon: CloudOff, title: "تعذّر تحميل البيانات", text: "صار خطأ في الاتصال بقاعدة البيانات — حاول مرة ثانية." };
  return (
    <div className="grid min-h-[70vh] place-items-center px-4">
      <div className={`${card} sg-in w-full max-w-md p-8 text-center`}>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}><meta.icon size={24} /></span>
        <h1 className="mt-5 text-xl font-black text-[var(--ink)]">{meta.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{meta.text}</p>
        <div className="mt-6">
          {mode === "login" && <Link href="/login" className={btnPrimary} style={accGrad}><LogIn size={15} /> تسجيل الدخول</Link>}
          {mode === "denied" && <Link href="/" className={btnGhost}>الرجوع للرئيسية</Link>}
          {mode === "error" && <button onClick={onRetry} className={btnGhost}><RotateCcw size={14} /> إعادة المحاولة</button>}
        </div>
      </div>
    </div>
  );
}

function ConnChip({ mode }: { mode: Mode }) {
  if (mode !== "live") return null;
  return (
    <span className="hidden items-center gap-1.5 rounded-full border border-green-500/40 px-3 py-1.5 text-xs font-bold text-green-600 sm:flex" title="البيانات محفوظة في قاعدة البيانات">
      <Cloud size={13} /> متصلة
    </span>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button onClick={onClick} title={title} aria-label={title} className="grid h-9 w-9 place-items-center rounded-full border border-[var(--line)] text-[var(--muted)] transition-colors hover:bg-[var(--hover)] hover:text-[var(--ink)]">
      {children}
    </button>
  );
}

function MetricCard({ icon: Icon, label, value, badge, sub, good, progress, target, onClick }: {
  icon: LucideIcon; label: string; value: string; badge: string; sub: string; good?: boolean; progress?: number; target?: number; onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick} className={`${card} group relative p-4 text-right transition-all hover:-translate-y-1 hover:border-[var(--line-strong)] sm:p-5`}>
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-2xl transition-transform group-hover:scale-110" style={{ color: "var(--acc)", background: "color-mix(in srgb, var(--acc) 12%, transparent)" }}>
          <Icon size={18} />
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-black sm:text-[11px] ${good ? "bg-green-500/12 text-green-600" : ""}`} style={good ? {} : { color: GOLD, background: `color-mix(in srgb, ${GOLD} 14%, transparent)` }}>
          {badge}
        </span>
      </div>
      <div className="mt-3 text-[11px] font-bold text-[var(--muted)] sm:text-xs">{label}</div>
      <div className="mt-0.5 text-xl font-black text-[var(--ink)] sm:text-2xl">{value}</div>
      {progress !== undefined && (
        <div className="relative mt-2 h-1.5 rounded-full bg-[var(--surface-2)]">
          <div className="h-full rounded-full" style={{ width: `${Math.min(1, progress) * 100}%`, ...accGrad }} />
          {target !== undefined && <div className="absolute -top-1 h-3.5 w-0.5 rounded" style={{ right: `${target * 100}%`, background: GOLD }} />}
        </div>
      )}
      <div className="mt-1.5 text-[10px] text-[var(--faint)] sm:text-[11px]">{sub}</div>
    </Tag>
  );
}

function Panel({ n, icon: Icon, title, lead, action, className = "", children }: {
  n?: number; icon: LucideIcon; title: string; lead?: string; action?: React.ReactNode; className?: string; children: React.ReactNode;
}) {
  return (
    <section className={`${card} p-5 sm:p-6 ${className}`}>
      <div className="mb-5 flex flex-wrap items-start gap-3">
        <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-[var(--on-acc)]" style={accGrad}>
          <Icon size={20} />
          {n !== undefined && <span className="absolute -left-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full text-[10px] font-black text-[#2A1018]" style={{ background: GOLD }}>{fmt(n)}</span>}
        </span>
        <div className="min-w-[12rem] flex-1">
          <h2 className="text-lg font-black leading-snug text-[var(--ink)] sm:text-xl">{title}</h2>
          {lead && <p className="mt-1 text-xs leading-relaxed text-[var(--muted)] sm:text-sm">{lead}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-dashed border-[var(--line-strong)] p-10 text-center">
      <Icon size={28} className="text-[var(--faint)]" />
      <div className="mt-3 text-sm font-bold text-[var(--muted)]">{text}</div>
    </div>
  );
}

function Toggle({ on }: { on: boolean }) {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors" style={{ background: on ? "var(--acc)" : "var(--line-strong)" }}>
      <span className="absolute h-5 w-5 rounded-full bg-white shadow transition-all" style={{ right: on ? "2px" : "calc(100% - 22px)" }} />
    </span>
  );
}

function Slider({ label, unit, min, max, step, value, onChange }: { label: string; unit: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void }) {
  const p = ((value - min) / (max - min)) * 100;
  return (
    <label className="block">
      <div className="mb-2 flex items-baseline justify-between text-sm">
        <span className="font-bold text-[var(--body)]">{label}</span>
        <span className="font-black text-[var(--ink)]">{fmt(value)} <span className="text-xs font-bold text-[var(--muted)]">{unit}</span></span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="sg-range" style={{ background: `linear-gradient(to left, var(--acc) ${p}%, var(--line) ${p}%)` }}
      />
    </label>
  );
}

function Ring({ value }: { value: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative h-20 w-20 shrink-0">
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--line)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={value === 1 ? GOLD : "var(--acc)"} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value)} style={{ transition: "stroke-dashoffset .5s ease, stroke .3s" }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-base font-black text-[var(--ink)]">{fmt(value * 100)}٪</div>
    </div>
  );
}

function MiniStat({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] p-3" style={gold ? { borderColor: `${GOLD}66` } : {}}>
      <div className="text-[11px] text-[var(--faint)]">{label}</div>
      <div className="mt-0.5 text-base font-black sm:text-lg" style={{ color: gold ? GOLD : "var(--ink)" }}>{value}</div>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return <span className="rounded-full px-2 py-0.5 text-[10px] font-black" style={{ color, background: `color-mix(in srgb, ${color} 13%, transparent)` }}>{children}</span>;
}

function FilterChip({ on, color, onClick, children }: { on: boolean; color?: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-all" style={on ? { borderColor: color ?? "var(--acc)", color: color ?? "var(--acc)", background: `color-mix(in srgb, ${color ?? "var(--acc)"} 10%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>
      {children}
    </button>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((w) => w[0]).slice(0, 2).join("");
  return (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-black text-[var(--on-acc)]" style={{ background: "linear-gradient(135deg, var(--rose), var(--acc))" }}>
      {initials}
    </span>
  );
}

function Field({ label, children, group }: { label: string; children: React.ReactNode; group?: boolean }) {
  // group: مجموعة أزرار — div مع role=group بدل label (الـ label يضغط أول زر لو ضغطت على العنوان)
  if (group) {
    return (
      <div role="group" aria-label={label}>
        <span className="mb-1 block text-xs font-bold text-[var(--muted)]">{label}</span>
        {children}
      </div>
    );
  }
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-bold text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="sg-noprint fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4 backdrop-blur-sm" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} className={`${card} sg-in max-h-[90vh] w-full max-w-lg overflow-y-auto !bg-[var(--bg)] p-5 sm:p-6`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-black text-[var(--ink)]">{title}</h3>
          <button onClick={onClose} className="grid h-8 w-8 place-items-center rounded-full text-[var(--muted)] hover:bg-[var(--hover)]" aria-label="إغلاق"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
