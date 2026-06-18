"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ColorBadge } from "@/components/ui/color-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth-context";
import {
  MessageCircle,
  RefreshCw,
  Smartphone,
  Send,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Power,
} from "lucide-react";

type WaStatus =
  | "INITIALIZING"
  | "SCAN_QR"
  | "CONNECTING"
  | "CONNECTED"
  | "DISCONNECTED"
  | "FAILED"
  | "LOADING";

const STATUS_META: Record<
  WaStatus,
  { label: string; color: "cyan" | "green" | "amber" | "red" | "blue" }
> = {
  CONNECTED: { label: "متصل", color: "green" },
  CONNECTING: { label: "جارٍ الاتصال", color: "amber" },
  SCAN_QR: { label: "بانتظار مسح الرمز", color: "blue" },
  INITIALIZING: { label: "جارٍ التهيئة", color: "amber" },
  DISCONNECTED: { label: "غير متصل", color: "red" },
  FAILED: { label: "فشل الاتصال", color: "red" },
  LOADING: { label: "جارٍ التحميل", color: "blue" },
};

const FALLBACK_META = { label: "غير معروف", color: "amber" as const };

// OpenWA statuses: created | initializing | qr_ready | authenticating |
// ready | disconnected | failed. Normalize to our display set.
function normalizeStatus(raw: unknown): WaStatus {
  const s = String(raw ?? "").toUpperCase().replace(/[\s-]+/g, "_");
  if (s in STATUS_META) return s as WaStatus;
  if (["READY", "AUTHENTICATED", "OPEN", "WORKING"].includes(s)) return "CONNECTED";
  if (["QR_READY", "QRCODE", "QR", "SCAN_QR_CODE", "PAIRING"].includes(s)) return "SCAN_QR";
  if (["AUTHENTICATING", "STARTING", "OPENING", "TIMEOUT"].includes(s)) return "CONNECTING";
  if (["CREATED"].includes(s)) return "INITIALIZING";
  if (["STOPPED", "LOGGED_OUT", "CLOSED", "CONFLICT"].includes(s)) return "DISCONNECTED";
  if (["ERROR", "UNLAUNCHED"].includes(s)) return "FAILED";
  return "DISCONNECTED";
}

