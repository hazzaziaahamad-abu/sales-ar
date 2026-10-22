"use client";

// تبويب «خطة الاستهداف»: أهداف الأسبوع، خط الصالونات المستهدفة حسب الحالة، تسجيل التواصل، والتحويل لعميل.

import React, { useState } from "react";
import {
  Crosshair, Phone, Plus, Search, ArrowLeftCircle, Pencil, Check, Loader2, CalendarDays, Clock, Target, Users,
} from "lucide-react";
import {
  LEAD_STATUSES, PRIORITIES, SEGMENTS, SOURCES, addDays, leadStatusMeta,
  type LeadStatus, type Priority, type RoomClient, type Targets, type TeamMember,
} from "@/lib/salon-room";
import type { RoomData, RoomOps } from "./SalonRoom";
import { isLead, ratio, weekProgress } from "./metrics";
import { Avatar, Badge, EmptyState, Field, GOLD, Modal, SectionTitle, accGrad, btnGhost, btnPrimary, card, dateLabel, fmt, input, timeAgo, todayKey } from "./ui";

export default function Targeting({ data, me, ops, onOpen }: { data: RoomData; me: string; ops: RoomOps; onOpen: (id: string) => void }) {
  const today = todayKey();
  const [now] = useState(() => Date.now());
  const [who, setWho] = useState<"all" | "me">("all");
  const [prio, setPrio] = useState<Priority | "all">("all");
  const [q, setQ] = useState("");
  const [addModal, setAddModal] = useState(false);
  const [contactFor, setContactFor] = useState<RoomClient | null>(null);
  const [editTargets, setEditTargets] = useState(false);

  const leads = data.clients.filter((c) => isLead(c)
    && (who === "all" || c.consultant === me)
    && (prio === "all" || c.priority === prio)
    && (!q.trim() || [c.salon_name, c.owner_name, c.city, c.source].some((x) => x?.includes(q.trim()))));
  const attempts = (id: string) => data.logs.filter((l) => l.client_id === id && l.kind === "contact").length;
  const w = weekProgress(data.clients, data.logs, now);
  const t = data.targets;
  const dueFollowups = data.clients.filter((c) => isLead(c) && c.lead_status !== "not_interested" && c.next_followup && c.next_followup <= today).length;

  const convert = (c: RoomClient) => {
    if (!confirm(`تحويل «${c.salon_name}» لعميل؟ ينتقل لمرحلة «الاستكشاف» في لوحة الغرفة.`)) return;
    ops.patchClient(c.id, { stage: "discovery", lead_status: "meeting" });
  };

  return (
    <div className="space-y-5">
      {/* ─── أهداف الأسبوع ─── */}
      <div className={`${card} p-5`}>
        <SectionTitle icon={Target} title={`أهداف الأسبوع — من ${dateLabel(todayKey(w.from))}`}
          action={<button onClick={() => setEditTargets((s) => !s)} className={`${btnGhost} !px-3 !py-1.5 !text-xs`}><Pencil size={12} /> {editTargets ? "إغلاق" : "تعديل الأهداف"}</button>} />
        {editTargets ? (
          <TargetsForm targets={t} onSave={(x) => { ops.setTargets(x); setEditTargets(false); }} />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Meter label="محاولات تواصل" value={w.contacts} target={t.contacts} icon={Phone} />
            <Meter label="اجتماعات محجوزة (تحويل لعميل)" value={w.meetings} target={t.meetings} icon={CalendarDays} />
            <Meter label="تعاقدات" value={w.contracts} target={t.contracts} icon={Check} />
          </div>
        )}
        {w.byMember.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-3 text-xs">
            <Users size={13} className="text-[var(--faint)]" /> <span className="font-bold text-[var(--muted)]">تواصل الفريق هذا الأسبوع:</span>
            {[...w.byMember.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => (
              <span key={name} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--line)] py-0.5 pe-2.5 ps-0.5 font-bold text-[var(--body)]">
                <Avatar name={name} size={20} /> {name}: <b className="text-[var(--ink)]">{fmt(n)}</b>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ─── الأدوات ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-[var(--line)] p-0.5 text-xs font-bold">
          {([["all", "كل الفريق"], ["me", "مستهدفاتي"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setWho(k)} className="rounded-full px-3 py-1" style={who === k ? { ...accGrad, color: "var(--on-acc)" } : { color: "var(--muted)" }}>{l}</button>
          ))}
        </div>
        <div className="flex rounded-full border border-[var(--line)] p-0.5 text-xs font-bold">
          {(["all", "A", "B", "C"] as const).map((k) => (
            <button key={k} onClick={() => setPrio(k)} className="whitespace-nowrap rounded-full px-2.5 py-1 sm:px-3" style={prio === k ? { ...accGrad, color: "var(--on-acc)" } : { color: "var(--muted)" }} title={k === "all" ? "" : PRIORITIES[k].hint}>
              {k === "all" ? "كل الأولويات" : `أولوية ${PRIORITIES[k].label}`}
            </button>
          ))}
        </div>
        {dueFollowups > 0 && <Badge color="#DC2626"><Clock size={10} /> {fmt(dueFollowups)} متابعة مستحقة</Badge>}
        <div className="relative ms-auto w-full sm:w-56">
          <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-[var(--faint)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="بحث بالصالون أو المصدر" className={`${input} ps-8`} />
        </div>
        <button onClick={() => setAddModal(true)} className={btnPrimary} style={accGrad}><Plus size={15} /> صالون مستهدف</button>
      </div>

      {/* ─── خط الاستهداف ─── */}
      {data.clients.filter(isLead).length === 0 ? (
        <EmptyState icon={Crosshair} text="ما فيه صالونات مستهدفة — أضيفي قائمة الصالونات اللي تبون تستهدفونها هذا الأسبوع." />
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6">
          <div className="flex gap-3" style={{ minWidth: LEAD_STATUSES.length * 258 }}>
            {LEAD_STATUSES.map((st) => {
              const list = leads.filter((c) => c.lead_status === st.id)
                .sort((a, b) => a.priority.localeCompare(b.priority) || (a.next_followup ?? "9").localeCompare(b.next_followup ?? "9"));
              return (
                <div key={st.id} className="w-[250px] shrink-0 rounded-3xl bg-[var(--surface-2)]/70 p-2.5">
                  <div className="mb-2 flex items-center justify-between px-1.5">
                    <span className="flex items-center gap-1.5 text-sm font-black text-[var(--ink)]"><span className="h-2 w-2 rounded-full" style={{ background: st.color }} /> {st.label}</span>
                    <span className="rounded-full bg-[var(--surface)] px-2 text-xs font-bold text-[var(--muted)]">{fmt(list.length)}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((c) => {
                      const late = c.next_followup && c.next_followup <= today && c.lead_status !== "not_interested";
                      return (
                        <div key={c.id} role="button" tabIndex={0} onClick={() => onOpen(c.id)} onKeyDown={(e) => e.key === "Enter" && onOpen(c.id)}
                          className={`${card} cursor-pointer !rounded-2xl p-3 transition-all hover:-translate-y-0.5 hover:border-[var(--line-strong)]`}>
                          <div className="flex items-start gap-2">
                            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg text-[11px] font-black" title={PRIORITIES[c.priority].hint}
                              style={c.priority === "A" ? { background: GOLD, color: "#2A1018" } : { background: "var(--surface-2)", color: "var(--muted)" }}>
                              {PRIORITIES[c.priority].label}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-black text-[var(--ink)]">{c.salon_name}</div>
                              <div className="truncate text-[11px] text-[var(--faint)]">{[c.city, c.source, c.segment].filter(Boolean).join(" · ") || "—"}</div>
                            </div>
                            <Avatar name={c.consultant} size={22} />
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-1 text-[10px]">
                            <Badge color="#7A6570"><Phone size={9} /> {fmt(attempts(c.id))}</Badge>
                            {c.last_contact_at && <span className="text-[var(--faint)]">آخر تواصل {timeAgo(c.last_contact_at)}</span>}
                            {c.next_followup && <Badge color={late ? "#DC2626" : "#7A6570"}><CalendarDays size={9} /> {dateLabel(c.next_followup)}</Badge>}
                          </div>
                          <div className="mt-2 flex gap-1.5">
                            <button onClick={(e) => { e.stopPropagation(); setContactFor(c); }} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-[var(--line)] py-1.5 text-[11px] font-extrabold text-[var(--body)] hover:bg-[var(--hover)]">
                              <Phone size={12} /> سجّل تواصل
                            </button>
                            {(c.lead_status === "interested" || c.lead_status === "meeting") && (
                              <button onClick={(e) => { e.stopPropagation(); convert(c); }} className="flex items-center justify-center gap-1 rounded-xl px-2.5 py-1.5 text-[11px] font-extrabold text-[var(--on-acc)]" style={accGrad} title="تحويل لعميل">
                                <ArrowLeftCircle size={12} /> عميل
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {list.length === 0 && <div className="rounded-2xl border border-dashed border-[var(--line)] p-4 text-center text-[11px] text-[var(--faint)]">—</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {addModal && <AddLeadModal team={data.team} me={me} onClose={() => setAddModal(false)} onSave={async (f) => { if (await ops.addClient(f)) setAddModal(false); }} />}
      {contactFor && <ContactModal client={contactFor} ops={ops} onClose={() => setContactFor(null)} />}
    </div>
  );
}

function Meter({ label, value, target, icon: Icon }: { label: string; value: number; target: number; icon: typeof Phone }) {
  const p = ratio(value, target);
  const hit = target > 0 && value >= target;
  return (
    <div className="rounded-2xl border border-[var(--line)] p-3" title={`${fmt(value)} من ${fmt(target)}`}>
      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--muted)]"><Icon size={13} /> {label}</div>
      <div className="mt-1 text-2xl font-black text-[var(--ink)]">{fmt(value)} <span className="text-sm font-bold text-[var(--faint)]">/ {fmt(target)}</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full transition-all" style={{ width: `${p * 100}%`, background: hit ? "#16A34A" : "var(--acc)" }} />
      </div>
      <div className="mt-1 text-[11px] font-bold" style={{ color: hit ? "#16A34A" : "var(--faint)" }}>{hit ? "تحقّق الهدف ✓" : `باقي ${fmt(Math.max(0, target - value))}`}</div>
    </div>
  );
}

function TargetsForm({ targets, onSave }: { targets: Targets; onSave: (t: Targets) => void }) {
  const [t, setT] = useState(targets);
  return (
    <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <Field label="محاولات تواصل / أسبوع"><input type="number" min={0} value={t.contacts} onChange={(e) => setT({ ...t, contacts: Number(e.target.value) })} className={input} /></Field>
      <Field label="اجتماعات محجوزة / أسبوع"><input type="number" min={0} value={t.meetings} onChange={(e) => setT({ ...t, meetings: Number(e.target.value) })} className={input} /></Field>
      <Field label="تعاقدات / أسبوع"><input type="number" min={0} value={t.contracts} onChange={(e) => setT({ ...t, contracts: Number(e.target.value) })} className={input} /></Field>
      <button onClick={() => onSave(t)} className={btnPrimary} style={accGrad}><Check size={15} /> حفظ</button>
    </div>
  );
}

function AddLeadModal({ team, me, onClose, onSave }: {
  team: TeamMember[]; me: string; onClose: () => void; onSave: (f: Parameters<RoomOps["addClient"]>[0]) => Promise<void>;
}) {
  const [f, setF] = useState({
    salon_name: "", owner_name: "", phone: "", city: "", consultant: me, stage: "lead" as const,
    source: SOURCES[0], segment: SEGMENTS[1], priority: "B" as Priority, next_followup: addDays(todayKey(), 1),
  });
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="صالون مستهدف جديد" onClose={onClose}>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Field label="اسم الصالون"><input autoFocus value={f.salon_name} onChange={(e) => setF({ ...f, salon_name: e.target.value })} className={input} /></Field></div>
        <Field label="المالكة"><input value={f.owner_name} onChange={(e) => setF({ ...f, owner_name: e.target.value })} className={input} /></Field>
        <Field label="الجوال"><input dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} placeholder="05xxxxxxxx" className={`${input} text-left`} /></Field>
        <Field label="المدينة / الحي"><input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} className={input} /></Field>
        <Field label="المصدر">
          <select value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} className={input}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="حجم الصالون">
          <select value={f.segment} onChange={(e) => setF({ ...f, segment: e.target.value })} className={input}>{SEGMENTS.map((s) => <option key={s}>{s}</option>)}</select>
        </Field>
        <Field label="الأولوية" group>
          <div className="flex gap-1.5">
            {(["A", "B", "C"] as Priority[]).map((p) => (
              <button key={p} onClick={() => setF({ ...f, priority: p })} title={PRIORITIES[p].hint} className="flex-1 rounded-xl border py-2 text-sm font-black"
                style={f.priority === p ? { ...accGrad, color: "var(--on-acc)", borderColor: "transparent" } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                {PRIORITIES[p].label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="المستشارة المسؤولة">
          <select value={f.consultant} onChange={(e) => setF({ ...f, consultant: e.target.value })} className={input}>{team.filter((m) => m.active).map((m) => <option key={m.id}>{m.name}</option>)}</select>
        </Field>
        <Field label="أول متابعة"><input type="date" value={f.next_followup} onChange={(e) => setF({ ...f, next_followup: e.target.value })} className={input} /></Field>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>إلغاء</button>
        <button disabled={f.salon_name.trim().length < 2 || busy} onClick={async () => { setBusy(true); await onSave(f); setBusy(false); }} className={btnPrimary} style={accGrad}>
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} إضافة
        </button>
      </div>
    </Modal>
  );
}

function ContactModal({ client: c, ops, onClose }: { client: RoomClient; ops: RoomOps; onClose: () => void }) {
  const [status, setStatus] = useState<LeadStatus>(c.lead_status === "new" ? "contacted" : c.lead_status);
  const [note, setNote] = useState("");
  const [followup, setFollowup] = useState(addDays(todayKey(), 3));
  const [convert, setConvert] = useState(true);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    const body = `${leadStatusMeta(status).label}${note.trim() ? ` — ${note.trim()}` : ""}`;
    if (await ops.addLog(c.id, "contact", body)) {
      const toClient = status === "meeting" && convert;
      ops.patchClient(c.id, {
        lead_status: status,
        next_followup: status === "not_interested" || toClient ? null : followup || null,
        ...(toClient ? { stage: "discovery" as const } : {}),
      });
      onClose();
    }
    setBusy(false);
  };
  return (
    <Modal title={`تواصل مع ${c.salon_name}`} onClose={onClose}>
      <div className="space-y-3">
        <Field label="نتيجة التواصل" group>
          <div className="flex flex-wrap gap-1.5">
            {LEAD_STATUSES.filter((s) => s.id !== "new").map((s) => (
              <button key={s.id} onClick={() => setStatus(s.id)} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold"
                style={status === s.id ? { borderColor: s.color, color: s.color, background: `color-mix(in srgb, ${s.color} 10%, transparent)` } : { borderColor: "var(--line)", color: "var(--muted)" }}>
                <span className="h-2 w-2 rounded-full" style={{ background: s.color }} /> {s.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="ملاحظة"><textarea autoFocus rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="وش قالت المالكة؟ الاعتراض؟ الموعد؟" className={`${input} resize-y`} /></Field>
        {status === "meeting" ? (
          <label className="flex items-center gap-2 rounded-2xl bg-[var(--surface-2)] p-3 text-sm font-bold text-[var(--body)]">
            <input type="checkbox" checked={convert} onChange={(e) => setConvert(e.target.checked)} className="h-4 w-4 accent-[var(--acc)]" />
            حوّليه لعميل الآن (مرحلة «الاستكشاف» في لوحة الغرفة)
          </label>
        ) : status !== "not_interested" && (
          <Field label="المتابعة الجاية"><input type="date" value={followup} onChange={(e) => setFollowup(e.target.value)} className={input} /></Field>
        )}
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className={btnGhost}>إلغاء</button>
        <button onClick={save} disabled={busy} className={btnPrimary} style={accGrad}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />} تسجيل التواصل</button>
      </div>
    </Modal>
  );
}
