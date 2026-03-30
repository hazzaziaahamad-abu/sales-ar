"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchGiftOffers, createGiftOffer, deleteGiftOffer, fetchDeals, fetchRenewals } from "@/lib/supabase/db";
import type { GiftOffer, Deal, Renewal } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Gift,
  Plus,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Clock,
  PackageOpen,
  CheckCircle2,
  XCircle,
  Users,
  Search,
  Sparkles,
} from "lucide-react";

/* ─── constants ─── */

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  pending: { label: "لم يُفتح", color: "text-gray-400", bg: "bg-white/5", icon: EyeOff },
  opened: { label: "تم الفتح", color: "text-amber-400", bg: "bg-amber-500/10", icon: Eye },
  accepted: { label: "تم القبول", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
};

const GIFT_TYPES = [
  { key: "discount", label: "خصم", emoji: "💰" },
  { key: "free_month", label: "شهر مجاني", emoji: "📅" },
  { key: "upgrade", label: "ترقية مجانية", emoji: "⬆️" },
  { key: "custom", label: "عرض مخصص", emoji: "✨" },
] as const;

const BOX_COLORS = [
  { key: "purple", label: "بنفسجي", class: "bg-purple-500" },
  { key: "gold", label: "ذهبي", class: "bg-amber-500" },
  { key: "red", label: "أحمر", class: "bg-red-500" },
  { key: "emerald", label: "أخضر", class: "bg-emerald-500" },
  { key: "blue", label: "أزرق", class: "bg-blue-500" },
] as const;

const GIFT_EMOJIS = ["🎁", "🎉", "🎊", "🌟", "💎", "🏆", "🎯", "💝", "🔥", "⭐"];

type ViewFilter = "all" | "pending" | "opened" | "accepted" | "rejected";

/* ─── page ─── */

