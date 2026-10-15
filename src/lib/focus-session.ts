"use client";

// «وضع التركيز» — جلسة واحدة نشطة محفوظة في المتصفح (تصمد أمام التحديث والتنقل بين الصفحات).
// أثناء الجلسة تتأجل التذكيرات والإشعارات (FocusGate) وترجع بعد انتهائها.

import { useSyncExternalStore } from "react";
import type { SliceKind, SliceSpace } from "@/lib/focus-slices";

export interface FocusSession {
  sliceId: string;
  title: string;
  parent: string;
  kind: SliceKind;
  space: SliceSpace;
  /** مدة الجلسة المخططة بالدقائق. */
  minutes: number;
  startedAt: number;
  /** وقت الإيقاف المؤقت الحالي (null = شغّالة) ومجموع دقائق الإيقاف السابقة بالملّي ثانية. */
  pausedAt: number | null;
  pausedMs: number;
}

/** المدة الافتراضية: ٩٠ د للعميقة و١٥ د للسطحية. */
export const DEFAULT_MINUTES: Record<SliceKind, number> = { deep: 90, shallow: 15 };
export const MINUTE_PRESETS = [15, 25, 45, 60, 90, 120];

const KEY = "cc_focus_session";
const EVENT = "cc-focus-change";
/** يُطلق بعد تعديل شريحة من وضع التركيز — قوائم الشرائح تعيد التحميل. */
export const SLICES_CHANGED_EVENT = "cc-focus-slices-changed";

let cachedRaw: string | null | undefined;
let cached: FocusSession | null = null;

function read(): FocusSession | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* ignore */ }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try { cached = raw ? (JSON.parse(raw) as FocusSession) : null; } catch { cached = null; }
  return cached;
}

function write(s: FocusSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

export const getFocusSession = () => (typeof window === "undefined" ? null : read());
export const isFocusActive = () => !!getFocusSession();

export function startFocus(s: Omit<FocusSession, "startedAt" | "pausedAt" | "pausedMs">) {
  write({ ...s, startedAt: Date.now(), pausedAt: null, pausedMs: 0 });
}
export function updateFocus(patch: Partial<FocusSession>) {
  const cur = read();
  if (cur) write({ ...cur, ...patch });
}
export function endFocus() {
  write(null);
}

/** الوقت المنقضي فعلياً (بدون فترات الإيقاف) بالملّي ثانية. */
export function elapsedMs(s: FocusSession, now = Date.now()) {
  const pausedNow = s.pausedAt ? now - s.pausedAt : 0;
  return Math.max(0, now - s.startedAt - s.pausedMs - pausedNow);
}

function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb(); };
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", onStorage);
  };
}

export function useFocusSession(): FocusSession | null {
  return useSyncExternalStore(subscribe, getFocusSession, () => null);
}
export const useFocusActive = () => !!useFocusSession();
