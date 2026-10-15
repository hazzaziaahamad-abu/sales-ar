"use client";

// إشعارات الجوال من طرف المتصفح: تسجيل الـService Worker والاشتراك/الإلغاء.

export type PushState = "unsupported" | "needs-install" | "denied" | "off" | "on";

const urlB64ToUint8Array = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent);
export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try { return await navigator.serviceWorker.register("/sw.js", { scope: "/" }); } catch { return null; }
}

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  // آيفون: الإشعارات تشتغل بس لو التطبيق مثبّت على الشاشة الرئيسية
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

/** يطلب الإذن ويشترك ويحفظ الاشتراك في السيرفر (لازم يكون من ضغطة المستخدم). */
export async function enablePush(): Promise<PushState> {
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return perm === "denied" ? "denied" : "off";
  const reg = await registerSW();
  if (!reg) throw new Error("المتصفح ما يدعم الإشعارات");
  await navigator.serviceWorker.ready;
  const res = await fetch("/api/push/subscribe", { cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "تعذّر تجهيز الإشعارات");
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToUint8Array(json.publicKey) });
  }
  const save = await fetch("/api/push/subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }),
  });
  if (!save.ok) throw new Error((await save.json().catch(() => ({}))).error || "تعذّر حفظ الاشتراك");
  return "on";
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {});
    await sub.unsubscribe().catch(() => {});
  }
  return "off";
}

/** يجدد الاشتراك بصمت عند فتح التطبيق (لو المتصفح بدّل المفاتيح) — بدون طلب إذن. */
export async function refreshPushSubscription() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const reg = await registerSW();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await fetch("/api/push/subscribe", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }),
  }).catch(() => {});
}

/** جدولة إشعار لوقت محدد (مثل انتهاء جلسة التركيز) — null يلغيه. */
export function schedulePush(tag: "focus", sendAt: number | null, msg?: { title: string; body?: string; url?: string }) {
  fetch("/api/push/queue", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sendAt === null ? { tag, send_at: null } : { tag, send_at: new Date(sendAt).toISOString(), ...msg }),
    keepalive: true,
  }).catch(() => {});
}