export default function WhatsAppPage() {
  const { activeOrgId, orgs } = useAuth();
  const orgName = orgs.find((o) => o.id === activeOrgId)?.nameAr ?? "";

  const [status, setStatus] = useState<WaStatus>("LOADING");
  const [phone, setPhone] = useState<string | null>(null);
  const [pushName, setPushName] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [rateLimitedSec, setRateLimitedSec] = useState<number | null>(null);

  // --- test sender state ---
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  // Polls status (which now includes the QR). Returns the recommended delay
  // before the next poll so we can back off on rate-limits and slow down once
  // connected. The gateway rate-limits, so we never hammer it.
  const refresh = useCallback(async (): Promise<number> => {
    if (!activeOrgId) return 8000;
    try {
      const res = await fetch(`/api/wa/status?orgId=${encodeURIComponent(activeOrgId)}`);
      const data = await res.json().catch(() => ({}));

      // Rate-limited: show a clear "busy" state (not an endless skeleton) and
      // back off. Re-checks periodically since the gateway windows reset.
      if (res.status === 429) {
        const retry = Number(data?.retryAfterSec) || 60;
        setRateLimitedSec(retry);
        setError(null);
        setStatus((prev) => (prev === "LOADING" ? "DISCONNECTED" : prev));
        return Math.min(Math.max(retry, 20), 60) * 1000;
      }
      setRateLimitedSec(null);

      if (!res.ok) {
        setError(data.error || "تعذّر الاتصال بالبوابة");
        setStatus("FAILED");
        return 12000;
      }
      setError(null);
      const norm = normalizeStatus(data.status);
      setStatus(norm);
      setPhone(data.phone ?? null);
      setPushName(data.pushName ?? null);
      setQr(norm === "CONNECTED" ? null : data.qr?.qrCode ?? null);

      // Poll fast ONLY while actively pairing (QR on screen). Otherwise poll
      // slowly — the gateway's long-window rate limit is strict, and idle
      // status rarely changes (webhooks cover status changes in production).
      if (norm === "SCAN_QR" || norm === "CONNECTING") return 6000;
      return 30000; // connected or idle
    } catch {
      setError("تعذّر الوصول إلى الخادم");
      setStatus("FAILED");
      return 12000;
    }
  }, [activeOrgId]);

  // Self-scheduling poll loop. Re-runs when the active org changes.
  useEffect(() => {
    setStatus("LOADING");
    setQr(null);
    setPhone(null);
    setPushName(null);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      const delay = await refresh();
      if (!cancelled) timer = setTimeout(tick, delay);
    };
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [refresh]);

  const handleConnect = async () => {
    if (!activeOrgId) return;
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/wa/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrgId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذّر بدء الجلسة");
      } else {
        setStatus(normalizeStatus(data.status));
        setQr(data?.qr?.qrCode ?? null);
      }
    } catch {
      setError("تعذّر بدء الجلسة");
    } finally {
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeOrgId) return;
    if (!confirm("سيتم فصل الرقم الحالي حتى تتمكن من ربط رقم آخر. متابعة؟")) return;
    setDisconnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/wa/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrgId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذّر فصل الرقم");
      } else {
        setStatus("DISCONNECTED");
        setPhone(null);
        setPushName(null);
        setQr(null);
      }
    } catch {
      setError("تعذّر فصل الرقم");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrgId) return;
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrgId, to, text }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSendMsg(`فشل الإرسال: ${data.error || ""}`);
      } else {
        setSendMsg("تم إرسال الرسالة بنجاح ✅");
        setText("");
      }
    } catch {
      setSendMsg("تعذّر إرسال الرسالة");
    } finally {
      setSending(false);
    }
  };

  const meta = STATUS_META[status] ?? FALLBACK_META;
  const isConnected = status === "CONNECTED";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-green-dim ring-1 ring-cc-green/20">
            <MessageCircle className="h-5 w-5 text-cc-green" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">واتساب</h1>
            <p className="text-xs text-muted-foreground">
              ربط رقم واتساب لـ{orgName ? ` ${orgName}` : "المنظمة"} — رقم مستقل لكل منظمة
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <ColorBadge text={meta.label} color={meta.color} size="md" />
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-3.5 w-3.5" />
            تحديث
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-cc-red/20 bg-red-dim px-4 py-3 text-sm text-cc-red">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {rateLimitedSec !== null && (
        <div className="flex items-center gap-2 rounded-xl border border-amber/20 bg-amber-dim px-4 py-3 text-sm text-amber">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            البوابة مزدحمة مؤقتًا (تم تجاوز حد الطلبات). سيُعاد المحاولة تلقائيًا
            {rateLimitedSec >= 120
              ? ` خلال حوالي ${Math.ceil(rateLimitedSec / 60)} دقيقة`
              : ` خلال ${rateLimitedSec} ثانية`}
            .
          </span>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Connection / QR card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-cyan" />
              ربط الرقم
            </CardTitle>
            <CardDescription>
              {isConnected
                ? "الرقم متصل وجاهز للاستخدام"
                : "افتح واتساب › الأجهزة المرتبطة › ربط جهاز، ثم امسح الرمز"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === "LOADING" ? (
              <Skeleton className="mx-auto h-64 w-64 rounded-xl" />
            ) : isConnected ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-dim ring-1 ring-cc-green/30">
                  <CheckCircle2 className="h-10 w-10 text-cc-green" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">الرقم متصل</p>
                  {pushName && (
                    <p className="mt-0.5 text-sm text-foreground">{pushName}</p>
                  )}
                  {phone && (
                    <p
                      className="mt-1 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"
                      dir="ltr"
                    >
                      <Smartphone className="h-3.5 w-3.5" />
                      {phone}
                    </p>
                  )}
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                >
                  <Power className="h-3.5 w-3.5" />
                  {disconnecting ? "جارٍ الفصل..." : "فصل / ربط رقم آخر"}
                </Button>
              </div>
            ) : qr ? (
              <div className="flex flex-col items-center gap-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qr}
                  alt="WhatsApp QR"
                  className="h-64 w-64 rounded-xl border border-white/10 bg-white p-2"
                />
                <p className="text-xs text-muted-foreground">
                  يتم تحديث الرمز تلقائيًا — امسحه بسرعة
                </p>
              </div>
            ) : rateLimitedSec !== null ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-dim ring-1 ring-amber/20">
                  <RefreshCw className="h-7 w-7 animate-spin text-amber" />
                </div>
                <p className="text-sm text-muted-foreground">
                  البوابة مزدحمة مؤقتًا — جارٍ إعادة المحاولة تلقائيًا...
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  لا يوجد رمز حاليًا. اضغط «بدء الاتصال» لإنشاء رمز جديد.
                </p>
                <Button onClick={handleConnect} disabled={connecting || !activeOrgId}>
                  <RefreshCw
                    className={connecting ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"}
                  />
                  {connecting ? "جارٍ البدء..." : "بدء الاتصال"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Test sender card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-cyan" />
              إرسال رسالة تجريبية
            </CardTitle>
            <CardDescription>
              أرسل رسالة نصية للتأكد من عمل الاتصال
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wa-to">رقم الجوال (بصيغة دولية)</Label>
                <Input
                  id="wa-to"
                  dir="ltr"
                  placeholder="9665XXXXXXXX"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  disabled={!isConnected}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wa-text">نص الرسالة</Label>
                <Input
                  id="wa-text"
                  placeholder="اكتب رسالتك هنا..."
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  disabled={!isConnected}
                />
              </div>
              <Button type="submit" disabled={!isConnected || sending}>
                <Send className="h-3.5 w-3.5" />
                {sending ? "جارٍ الإرسال..." : "إرسال"}
              </Button>
              {!isConnected && (
                <p className="text-xs text-muted-foreground">
                  يجب ربط الرقم أولًا لتفعيل الإرسال
                </p>
              )}
              {sendMsg && (
                <p className="text-sm text-foreground">{sendMsg}</p>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
