"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  MessageCircle,
  RefreshCw,
  Smartphone,
  Send,
  QrCode,
  CheckCircle2,
  AlertTriangle,
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

// The gateway may report statuses in different casing or with aliases
// (e.g. whatsapp-web.js states). Normalize to our known set.
function normalizeStatus(raw: unknown): WaStatus {
  const s = String(raw ?? "").toUpperCase().replace(/[\s-]+/g, "_");
  if (s in STATUS_META) return s as WaStatus;
  if (["READY", "AUTHENTICATED", "OPEN", "WORKING"].includes(s)) return "CONNECTED";
  if (["QRCODE", "QR", "SCAN_QR_CODE", "PAIRING"].includes(s)) return "SCAN_QR";
  if (["STARTING", "OPENING", "TIMEOUT"].includes(s)) return "CONNECTING";
  if (["STOPPED", "LOGGED_OUT", "CLOSED", "CONFLICT"].includes(s)) return "DISCONNECTED";
  if (["ERROR", "UNLAUNCHED"].includes(s)) return "FAILED";
  return "DISCONNECTED";
}

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WaStatus>("LOADING");
  const [phone, setPhone] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- test sender state ---
  const [to, setTo] = useState("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/wa/status");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذّر الاتصال بالبوابة");
        setStatus("FAILED");
        return;
      }
      setError(null);
      setStatus(normalizeStatus(data.status));
      setPhone(data.phoneNumber ?? null);

      // If not connected, fetch a fresh QR to display.
      if (data.status !== "CONNECTED") {
        const qrRes = await fetch("/api/wa/qr");
        const qrData = await qrRes.json();
        setQr(qrData?.qr?.image ?? null);
      } else {
        setQr(null);
      }
    } catch {
      setError("تعذّر الوصول إلى الخادم");
      setStatus("FAILED");
    }
  }, []);

  // Initial load + polling.
  useEffect(() => {
    refresh();
    pollRef.current = setInterval(refresh, 4000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refresh]);

  const handleConnect = async () => {
    setConnecting(true);
    setError(null);
    try {
      const res = await fetch("/api/wa/connect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "تعذّر بدء الجلسة");
      } else {
        setStatus(normalizeStatus(data.status));
        setQr(data?.qr?.image ?? null);
      }
    } catch {
      setError("تعذّر بدء الجلسة");
    } finally {
      setConnecting(false);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSendMsg(null);
    try {
      const res = await fetch("/api/wa/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, text }),
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
              ربط رقم واتساب لإرسال واستقبال الرسائل
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
            ) : (
              <div className="flex flex-col items-center gap-4 py-10 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/[0.04] ring-1 ring-white/10">
                  <QrCode className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  لا يوجد رمز حاليًا. اضغط «بدء الاتصال» لإنشاء رمز جديد.
                </p>
                <Button onClick={handleConnect} disabled={connecting}>
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
