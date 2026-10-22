"use client";

// «غرفة التخطيط والتنفيذ» — مساحة فريق مستشاري الصالونات لتنفيذ آلية العميل.
// الدخول بكود الفريق (تحقق على السيرفر + كوكي موقّع)، وبعدها تختار المستشارة اسمها.

import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { LucideIcon } from "lucide-react";
import {
  KeyRound, Loader2, LogOut, Moon, Sun, LayoutGrid, CalendarDays, BookOpen, Users, Plus, Search, ChevronLeft, BarChart3, Crosshair, Phone,
  ChevronRight, AlertTriangle, Clock, CheckCircle2, Circle, Target, Lightbulb, Package, ShieldCheck,
  UserPlus, Trash2, Check, X, Briefcase, Eye, EyeOff, Repeat, Sparkles, Store, Crown, MoonStar, Flower2,
} from "lucide-react";
import {
  DEFAULT_TARGETS, HEALTH, PLAYBOOK, ROOM_MIN_CODE, STAGES, leadStatusMeta, stageLabel,
  type LogKind, type Priority, type RoomClient, type RoomLog, type RoomTask, type Stage, type Targets, type TeamMember,
} from "@/lib/salon-room";
import ClientPanel from "./ClientPanel";
import Dashboard from "./Dashboard";
import Targeting from "./Targeting";
import {
  THEMES, Avatar, Badge, EmptyState, Field, IconBtn, Modal, SectionTitle, GOLD, accGrad, addDaysKey, btnGhost, btnPrimary,
  card, dateLabel, fmt, input, todayKey, type ThemeKey,
} from "./ui";

/* ──────────────────────────── البيانات ──────────────────────────── */

export type RoomData = { clients: RoomClient[]; tasks: RoomTask[]; logs: RoomLog[]; team: TeamMember[]; targets: Targets };
const EMPTY: RoomData = { clients: [], tasks: [], logs: [], team: [], targets: DEFAULT_TARGETS };
type ClientPatch = Partial<Omit<RoomClient, "id" | "created_at" | "updated_at">>;

export type RoomOps = {
  addClient: (f: {
    salon_name: string; owner_name: string; phone: string; city: string; consultant: string; stage: Stage;
    source?: string; segment?: string; priority?: Priority; next_followup?: string;
  }) => Promise<boolean>;
  generatePlan: (clientId: string, start: string, overwrite: boolean) => Promise<void>;
  setTargets: (t: Targets) => void;
  patchClient: (id: string, patch: ClientPatch, debounce?: boolean) => void;
  addTask: (clientId: string, phase: Stage, title: string) => Promise<void>;
  patchTask: (t: RoomTask, patch: { done?: boolean; due_date?: string | null; assignee?: string | null }) => void;
  deleteTask: (t: RoomTask) => void;
  addLog: (clientId: string, kind: LogKind, body: string) => Promise<boolean>;
  addMember: (name: string, role?: string, phone?: string) => Promise<boolean>;
  patchMember: (m: TeamMember, patch: Partial<TeamMember>) => void;
  deleteMember: (m: TeamMember) => void;
};

type Phase = "loading" | "gate" | "name" | "room";
type TabId = "dashboard" | "board" | "targeting" | "week" | "playbook" | "team";
const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: "dashboard", label: "الداشبورد", icon: BarChart3 },
  { id: "board", label: "لوحة التنفيذ", icon: LayoutGrid },
  { id: "targeting", label: "خطة الاستهداف", icon: Crosshair },
  { id: "week", label: "هذا الأسبوع", icon: CalendarDays },
  { id: "playbook", label: "آلية العميل", icon: BookOpen },
  { id: "team", label: "الفريق", icon: Users },
];

const isDone = (c: RoomClient) => c.stage === "done" || c.stage === "paused" || c.stage === "lead";
const overdueTasks = (tasks: RoomTask[], clientId: string, today: string) =>
  tasks.filter((t) => t.client_id === clientId && !t.done_at && t.due_date && t.due_date < today);
export const needsAttention = (c: RoomClient, tasks: RoomTask[], today: string) =>
  !isDone(c) && (c.health !== "on_track" || overdueTasks(tasks, c.id, today).length > 0 || (!!c.next_review && c.next_review < today));

/* ──────────────────────────── الصفحة ──────────────────────────── */

const noop = () => () => {};

export default function SalonRoom() {
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  if (!isClient) return <div className="min-h-screen bg-[#FAF5EF]" />;
  return <SalonRoomInner />;
}

