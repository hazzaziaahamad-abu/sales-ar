export function formatMoney(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M ر.س`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(0)}K ر.س`;
  }
  return `${value.toLocaleString()} ر.س`;
}

export function formatMoneyFull(value: number): string {
  return `${value.toLocaleString("en-US")} ر.س`;
}

export function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  const s = new Date(d.getTime() + SAUDI_OFFSET_MS);
  return `${s.getUTCDate().toString().padStart(2, "0")}/${(s.getUTCMonth() + 1).toString().padStart(2, "0")}/${s.getUTCFullYear()}`;
}

// ─── Saudi Arabia Timezone (UTC+3) — single source of truth ───
const SAUDI_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Returns a Date shifted to Saudi time (UTC+3). Use for display & comparisons. */
export function saudiNow(date?: Date): Date {
  const d = date ?? new Date();
  return new Date(d.getTime() + SAUDI_OFFSET_MS);
}

/** Current Saudi hour (0-23). */
export function saudiHour(date?: Date): number {
  const d = date ?? new Date();
  return (d.getUTCHours() + 3) % 24;
}

/** YYYY-MM-DD in Saudi time. */
export function saudiDateStr(date?: Date): string {
  const d = date ?? new Date();
  const s = new Date(d.getTime() + SAUDI_OFFSET_MS);
  const y = s.getUTCFullYear();
  const m = String(s.getUTCMonth() + 1).padStart(2, "0");
  const day = String(s.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Full ISO timestamp anchored to Saudi wall-clock time. Use when storing close_date / payment_date. */
export function saudiTimestamp(): string {
  return new Date().toISOString();
}

/** Converts a date-only string (YYYY-MM-DD) to a full ISO timestamp using current Saudi time-of-day. */
export function dateToTimestamp(dateStr: string): string {
  const now = new Date();
  const h = String((now.getUTCHours() + 3) % 24).padStart(2, "0");
  const m = String(now.getUTCMinutes()).padStart(2, "0");
  const s = String(now.getUTCSeconds()).padStart(2, "0");
  return new Date(`${dateStr}T${h}:${m}:${s}+03:00`).toISOString();
}

/** Returns a YYYY-MM-DD string in Saudi time. Replaces dateToLocal for Saudi usage. */
export function dateToLocal(date: Date): string {
  const s = new Date(date.getTime() + SAUDI_OFFSET_MS);
  const y = s.getUTCFullYear();
  const m = String(s.getUTCMonth() + 1).padStart(2, "0");
  const d = String(s.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's date as YYYY-MM-DD in Saudi time. */
export function todayLocal(): string {
  return saudiDateStr();
}

/** Returns [from, to] YYYY-MM-DD bounds for a quick date filter (Saudi time). Null if filter is inactive. */
export function tableDateBounds(
  filter: string,
  customFrom?: string,
  customTo?: string,
): [string, string] | null {
  const today = todayLocal();
  const [y, mo, d] = today.split("-").map(Number);
  const p = (n: number) => String(n).padStart(2, "0");

  if (filter === "اليوم") return [today, today];

  if (filter === "أمس") {
    const prev = new Date(y, mo - 1, d - 1);
    const s = `${prev.getFullYear()}-${p(prev.getMonth() + 1)}-${p(prev.getDate())}`;
    return [s, s];
  }

  if (filter === "الأسبوع") {
    const start = new Date(y, mo - 1, d - 6);
    return [`${start.getFullYear()}-${p(start.getMonth() + 1)}-${p(start.getDate())}`, today];
  }

  if (filter === "الشهر") return [`${y}-${p(mo)}-01`, today];

  if (filter === "الشهر الماضي") {
    const first = new Date(y, mo - 2, 1);
    const lmY = first.getFullYear();
    const lmM = first.getMonth() + 1;
    const lastDay = new Date(lmY, lmM, 0).getDate();
    return [`${lmY}-${p(lmM)}-01`, `${lmY}-${p(lmM)}-${p(lastDay)}`];
  }

  if (filter === "مخصص" && customFrom && customTo) return [customFrom, customTo];
  return null;
}

export function formatPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10 && cleaned.startsWith("05")) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}
