"use client";

import { useEffect, useRef, useState } from "react";
import type { ShowcasePackage } from "@/lib/showcase";
import s from "./showcase.module.css";

// نافذة تعديل الباقات (للمدير): فوق العرض وبتمرير عمودي خاص، بعيداً عن المسار الأفقي
// (الجوال يحرّك المسار جانبياً لما يركّز على حقل داخله).

interface DraftFeature { id: number; text: string }
interface DraftPackage extends Omit<ShowcasePackage, "features"> { id: number; features: DraftFeature[] }

let seq = 0;
const nextId = () => ++seq;

const toDraft = (list: ShowcasePackage[]): DraftPackage[] =>
  list.map((p) => ({ ...p, id: nextId(), features: p.features.map((text) => ({ id: nextId(), text })) }));

function move<T>(arr: T[], i: number, d: number): T[] {
  const j = i + d;
  if (j < 0 || j >= arr.length) return arr;
  const out = [...arr];
  [out[i], out[j]] = [out[j], out[i]];
  return out;
}

const Up = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 15l6-6 6 6" /></svg>
);
const Down = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
);

export function PackagesEditor({ initial, orgId, onClose, onSaved }: {
  initial: ShowcasePackage[];
  orgId: string;
  onClose: () => void;
  onSaved: (packages: ShowcasePackage[]) => void;
}) {
  const [draft, setDraft] = useState<DraftPackage[]>(() => toDraft(initial));
  const [newFeature, setNewFeature] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const focusAfter = useRef<string | null>(null);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    bodyRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // تركيز عنصر بعد إعادة الرسم (باقة جديدة / ميزة جديدة)
  useEffect(() => {
    if (!focusAfter.current) return;
    document.getElementById(focusAfter.current)?.focus();
    focusAfter.current = null;
  });

  const patch = (id: number, fn: (p: DraftPackage) => DraftPackage) =>
    setDraft((d) => d.map((p) => (p.id === id ? fn(p) : p)));

  const addFeature = (p: DraftPackage) => {
    const text = (newFeature[p.id] ?? "").trim();
    if (!text) return;
    patch(p.id, (x) => ({ ...x, features: [...x.features, { id: nextId(), text }] }));
    setNewFeature((m) => ({ ...m, [p.id]: "" }));
  };

  const addPackage = () => {
    const id = nextId();
    setDraft((d) => [...d, { id, name: "باقة جديدة", price: "0", period: "ريال / سنة", featured: false, features: [] }]);
    focusAfter.current = `pk-name-${id}`;
  };

  const save = async () => {
    const packages: ShowcasePackage[] = draft.map(({ name, price, period, featured, features }) => ({
      name: name.trim(),
      price: price.trim(),
      period: period.trim(),
      featured,
      features: features.map((f) => f.text.trim()).filter(Boolean),
    }));
    if (packages.some((p) => !p.name)) { setMsg("كل باقة تحتاج اسم."); return; }
    setSaving(true);
    setMsg("جاري الحفظ…");
    try {
      const res = await fetch("/api/showcase-packages", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ org_id: orgId, packages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "");
      onSaved(data.packages ?? packages);
    } catch (e) {
      const reason = e instanceof Error && e.message ? ` (${e.message})` : "";
      setMsg(`ما تم الحفظ: ما عندك صلاحية تعديل أو الاتصال انقطع. جرب مرة ثانية.${reason}`);
      setSaving(false);
    }
  };

  return (
    <div className={s.pkPanel} role="dialog" aria-modal="true" aria-labelledby="pk-title" dir="rtl">
      <div className={s.pkSheet}>
        <div className={s.pkTop}>
          <h2 id="pk-title">تعديل الباقات</h2>
          <button type="button" className={`${s.pkBtn} ${s.ghost}`} onClick={onClose}>إلغاء</button>
          <button type="button" className={s.pkBtn} onClick={save} disabled={saving}>حفظ</button>
          {msg && <span className={s.pkMsg} role="status">{msg}</span>}
        </div>

        <div className={s.pkBody} ref={bodyRef}>
          {draft.map((p, pi) => (
            <section key={p.id} className={s.pkEd}>
              <div className={s.pkRow}>
                <input id={`pk-name-${p.id}`} className={`${s.pkIn} ${s.nameIn}`} value={p.name} aria-label="اسم الباقة"
                  onChange={(e) => patch(p.id, (x) => ({ ...x, name: e.target.value }))} />
                <button type="button" className={s.pkIb} aria-label="نقل الباقة قبل" title="نقل الباقة قبل" disabled={pi === 0}
                  onClick={() => setDraft((d) => move(d, pi, -1))}><Up /></button>
                <button type="button" className={s.pkIb} aria-label="نقل الباقة بعد" title="نقل الباقة بعد" disabled={pi === draft.length - 1}
                  onClick={() => setDraft((d) => move(d, pi, 1))}><Down /></button>
                <button type="button" className={s.pkX} aria-label="حذف الباقة"
                  onClick={() => setDraft((d) => d.filter((x) => x.id !== p.id))}>حذف</button>
              </div>

              <div className={s.pkRow}>
                <input className={`${s.pkIn} ${s.priceIn}`} value={p.price} aria-label="السعر" inputMode="numeric"
                  onChange={(e) => patch(p.id, (x) => ({ ...x, price: e.target.value }))} />
                <input className={s.pkIn} value={p.period} aria-label="المدة"
                  onChange={(e) => patch(p.id, (x) => ({ ...x, period: e.target.value }))} />
              </div>

              <label className={s.pkFeatToggle}>
                <input type="checkbox" checked={p.featured}
                  onChange={(e) => patch(p.id, (x) => ({ ...x, featured: e.target.checked }))} />
                تمييز الباقة
              </label>

              <ul className={s.pkElist}>
                {p.features.map((f, fi) => (
                  <li key={f.id}>
                    <button type="button" className={s.pkIb} aria-label="نقل الميزة لفوق" title="نقل لفوق" disabled={fi === 0}
                      onClick={() => patch(p.id, (x) => ({ ...x, features: move(x.features, fi, -1) }))}><Up /></button>
                    <button type="button" className={s.pkIb} aria-label="نقل الميزة لتحت" title="نقل لتحت" disabled={fi === p.features.length - 1}
                      onClick={() => patch(p.id, (x) => ({ ...x, features: move(x.features, fi, 1) }))}><Down /></button>
                    <input className={`${s.pkIn} ${s.smIn}`} value={f.text} aria-label="ميزة"
                      onChange={(e) => patch(p.id, (x) => ({
                        ...x, features: x.features.map((y) => (y.id === f.id ? { ...y, text: e.target.value } : y)),
                      }))} />
                    <button type="button" className={`${s.pkIb} ${s.danger}`} aria-label="حذف الميزة" title="حذف"
                      onClick={() => patch(p.id, (x) => ({ ...x, features: x.features.filter((y) => y.id !== f.id) }))}>×</button>
                  </li>
                ))}
              </ul>

              <div className={s.pkRow}>
                <input className={`${s.pkIn} ${s.smIn}`} placeholder="ميزة جديدة…" aria-label="ميزة جديدة"
                  value={newFeature[p.id] ?? ""}
                  onChange={(e) => setNewFeature((m) => ({ ...m, [p.id]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addFeature(p); } }} />
                <button type="button" className={`${s.pkBtn} ${s.smBtn}`} onClick={() => addFeature(p)}>إضافة</button>
              </div>
            </section>
          ))}

          <button type="button" className={`${s.pkBtn} ${s.ghost} ${s.wide}`} onClick={addPackage}>+ باقة جديدة</button>
        </div>
      </div>
    </div>
  );
}