function SalonRoomInner() {
  const [theme, setTheme] = useState<ThemeKey>(() => {
    try { return localStorage.getItem("room-theme") === "night" ? "night" : "brand"; } catch { return "brand"; }
  });
  const toggleTheme = () => {
    const next = theme === "brand" ? "night" : "brand";
    setTheme(next);
    try { localStorage.setItem("room-theme", next); } catch { /* ignore */ }
  };

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState({ configured: false, isOwner: false });
  const [data, setData] = useState<RoomData>(EMPTY);
  const [me, setMe] = useState<string>(() => { try { return localStorage.getItem("room-user") ?? ""; } catch { return ""; } });
  const meRef = useRef(me);
  useEffect(() => { meRef.current = me; }, [me]);
  const [tab, setTab] = useState<TabId>("dashboard");
  const [openId, setOpenId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; error?: boolean } | null>(null);
  const [codeModal, setCodeModal] = useState(false);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((msg: string, error = false) => {
    setToast({ msg, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), error ? 3500 : 2000);
  }, []);

  const api = useCallback(async <T,>(path: string, method = "GET", body?: unknown): Promise<T> => {
    const res = await fetch(`/api/salon-room${path}`, {
      method, cache: "no-store",
      headers: { ...(body === undefined ? {} : { "Content-Type": "application/json" }), "x-room-user": encodeURIComponent(meRef.current) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== "/session") setPhase("gate");
    if (!res.ok) throw new Error(json.error || "تعذّر الحفظ");
    return json as T;
  }, []);

  const loadData = useCallback(async () => {
    const d = await api<RoomData>("");
    setData(d);
    return d;
  }, [api]);

  const boot = useCallback(() =>
    api<{ configured: boolean; authed: boolean; isOwner: boolean }>("/session").then(async (s) => {
      setSession({ configured: s.configured, isOwner: s.isOwner });
      if (!s.authed) { setPhase("gate"); return; }
      const d = await loadData();
      setPhase(meRef.current && d.team.some((m) => m.name === meRef.current) ? "room" : "name");
    }).catch(() => setPhase("gate")), [api, loadData]);
  useEffect(() => {
    const t = setTimeout(boot, 0);
    return () => clearTimeout(t);
  }, [boot]);

  // تحديث دوري عشان تشوفين شغل زميلاتك (يتوقف وقت فتح بطاقة صالون)
  useEffect(() => {
    if (phase !== "room" || openId) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") loadData().catch(() => {}); }, 45_000);
    return () => clearInterval(t);
  }, [phase, openId, loadData]);

  const fail = useCallback((e: unknown) => { notify((e as Error).message, true); loadData().catch(() => {}); }, [notify, loadData]);

  // ─── تعديل العميل: فوري للواجهة، والحفظ مؤجّل للحقول النصية ───
  const pending = useRef(new Map<string, { patch: ClientPatch; timer: ReturnType<typeof setTimeout> | null }>());
  const flushClient = useCallback(async (id: string) => {
    const p = pending.current.get(id);
    if (!p) return;
    pending.current.delete(id);
    try {
      const res = await api<{ client: RoomClient; log: RoomLog | null }>(`/clients/${id}`, "PATCH", p.patch);
      setData((d) => ({
        ...d,
        clients: pending.current.has(id) ? d.clients : d.clients.map((c) => (c.id === id ? { ...res.client, contract_value: res.client.contract_value === null ? null : Number(res.client.contract_value) } : c)),
        logs: res.log ? [res.log, ...d.logs] : d.logs,
      }));
    } catch (e) { fail(e); }
  }, [api, fail]);

  const ops: RoomOps = {
    addClient: async (f) => {
      try {
        const res = await api<{ client: RoomClient; tasks: RoomTask[]; log: RoomLog | null }>("/clients", "POST", f);
        setData((d) => ({ ...d, clients: [res.client, ...d.clients], tasks: [...d.tasks, ...res.tasks], logs: res.log ? [res.log, ...d.logs] : d.logs }));
        notify(`أُضيف «${res.client.salon_name}»`);
        setOpenId(res.client.id);
        return true;
      } catch (e) { fail(e); return false; }
    },
    patchClient: (id, patch, debounce = false) => {
      setData((d) => ({ ...d, clients: d.clients.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));
      const cur = pending.current.get(id);
      if (cur?.timer) clearTimeout(cur.timer);
      pending.current.set(id, { patch: { ...cur?.patch, ...patch }, timer: debounce ? setTimeout(() => flushClient(id), 700) : null });
      if (!debounce) flushClient(id);
      if (patch.archived) { setOpenId(null); notify("أُرشف الصالون"); }
    },
    addTask: async (clientId, phaseId, title) => {
      try {
        const res = await api<{ task: RoomTask }>("/tasks", "POST", { client_id: clientId, phase: phaseId, title, assignee: meRef.current || null });
        setData((d) => ({ ...d, tasks: [...d.tasks, res.task] }));
      } catch (e) { fail(e); }
    },
    patchTask: (t, patch) => {
      const local: Partial<RoomTask> = { ...patch };
      if ("done" in patch) Object.assign(local, patch.done ? { done_at: new Date().toISOString(), done_by: meRef.current || null } : { done_at: null, done_by: null });
      delete (local as { done?: boolean }).done;
      setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? { ...x, ...local } : x)) }));
      api<{ task: RoomTask }>(`/tasks/${t.id}`, "PATCH", patch)
        .then((res) => setData((d) => ({ ...d, tasks: d.tasks.map((x) => (x.id === t.id ? res.task : x)) })))
        .catch(fail);
    },
    deleteTask: (t) => {
      setData((d) => ({ ...d, tasks: d.tasks.filter((x) => x.id !== t.id) }));
      api(`/tasks/${t.id}`, "DELETE").catch(fail);
    },
    addLog: async (clientId, kind, body) => {
      try {
        const res = await api<{ log: RoomLog; client: RoomClient | null }>("/logs", "POST", { client_id: clientId, kind, body });
        setData((d) => ({
          ...d, logs: [res.log, ...d.logs],
          clients: res.client ? d.clients.map((c) => (c.id === clientId ? { ...c, last_contact_at: res.client!.last_contact_at, lead_status: res.client!.lead_status } : c)) : d.clients,
        }));
        return true;
      } catch (e) { fail(e); return false; }
    },
    generatePlan: async (clientId, start, overwrite) => {
      try {
        const res = await api<{ client: RoomClient; tasks: RoomTask[]; log: RoomLog | null }>(`/clients/${clientId}`, "POST", { start_date: start, overwrite });
        setData((d) => ({
          ...d,
          clients: d.clients.map((c) => (c.id === clientId ? { ...res.client, contract_value: res.client.contract_value === null ? null : Number(res.client.contract_value) } : c)),
          tasks: [...d.tasks.filter((t) => t.client_id !== clientId), ...res.tasks],
          logs: res.log ? [res.log, ...d.logs] : d.logs,
        }));
        notify("تم توليد خطة التنفيذ بالتواريخ");
      } catch (e) { fail(e); }
    },
    setTargets: (t) => {
      setData((d) => ({ ...d, targets: t }));
      api("/targets", "PUT", t).then(() => notify("تم حفظ أهداف الأسبوع")).catch(fail);
    },
    addMember: async (name, role, phone) => {
      try {
        const res = await api<{ member: TeamMember }>("/team", "POST", { name, role, phone });
        setData((d) => ({ ...d, team: [...d.team, res.member] }));
        return true;
      } catch (e) { notify((e as Error).message, true); return false; }
    },
    patchMember: (m, patch) => {
      setData((d) => ({ ...d, team: d.team.map((x) => (x.id === m.id ? { ...x, ...patch } : x)) }));
      api(`/team/${m.id}`, "PATCH", patch).catch(fail);
    },
    deleteMember: (m) => {
      setData((d) => ({ ...d, team: d.team.filter((x) => x.id !== m.id) }));
      api(`/team/${m.id}`, "DELETE").catch(fail);
    },
  };

  const copy = async (text: string, msg = "تم النسخ") => {
    try { await navigator.clipboard.writeText(text); notify(msg); } catch { notify("تعذّر النسخ", true); }
  };

  const chooseMe = (name: string) => {
    setMe(name);
    meRef.current = name;
    try { localStorage.setItem("room-user", name); } catch { /* ignore */ }
    setPhase("room");
  };

  const logout = async () => {
    await api("/session", "DELETE").catch(() => {});
    setData(EMPTY);
    setPhase("gate");
  };

  const openClient = data.clients.find((c) => c.id === openId) ?? null;

  return (
    <div
      dir="rtl"
      className="min-h-screen w-full overflow-x-hidden bg-[var(--bg)] text-[var(--body)]"
      style={{ ...THEMES[theme], colorScheme: theme === "night" ? "dark" : "light", fontFamily: "var(--font-tajawal), system-ui, sans-serif" } as React.CSSProperties}
    >
      <style>{`
        @keyframes sr-in { from { transform: translateY(12px); opacity: 0; } to { transform: none; opacity: 1; } }
        .sr-in { animation: sr-in .4s ease-out both; }
        @keyframes sr-slide { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
        .sr-slide { animation: sr-slide .3s ease-out both; }
      `}</style>

      {phase === "loading" && <div className="grid min-h-screen place-items-center text-[var(--muted)]"><Loader2 className="animate-spin" size={28} /></div>}

      {phase === "gate" && (
        <Gate session={session} theme={theme} toggleTheme={toggleTheme} onEnter={() => { setPhase("loading"); boot(); }} />
      )}

      {phase === "name" && <NamePicker team={data.team} current={me} onPick={chooseMe} addMember={ops.addMember} />}

      {phase === "room" && (
        <>
          <header className="sticky inset-x-0 top-0 z-40 border-b border-[var(--line)] bg-[var(--glass)] backdrop-blur-xl">
            <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[var(--on-acc)]" style={accGrad}><Briefcase size={18} /></span>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-black text-[var(--ink)]">غرفة التخطيط والتنفيذ</div>
                <div className="hidden text-[11px] text-[var(--faint)] sm:block">فريق مستشاري الصالونات</div>
              </div>
              <div className="ms-auto flex items-center gap-1.5">
                <button onClick={() => setPhase("name")} className="flex items-center gap-2 rounded-full border border-[var(--line)] py-1 pe-3 ps-1 text-xs font-bold text-[var(--body)] hover:bg-[var(--hover)]" title="تغيير المستشارة">
                  <Avatar name={me} size={26} /> <span className="max-w-[7rem] truncate">{me}</span>
                </button>
                {session.isOwner && <IconBtn onClick={() => setCodeModal(true)} title="تغيير كود الدخول"><KeyRound size={16} /></IconBtn>}
                <IconBtn onClick={toggleTheme} title={theme === "brand" ? "المظهر الليلي" : "المظهر الفاتح"}>{theme === "brand" ? <Moon size={16} /> : <Sun size={16} />}</IconBtn>
                <IconBtn onClick={logout} title="خروج"><LogOut size={16} /></IconBtn>
              </div>
            </div>
            <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 pb-2.5 sm:px-6 [scrollbar-width:none]" role="tablist">
              {TABS.map((t) => (
                <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition-all sm:text-sm"
                  style={tab === t.id ? { ...accGrad, color: "var(--on-acc)" } : { color: "var(--muted)" }}>
                  <t.icon size={14} /> {t.label}
                </button>
              ))}
            </nav>
          </header>

          <main key={tab} className="sr-in mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">
            {tab === "dashboard" && <Dashboard data={data} onOpen={setOpenId} />}
            {tab === "board" && <Board data={data} me={me} ops={ops} onOpen={setOpenId} />}
            {tab === "targeting" && <Targeting data={data} me={me} ops={ops} onOpen={setOpenId} />}
            {tab === "week" && <Week data={data} me={me} ops={ops} onOpen={setOpenId} />}
            {tab === "playbook" && <Playbook />}
            {tab === "team" && <Team data={data} me={me} ops={ops} />}
          </main>

          {openClient && <ClientPanel client={openClient} data={data} me={me} ops={ops} onClose={() => setOpenId(null)} copy={copy} />}
          {codeModal && <CodeModal onClose={() => setCodeModal(false)} onDone={() => { setCodeModal(false); notify("تم تغيير الكود — كل الجلسات القديمة خرجت"); }} />}
        </>
      )}

      {toast && (
        <div className={`sr-in fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-full px-5 py-2.5 text-sm font-bold shadow-2xl ${toast.error ? "bg-red-600 text-white" : "text-[var(--on-acc)]"}`} style={toast.error ? {} : accGrad}>
          {toast.error ? <X size={14} className="me-1 inline" /> : <Check size={14} className="me-1 inline" />} {toast.msg}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════ بوابة الدخول ══════════════════════════ */

function Gate({ session, theme, toggleTheme, onEnter }: {
  session: { configured: boolean; isOwner: boolean }; theme: ThemeKey; toggleTheme: () => void; onEnter: () => void;
}) {
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    const res = await fetch("/api/salon-room/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onEnter(); else { setError(json.error || "تعذّر الدخول"); setCode(""); }
  };

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 50% at 50% 0%, color-mix(in srgb, var(--acc) 18%, transparent), transparent 70%)" }} />
      <div className="absolute left-4 top-4"><IconBtn onClick={toggleTheme} title="المظهر">{theme === "brand" ? <Moon size={16} /> : <Sun size={16} />}</IconBtn></div>
      <div className={`${card} sr-in relative w-full max-w-sm p-7 text-center`}>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-3xl text-[var(--on-acc)] shadow-xl" style={accGrad}><Briefcase size={28} /></span>
        <h1 className="mt-5 text-2xl font-black text-[var(--ink)]">غرفة التخطيط والتنفيذ</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">فريق مستشاري الصالونات</p>

        {session.configured ? (
          <form onSubmit={submit} className="mt-6 space-y-3 text-right">
            <Field label="كود الدخول">
              <div className="relative">
                <input autoFocus type={show ? "text" : "password"} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off"
                  className={`${input} !py-3 pe-10 text-center text-lg font-black tracking-[0.3em]`} dir="ltr" aria-label="كود الدخول" />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-[var(--faint)]" aria-label={show ? "إخفاء" : "إظهار"}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </Field>
            {error && <p className="text-center text-xs font-bold text-red-500">{error}</p>}
            <button type="submit" disabled={!code.trim() || busy} className={`${btnPrimary} w-full !py-3`} style={accGrad}>
              {busy ? <Loader2 size={16} className="animate-spin" /> : <KeyRound size={16} />} دخول الغرفة
            </button>
          </form>
        ) : (
          <p className="mt-6 rounded-2xl bg-[var(--surface-2)] p-4 text-sm font-bold text-[var(--muted)]">الغرفة ما تفعّلت بعد — المسؤول يضبط كود الدخول أولاً.</p>
        )}

        {session.isOwner && (
          <div className="mt-5 border-t border-[var(--line)] pt-4">
            {setup ? (
              <CodeForm onDone={onEnter} />
            ) : (
              <button onClick={() => setSetup(true)} className={`${btnGhost} w-full`}><ShieldCheck size={15} /> {session.configured ? "تغيير كود الدخول (للمسؤول)" : "ضبط كود الدخول"}</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function CodeForm({ onDone }: { onDone: () => void }) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const valid = a.trim().length >= ROOM_MIN_CODE && a === b;
  const save = async () => {
    setBusy(true); setError("");
    const res = await fetch("/api/salon-room/code", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: a.trim() }) });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) onDone(); else setError(json.error || "تعذّر الحفظ");
  };
  return (
    <div className="space-y-2 text-right">
      <Field label={`الكود الجديد (${fmt(ROOM_MIN_CODE)} خانات على الأقل)`}>
        <input type="password" value={a} onChange={(e) => setA(e.target.value)} className={input} dir="ltr" autoComplete="new-password" />
      </Field>
      <Field label="تأكيد الكود">
        <input type="password" value={b} onChange={(e) => setB(e.target.value)} className={input} dir="ltr" autoComplete="new-password" />
      </Field>
      {b && a !== b && <p className="text-xs font-bold text-red-500">الكودين مو متطابقين</p>}
      {error && <p className="text-xs font-bold text-red-500">{error}</p>}
      <p className="text-[11px] text-[var(--faint)]">تغيير الكود يُخرج كل المستشارات من الغرفة لين يدخلن الكود الجديد.</p>
      <button onClick={save} disabled={!valid || busy} className={`${btnPrimary} w-full`} style={accGrad}>
        {busy ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />} حفظ الكود
      </button>
    </div>
  );
}

function CodeModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  return <Modal title="تغيير كود دخول الغرفة" onClose={onClose}><CodeForm onDone={onDone} /></Modal>;
}

function NamePicker({ team, current, onPick, addMember }: { team: TeamMember[]; current: string; onPick: (n: string) => void; addMember: RoomOps["addMember"] }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const active = team.filter((m) => m.active);
  const addAndPick = async () => {
    const n = name.trim();
    if (n.length < 2) return;
    setBusy(true);
    const ok = team.some((m) => m.name === n) || (await addMember(n));
    setBusy(false);
    if (ok) onPick(n);
  };
  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className={`${card} sr-in w-full max-w-md p-7`}>
        <h1 className="text-center text-xl font-black text-[var(--ink)]">مين أنتِ؟</h1>
        <p className="mt-1 text-center text-sm text-[var(--muted)]">اختاري اسمك — يُستخدم لإسناد المهام وتوقيع السجل.</p>
        {active.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-2">
            {active.map((m) => (
              <button key={m.id} onClick={() => onPick(m.name)} className="flex items-center gap-2 rounded-2xl border p-3 text-right transition-all hover:-translate-y-0.5"
                style={{ borderColor: m.name === current ? "var(--acc)" : "var(--line)" }}>
                <Avatar name={m.name} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-black text-[var(--ink)]">{m.name}</span>
                  <span className="block truncate text-[11px] text-[var(--faint)]">{m.role}</span>
                </span>
              </button>
            ))}
          </div>
        )}
        <div className="mt-5 flex gap-2 border-t border-[var(--line)] pt-4">
          <input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addAndPick()} placeholder={active.length ? "أو اكتبي اسماً جديداً" : "اكتبي اسمك"} className={input} />
          <button onClick={addAndPick} disabled={name.trim().length < 2 || busy} className={`${btnPrimary} shrink-0`} style={accGrad}>
            {busy ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />} دخول
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════ لوحة الغرفة ══════════════════════════ */

