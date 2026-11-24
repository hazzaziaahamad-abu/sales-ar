"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CreditCard, Truck, Globe, Phone, MessageCircle, Pencil, Plus, Trash2, Copy, Check, Link2, Info, FileCheck2, X,
} from "lucide-react";
import { getEditableContent, saveEditableContent } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

/* ─── البيانات ───────────────────────────────────────────────────────────────
 * الشركات المرتبطة (بوابات الدفع / التوصيل) تنحفظ كمحتوى قابل للتحرير (KV) بمفتاح واحد.
 * لو ما فيه بيانات محفوظة للمنظمة نعرض القيم الافتراضية تحت — وأول حفظ يثبّتها.
 */

type Category = "payment" | "delivery";
type PriceRow = { label: string; value: string };
type PriceTier = { title: string; rows: PriceRow[] };
type Partner = {
  id: string;
  category: Category;
  name: string;
  website: string;
  phone: string;
  whatsapp: string;
  tiers: PriceTier[];
  requirements: string;
  notes: string;
};
type Stored = { partners: Partner[] };

const STORAGE_KEY = "integration_partners";

const CATEGORIES: { key: Category; label: string; icon: typeof CreditCard }[] = [
  { key: "payment", label: "بوابات الدفع", icon: CreditCard },
  { key: "delivery", label: "شركات التوصيل", icon: Truck },
];

const MENU_NOTE = "يتطلب التواصل معهم من خلال رابط الموقع وأخذ تفاصيل السعر، مع إبلاغهم أن الربط بيكون مع «قائمة الطلبات» للمنيو الإلكتروني.";

const DEFAULT_PARTNERS: Partner[] = [
  {
    id: "neoleap", category: "payment", name: "نيوليب",
    website: "https://www.neoleap.com.sa/ar", phone: "+966548185292", whatsapp: "",
    tiers: [
      { title: "بنك الراجحي", rows: [
        { label: "رسوم التأسيس", value: "0" },
        { label: "الرسوم الشهرية", value: "0" },
        { label: "مدى", value: "0.75٪" },
        { label: "فيزا وماستركارد", value: "2.3٪" },
      ] },
      { title: "البنوك الأخرى", rows: [
        { label: "رسوم التأسيس", value: "1725 ريال" },
        { label: "الرسوم الشهرية", value: "100 ريال" },
        { label: "مدى", value: "1٪" },
        { label: "فيزا وماستركارد", value: "2.5٪" },
      ] },
    ],
    requirements: "", notes: "",
  },
  {
    id: "paymob", category: "payment", name: "بي موب (Paymob)",
    website: "https://paymob.sa/ar", phone: "", whatsapp: "966505410223",
    tiers: [
      { title: "", rows: [
        { label: "مدى", value: "1٪" },
        { label: "فيزا وماستركارد", value: "2.5٪ + 1 ريال" },
        { label: "رسوم الاشتراك في البنوك", value: "لا يوجد" },
        { label: "رسوم تأسيس الحساب", value: "لا يوجد" },
      ] },
    ],
    requirements: "السجل التجاري أو وثيقة العمل الحر",
    notes: "يتم تحويل المبالغ إلى الحساب يومين في الأسبوع بتكلفة 6 ريال عن كل يوم، أو بشكل يومي مقابل 120 ريال في الشهر.",
  },
  {
    id: "moyasar", category: "payment", name: "ميسر (Moyasar)",
    website: "https://dashboard.moyasar.com/register/new", phone: "", whatsapp: "",
    tiers: [], requirements: "", notes: MENU_NOTE,
  },
  {
    id: "tap", category: "payment", name: "تاب (Tap)",
    website: "https://www.tap.company/ar-sa/products/checkout", phone: "", whatsapp: "",
    tiers: [], requirements: "", notes: MENU_NOTE,
  },
  {
    id: "alshorouq", category: "delivery", name: "الشروق",
    website: "", phone: "", whatsapp: "",
    tiers: [{ title: "", rows: [{ label: "رسوم التوصيل", value: "تبدأ من 18 ريال" }] }],
    requirements: "", notes: "",
  },
];

