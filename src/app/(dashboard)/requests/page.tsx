"use client";

import { useState, useEffect } from "react";
import type { PendingDeal } from "@/types";
import { fetchPendingDeals, approvePendingDeal, rejectPendingDeal } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { formatMoneyFull, formatDate } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { CheckCircle, XCircle, Clock, Inbox, Copy, ExternalLink } from "lucide-react";

export default function RequestsPage() {
  const { activeOrgId: orgId, user: authUser } = useAuth();
  const [deals, setDeals] = useState<PendingDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [processing, setProcessing] = useState<string | null>(null);

  /* Detail modal */
  const [detailDeal, setDetailDeal] = useState<PendingDeal | null>(null);

  /* Link copy */
  const [copied, setCopied] = useState(false);
  const submitLink = typeof window !== "undefined" ? `${window.location.origin}/submit/${orgId}` : "";

  function copyLink() {
    navigator.clipboard.writeText(submitLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  useEffect(() => {
    setLoading(true);
    fetchPendingDeals(filter === "all" ? undefined : filter)
      .then(setDeals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [orgId, filter]);

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      await approvePendingDeal(id, authUser?.name || "المدير");
      setDeals((prev) => prev.filter((d) => d.id !== id));
      setDetailDeal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    setProcessing(id);
    try {
      await rejectPendingDeal(id, authUser?.name || "المدير");
      setDeals((prev) => prev.filter((d) => d.id !== id));
      setDetailDeal(null);
    } catch (err) {
      console.error(err);
    } finally {
      setProcessing(null);
    }
  }

  const pendingCount = deals.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
            <Inbox className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">قائمة الطلبات</h1>
            <p className="text-xs text-muted-foreground">مراجعة طلبات إضافة العملاء الجديدة</p>
          </div>
        </div>

        {/* Copy submission link */}
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-[14px] bg-white/[0.04] border border-white/[0.08] text-xs text-muted-foreground min-w-0 flex-1 sm:flex-initial sm:max-w-[300px]">
            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate" dir="ltr">{submitLink}</span>
          </div>
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 shrink-0">
            <Copy className="w-3.5 h-3.5" />
            {copied ? "تم النسخ!" : "نسخ الرابط"}
          </Button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: "pending", label: "معلّقة", icon: <Clock className="w-3.5 h-3.5" />, color: "amber" },
          { key: "approved", label: "مقبولة", icon: <CheckCircle className="w-3.5 h-3.5" />, color: "green" },
          { key: "rejected", label: "مرفوضة", icon: <XCircle className="w-3.5 h-3.5" />, color: "red" },
          { key: "all", label: "الكل", icon: <Inbox className="w-3.5 h-3.5" />, color: "cyan" },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-xs font-medium transition-all ${
              filter === tab.key
                ? `bg-${tab.color}-500/15 text-${tab.color}-400 ring-1 ring-${tab.color}-500/30`
                : "bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07]"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="cc-card rounded-[14px] p-5">
              <div className="flex items-center gap-3">
                <Skeleton className="w-10 h-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : deals.length === 0 ? (
        <div className="cc-card rounded-2xl p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-violet-500/10 flex items-center justify-center mb-4">
            <Inbox className="w-8 h-8 text-violet-400/50" />
          </div>
          <h3 className="text-sm font-bold text-foreground">لا توجد طلبات {filter === "pending" ? "معلّقة" : ""}</h3>
          <p className="text-xs text-muted-foreground mt-1">شارك رابط النموذج ليتمكن الفريق من إرسال طلبات جديدة</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {deals.map((deal) => {
            const isPending = deal.status === "pending";
            const isApproved = deal.status === "approved";
            const statusColors = isPending ? "border-amber-500/20 bg-amber-500/[0.03]" : isApproved ? "border-emerald-500/20 bg-emerald-500/[0.03]" : "border-red-500/20 bg-red-500/[0.03]";
            const statusBadge = isPending
              ? { text: "معلّقة", color: "bg-amber-500/15 text-amber-400" }
              : isApproved
              ? { text: "مقبولة", color: "bg-emerald-500/15 text-emerald-400" }
              : { text: "مرفوضة", color: "bg-red-500/15 text-red-400" };

            return (
              <div
                key={deal.id}
                onClick={() => setDetailDeal(deal)}
                className={`cc-card rounded-[14px] p-5 border cursor-pointer hover:border-white/20 transition-all ${statusColors}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold ${
                    deal.sales_type === "support" ? "bg-orange-500/15 text-orange-400" : "bg-emerald-500/15 text-emerald-400"
                  }`}>
                    {deal.sales_type === "support" ? "د" : "م"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground">{deal.client_name}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusBadge.color}`}>{statusBadge.text}</span>
                      {deal.deal_value > 0 && (
                        <span className="text-xs font-bold text-cyan-400">{formatMoneyFull(deal.deal_value)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                      {deal.stage && <span className="text-cyan-400 font-medium">{deal.stage}</span>}
                      {deal.source && <span>• {deal.source}</span>}
                      {deal.plan && <span>• {deal.plan}</span>}
                      {deal.submitter_name && <span>• بواسطة: {deal.submitter_name}</span>}
                      <span>• {formatDate(deal.created_at)}</span>
                    </div>
                  </div>
                  {isPending && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        className="gap-1 bg-emerald-600 hover:bg-emerald-500 text-white"
                        onClick={(e) => { e.stopPropagation(); handleApprove(deal.id); }}
                        disabled={processing === deal.id}
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        قبول
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        className="gap-1"
                        onClick={(e) => { e.stopPropagation(); handleReject(deal.id); }}
                        disabled={processing === deal.id}
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        رفض
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Dialog open={!!detailDeal} onOpenChange={() => setDetailDeal(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب</DialogTitle>
            <DialogDescription>مراجعة بيانات العميل قبل الموافقة</DialogDescription>
          </DialogHeader>
          {detailDeal && (
            <div className="space-y-3 py-2">
              <InfoRow label="اسم العميل" value={detailDeal.client_name} />
              <InfoRow label="رقم الجوال" value={detailDeal.client_phone || "—"} />
              <InfoRow label="القيمة" value={detailDeal.deal_value > 0 ? `${detailDeal.deal_value.toLocaleString()} ر.س` : "—"} />
              <InfoRow label="المرحلة" value={detailDeal.stage || "قيد التواصل"} />
              <InfoRow label="المصدر" value={detailDeal.source || "—"} />
              <InfoRow label="الباقة" value={detailDeal.plan || "—"} />
              <InfoRow label="القسم" value={detailDeal.sales_type === "support" ? "مبيعات الدعم" : "مبيعات المكتب"} />
              <InfoRow label="المسؤول" value={detailDeal.assigned_rep_name || "—"} />
              <InfoRow label="مرسل الطلب" value={detailDeal.submitter_name || "—"} />
              {detailDeal.notes && <InfoRow label="ملاحظات" value={detailDeal.notes} />}
              <InfoRow label="تاريخ الإرسال" value={formatDate(detailDeal.created_at)} />
            </div>
          )}
          {detailDeal?.status === "pending" && (
            <DialogFooter>
              <Button
                variant="destructive"
                onClick={() => handleReject(detailDeal.id)}
                disabled={processing === detailDeal.id}
              >
                رفض
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500 text-white"
                onClick={() => handleApprove(detailDeal.id)}
                disabled={processing === detailDeal.id}
              >
                قبول وإضافة للمبيعات
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/30">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}