function Board({ data, me, ops, onOpen }: { data: RoomData; me: string; ops: RoomOps; onOpen: (id: string) => void }) {
  const today = todayKey();
  const in7 = addDaysKey(today, 7);
  const [who, setWho] = useState<string>("all");
  const [q, setQ] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [newModal, setNewModal] = useState(false);

  const clients = data.clients.filter((c) => c.stage !== "lead" &&
    (who === "all" || (who === "me" ? c.consultant === me : c.consultant === who)) &&
    (!q.trim() || [c.salon_name, c.owner_name, c.city].some((x) => x?.includes(q.trim()))));
  const active = clients.filter((c) => !isDone(c));
  const attention = active.filter((c) => needsAttention(c, data.tasks, today));
  const ids = new Set(clients.map((c) => c.id));
  const overdue = data.tasks.filter((t) => ids.has(t.client_id) && !t.done_at && t.due_date && t.due_date < today);
  const reviews = active.filter((c) => c.next_review && c.next_review >= today && c.next_review <= in7);
  const columns = STAGES.filter((s) => s.id !== "lead" && (showClosed || !["done", "paused"].includes(s.id)));

  const move = (c: RoomClient, dir: 1 | -1) => {
    const order = STAGES.filter((s) => s.id !== "paused" && s.id !== "lead").map((s) => s.id);
    const i = order.indexOf(c.stage);
    const next = order[Math.max(0, Math.min(order.length - 1, (i < 0 ? 0 : i) + dir))];
    if (next !== c.stage) ops.patchClient(c.id, { stage: next });
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Store} label="صالونات نشطة" value={fmt(active.length)} />
        <Stat icon={AlertTriangle} label="بحاجة انتباه" value={fmt(attention.length)} tone={attention.length ? "#D9A21B" : undefined} />
        <Stat icon={Clock} label="مهام متأخرة" value={fmt(overdue.length)} tone={overdue.length ? "#DC2626" : undefined} />
        <Stat icon={CalendarDays} label="مراجعات خلال ٧ أيام" value={fmt(reviews.length)} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {[{ id: "all", label: "الكل" }, { id: "me", label: "صالوناتي" }, ...data.team.filter((m) => m.active && m.name !== me).map((m) => ({ id: m.name, label: m.name }))].map((x) => (
            <button key={x.id} onClick={() => setWho(x.id)} className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors"
              style={who === x.id ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
              {x.label}
            </button>
          ))}
        </div>
        <div className="relative ms-auto w-full sm:w-56">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالصالون أو المالكة أو المدينة" className={`${input} ps-8`} />
        </div>
        <button onClick={() => setShowClosed((s) => !s)} className={btnGhost}>{showClosed ? "إخفاء المكتمل والمتوقف" : "عرض المكتمل والمتوقف"}</button>
        <button onClick={() => setNewModal(true)} className={btnPrimary} style={accGrad}><Plus size={15} /> صالون جديد</button>
      </div>

      {data.clients.every((c) => c.stage === "lead") ? (
        <EmptyState icon={Store} text="ما فيه عملاء في التنفيذ بعد — حوّلي صالون من «خطة الاستهداف» أو أضيفي صالون مباشرة." />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          <div className="flex gap-3" style={{ minWidth: columns.length * 248 }}>
            {columns.map((col) => {
              const list = clients.filter((c) => c.stage === col.id);
              return (
                <div key={col.id} className="w-[240px] shrink-0 rounded-3xl bg-[var(--surface-2)]/70 p-2.5">
                  <div className="mb-2 flex items-center justify-between px-1.5">
                    <span className="text-sm font-black text-[var(--ink)]">{col.label}</span>
                    <span className="rounded-full bg-[var(--surface)] px-2 text-xs font-bold text-[var(--muted)]">{fmt(list.length)}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((c) => <ClientCard key={c.id} c={c} tasks={data.tasks} today={today} onOpen={() => onOpen(c.id)} onMove={(d) => move(c, d)} />)}
                    {list.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-center text-[11px] text-[var(--faint)]">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {newModal && <NewClientModal team={data.team} me={me} onClose={() => setNewModal(false)} onSave={async (f) => { if (await ops.addClient(f)) setNewModal(false); }} />}
    </div>
  );
}

function ClientCard({ c, tasks, today, onOpen, onMove }: { c: RoomClient; tasks: RoomTask[]; today: string; onOpen: () => void; onMove: (d: 1 | -1) => void }) {
  const phaseTasks = tasks.filter((t) => t.client_id === c.id && t.phase === c.stage);
  const done = phaseTasks.filter((t) => t.done_at).length;
  const late = overdueTasks(tasks, c.id, today).length;
  const reviewLate = !!c.next_review && c.next_review < today;
  const h = HEALTH[c.health];
  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={`${card} group cursor-pointer !rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:border-[var(--line-strong)]`}>
      <div className="flex items-start gap-2">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: h.color }} title={h.label} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black text-[var(--ink)]">{c.salon_name}</div>
          <div className="truncate text-[11px] text-[var(--faint)]">{[c.owner_name, c.city].filter(Boolean).join(" · ") || "—"}</div>
        </div>
        <Avatar name={c.consultant} size={24} />
      </div>
      {phaseTasks.length > 0 && (
        <div className="mt-2.5">
          <div className="mb-1 flex justify-between text-[10px] font-bold text-[var(--faint)]"><span>مهام المرحلة</span><span>{fmt(done)}/{fmt(phaseTasks.length)}</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div className="h-full rounded-full" style={{ width: `${(done / phaseTasks.length) * 100}%`, background: done === phaseTasks.length ? "#16A34A" : "var(--acc)" }} />
          </div>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1">
        {late > 0 && <Badge color="#DC2626"><Clock size={10} /> {fmt(late)} متأخرة</Badge>}
        {c.next_review && <Badge color={reviewLate ? "#DC2626" : "#7A6570"}><CalendarDays size={10} /> {dateLabel(c.next_review)}</Badge>}
        <span className="ms-auto flex opacity-60 transition-opacity group-hover:opacity-100">
          <button onClick={(e) => { e.stopPropagation(); onMove(-1); }} className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--hover)]" title="المرحلة السابقة" aria-label="المرحلة السابقة"><ChevronRight size={14} /></button>
          <button onClick={(e) => { e.stopPropagation(); onMove(1); }} className="grid h-6 w-6 place-items-center rounded-full hover:bg-[var(--hover)]" title="المرحلة التالية" aria-label="المرحلة التالية"><ChevronLeft size={14} /></button>
        </span>
      </div>
    </div>
  );
}

function NewClientModal({ team, me, onClose, onSave }: {
  team: TeamMember[]; me: string; onClose: () => void; onSave: (f: Parameters<RoomOps["addClient"]>[0]) => Promise<void>;
}) {
  const [f, setF] = useState({ salon_name: "", owner_name: "", phone: "", city: "", consultant: me, stage: "discovery" as Stage });
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="صالون جديد" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="اسم الصالون"><input autoFocus value={f.salon_name} onChange={(e) => setF({ ...f, salon_name: e.target.value })} className={input} /></Field></div>
        <Field label="المالكة"><input value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} className={input} /></Field>
        <Field label="الجوال"><input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="05xxxxxxxx" className={`${input} text-left`} /></Field>
        <Field label="المدينة"><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={input} /></Field>
        <Field label="المستشارة المسؤولة">
          <select value={f.consultant} onChange={(e) => setF({ ...f, consultant: e.target.value })} className={input}>
            {team.filter((m) => m.active).map((m) => <option key={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <div className="col-span-2">
          <Field label="المرحلة الحالية">
            <select value={f.stage} onChange={(e) => setF({ ...f, stage: e.target.value as Stage })} className={input}>
              {STAGES.filter((s) => !["lead", "done", "paused"].includes(s.id)).map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <p className="mt-3 text-[11px] text-[var(--faint)]">تنزل مهام آلية العميل لكل المراحل تلقائياً (٢٧ مهمة) وتُسند للمستشارة المسؤولة.</p>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>إلغاء</button>
        <button disabled={f.salon_name.trim().length < 2 || busy} onClick={async () => { setBusy(true); await onSave(f); setBusy(false); }} className={btnPrimary} style={accGrad}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} إضافة
        </button>
      </div>
    </Modal>
  );
}

/* ══════════════════════════ هذا الأسبوع ══════════════════════════ */

function Week({ data, me, ops, onOpen }: { data: RoomData; me: string; ops: RoomOps; onOpen: (id: string) => void }) {
  const today = todayKey();
  const in7 = addDaysKey(today, 7);
  const [mine, setMine] = useState(true);
  const byId = useMemo(() => new Map(data.clients.map((c) => [c.id, c])), [data.clients]);
  const isMine = (t: RoomTask) => t.assignee === me || (!t.assignee && byId.get(t.client_id)?.consultant === me);
  const open = data.tasks.filter((t) => !t.done_at && t.due_date && t.due_date <= in7 && byId.has(t.client_id) && (!mine || isMine(t)));
  const late = open.filter((t) => t.due_date! < today).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
  const days = Array.from({ length: 8 }, (_, i) => addDaysKey(today, i));
  const clientsMine = data.clients.filter((c) => !isDone(c) && (!mine || c.consultant === me));
  const reviews = clientsMine.filter((c) => c.next_review && c.next_review <= in7).sort((a, b) => a.next_review!.localeCompare(b.next_review!));
  const attention = clientsMine.filter((c) => needsAttention(c, data.tasks, today));
  const followups = data.clients.filter((c) => c.stage === "lead" && c.lead_status !== "not_interested" && c.next_followup && c.next_followup <= in7
    && (!mine || c.consultant === me)).sort((a, b) => a.next_followup!.localeCompare(b.next_followup!));
  const noDue = data.tasks.filter((t) => !t.done_at && !t.due_date && byId.has(t.client_id) && (!mine || isMine(t))
    && byId.get(t.client_id)!.stage === t.phase).length;

  const row = (t: RoomTask) => {
    const c = byId.get(t.client_id)!;
    return (
      <li key={t.id} className="flex items-center gap-2 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-2.5">
        <button onClick={() => ops.patchTask(t, { done: true })} className="text-[var(--faint)] hover:text-[#16A34A]" aria-label="إنجاز"><Circle size={18} /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-[var(--ink)]">{t.title}</div>
          <button onClick={() => onOpen(c.id)} className="truncate text-[11px] font-bold hover:underline" style={{ color: "var(--acc)" }}>{c.salon_name} · {stageLabel(t.phase)}</button>
        </div>
        {!mine && t.assignee && <Avatar name={t.assignee} size={22} />}
      </li>
    );
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-[var(--ink)]">المهام المستحقة</h2>
          <div className="flex rounded-full border border-[var(--line)] p-0.5 text-xs font-bold">
            {[{ v: true, l: "مهامي" }, { v: false, l: "كل الفريق" }].map((x) => (
              <button key={x.l} onClick={() => setMine(x.v)} className="rounded-full px-3 py-1" style={mine === x.v ? { ...accGrad, color: "var(--on-acc)" } : { color: "var(--muted)" }}>{x.l}</button>
            ))}
          </div>
        </div>
        {late.length > 0 && (
          <div className={`${card} p-4`} style={{ borderColor: "#DC262655" }}>
            <SectionTitle icon={AlertTriangle} title={`متأخرة (${fmt(late.length)})`} />
            <ul className="space-y-1.5">{late.map(row)}</ul>
          </div>
        )}
        {days.map((d, i) => {
          const list = open.filter((t) => t.due_date === d);
          if (!list.length && i > 0) return null;
          return (
            <div key={d} className={`${card} p-4`}>
              <SectionTitle icon={CalendarDays} title={i === 0 ? `اليوم — ${dateLabel(d, true)}` : dateLabel(d, true)} />
              {list.length ? <ul className="space-y-1.5">{list.map(row)}</ul> : <p className="text-xs text-[var(--faint)]">ما فيه مهام مستحقة اليوم.</p>}
            </div>
          );
        })}
        {noDue > 0 && (
          <p className="rounded-2xl bg-[var(--surface-2)] p-3 text-xs text-[var(--muted)]">
            فيه {fmt(noDue)} مهمة في المراحل الحالية بدون تاريخ استحقاق — حدّدي لها تواريخ من بطاقة الصالون عشان تطلع هنا.
          </p>
        )}
      </div>

      <div className="space-y-4">
        <div className={`${card} p-4`}>
          <SectionTitle icon={Phone} title="متابعات الاستهداف" />
          {followups.length ? (
            <ul className="space-y-1.5">
              {followups.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2 rounded-2xl border border-[var(--line)] p-2.5 text-right hover:bg-[var(--hover)]">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: leadStatusMeta(c.lead_status).color }} title={leadStatusMeta(c.lead_status).label} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--ink)]">{c.salon_name}</span>
                    <Badge color={c.next_followup! < today ? "#DC2626" : "#7A6570"}>{dateLabel(c.next_followup)}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-[var(--faint)]">ما فيه متابعات استهداف خلال ٧ أيام.</p>}
        </div>
        <div className={`${card} p-4`}>
          <SectionTitle icon={CalendarDays} title="مراجعات قادمة" />
          {reviews.length ? (
            <ul className="space-y-1.5">
              {reviews.map((c) => (
                <li key={c.id}>
                  <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2 rounded-2xl border border-[var(--line)] p-2.5 text-right hover:bg-[var(--hover)]">
                    <Avatar name={c.consultant} size={24} />
                    <span className="min-w-0 flex-1 truncate text-sm font-bold text-[var(--ink)]">{c.salon_name}</span>
                    <Badge color={c.next_review! < today ? "#DC2626" : "#7A6570"}>{dateLabel(c.next_review)}</Badge>
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="text-xs text-[var(--faint)]">ما فيه مراجعات خلال ٧ أيام.</p>}
        </div>
        <div className={`${card} p-4`}>
          <SectionTitle icon={AlertTriangle} title="بحاجة انتباه" />
          {attention.length ? (
            <ul className="space-y-1.5">
              {attention.map((c) => {
                const late = overdueTasks(data.tasks, c.id, today).length;
                const reasons = [c.health !== "on_track" ? HEALTH[c.health].label : null, late ? `${fmt(late)} مهام متأخرة` : null, c.next_review && c.next_review < today ? "المراجعة فاتت" : null].filter(Boolean);
                return (
                  <li key={c.id}>
                    <button onClick={() => onOpen(c.id)} className="flex w-full items-center gap-2 rounded-2xl border border-[var(--line)] p-2.5 text-right hover:bg-[var(--hover)]">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HEALTH[c.health].color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-[var(--ink)]">{c.salon_name}</span>
                        <span className="block truncate text-[11px] text-[var(--faint)]">{reasons.join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-xs font-bold text-[#16A34A]">كل الصالونات على المسار ✓</p>}
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════ آلية العميل ══════════════════════════ */

const KEYS = [
  { icon: Flower2, title: "بروتوكول الاستقبال الـ ٣ دقائق", text: "عطر، ضيافة، ترحيب بالاسم — أول انطباع يحدد العودة." },
  { icon: Sparkles, title: "استشارة الـ ٥ دقائق", text: "فحص واقتراح إضافة واحدة قبل الخدمة — ترفع الفاتورة." },
  { icon: Crown, title: "العضويات المغلقة", text: "رصيد مسبق وباقات — سيولة مقدّمة وعميلة ملتزمة." },
  { icon: MoonStar, title: "صيد العميلات النائمات", text: "رسالة شخصية بعد ٤٥ يوم غياب — أسرع فوز." },
];

function Playbook() {
  return (
    <div className="space-y-6">
      <div className={`${card} p-5 sm:p-6`}>
        <h2 className="text-xl font-black text-[var(--ink)]">آلية العميل — من أول تواصل إلى التجديد</h2>
        <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
          ٦ مراحل ثابتة لكل صالون. كل صالون جديد تنزل له مهام هذا الدليل تلقائياً، والمستشارة تضيف عليها حسب حالته.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {KEYS.map((k) => (
            <div key={k.title} className="rounded-2xl border border-[var(--line)] p-3">
              <k.icon size={18} style={{ color: GOLD }} />
              <div className="mt-2 text-sm font-black text-[var(--ink)]">{k.title}</div>
              <div className="mt-0.5 text-xs leading-relaxed text-[var(--muted)]">{k.text}</div>
            </div>
          ))}
        </div>
      </div>

      <ol className="relative space-y-4 border-s-2 border-dashed border-[var(--line-strong)] ps-6">
        {PLAYBOOK.map((p, i) => (
          <li key={p.stage} className="relative">
            <span className="absolute -start-[37px] top-4 grid h-7 w-7 place-items-center rounded-full text-xs font-black text-[var(--on-acc)]" style={accGrad}>{fmt(i + 1)}</span>
            <div className={`${card} p-5`}>
              <div className="flex flex-wrap items-baseline gap-2">
                <h3 className="text-lg font-black text-[var(--ink)]">{stageLabel(p.stage)}</h3>
                <Badge color={GOLD}><Clock size={10} /> {p.duration}</Badge>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-[var(--body)]"><Target size={14} style={{ color: "var(--acc)" }} /> {p.goal}</p>
              <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
                {p.tasks.map((t) => <li key={t} className="flex items-start gap-2 text-sm text-[var(--body)]"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[var(--faint)]" /> {t}</li>)}
              </ul>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-2xl bg-[var(--surface-2)] p-3 text-xs"><span className="flex items-center gap-1 font-black text-[var(--ink)]"><Package size={12} /> المُخرَج</span><span className="mt-0.5 block text-[var(--muted)]">{p.deliverable}</span></div>
                <div className="rounded-2xl p-3 text-xs" style={{ background: `color-mix(in srgb, ${GOLD} 10%, transparent)` }}><span className="flex items-center gap-1 font-black text-[var(--ink)]"><Lightbulb size={12} style={{ color: GOLD }} /> نصيحة القائد</span><span className="mt-0.5 block text-[var(--muted)]">{p.tip}</span></div>
              </div>
            </div>
          </li>
        ))}
      </ol>

      <div className={`${card} p-5 sm:p-6`}>
        <SectionTitle icon={Repeat} title="إيقاع الفريق" />
        <ul className="grid gap-2 text-sm text-[var(--body)] sm:grid-cols-3">
          <li className="rounded-2xl border border-[var(--line)] p-3"><b className="text-[var(--ink)]">يومياً:</b> افتحي «هذا الأسبوع» وخلّصي مهام اليوم، وسجّلي أي تواصل في سجل الصالون.</li>
          <li className="rounded-2xl border border-[var(--line)] p-3"><b className="text-[var(--ink)]">أسبوعياً (اجتماع الغرفة):</b> نمرّ على «بحاجة انتباه» والمهام المتأخرة والمراجعات القادمة — ٣٠ دقيقة.</li>
          <li className="rounded-2xl border border-[var(--line)] p-3"><b className="text-[var(--ink)]">شهرياً:</b> تحديث «الحالي» في مؤشرات كل صالون، ومقارنته بخط الأساس والأهداف.</li>
        </ul>
      </div>
    </div>
  );
}

/* ══════════════════════════ الفريق ══════════════════════════ */

function Team({ data, me, ops }: { data: RoomData; me: string; ops: RoomOps }) {
  const today = todayKey();
  const [weekAgo] = useState(() => Date.now() - 7 * 86_400_000);
  const [name, setName] = useState("");
  const [role, setRole] = useState("مستشارة");
  const [phone, setPhone] = useState("");
  const add = async () => { if (await ops.addMember(name.trim(), role.trim(), phone.trim())) { setName(""); setPhone(""); } };

  return (
    <div className="space-y-5">
      <div className={`${card} p-5`}>
        <SectionTitle icon={UserPlus} title="إضافة عضو للفريق" />
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" className={input} />
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="الدور" className={input} />
          <input dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="05xxxxxxxx" className={`${input} text-left`} />
          <button onClick={add} disabled={name.trim().length < 2} className={btnPrimary} style={accGrad}><Plus size={15} /> إضافة</button>
        </div>
      </div>

      <div className={`${card} overflow-x-auto p-5`}>
        <SectionTitle icon={Users} title="حِمل الفريق" />
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="text-right text-[11px] text-[var(--faint)]">
              <th className="py-2 font-bold">العضو</th><th className="font-bold">صالونات نشطة</th><th className="font-bold">بحاجة انتباه</th>
              <th className="font-bold">مهام متأخرة</th><th className="font-bold">أُنجز آخر ٧ أيام</th><th className="font-bold">نشط</th><th />
            </tr>
          </thead>
          <tbody>
            {data.team.map((m) => {
              const mine = data.clients.filter((c) => c.consultant === m.name && !isDone(c));
              const att = mine.filter((c) => needsAttention(c, data.tasks, today)).length;
              const late = data.tasks.filter((t) => !t.done_at && t.due_date && t.due_date < today && (t.assignee === m.name)).length;
              const doneWeek = data.tasks.filter((t) => t.done_by === m.name && t.done_at && Date.parse(t.done_at) > weekAgo).length;
              return (
                <tr key={m.id} className="border-t border-[var(--line)]">
                  <td className="py-2.5">
                    <div className="flex items-center gap-2">
                      <Avatar name={m.name} size={30} />
                      <div><div className="font-black text-[var(--ink)]">{m.name}{m.name === me && <span className="ms-1 text-[10px] text-[var(--faint)]">(أنتِ)</span>}</div><div className="text-[11px] text-[var(--faint)]">{m.role}</div></div>
                    </div>
                  </td>
                  <td className="font-black text-[var(--ink)]">{fmt(mine.length)}</td>
                  <td style={{ color: att ? "#D9A21B" : "var(--faint)" }} className="font-black">{fmt(att)}</td>
                  <td style={{ color: late ? "#DC2626" : "var(--faint)" }} className="font-black">{fmt(late)}</td>
                  <td className="font-black text-[#16A34A]">{fmt(doneWeek)}</td>
                  <td>
                    <button onClick={() => ops.patchMember(m, { active: !m.active })} className="rounded-full px-2.5 py-1 text-[11px] font-black"
                      style={m.active ? { color: "#16A34A", background: "color-mix(in srgb, #16A34A 12%, transparent)" } : { color: "var(--faint)", background: "var(--surface-2)" }}>
                      {m.active ? "نشط" : "موقوف"}
                    </button>
                  </td>
                  <td className="text-left">
                    {m.name !== me && (
                      <button onClick={() => { if (confirm(`حذف ${m.name} من الفريق؟ (صالوناتها تبقى باسمها)`)) ops.deleteMember(m); }} className="grid h-7 w-7 place-items-center rounded-full text-red-500 hover:bg-red-500/10" aria-label="حذف"><Trash2 size={13} /></button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────────── مكوّنات ──────────────────────────── */

function Stat({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone?: string }) {
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-xl" style={{ color: tone ?? "var(--acc)", background: `color-mix(in srgb, ${tone ?? "var(--acc)"} 12%, transparent)` }}><Icon size={16} /></span>
        <span className="text-xs font-bold text-[var(--muted)]">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-black" style={{ color: tone ?? "var(--ink)" }}>{value}</div>
    </div>
  );
}
