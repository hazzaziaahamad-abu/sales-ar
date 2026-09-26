"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { getEditableContent, saveEditableContent } from "@/lib/supabase/db";
import {
  HelpCircle,
  Search,
  Phone,
  MessageCircle,
  Copy,
  Check,
  Lightbulb,
  Pencil,
  Save,
  RotateCcw,
  X,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";

/* ---------- brand tokens (مطابقة لمسار الاتصال) ---------- */
const INK = "#40332b";
const PURPLE = "#6D28D9";
const PURPLE_DEEP = "#5B21B6";

/* ---------- الأنواع ---------- */
export type FAQCat = "cashier" | "menu" | "loyalty";
export type FAQItem = {
  id: string;
  cat: FAQCat;
  q: string;
  /** الرد الشفهي في المكالمة */
  call: string;
  /** نسخة جاهزة للواتساب */
  wa: string;
  /** ملاحظة داخلية للموظف فقط (لا تُقال للعميل) */
  note?: string;
};

const CATS: { k: FAQCat | "all"; t: string; emoji: string }[] = [
  { k: "all", t: "الكل", emoji: "🔎" },
  { k: "cashier", t: "الكاشير", emoji: "💳" },
  { k: "menu", t: "المنيو", emoji: "📱" },
  { k: "loyalty", t: "بطاقات الولاء", emoji: "🎁" },
];

const CAT_LABEL: Record<FAQCat, string> = { cashier: "الكاشير", menu: "المنيو", loyalty: "بطاقات الولاء" };

type Stored = { items?: FAQItem[] };

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const uid = () => Math.random().toString(36).slice(2, 10);

// توحيد الحروف العربية للبحث (أ/إ/آ ← ا، ة ← ه، ى ← ي) وإزالة التشكيل.
function norm(s: string) {
  return s
    .replace(/[ً-ْ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase();
}

/* ---------- حقل تحرير صغير ---------- */
function Field({ label, value, onChange, rows = 2 }: { label: string; value: string; onChange: (v: string) => void; rows?: number }) {
  return (
    <label className="block text-right">
      <span className="mb-1 block text-[11px] font-black" style={{ color: PURPLE_DEEP }}>
        {label}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        dir="rtl"
        className="w-full rounded-lg px-2.5 py-1.5 text-right text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
        style={{ backgroundColor: "#fff", border: "1px solid #e2d3c3", color: INK, resize: "vertical" }}
      />
    </label>
  );
}

/* ---------- المكوّن الرئيسي: بنك ردود سريعة على أسئلة العملاء ---------- */
export default function CustomerFAQPanel({ id, storageKey, defaultItems }: { id?: string; storageKey: string; defaultItems: FAQItem[] }) {
  const { user, isImpersonating } = useAuth();
  // الإضافة والتعديل للمدير فقط (المشرف العام أو دور «مدير»/admin) — الموظف يعرض وينسخ فقط.
  const isManager = !!user && (user.isSuperAdmin || user.roleName === "مدير" || user.roleName === "admin");
  const canEdit = isManager && !isImpersonating;

  const [items, setItems] = useState<FAQItem[]>(defaultItems);
  const [cat, setCat] = useState<FAQCat | "all">("all");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [channel, setChannel] = useState<"call" | "wa">("call");
  const [copied, setCopied] = useState<string | null>(null);
  const isWa = channel === "wa";

  // وضع التحرير (نسخة مسودّة)
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<FAQItem[]>(defaultItems);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getEditableContent<Stored>(storageKey)
      .then((data) => {
        if (alive && data && Array.isArray(data.items) && data.items.length) setItems(data.items);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [storageKey]);

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1600);
    } catch {
      /* المتصفح ما يدعم النسخ — تجاهل بهدوء */
    }
  }, []);

  const visible = useMemo(() => {
    const q = norm(query.trim());
    return items.filter((it) => {
      if (cat !== "all" && it.cat !== cat) return false;
      if (!q) return true;
      return norm(`${it.q} ${it.call} ${it.wa} ${it.note || ""}`).includes(q);
    });
  }, [items, cat, query]);

  const blankItem = (): FAQItem => ({ id: uid(), cat: cat === "all" ? "cashier" : cat, q: "", call: "", wa: "" });

  const startEdit = (withNew = false) => {
    setDraft(withNew ? [blankItem(), ...clone(items)] : clone(items));
    setSavedMsg(null);
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    setSavedMsg(null);
    try {
      const clean = draft.filter((d) => d.q.trim());
      await saveEditableContent(storageKey, { items: clean } satisfies Stored);
      setItems(clean);
      setEditing(false);
      setSavedMsg("تم الحفظ ✓");
      setTimeout(() => setSavedMsg(null), 2500);
    } catch {
      setSavedMsg("تعذّر الحفظ — تأكّد من صلاحيتك واتصالك.");
    } finally {
      setSaving(false);
    }
  };

  const upd = (id: string, patch: Partial<FAQItem>) => setDraft((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));

  return (
    <div
      id={id}
      className="mx-auto mt-8 max-w-3xl scroll-mt-4 rounded-3xl p-5"
      style={{ backgroundColor: "#fffdf7", border: "1.5px solid #ead9c9", boxShadow: "0 12px 26px -16px rgba(64,51,43,.5)" }}
    >
      {/* الرأس */}
      <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl text-white" style={{ backgroundColor: PURPLE }}>
            <HelpCircle size={17} strokeWidth={2.3} />
          </span>
          <h3 className="text-base font-black" style={{ color: PURPLE_DEEP }}>
            العميل سأل؟ — ردود جاهزة
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && !editing && (
            <button
              onClick={() => startEdit(true)}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-emerald-200"
              style={{ backgroundColor: "#059669" }}
            >
              <Plus size={13} strokeWidth={2.6} /> إضافة سؤال
            </button>
          )}
          {canEdit && !editing && (
            <button
              onClick={() => startEdit()}
              className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-violet-300"
              style={{ backgroundColor: PURPLE_DEEP }}
            >
              <Pencil size={13} strokeWidth={2.4} /> تعديل الأسئلة
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold text-white outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-emerald-200 disabled:opacity-60"
                style={{ backgroundColor: "#059669" }}
              >
                <Save size={13} strokeWidth={2.4} /> {saving ? "جارٍ الحفظ…" : "حفظ"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold outline-none transition hover:opacity-80"
                style={{ backgroundColor: "rgba(64,51,43,.08)", color: INK }}
              >
                <X size={13} strokeWidth={2.4} /> إلغاء
              </button>
              <button
                onClick={() => setDraft(clone(defaultItems))}
                className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold outline-none transition hover:opacity-80"
                style={{ backgroundColor: "rgba(64,51,43,.08)", color: INK }}
                title="استعادة الأسئلة الافتراضية في المسودّة"
              >
                <RotateCcw size={13} strokeWidth={2.4} /> الافتراضي
              </button>
            </>
          )}

          {!editing && (
            <div className="flex rounded-full p-1" style={{ backgroundColor: "#efe6dd" }}>
              {[
                { k: "call", t: "مكالمة", icon: <Phone size={13} strokeWidth={2.4} /> },
                { k: "wa", t: "واتساب", icon: <MessageCircle size={13} strokeWidth={2.4} /> },
              ].map((o) => {
                const on = channel === o.k;
                return (
                  <button
                    key={o.k}
                    onClick={() => setChannel(o.k as "call" | "wa")}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold outline-none transition focus-visible:ring-4 focus-visible:ring-violet-300"
                    style={{ backgroundColor: on ? PURPLE : "transparent", color: on ? "#fff" : "#7a6b5e" }}
                    aria-pressed={on}
                  >
                    {o.icon}
                    {o.t}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {savedMsg && (
        <div
          className="mb-3 rounded-lg px-3 py-1.5 text-right text-xs font-bold"
          style={{ backgroundColor: savedMsg.includes("تعذّر") ? "#FEE2E2" : "#DCFCE7", color: savedMsg.includes("تعذّر") ? "#991B1B" : "#065F46" }}
        >
          {savedMsg}
        </div>
      )}

      {editing ? (
        /* ============ وضع التحرير (للأدمن) ============ */
        <div className="space-y-3">
          <p className="text-right text-xs font-semibold leading-relaxed" style={{ color: "#8a7c70" }}>
            عدّل الأسئلة والردود ثم اضغط «حفظ» — تُحفظ في قاعدة البيانات ويشوفها جميع الموظفين. السؤال الفارغ يُحذف عند الحفظ.
          </p>
          {draft.map((d) => (
            <div key={d.id} className="rounded-2xl p-3" style={{ backgroundColor: "#faf4ee", border: "1px solid #efe2d5" }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <button
                  onClick={() => setDraft((prev) => prev.filter((x) => x.id !== d.id))}
                  className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold outline-none transition hover:opacity-80"
                  style={{ backgroundColor: "#FEE2E2", color: "#991B1B" }}
                >
                  <Trash2 size={12} strokeWidth={2.4} /> حذف
                </button>
                <select
                  value={d.cat}
                  onChange={(e) => upd(d.id, { cat: e.target.value as FAQCat })}
                  dir="rtl"
                  className="rounded-lg px-2 py-1 text-xs font-bold outline-none"
                  style={{ backgroundColor: "#fff", border: "1px solid #e2d3c3", color: INK }}
                >
                  {(Object.keys(CAT_LABEL) as FAQCat[]).map((k) => (
                    <option key={k} value={k}>
                      {CAT_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <Field label="السؤال" value={d.q} onChange={(v) => upd(d.id, { q: v })} rows={1} />
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <Field label="الرد في المكالمة" value={d.call} onChange={(v) => upd(d.id, { call: v })} rows={3} />
                <Field label="رسالة الواتساب" value={d.wa} onChange={(v) => upd(d.id, { wa: v })} rows={3} />
              </div>
              <div className="mt-2">
                <Field label="ملاحظة داخلية للموظف (اختياري)" value={d.note || ""} onChange={(v) => upd(d.id, { note: v })} rows={1} />
              </div>
            </div>
          ))}
          <button
            onClick={() => setDraft((prev) => [...prev, blankItem()])}
            className="flex w-full items-center justify-center gap-1 rounded-2xl py-2 text-xs font-black outline-none transition hover:opacity-80"
            style={{ backgroundColor: "#F4ECFB", border: "1px dashed #C4B5FD", color: PURPLE_DEEP }}
          >
            <Plus size={14} strokeWidth={2.6} /> إضافة سؤال
          </button>
        </div>
      ) : (
        /* ============ وضع العرض (للموظف) ============ */
        <>
          <p className="mb-3 text-right text-xs font-semibold leading-relaxed" style={{ color: "#8a7c70" }}>
            أكثر أسئلة العملاء تكراراً مع رد جاهز. اكتب كلمة من سؤال العميل (مثل: أجهزة، ضريبة، مخزون، إشعار) أو اختر المنتج، واضغط السؤال لتشوف الرد.
          </p>

          {/* البحث + التصنيفات */}
          <div className="mb-3 rounded-2xl p-3" style={{ backgroundColor: "#faf4ee", border: "1px solid #efe2d5" }}>
            <div className="relative mb-2">
              <Search size={15} strokeWidth={2.4} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "#a89c90" }} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث في الأسئلة…"
                dir="rtl"
                className="w-full rounded-xl py-2 pl-3 pr-9 text-right text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                style={{ backgroundColor: "#fff", border: "1px solid #e2d3c3", color: INK }}
                aria-label="ابحث في أسئلة العملاء"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-1.5">
              {CATS.map((c) => {
                const on = cat === c.k;
                const count = c.k === "all" ? items.length : items.filter((i) => i.cat === c.k).length;
                return (
                  <button
                    key={c.k}
                    onClick={() => setCat(c.k)}
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold outline-none transition hover:opacity-90 focus-visible:ring-4 focus-visible:ring-violet-300"
                    style={{ backgroundColor: on ? PURPLE : "#fff", color: on ? "#fff" : INK, border: `1px solid ${on ? PURPLE : "#e2d3c3"}` }}
                    aria-pressed={on}
                  >
                    {c.emoji} {c.t} <span style={{ opacity: 0.7 }}>({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* الأسئلة */}
          <div className="space-y-2">
            {visible.length === 0 && (
              <p className="rounded-xl px-3 py-4 text-center text-xs font-bold" style={{ backgroundColor: "#faf4ee", color: "#8a7c70" }}>
                {canEdit ? "ما لقينا سؤال مطابق — اضغط «إضافة سؤال» بالأعلى لإضافة رده." : "ما لقينا سؤال مطابق — ارفعه لمديرك ليُضاف رده هنا."}
              </p>
            )}
            {visible.map((it) => {
              const open = openId === it.id;
              const text = isWa ? it.wa : it.call;
              const isCopied = copied === it.id;
              return (
                <div key={it.id} className="rounded-2xl" style={{ backgroundColor: "#faf4ee", border: `1px solid ${open ? "#C4B5FD" : "#efe2d5"}` }}>
                  <button
                    onClick={() => setOpenId(open ? null : it.id)}
                    className="flex w-full items-center justify-between gap-2 rounded-2xl px-3 py-2.5 text-right outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                    aria-expanded={open}
                  >
                    <ChevronDown size={15} strokeWidth={2.4} className="shrink-0 transition-transform" style={{ color: PURPLE, transform: open ? "rotate(180deg)" : undefined }} />
                    <span className="flex flex-1 items-center justify-end gap-2">
                      <span className="text-sm font-black" style={{ color: INK }}>
                        {it.q}
                      </span>
                      {cat === "all" && (
                        <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black" style={{ backgroundColor: "#EDE9FE", color: PURPLE_DEEP }}>
                          {CAT_LABEL[it.cat]}
                        </span>
                      )}
                    </span>
                  </button>

                  {open && (
                    <div className="px-3 pb-3">
                      <div className="rounded-xl p-3 text-right" style={{ backgroundColor: isWa ? "#EAF7EE" : "#fffdf7", border: `1px solid ${isWa ? "#A7D7B9" : "#ead9c9"}` }}>
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <button
                            onClick={() => copy(it.id, text)}
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold outline-none transition hover:opacity-80 focus-visible:ring-4 focus-visible:ring-violet-300"
                            style={{ backgroundColor: isCopied ? "#DCFCE7" : "rgba(64,51,43,.06)", color: isCopied ? "#065F46" : INK }}
                          >
                            {isCopied ? <Check size={12} strokeWidth={2.6} /> : <Copy size={12} strokeWidth={2.4} />}
                            {isCopied ? "تم النسخ" : "نسخ"}
                          </button>
                          <span className="flex items-center gap-1 text-[11px] font-black" style={{ color: isWa ? "#065F46" : PURPLE_DEEP }}>
                            {isWa ? "أرسل في الواتساب" : "قل في المكالمة"}
                            {isWa ? <MessageCircle size={12} strokeWidth={2.4} /> : <Phone size={12} strokeWidth={2.4} />}
                          </span>
                        </div>
                        <p className="whitespace-pre-line text-sm font-semibold leading-relaxed" style={{ color: INK }}>
                          {text}
                        </p>
                      </div>
                      {it.note && (
                        <div className="mt-2 flex items-start justify-end gap-2 px-1">
                          <p className="flex-1 text-right text-xs leading-relaxed" style={{ color: "#6f6156" }}>
                            <span className="font-black" style={{ color: "#B8860B" }}>للموظف: </span>
                            {it.note}
                          </p>
                          <Lightbulb size={13} strokeWidth={2.2} className="mt-0.5 shrink-0" style={{ color: "#B8860B" }} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
