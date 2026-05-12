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
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

/** Returns a YYYY-MM-DD string for the given Date in **local time** (not UTC).
 *  Use this instead of `.toISOString().slice(0, 10)` whenever you need the
 *  user's calendar date — UTC slicing flips 1 day backward for users in
 *  positive-offset timezones (e.g. Saudi Arabia) during the first hours
 *  of a new day, which corrupts month/year reporting. */
export function dateToLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Today's date as YYYY-MM-DD in **local time**. Shorthand for dateToLocal(new Date()). */
export function todayLocal(): string {
  return dateToLocal(new Date());
}

export function formatPhone(phone: string): string {
  if (!phone) return "";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10 && cleaned.startsWith("05")) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}