const emptyPartner = (category: Category): Partner => ({
  id: `p_${Date.now().toString(36)}`, category, name: "", website: "", phone: "", whatsapp: "",
  tiers: [{ title: "", rows: [{ label: "", value: "" }] }], requirements: "", notes: "",
});

const digits = (s: string) => s.replace(/[^\d]/g, "");
const fmtPhone = (s: string) => {
  const d = digits(s);
  return d.startsWith("966") && d.length === 12 ? `+966 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : s;
};

/** نص جاهز للنسخ والإرسال للعميل (واتساب). */
function partnerText(p: Partner): string {
  const lines: string[] = [`• شركة ${p.name}`];
  if (p.website) lines.push(`الموقع الإلكتروني: ${p.website}`);
  if (p.tiers.some((t) => t.rows.length)) {
    lines.push("", "الأسعار:");
    for (const t of p.tiers) {
      if (t.title) lines.push(`${t.title}:`);
      for (const r of t.rows) lines.push(`${r.label}: ${r.value}`);
      lines.push("");
    }
  }
  if (p.notes) lines.push(p.notes);
  if (p.requirements) lines.push(`المتطلبات: ${p.requirements}`);
  if (p.phone) lines.push(`رقم التواصل: ${fmtPhone(p.phone)}`);
  if (p.whatsapp) lines.push(`واتساب: https://wa.me/${digits(p.whatsapp)}`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** يشيل الصفوف والمستويات الفاضية قبل الحفظ. */
function clean(p: Partner): Partner {
  return {
    ...p,
    name: p.name.trim(),
    tiers: p.tiers
      .map((t) => ({ title: t.title.trim(), rows: t.rows.filter((r) => r.label.trim() || r.value.trim()) }))
      .filter((t) => t.rows.length),
  };
}

/* ─── الصفحة ───────────────────────────────────────────────────────────────── */

export default function IntegrationsPage() {
  const { user, isImpersonating } = useAuth();
  const isManager = !!user && (user.isSuperAdmin || user.roleName === "مدير" || user.roleName === "admin");
  const canEdit = isManager && !isImpersonating;

  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Category>("payment");
  const [editing, setEditing] = useState<Partner | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getEditableContent<Stored>(STORAGE_KEY)
      .then((d) => setPartners(d?.partners?.length ? d.partners : DEFAULT_PARTNERS))
      .catch(() => setPartners(DEFAULT_PARTNERS))
      .finally(() => setLoading(false));
  }, [user?.orgId]);

  const shown = useMemo(() => partners.filter((p) => p.category === tab), [partners, tab]);

  async function persist(next: Partner[]) {
    setSaving(true);
    setError("");
    try {
      await saveEditableContent(STORAGE_KEY, { partners: next } satisfies Stored);
      setPartners(next);
      return true;
    } catch (e) {
      console.error(e);
      setError("تعذّر الحفظ — حاول مرة ثانية");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!editing) return;
    const p = clean(editing);
    if (!p.name) { setError("اكتب اسم الشركة"); return; }
    const exists = partners.some((x) => x.id === p.id);
    const next = exists ? partners.map((x) => (x.id === p.id ? p : x)) : [...partners, p];
    if (await persist(next)) setEditing(null);
  }

  async function handleDelete(id: string) {
    const p = partners.find((x) => x.id === id);
    if (!p || !confirm(`حذف شركة «${p.name}»؟`)) return;
    await persist(partners.filter((x) => x.id !== id));
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <Link2 className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">الشركات المرتبطة</h1>
            <p className="text-xs text-muted-foreground">تفاصيل بوابات الدفع وشركات التوصيل المرتبطة مع المنيو الإلكتروني</p>
          </div>
        </div>
        {canEdit && (
          <Button onClick={() => { setError(""); setEditing(emptyPartner(tab)); }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            إضافة شركة
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {CATEGORIES.map((c) => {
          const Icon = c.icon;
          const count = partners.filter((p) => p.category === c.key).length;
          const active = tab === c.key;
          return (
            <button
              key={c.key}
              onClick={() => setTab(c.key)}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                active ? "border-violet-500/40 bg-violet-500/15 text-violet-300" : "border-border bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              {c.label}
              {!loading && <span className="rounded-full bg-muted px-2 text-[11px]">{count}</span>}
            </button>
          );
        })}
      </div>

      {error && !editing && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="cc-card rounded-[14px] p-5 space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="cc-card rounded-[14px] p-10 text-center text-sm text-muted-foreground">
          ما فيه شركات مضافة في هذا القسم{canEdit ? " — اضغط «إضافة شركة»." : "."}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {shown.map((p) => (
            <PartnerCard
              key={p.id}
              partner={p}
              canEdit={canEdit}
              onEdit={() => { setError(""); setEditing(structuredClone(p)); }}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}

      {editing && (
        <PartnerEditor
          value={editing}
          onChange={setEditing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
          saving={saving}
          error={error}
        />
      )}
    </div>
  );
}

/* ─── بطاقة الشركة ─────────────────────────────────────────────────────────── */

function PartnerCard({ partner: p, canEdit, onEdit, onDelete }: {
  partner: Partner; canEdit: boolean; onEdit: () => void; onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(partnerText(p));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* المتصفح رفض النسخ */ }
  };
  const Icon = p.category === "payment" ? CreditCard : Truck;

  return (
    <div className="cc-card rounded-[14px] p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Icon className="w-5 h-5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground">شركة {p.name}</h3>
            {p.website && (
              <a href={p.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-cyan-400 hover:underline truncate" dir="ltr">
                <Globe className="w-3 h-3 shrink-0" />
                <span className="truncate">{p.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
              </a>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={copy} title="نسخ التفاصيل للإرسال"
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          {canEdit && (
            <>
              <button onClick={onEdit} title="تعديل" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={onDelete} title="حذف" className="rounded-lg p-2 text-muted-foreground hover:bg-red-500/10 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>

      {p.tiers.length > 0 && (
        <div className={`grid gap-3 ${p.tiers.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {p.tiers.map((t, i) => (
            <div key={i} className="rounded-xl border border-border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-bold text-violet-300">{t.title || "الأسعار"}</p>
              <dl className="space-y-1.5">
                {t.rows.map((r, j) => (
                  <div key={j} className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-muted-foreground">{r.label}</dt>
                    <dd className="font-semibold text-foreground text-left">{r.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      {p.notes && (
        <div className="flex gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-200/90 leading-relaxed">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-amber-400" />
          <p className="whitespace-pre-line">{p.notes}</p>
        </div>
      )}

      {p.requirements && (
        <div className="flex gap-2 text-sm">
          <FileCheck2 className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
          <p><span className="text-muted-foreground">المتطلبات: </span><span className="text-foreground">{p.requirements}</span></p>
        </div>
      )}

      {(p.phone || p.whatsapp) && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          {p.phone && (
            <a href={`tel:+${digits(p.phone)}`}
              className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted/70">
              <Phone className="w-3.5 h-3.5" />
              <span dir="ltr">{fmtPhone(p.phone)}</span>
            </a>
          )}
          {p.whatsapp && (
            <a href={`https://wa.me/${digits(p.whatsapp)}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/25">
              <MessageCircle className="w-3.5 h-3.5" />
              واتساب <span dir="ltr">{fmtPhone(p.whatsapp)}</span>
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── نافذة التعديل ────────────────────────────────────────────────────────── */

function PartnerEditor({ value: p, onChange, onClose, onSave, saving, error }: {
  value: Partner; onChange: (p: Partner) => void; onClose: () => void; onSave: () => void; saving: boolean; error: string;
}) {
  const set = <K extends keyof Partner>(k: K, v: Partner[K]) => onChange({ ...p, [k]: v });
  const setTier = (i: number, t: PriceTier) => set("tiers", p.tiers.map((x, j) => (j === i ? t : x)));

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle>{p.name ? `تعديل شركة ${p.name}` : "شركة جديدة"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>اسم الشركة</Label>
              <Input value={p.name} onChange={(e) => set("name", e.target.value)} placeholder="مثال: نيوليب" />
            </div>
            <div className="space-y-1.5">
              <Label>القسم</Label>
              <select value={p.category} onChange={(e) => set("category", e.target.value as Category)}
                className="h-9 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm dark:bg-input/30">
                {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>رابط الموقع الإلكتروني</Label>
              <Input dir="ltr" value={p.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم التواصل (اتصال)</Label>
              <Input dir="ltr" value={p.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+9665xxxxxxxx" />
            </div>
            <div className="space-y-1.5">
              <Label>رقم الواتساب</Label>
              <Input dir="ltr" value={p.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="9665xxxxxxxx" />
            </div>
          </div>

          {/* الأسعار */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>الأسعار</Label>
              <Button type="button" variant="outline" size="sm" className="gap-1"
                onClick={() => set("tiers", [...p.tiers, { title: "", rows: [{ label: "", value: "" }] }])}>
                <Plus className="w-3.5 h-3.5" /> مجموعة أسعار
              </Button>
            </div>
            {p.tiers.length === 0 && (
              <p className="text-xs text-muted-foreground">ما فيه أسعار — أضف مجموعة أسعار، أو اكتب طريقة أخذ السعر في الملاحظات.</p>
            )}
            {p.tiers.map((t, i) => (
              <div key={i} className="rounded-xl border border-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <Input value={t.title} onChange={(e) => setTier(i, { ...t, title: e.target.value })}
                    placeholder="عنوان المجموعة (اختياري) — مثال: بنك الراجحي" />
                  <button type="button" title="حذف المجموعة" onClick={() => set("tiers", p.tiers.filter((_, j) => j !== i))}
                    className="rounded-lg p-2 text-muted-foreground hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
                {t.rows.map((r, j) => (
                  <div key={j} className="flex items-center gap-2">
                    <Input value={r.label} placeholder="البند — مثال: مدى"
                      onChange={(e) => setTier(i, { ...t, rows: t.rows.map((x, k) => (k === j ? { ...x, label: e.target.value } : x)) })} />
                    <Input value={r.value} placeholder="القيمة — مثال: 1٪"
                      onChange={(e) => setTier(i, { ...t, rows: t.rows.map((x, k) => (k === j ? { ...x, value: e.target.value } : x)) })} />
                    <button type="button" title="حذف البند" onClick={() => setTier(i, { ...t, rows: t.rows.filter((_, k) => k !== j) })}
                      className="rounded-lg p-2 text-muted-foreground hover:text-red-400"><X className="w-4 h-4" /></button>
                  </div>
                ))}
                <button type="button" onClick={() => setTier(i, { ...t, rows: [...t.rows, { label: "", value: "" }] })}
                  className="text-xs font-semibold text-violet-400 hover:underline">+ إضافة بند</button>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label>المتطلبات</Label>
            <Input value={p.requirements} onChange={(e) => set("requirements", e.target.value)} placeholder="مثال: السجل التجاري أو وثيقة العمل الحر" />
          </div>
          <div className="space-y-1.5">
            <Label>ملاحظات</Label>
            <Textarea value={p.notes} onChange={(e) => set("notes", e.target.value)} rows={3}
              placeholder="مثال: طريقة تحويل المبالغ، أو طريقة التواصل لأخذ السعر" />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>إلغاء</Button>
          <Button onClick={onSave} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
