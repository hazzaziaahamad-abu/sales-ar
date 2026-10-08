// «البذور» — أفكار شخصية تكبر من بذرة إلى ثمرة.

export type IdeaStage = "seed" | "sprout" | "tree" | "fruit";

export const IDEA_STAGES: IdeaStage[] = ["seed", "sprout", "tree", "fruit"];

export const STAGE_META: Record<IdeaStage, { icon: string; label: string; hint: string; tone: string; ring: string }> = {
  seed: { icon: "🌰", label: "بذرة", hint: "فكرة خام رميتها", tone: "text-amber-300", ring: "border-amber-500/25 bg-amber-500/[0.05]" },
  sprout: { icon: "🌱", label: "برعم", hint: "رجعت لها وفكرت فيها", tone: "text-lime-300", ring: "border-lime-500/25 bg-lime-500/[0.05]" },
  tree: { icon: "🌳", label: "شجرة", hint: "صار لها خطة تنفيذ", tone: "text-emerald-300", ring: "border-emerald-500/25 bg-emerald-500/[0.05]" },
  fruit: { icon: "🍎", label: "ثمرة", hint: "تنفّذت", tone: "text-rose-300", ring: "border-rose-500/25 bg-rose-500/[0.05]" },
};

export interface PlanStep {
  text: string;
  done: boolean;
}

export interface Idea {
  id: string;
  text: string;
  notes: string | null;
  stage: IdeaStage;
  plan: PlanStep[];
  touches: number;
  last_touched_at: string;
  wilted_at: string | null;
  created_at: string;
}

/** حرارة الفكرة 0–100: تزيد كل ما رجعت لها، وتبرد مع الأيام اللي تهملها فيها. */
export function ideaWarmth(idea: Pick<Idea, "touches" | "last_touched_at">, now = Date.now()): number {
  const days = Math.max(0, (now - new Date(idea.last_touched_at).getTime()) / 86_400_000);
  return Math.round(Math.max(0, Math.min(100, 45 + idea.touches * 12 - days * 5)));
}

export function warmthLabel(w: number): { icon: string; label: string; tone: string } {
  if (w >= 70) return { icon: "🔥", label: "حارّة", tone: "text-orange-400" };
  if (w >= 35) return { icon: "☀️", label: "دافئة", tone: "text-yellow-300" };
  return { icon: "❄️", label: "باردة", tone: "text-sky-300" };
}

/** ينظّف خطوات الخطة القادمة من العميل أو من الذكاء الاصطناعي. */
export function sanitizePlan(raw: unknown): PlanStep[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((s) => (typeof s === "string" ? { text: s, done: false } : s))
    .filter((s): s is { text: unknown; done?: unknown } => !!s && typeof s === "object")
    .map((s) => ({ text: String(s.text ?? "").trim().slice(0, 300), done: s.done === true }))
    .filter((s) => s.text)
    .slice(0, 30);
}

/** «البذور» متاحة للمدير (السوبر أدمن) ومنال فقط — منال تُطابق بالاسم الأول مثل باقي المتابعة اليومية. */
// اسمها في النظام بالإنجليزي «Manal»، فنقبل الاسمين
const IDEAS_MEMBERS = ["منال", "manal"];
export function canUseIdeas(user: { name?: string | null; isSuperAdmin?: boolean | null } | null | undefined): boolean {
  if (!user) return false;
  if (user.isSuperAdmin) return true;
  return IDEAS_MEMBERS.includes((user.name ?? "").trim().split(/\s+/)[0].toLowerCase());
}