export default function GiftsPage() {
  const { activeOrgId } = useAuth();

  const [offers, setOffers] = useState<GiftOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [search, setSearch] = useState("");

  // Create modal
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // Select client modal
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectSource, setSelectSource] = useState<"renewal" | "deal">("renewal");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Form
  const [form, setForm] = useState({
    client_name: "",
    client_phone: "",
    entity_type: "renewal" as "renewal" | "deal",
    entity_id: "" as string,
    gift_title: "",
    gift_description: "",
    gift_type: "discount" as GiftOffer["gift_type"],
    gift_value: "",
    gift_emoji: "🎁",
    box_color: "purple",
    notes: "",
  });

  // Copied link
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    fetchGiftOffers()
      .then(setOffers)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [activeOrgId]);

  const filteredOffers = useMemo(() => {
    let result = offers;
    if (filter !== "all") result = result.filter((o) => o.status === filter);
    if (search) {
      const s = search.toLowerCase();
      result = result.filter((o) => o.client_name.toLowerCase().includes(s) || o.gift_title.toLowerCase().includes(s));
    }
    return result;
  }, [offers, filter, search]);

  const stats = useMemo(() => ({
    total: offers.length,
    pending: offers.filter((o) => o.status === "pending").length,
    opened: offers.filter((o) => o.status === "opened").length,
    accepted: offers.filter((o) => o.status === "accepted").length,
  }), [offers]);

  function openSelectClient() {
    setLoadingClients(true);
    setSelectOpen(true);
    setClientSearch("");
    Promise.all([fetchDeals(), fetchRenewals()])
      .then(([d, r]) => { setDeals(d); setRenewals(r); })
      .catch(console.error)
      .finally(() => setLoadingClients(false));
  }

  function selectClient(name: string, phone: string | undefined, type: "renewal" | "deal", entityId: string) {
    setForm((prev) => ({
      ...prev,
      client_name: name,
      client_phone: phone || "",
      entity_type: type,
      entity_id: entityId,
    }));
    setSelectOpen(false);
    setCreateOpen(true);
  }

  function openCreateDirect() {
    setForm({
      client_name: "",
      client_phone: "",
      entity_type: "renewal",
      entity_id: "",
      gift_title: "",
      gift_description: "",
      gift_type: "discount",
      gift_value: "",
      gift_emoji: "🎁",
      box_color: "purple",
      notes: "",
    });
    setCreateOpen(true);
  }

  async function handleCreate() {
    if (!form.client_name.trim() || !form.gift_title.trim()) return;
    setSaving(true);
    try {
      const created = await createGiftOffer({
        client_name: form.client_name,
        client_phone: form.client_phone || undefined,
        entity_type: form.entity_type,
        entity_id: form.entity_id || undefined,
        gift_title: form.gift_title,
        gift_description: form.gift_description || undefined,
        gift_type: form.gift_type,
        gift_value: form.gift_value || undefined,
        gift_emoji: form.gift_emoji,
        box_color: form.box_color,
        notes: form.notes || undefined,
      });
      setOffers((prev) => [created, ...prev]);
      setCreateOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function copyLink(offerId: string) {
    const url = `${window.location.origin}/gift/${offerId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(offerId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteGiftOffer(deleteId);
      setOffers((prev) => prev.filter((o) => o.id !== deleteId));
    } catch (err) {
      console.error(err);
    }
    setDeleteOpen(false);
    setDeleteId(null);
  }

  const filteredClients = useMemo(() => {
    const s = clientSearch.toLowerCase();
    if (selectSource === "renewal") {
      return renewals.filter((r) => !s || r.customer_name.toLowerCase().includes(s));
    }
    return deals.filter((d) => !s || d.client_name.toLowerCase().includes(s));
  }, [selectSource, renewals, deals, clientSearch]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
          <Gift className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-foreground">بوكس الهدايا</h1>
          <p className="text-xs text-muted-foreground">
            أرسل هدايا وعروض مخصصة لعملائك لإعادة استهدافهم
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "إجمالي الهدايا", value: stats.total, icon: Gift, color: "amber" },
          { label: "لم تُفتح بعد", value: stats.pending, icon: EyeOff, color: "gray" },
          { label: "تم الفتح", value: stats.opened, icon: Eye, color: "sky" },
          { label: "تم القبول", value: stats.accepted, icon: CheckCircle2, color: "emerald" },
        ].map((s, i) => (
          <div key={i} className="cc-card rounded-xl p-4 text-center">
            <s.icon className={`w-5 h-5 mx-auto mb-2 text-${s.color}-400`} />
            <p className="text-2xl font-bold text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <Button onClick={openSelectClient} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
            <Users className="w-4 h-4" />
            اختر عميل
          </Button>
          <Button onClick={openCreateDirect} variant="outline" className="gap-1.5">
            <Plus className="w-4 h-4" />
            إضافة يدوية
          </Button>
        </div>
        <div className="flex-1 w-full sm:w-auto">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم العميل أو العرض..."
              className="pr-9"
            />
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: "all", label: "الكل" },
          { key: "pending", label: "لم تُفتح" },
          { key: "opened", label: "تم الفتح" },
          { key: "accepted", label: "تم القبول" },
          { key: "rejected", label: "مرفوض" },
        ] as const).map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-lg text-xs transition-colors border ${
              filter === f.key
                ? "bg-white/[0.08] text-foreground border-amber-500/30 font-medium"
                : "text-muted-foreground border-border hover:text-foreground hover:bg-white/[0.03]"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Gift cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="cc-card rounded-xl p-5 space-y-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-48" />
              <Skeleton className="h-8 w-full" />
            </div>
          ))}
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>لا توجد هدايا {filter !== "all" ? "في هذا التصنيف" : "بعد"}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOffers.map((offer) => {
            const status = STATUS_MAP[offer.status] || STATUS_MAP.pending;
            const StatusIcon = status.icon;
            return (
              <div key={offer.id} className="cc-card rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{offer.gift_emoji || "🎁"}</div>
                    <div>
                      <p className="text-sm font-bold text-foreground">{offer.client_name}</p>
                      {offer.client_phone && (
                        <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">{offer.client_phone}</p>
                      )}
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${status.bg} ${status.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {status.label}
                  </span>
                </div>

                <div>
                  <p className="text-sm font-medium text-foreground">{offer.gift_title}</p>
                  {offer.gift_value && (
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-[11px] font-medium">
                      {offer.gift_value}
                    </span>
                  )}
                </div>

                {offer.gift_description && (
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{offer.gift_description}</p>
                )}

                <div className="text-[10px] text-muted-foreground">
                  {offer.entity_type === "renewal" ? "تجديد" : "صفقة"} — {new Date(offer.created_at).toLocaleDateString("ar-SA")}
                  {offer.accepted_at && (
                    <span className="text-emerald-400 mr-2">قبل في {new Date(offer.accepted_at).toLocaleDateString("ar-SA")}</span>
                  )}
                </div>

                <div className="flex items-center gap-1 pt-2 border-t border-border">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1 text-xs"
                    onClick={() => copyLink(offer.id)}
                  >
                    {copiedId === offer.id ? (
                      <><Check className="w-3.5 h-3.5 text-emerald-400" /><span className="text-emerald-400">تم النسخ</span></>
                    ) : (
                      <><Copy className="w-3.5 h-3.5" />نسخ الرابط</>
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs"
                    onClick={() => window.open(`/gift/${offer.id}`, "_blank")}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-xs text-red-400 hover:text-red-400"
                    onClick={() => { setDeleteId(offer.id); setDeleteOpen(true); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Select Client Modal ─── */}
      <Dialog open={selectOpen} onOpenChange={setSelectOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>اختر عميل</DialogTitle>
            <DialogDescription>اختر عميل من التجديدات أو المبيعات لإرسال هدية له</DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => setSelectSource("renewal")}
              className={`px-4 py-2 rounded-lg text-xs border transition-colors ${
                selectSource === "renewal" ? "bg-sky-500/10 text-sky-400 border-sky-500/30" : "border-border text-muted-foreground"
              }`}
            >
              التجديدات
            </button>
            <button
              onClick={() => setSelectSource("deal")}
              className={`px-4 py-2 rounded-lg text-xs border transition-colors ${
                selectSource === "deal" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "border-border text-muted-foreground"
              }`}
            >
              المبيعات
            </button>
          </div>

          <Input
            value={clientSearch}
            onChange={(e) => setClientSearch(e.target.value)}
            placeholder="ابحث باسم العميل..."
            className="mb-3"
          />

          <div className="flex-1 overflow-y-auto space-y-1 min-h-0">
            {loadingClients ? (
              Array.from({ length: 5 }, (_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))
            ) : filteredClients.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">لا توجد نتائج</p>
            ) : selectSource === "renewal" ? (
              (filteredClients as Renewal[]).map((r) => (
                <button
                  key={r.id}
                  onClick={() => selectClient(r.customer_name, r.customer_phone, "renewal", r.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-colors text-right"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{r.customer_name}</p>
                    <p className="text-[10px] text-muted-foreground">{r.plan_name} — {r.status}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    r.status === "ملغي" ? "bg-red-500/10 text-red-400" :
                    r.status === "متأخر" ? "bg-amber-500/10 text-amber-400" :
                    "bg-white/5 text-muted-foreground"
                  }`}>
                    {r.status}
                  </span>
                </button>
              ))
            ) : (
              (filteredClients as Deal[]).map((d) => (
                <button
                  key={d.id}
                  onClick={() => selectClient(d.client_name, d.client_phone, "deal", d.id)}
                  className="w-full flex items-center justify-between p-3 rounded-lg hover:bg-white/[0.04] transition-colors text-right"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{d.client_name}</p>
                    <p className="text-[10px] text-muted-foreground">{d.stage} — {d.plan || "بدون خطة"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.deal_value} ر.س</span>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Create Gift Modal ─── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              إنشاء هدية جديدة
            </DialogTitle>
            <DialogDescription>صمم هدية مخصصة لعميلك</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Client info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>اسم العميل</Label>
                <Input
                  value={form.client_name}
                  onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                  placeholder="اسم العميل"
                />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الجوال</Label>
                <Input
                  value={form.client_phone}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  placeholder="05xxxxxxxx"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Gift title */}
            <div className="space-y-1.5">
              <Label>عنوان الهدية</Label>
              <Input
                value={form.gift_title}
                onChange={(e) => setForm({ ...form, gift_title: e.target.value })}
                placeholder="مثال: خصم خاص لأنك عميلنا المميز!"
              />
            </div>

            {/* Gift type */}
            <div className="space-y-1.5">
              <Label>نوع الهدية</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {GIFT_TYPES.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setForm({ ...form, gift_type: t.key })}
                    className={`px-3 py-2 rounded-lg text-xs border transition-colors ${
                      form.gift_type === t.key
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/30 font-medium"
                        : "border-border text-muted-foreground hover:border-muted-foreground"
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Gift value */}
            <div className="space-y-1.5">
              <Label>قيمة العرض</Label>
              <Input
                value={form.gift_value}
                onChange={(e) => setForm({ ...form, gift_value: e.target.value })}
                placeholder="مثال: خصم 30% — شهر مجاني — ترقية VIP"
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label>وصف العرض</Label>
              <textarea
                value={form.gift_description}
                onChange={(e) => setForm({ ...form, gift_description: e.target.value })}
                placeholder="اكتب تفاصيل العرض التي سيراها العميل..."
                rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {/* Box color */}
            <div className="space-y-1.5">
              <Label>لون صندوق الهدية</Label>
              <div className="flex items-center gap-2">
                {BOX_COLORS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setForm({ ...form, box_color: c.key })}
                    className={`w-9 h-9 rounded-lg ${c.class} transition-all ${
                      form.box_color === c.key ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Emoji */}
            <div className="space-y-1.5">
              <Label>إيموجي الهدية</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {GIFT_EMOJIS.map((e) => (
                  <button
                    key={e}
                    onClick={() => setForm({ ...form, gift_emoji: e })}
                    className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${
                      form.gift_emoji === e ? "bg-white/10 ring-2 ring-amber-500/50 scale-110" : "hover:bg-white/5"
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>ملاحظات داخلية</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ملاحظات للفريق (لا تظهر للعميل)"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
              {saving ? "جاري الإنشاء..." : (
                <><Gift className="w-4 h-4" />إنشاء الهدية</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirmation ─── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>تأكيد الحذف</DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذه الهدية؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={handleDelete}>حذف الهدية</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
