// «لوحة نمو الصالون»: الأنواع والثوابت والحسابات المشتركة بين الواجهة ومسارات الـ API.
// لا يعتمد على أي شي خاص بالسيرفر أو المتصفح — يُستورد من الطرفين.

/* ──────────────────────────── الأنواع (بنفس أعمدة الجداول) ──────────────────────────── */

export type Addon = { name: string; price: number };
export type ApptStatus = "waiting" | "in_progress" | "done";
export type ApptKind = "booking" | "walkin";
export type PlanIcon = "crown" | "gem" | "gift";

export type ClientRow = {
  id: string; name: string; phone: string; favorite_service: string | null;
  last_visit_at: string | null; total_spent: number; visits: number; winback_sent_at: string | null;
};

export type ApptRow = {
  id: string; client_id: string | null; client_name: string; phone: string; service: string; staff: string;
  starts_at: string; duration_minutes: number; price: number; status: ApptStatus; kind: ApptKind;
  addons: Addon[]; started_at: string | null; completed_at: string | null; reminded_at: string | null;
};

export type MembershipRow = {
  id: string; name: string; price: number; period: string; perks: string[]; icon: PlanIcon;
  members: number; active: boolean; sort_order: number;
};

export type TplKey = "reminder" | "followup" | "winback";

export type Settings = {
  salon_name: string;
  booking_link: string;
  discount: number;
  templates: Record<TplKey, string>;
  auto_on: Record<TplKey, boolean>;
  reception: { date: string; checks: Record<string, boolean> };
};

export const SETTING_KEYS = ["salon_name", "booking_link", "discount", "templates", "auto_on", "reception"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export const CLIENT_COLS = "id, name, phone, favorite_service, last_visit_at, total_spent, visits, winback_sent_at";
export const APPT_COLS = "id, client_id, client_name, phone, service, staff, starts_at, duration_minutes, price, status, kind, addons, started_at, completed_at, reminded_at";
export const MEMBERSHIP_COLS = "id, name, price, period, perks, icon, members, active, sort_order";

/* ──────────────────────────── الثوابت ──────────────────────────── */

export const STAFF = ["نوف", "ريم", "هيا", "جود", "لمى"];

export type Category = "صبغات" | "عناية بالشعر" | "أظافر" | "مكياج وبشرة";
export const CATEGORIES: Category[] = ["صبغات", "عناية بالشعر", "أظافر", "مكياج وبشرة"];

export const SERVICES: { name: string; price: number; mins: number; cat: Category }[] = [
  { name: "صبغة كاملة", price: 450, mins: 120, cat: "صبغات" },
  { name: "هايلايت", price: 550, mins: 150, cat: "صبغات" },
  { name: "بروتين / كيراتين", price: 700, mins: 180, cat: "عناية بالشعر" },
  { name: "قص وسشوار", price: 180, mins: 60, cat: "عناية بالشعر" },
  { name: "مناكير وبديكير جل", price: 220, mins: 75, cat: "أظافر" },
  { name: "مكياج سهرة", price: 400, mins: 60, cat: "مكياج وبشرة" },
  { name: "تنظيف بشرة عميق", price: 300, mins: 60, cat: "مكياج وبشرة" },
];

export const ADDONS: Addon[] = [
  { name: "حمام زيت مغذّي", price: 80 },
  { name: "قناع كولاجين للوجه", price: 120 },
  { name: "تنظيف بشرة سريع", price: 150 },
  { name: "رسم وتشذيب الحواجب", price: 50 },
  { name: "بديكير سريع", price: 90 },
  { name: "سيروم لمعان للشعر", price: 60 },
];

export const SLEEP_DAYS = 45;
export const RETENTION_TARGET = 60;

export const TEMPLATE_DEFAULTS: Record<TplKey, string> = {
  reminder:
    "مرحباً {اسم_العميلة} 🌸\nنذكّرك بموعدك غداً لخدمة {اسم_الخدمة} في {اسم_الصالون} الساعة {وقت_الموعد} مع الخبيرة {اسم_الخبيرة}.\nللتأكيد ردّي بـ (1) وللتعديل ردّي بـ (2).\nننتظرك بكل حب 💕",
  followup:
    "أهلاً {اسم_العميلة} 💐\nسعدنا بزيارتك أمس لخدمة {اسم_الخدمة} مع {اسم_الخبيرة}.\nكيف كانت تجربتك؟ قيّميها من ١ إلى ٥ ⭐\nرأيك يهمّنا — وزيارتك القادمة عليها هدية صغيرة منّا 🎁",
  winback:
    "وحشتينا يا {اسم_العميلة} 🤍\nصار لك فترة ما زرتي {اسم_الصالون}، وجهّزنا لك هدية خاصة: خصم {نسبة_الخصم} على {اسم_الخدمة} + مشروب الترحيب المفضّل لك.\nالعرض صالح ٧ أيام فقط — احجزي الآن: {رابط_الحجز}",
};

export const DEFAULT_SETTINGS: Settings = {
  salon_name: "",
  booking_link: "",
  discount: 20,
  templates: TEMPLATE_DEFAULTS,
  auto_on: { reminder: true, followup: true, winback: false },
  reception: { date: "", checks: {} },
};

export const DEFAULT_PLANS: Omit<MembershipRow, "id">[] = [
  { name: "الرصيد الذهبي", price: 2000, period: "رصيد مسبق", icon: "crown", members: 34, active: true, sort_order: 0,
    perks: ["ادفعي ٢٠٠٠ واحصلي على ٢٤٠٠ رصيد", "أولوية في المواعيد", "هدية في يوم الميلاد"] },
  { name: "اشتراك الخدمات الشهري", price: 399, period: "شهرياً", icon: "gem", members: 58, active: true, sort_order: 1,
    perks: ["٤ سشوار + حمام زيت شهرياً", "خصم ١٥٪ على باقي الخدمات", "إلغاء في أي وقت"] },
  { name: "باقة العروس", price: 4500, period: "باقة كاملة", icon: "gift", members: 9, active: true, sort_order: 2,
    perks: ["تجربة مكياج وشعر قبل الزفاف", "جلسات عناية ٣ أشهر", "مكياج وتسريحة يوم الزفاف"] },
];

/* ──────────────────────────── أدوات ──────────────────────────── */

const DAY = 86_400_000;

// 05xxxxxxxx → 9665xxxxxxxx (واتساب يحتاج الرقم الدولي بدون +)
export function intlPhone(raw: string) {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("966")) return d;
  if (d.startsWith("05")) return `966${d.slice(1)}`;
  if (d.startsWith("5") && d.length === 9) return `966${d}`;
  return d;
}
export const isSaudiMobile = (raw: string) => /^9665\d{8}$/.test(intlPhone(raw));

