"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { fetchGiftOffers, createGiftOffer, deleteGiftOffer, deleteGiftBundle, createGiftBundle, updateGiftOffer, fetchDeals, fetchRenewals } from "@/lib/supabase/db";
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
  Pencil,
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
  const [isUnregistered, setIsUnregistered] = useState(false);

  // Select client modal
  const [selectOpen, setSelectOpen] = useState(false);
  const [selectSource, setSelectSource] = useState<"renewal" | "deal">("renewal");
  const [deals, setDeals] = useState<Deal[]>([]);
  const [renewals, setRenewals] = useState<Renewal[]>([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [clientSearch, setClientSearch] = useState("");

  // Form - client info
  const [clientForm, setClientForm] = useState({
    client_name: "",
    client_phone: "",
    entity_type: "renewal" as "renewal" | "deal",
    entity_id: "",
    box_color: "purple",
  });

  // Form - gift items (for bundle)
  interface GiftItem { gift_title: string; gift_description: string; gift_type: GiftOffer["gift_type"]; gift_value: string; gift_emoji: string; }
  const emptyGift = (): GiftItem => ({ gift_title: "", gift_description: "", gift_type: "discount", gift_value: "", gift_emoji: "🎁" });
  const [giftItems, setGiftItems] = useState<GiftItem[]>([emptyGift()]);

  function updateGiftItem(idx: number, updates: Partial<GiftItem>) {
    setGiftItems(prev => prev.map((g, i) => i === idx ? { ...g, ...updates } : g));
  }
  function addGiftItem() { setGiftItems(prev => [...prev, emptyGift()]); }
  function removeGiftItem(idx: number) { setGiftItems(prev => prev.filter((_, i) => i !== idx)); }

  // Copied link
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit
  const [editOpen, setEditOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<GiftOffer | null>(null);
  const [editForm, setEditForm] = useState({ gift_title: "", gift_description: "", gift_type: "discount" as string, gift_value: "", gift_emoji: "🎁", client_name: "", client_phone: "", box_color: "purple" });
  const [editSaving, setEditSaving] = useState(false);

  function openEdit(offer: GiftOffer) {
    setEditingOffer(offer);
    setEditForm({
      gift_title: offer.gift_title,
      gift_description: offer.gift_description || "",
      gift_type: offer.gift_type,
      gift_value: offer.gift_value || "",
      gift_emoji: offer.gift_emoji || "🎁",
      client_name: offer.client_name,
      client_phone: offer.client_phone || "",
      box_color: offer.box_color || "purple",
    });
    setEditOpen(true);
  }

  async function handleEditSave() {
    if (!editingOffer || !editForm.gift_title.trim() || !editForm.client_name.trim()) return;
    setEditSaving(true);
    try {
      const updated = await updateGiftOffer(editingOffer.id, {
        gift_title: editForm.gift_title,
        gift_description: editForm.gift_description || null,
        gift_type: editForm.gift_type,
        gift_value: editForm.gift_value || null,
        gift_emoji: editForm.gift_emoji,
        client_name: editForm.client_name,
        client_phone: editForm.client_phone || null,
        box_color: editForm.box_color,
      });
      setOffers(prev => prev.map(o => o.id === editingOffer.id ? updated : o));
      setEditOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  }

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
    setClientForm({ client_name: name, client_phone: phone || "", entity_type: type, entity_id: entityId, box_color: "purple" });
    setGiftItems([emptyGift()]);
    setSelectOpen(false);
    setCreateOpen(true);
  }

  function openCreateDirect() {
    setClientForm({ client_name: "", client_phone: "", entity_type: "renewal", entity_id: "", box_color: "purple" });
    setGiftItems([emptyGift()]);
    setIsUnregistered(false);
    setCreateOpen(true);
  }

  async function handleCreate() {
    const validGifts = giftItems.filter(g => g.gift_title.trim());
    const effectiveName = isUnregistered ? "__unregistered__" : clientForm.client_name.trim();
    if ((!isUnregistered && !clientForm.client_name.trim()) || validGifts.length === 0) return;
    setSaving(true);
    try {
      if (validGifts.length === 1) {
        // Single gift - use original method
        const g = validGifts[0];
        const payload: Parameters<typeof createGiftOffer>[0] = {
          client_name: effectiveName,
          entity_type: clientForm.entity_type,
          gift_title: g.gift_title,
          gift_type: g.gift_type,
          gift_emoji: g.gift_emoji,
          box_color: clientForm.box_color,
        };
        if (clientForm.client_phone) payload.client_phone = clientForm.client_phone;
        if (clientForm.entity_id) payload.entity_id = clientForm.entity_id;
        if (g.gift_description) payload.gift_description = g.gift_description;
        if (g.gift_value) payload.gift_value = g.gift_value;
        const created = await createGiftOffer(payload);
        setOffers((prev) => [created, ...prev]);
      } else {
        // Multiple gifts - create bundle
        const { offers } = await createGiftBundle(
          {
            client_name: effectiveName,
            client_phone: clientForm.client_phone || undefined,
            entity_type: clientForm.entity_type,
            entity_id: clientForm.entity_id || undefined,
            box_color: clientForm.box_color,
          },
          validGifts
        );
        setOffers((prev) => [...offers, ...prev]);
      }
      setCreateOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function copyLink(offer: GiftOffer) {
    // If offer has a bundle_id and there are other offers with same bundle_id, use bundle link
    const siblings = offers.filter(o => o.bundle_id && o.bundle_id === offer.bundle_id);
    const url = siblings.length > 1
      ? `${window.location.origin}/gift/b/${offer.bundle_id}`
      : `${window.location.origin}/gift/${offer.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(offer.id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      const offer = offers.find(o => o.id === deleteId);
      const siblings = offer?.bundle_id ? offers.filter(o => o.bundle_id === offer.bundle_id) : [];
      if (siblings.length > 1) {
        // Delete entire bundle
        await deleteGiftBundle(offer!.bundle_id!);
        setOffers(prev => prev.filter(o => o.bundle_id !== offer!.bundle_id));
      } else {
        await deleteGiftOffer(deleteId);
        setOffers(prev => prev.filter(o => o.id !== deleteId));
      }
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
          <div key={i} className="cc-card rounded-[14px] p-4 text-center">
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
                : "text-muted-foreground border-border hover:text-foreground hover:bg-white/[0.05]"
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
            <div key={i} className="cc-card rounded-[14px] p-5 space-y-3">
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
            const bundleSiblings = offer.bundle_id ? offers.filter(o => o.bundle_id === offer.bundle_id) : [];
            const isBundle = bundleSiblings.length > 1;
            return (
              <div key={offer.id} className="cc-card rounded-[14px] p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-3xl">{offer.gift_emoji || "🎁"}</div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {offer.client_name === "__unregistered__" ? (
                          <span className="text-amber-400">عميل غير مسجل</span>
                        ) : offer.client_name}
                      </p>
                      {offer.client_phone && (
                        <p className="text-[10px] text-muted-foreground mt-0.5" dir="ltr">{offer.client_phone}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isBundle && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-fuchsia-500/10 text-fuchsia-400 text-[10px] font-medium">
                        🎰 {bundleSiblings.length} هدايا
                      </span>
                    )}
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium ${status.bg} ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </span>
                  </div>
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
                    className="gap-1 text-xs"
                    onClick={() => openEdit(offer)}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="flex-1 gap-1 text-xs"
                    onClick={() => copyLink(offer)}
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
                    onClick={() => {
                      const siblings = offers.filter(o => o.bundle_id && o.bundle_id === offer.bundle_id);
                      const url = siblings.length > 1 ? `/gift/b/${offer.bundle_id}` : `/gift/${offer.id}`;
                      window.open(url, "_blank");
                    }}
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
        <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              إنشاء هدية جديدة
            </DialogTitle>
            <DialogDescription>صمم هدية أو مجموعة هدايا عشوائية لعميلك — أضف أكثر من هدية ليختار البوكس واحدة عشوائياً</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Unregistered client toggle */}
            <button
              type="button"
              onClick={() => {
                setIsUnregistered(!isUnregistered);
                if (!isUnregistered) {
                  setClientForm({ ...clientForm, client_name: "", client_phone: "" });
                }
              }}
              className={`w-full flex items-center justify-between rounded-[14px] border px-4 py-3 transition-all ${
                isUnregistered
                  ? "border-amber-500/30 bg-amber-500/5 text-amber-400"
                  : "border-border bg-white/[0.02] text-muted-foreground hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-sm font-semibold">عميل غير مسجل (يسجّل عند فتح الرابط)</span>
              <div className={`w-10 h-5 rounded-full transition-all relative ${isUnregistered ? "bg-amber-500" : "bg-white/10"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${isUnregistered ? "right-0.5" : "right-[calc(100%-18px)]"}`} />
              </div>
            </button>

            {/* Client info - hidden when unregistered */}
            {!isUnregistered && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>اسم العميل</Label>
                  <Input
                    value={clientForm.client_name}
                    onChange={(e) => setClientForm({ ...clientForm, client_name: e.target.value })}
                    placeholder="اسم العميل"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>رقم الجوال</Label>
                  <Input
                    value={clientForm.client_phone}
                    onChange={(e) => setClientForm({ ...clientForm, client_phone: e.target.value })}
                    placeholder="05xxxxxxxx"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {isUnregistered && (
              <div className="rounded-[14px] border border-amber-500/10 bg-amber-500/5 px-4 py-3">
                <p className="text-xs text-amber-400/80">
                  سيُطلب من العميل تسجيل اسم المتجر ورقم الجوال عند فتح رابط الهدية
                </p>
              </div>
            )}

            {/* Box color */}
            <div className="space-y-1.5">
              <Label>لون صندوق الهدية</Label>
              <div className="flex items-center gap-2">
                {BOX_COLORS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setClientForm({ ...clientForm, box_color: c.key })}
                    className={`w-9 h-9 rounded-lg ${c.class} transition-all ${
                      clientForm.box_color === c.key ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110" : "opacity-60 hover:opacity-100"
                    }`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Gift items */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">الهدايا ({giftItems.length})</Label>
                <Button variant="outline" size="sm" onClick={addGiftItem} className="gap-1 text-xs">
                  <Plus className="w-3.5 h-3.5" /> إضافة هدية أخرى
                </Button>
              </div>

              {giftItems.length > 1 && (
                <p className="text-xs text-fuchsia-400 bg-fuchsia-500/10 px-3 py-2 rounded-lg">
                  🎰 وضع البوكس العشوائي — العميل سيفتح الصندوق وتظهر له هدية واحدة عشوائياً من {giftItems.length} هدايا
                </p>
              )}

              {giftItems.map((item, idx) => (
                <div key={idx} className="cc-card rounded-[14px] p-4 space-y-3 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">هدية {idx + 1}</span>
                    {giftItems.length > 1 && (
                      <button onClick={() => removeGiftItem(idx)} className="text-red-400 hover:text-red-300 text-xs">حذف</button>
                    )}
                  </div>

                  <Input
                    value={item.gift_title}
                    onChange={(e) => updateGiftItem(idx, { gift_title: e.target.value })}
                    placeholder="عنوان الهدية"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {GIFT_TYPES.map((t) => (
                          <button
                            key={t.key}
                            onClick={() => updateGiftItem(idx, { gift_type: t.key })}
                            className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                              item.gift_type === t.key
                                ? "bg-amber-500/10 text-amber-400 border-amber-500/30 font-medium"
                                : "border-border text-muted-foreground"
                            }`}
                          >
                            {t.emoji} {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <Input
                      value={item.gift_value}
                      onChange={(e) => updateGiftItem(idx, { gift_value: e.target.value })}
                      placeholder="القيمة: خصم 30%"
                    />
                  </div>

                  <textarea
                    value={item.gift_description}
                    onChange={(e) => updateGiftItem(idx, { gift_description: e.target.value })}
                    placeholder="وصف العرض (اختياري)"
                    rows={2}
                    className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  />

                  <div className="flex items-center gap-1">
                    {GIFT_EMOJIS.map((e) => (
                      <button
                        key={e}
                        onClick={() => updateGiftItem(idx, { gift_emoji: e })}
                        className={`w-7 h-7 rounded text-sm flex items-center justify-center transition-all ${
                          item.gift_emoji === e ? "bg-white/10 ring-1 ring-amber-500/50 scale-110" : "hover:bg-white/5"
                        }`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button onClick={handleCreate} disabled={saving} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
              {saving ? "جاري الإنشاء..." : (
                <><Gift className="w-4 h-4" />{giftItems.length > 1 ? `إنشاء ${giftItems.length} هدايا` : "إنشاء الهدية"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Edit Gift Modal ─── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-amber-400" />
              تعديل الهدية
            </DialogTitle>
            <DialogDescription>عدّل بيانات الهدية</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>اسم العميل</Label>
                <Input value={editForm.client_name} onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label>رقم الجوال</Label>
                <Input value={editForm.client_phone} onChange={(e) => setEditForm({ ...editForm, client_phone: e.target.value })} dir="ltr" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>عنوان الهدية</Label>
              <Input value={editForm.gift_title} onChange={(e) => setEditForm({ ...editForm, gift_title: e.target.value })} />
            </div>

            <div className="space-y-1.5">
              <Label>نوع الهدية</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {GIFT_TYPES.map((t) => (
                  <button key={t.key} onClick={() => setEditForm({ ...editForm, gift_type: t.key })}
                    className={`px-3 py-2 rounded-lg text-xs border transition-colors ${editForm.gift_type === t.key ? "bg-amber-500/10 text-amber-400 border-amber-500/30 font-medium" : "border-border text-muted-foreground"}`}>
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>قيمة العرض</Label>
              <Input value={editForm.gift_value} onChange={(e) => setEditForm({ ...editForm, gift_value: e.target.value })} placeholder="خصم 30%" />
            </div>

            <div className="space-y-1.5">
              <Label>وصف العرض</Label>
              <textarea value={editForm.gift_description} onChange={(e) => setEditForm({ ...editForm, gift_description: e.target.value })} rows={3}
                className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>

            <div className="space-y-1.5">
              <Label>لون الصندوق</Label>
              <div className="flex items-center gap-2">
                {BOX_COLORS.map((c) => (
                  <button key={c.key} onClick={() => setEditForm({ ...editForm, box_color: c.key })}
                    className={`w-9 h-9 rounded-lg ${c.class} transition-all ${editForm.box_color === c.key ? "ring-2 ring-white ring-offset-2 ring-offset-background scale-110" : "opacity-60 hover:opacity-100"}`}
                    title={c.label} />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>إيموجي الهدية</Label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {GIFT_EMOJIS.map((e) => (
                  <button key={e} onClick={() => setEditForm({ ...editForm, gift_emoji: e })}
                    className={`w-9 h-9 rounded-lg text-xl flex items-center justify-center transition-all ${editForm.gift_emoji === e ? "bg-white/10 ring-2 ring-amber-500/50 scale-110" : "hover:bg-white/5"}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleEditSave} disabled={editSaving} className="gap-1.5 bg-amber-600 hover:bg-amber-700">
              {editSaving ? "جاري الحفظ..." : "حفظ التعديلات"}
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