export const addonsTotal = (a: Pick<ApptRow, "addons">) => (a.addons ?? []).reduce((s, o) => s + Number(o.price || 0), 0);
export const invoice = (a: Pick<ApptRow, "price" | "addons">) => Number(a.price || 0) + addonsTotal(a);
export const categoryOf = (service: string): Category | "أخرى" => SERVICES.find((s) => s.name === service)?.cat ?? "أخرى";

export const daysSince = (iso: string | null, now: number) => (iso ? Math.floor((now - Date.parse(iso)) / DAY) : Infinity);
export const isSleeping = (c: ClientRow, now: number) => c.last_visit_at !== null && daysSince(c.last_visit_at, now) > SLEEP_DAYS;
export const winbackSent = (c: ClientRow) =>
  !!c.winback_sent_at && (!c.last_visit_at || Date.parse(c.winback_sent_at) > Date.parse(c.last_visit_at));

export function localDateKey(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** يطبّق انتقال حالة الموعد ويرجع التحديث على العميلة لو اكتمل. نفس المنطق في الواجهة والسيرفر. */
export function applyStatus(a: ApptRow, status: ApptStatus, nowIso: string): ApptRow {
  if (a.status === status) return a;
  return {
    ...a, status,
    started_at: status === "in_progress" ? nowIso : status === "waiting" ? null : a.started_at ?? nowIso,
    completed_at: status === "done" ? nowIso : null,
  };
}
export function clientAfterVisit(c: ClientRow, a: ApptRow, nowIso: string): ClientRow {
  return {
    ...c,
    last_visit_at: !c.last_visit_at || Date.parse(nowIso) > Date.parse(c.last_visit_at) ? nowIso : c.last_visit_at,
    total_spent: Number(c.total_spent || 0) + invoice(a),
    visits: (c.visits || 0) + 1,
    favorite_service: a.service,
  };
}

/* ──────────────────────────── الحسابات ──────────────────────────── */

export type Metrics = {
  monthSales: number; monthChange: number | null;
  aov: number; aovPrev: number | null;
  retention: number | null;
  sleepingCount: number; sleepingSent: number;
  byCategory: { name: string; value: number }[];
  staffUpsell: { name: string; count: number; revenue: number; today: number }[];
  returnRates: { days: number; rate: number | null; sample: number }[];
  upsellToday: number; upsellCountToday: number;
};

export function computeMetrics(clients: ClientRow[], appts: ApptRow[], now: number): Metrics {
  const d = new Date(now);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const prevStart = new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime();
  // نفس الفترة من الشهر الماضي (من أوله إلى نفس اليوم) للمقارنة العادلة
  const prevSameDay = Math.min(prevStart + (now - monthStart), monthStart);
  const todayKey = localDateKey(now);

  const done = appts.filter((a) => a.status === "done");
  const at = (a: ApptRow) => Date.parse(a.starts_at);
  const month = done.filter((a) => at(a) >= monthStart && at(a) <= now);
  const prev = done.filter((a) => at(a) >= prevStart && at(a) < prevSameDay);
  const sum = (xs: ApptRow[]) => xs.reduce((s, a) => s + invoice(a), 0);

  const monthSales = sum(month);
  const prevSales = sum(prev);
  const aov = month.length ? monthSales / month.length : 0;
  const aovPrev = prev.length ? prevSales / prev.length : null;

  const byCat = new Map<string, number>();
  for (const a of month) byCat.set(categoryOf(a.service), (byCat.get(categoryOf(a.service)) ?? 0) + invoice(a));
  const byCategory = [...CATEGORIES, "أخرى"].map((name) => ({ name, value: byCat.get(name) ?? 0 })).filter((x) => x.name !== "أخرى" || x.value > 0);

  const staffNames = Array.from(new Set([...STAFF, ...appts.map((a) => a.staff)]));
  const staffUpsell = staffNames.map((name) => {
    const mine = appts.filter((a) => a.staff === name && at(a) >= monthStart);
    const todayMine = mine.filter((a) => localDateKey(at(a)) === todayKey);
    return {
      name,
      count: mine.reduce((s, a) => s + (a.addons?.length ?? 0), 0),
      revenue: mine.reduce((s, a) => s + addonsTotal(a), 0),
      today: todayMine.reduce((s, a) => s + (a.addons?.length ?? 0), 0),
    };
  }).sort((a, b) => b.revenue - a.revenue);

  // معدل العودة: من زيارات قبل ٩٠–١٨٠ يوماً (نفس العيّنة للفترات الثلاث)، كم وحدة رجعت صاحبتها خلال N يوم؟
  const byPhone = new Map<string, number[]>();
  for (const a of done) {
    const list = byPhone.get(a.phone) ?? [];
    list.push(at(a));
    byPhone.set(a.phone, list);
  }
  byPhone.forEach((l) => l.sort((x, y) => x - y));
  const returnRates = [30, 60, 90].map((days) => {
    let sample = 0, back = 0;
    byPhone.forEach((visits) => {
      visits.forEach((t, i) => {
        if (t > now - 90 * DAY || t < now - 180 * DAY) return;
        sample++;
        const next = visits[i + 1];
        if (next !== undefined && next - t <= days * DAY) back++;
      });
    });
    return { days, rate: sample ? (back / sample) * 100 : null, sample };
  });

  const sleepers = clients.filter((c) => isSleeping(c, now));
  const todayAppts = appts.filter((a) => localDateKey(at(a)) === todayKey);

  return {
    monthSales,
    monthChange: prevSales > 0 ? ((monthSales - prevSales) / prevSales) * 100 : null,
    aov, aovPrev,
    retention: returnRates[2].rate,
    sleepingCount: sleepers.length,
    sleepingSent: sleepers.filter(winbackSent).length,
    byCategory, staffUpsell, returnRates,
    upsellToday: todayAppts.reduce((s, a) => s + addonsTotal(a), 0),
    upsellCountToday: todayAppts.reduce((s, a) => s + (a.addons?.length ?? 0), 0),
  };
}

/* ──────────────────────────── بيانات تجريبية ──────────────────────────── */

// مولّد عشوائي ثابت البذرة — نفس البيانات في كل مرة
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["سارة", "نورة", "ريما", "العنود", "لطيفة", "منيرة", "جواهر", "شهد", "هند", "دانة", "أمل", "رهف", "غادة", "مها", "بسمة", "وعد", "لمى", "رغد", "أريج", "حصة"];
const LAST = ["العتيبي", "القحطاني", "الشهري", "الدوسري", "الحربي", "الزهراني", "المطيري", "الغامدي", "السبيعي", "العنزي", "الشمري", "الجهني", "البقمي", "العمري", "الرشيدي", "الحارثي"];

function uuid(rand: () => number) {
  const h = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");
  return `${h(8)}-${h(4)}-4${h(3)}-${"89ab"[Math.floor(rand() * 4)]}${h(3)}-${h(12)}`;
}

/** بيانات صالون تجريبية واقعية: ~٢٠٠ عميلة وسجل زيارات ~٦ أشهر ومواعيد اليوم. */
export function buildDemoData(now: number, seed = 20261021): { clients: ClientRow[]; appts: ApptRow[]; memberships: MembershipRow[] } {
  const rand = mulberry32(seed);
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
  const iso = (ms: number) => new Date(ms).toISOString();
  const base = Math.floor(now / 60000) * 60000;

  const clients: ClientRow[] = [];
  const appts: ApptRow[] = [];
  const used = new Set<string>();
  while (clients.length < 200) {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    if (used.has(name)) continue;
    used.add(name);
    const phone = `9665${String(Math.floor(rand() * 1e8)).padStart(8, "0")}`;
    clients.push({ id: uuid(rand), name, phone, favorite_service: null, last_visit_at: null, total_spent: 0, visits: 0, winback_sent_at: null });
  }

  const mkAppt = (c: ClientRow, startMs: number, status: ApptStatus, kind: ApptKind = "booking", staff = pick(STAFF)): ApptRow => {
    const s = pick(SERVICES);
    const addons = status === "done" && rand() < 0.38 ? [pick(ADDONS)] : [];
    return {
      id: uuid(rand), client_id: c.id, client_name: c.name, phone: c.phone, service: s.name, staff,
      starts_at: iso(startMs), duration_minutes: s.mins, price: s.price, status, kind, addons,
      started_at: status === "waiting" ? null : iso(startMs), completed_at: status === "done" ? iso(startMs + s.mins * 60000) : null,
      reminded_at: kind === "booking" && status !== "waiting" ? iso(startMs - DAY) : null,
    };
  };

  // السجل: كل عميلة لها إيقاع زيارات، وربعهن تقريباً توقّفن من أكثر من ٤٥ يوماً (النائمات)
  clients.forEach((c) => {
    // أغلبهن منتظمات (كل ٣–٥ أسابيع) والباقي متقطّعات (كل ٥–١٠ أسابيع)
    const cadence = rand() < 0.6 ? 18 + Math.floor(rand() * 20) : 38 + Math.floor(rand() * 30);
    const stopsAt = rand() < 0.18 ? SLEEP_DAYS + 2 + Math.floor(rand() * 90) : 0;
    let daysAgo = 175 - Math.floor(rand() * cadence);
    while (daysAgo > Math.max(stopsAt, 1)) {
      const day = new Date(base - daysAgo * DAY);
      day.setHours(10 + Math.floor(rand() * 10), rand() < 0.5 ? 0 : 30, 0, 0);
      // اتجاه نمو خفيف: الأشهر الأقدم أهدأ قليلاً
      if (rand() > (daysAgo / 175) * 0.45) appts.push(mkAppt(c, day.getTime(), "done"));
      daysAgo -= cadence + Math.floor(rand() * 9) - 4;
    }
  });

  // مواعيد اليوم والحضور المباشر
  const regulars = clients.filter((c) => appts.some((a) => a.client_id === c.id && Date.parse(a.starts_at) > now - 30 * DAY));
  const today: [number, ApptStatus, ApptKind, string][] = [
    [-75, "done", "booking", "ريم"], [-35, "in_progress", "booking", "نوف"], [12, "waiting", "booking", "هيا"],
    [40, "waiting", "booking", "جود"], [95, "waiting", "booking", "نوف"], [150, "waiting", "booking", "لمى"],
    [230, "waiting", "booking", "ريم"], [-8, "waiting", "walkin", "لمى"], [-22, "in_progress", "walkin", "هيا"],
  ];
  today.forEach(([off, status, kind, staff], i) => {
    const a = mkAppt(regulars[i * 3 % regulars.length], base + off * 60000, status, kind, staff);
    a.addons = i === 1 ? [ADDONS[0]] : [];
    appts.push(a);
  });

  // تجميع بيانات العميلات من السجل
  const byClient = new Map<string, ApptRow[]>();
  appts.filter((a) => a.status === "done").forEach((a) => byClient.set(a.client_id!, [...(byClient.get(a.client_id!) ?? []), a]));
  clients.forEach((c) => {
    const visits = (byClient.get(c.id) ?? []).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
    if (!visits.length) return;
    const last = visits[visits.length - 1];
    c.last_visit_at = last.starts_at;
    c.visits = visits.length;
    c.total_spent = visits.reduce((s, a) => s + invoice(a), 0);
    c.favorite_service = last.service;
  });

  const memberships = DEFAULT_PLANS.map((p) => ({ ...p, id: uuid(rand) }));
  return { clients: clients.filter((c) => c.visits > 0 || appts.some((a) => a.client_id === c.id)), appts, memberships };
}
