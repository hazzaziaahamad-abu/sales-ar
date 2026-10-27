// «جدول المهام للمستشارين»: مهام عامة لفريق الصالونات (غير مرتبطة بصالون) — مشتركة بين الواجهة ومسارات الـ API.

import type { Priority } from "@/lib/salon-room";

export type BoardCategory = "competitors" | "ideas" | "content" | "training" | "ops" | "other";
export type BoardStatus = "todo" | "doing" | "review" | "done";

export type BoardStep = { key: string; label: string; done_at: string | null; done_by: string | null };
export type BoardUpdate = { id: string; body: string; author: string | null; at: string };

export type BoardTask = {
  id: string; category: BoardCategory; title: string; body: string; assignee: string | null; priority: Priority;
  status: BoardStatus; due_date: string | null; steps: BoardStep[]; updates: BoardUpdate[]; sort_order: number;
  created_by: string | null; completed_at: string | null; completed_by: string | null; created_at: string; updated_at: string;
};

export const BOARD_COLS = "id, category, title, body, assignee, priority, status, due_date, steps, updates, sort_order, created_by, completed_at, completed_by, created_at, updated_at";

/** التصنيفات — لكل تصنيف لون ورقة وخطوات افتراضية تنسخ للمهمة الجديدة. */
export const BOARD_CATEGORIES: { id: BoardCategory; label: string; emoji: string; paper: string; ink: string; pin: string; steps: string[] }[] = [
  {
    id: "competitors", label: "متابعة المنافسين", emoji: "🔭", paper: "#fef08a", ink: "#713f12", pin: "#f97316",
    steps: ["تحديد المنافسين وجمع بياناتهم", "رصد الأسعار والعروض والباقات", "مقارنتهم بخدماتنا", "توصيات وقرار"],
  },
  {
    id: "ideas", label: "تقييم فكرة جديدة", emoji: "💡", paper: "#a7f3d0", ink: "#064e3b", pin: "#0d9488",
    steps: ["وصف الفكرة والمشكلة اللي تحلها", "تقييم الأثر والجهد والتكلفة", "تجربة مصغّرة مع صالون", "القرار: نعتمد / نعدّل / نلغي"],
  },
  {
    id: "content", label: "محتوى وتسويق", emoji: "📣", paper: "#fbcfe8", ink: "#831843", pin: "#e11d48",
    steps: ["الفكرة والرسالة", "كتابة المحتوى وتصميمه", "المراجعة والاعتماد", "النشر وقياس التفاعل"],
  },
  {
    id: "training", label: "تدريب وتطوير", emoji: "🎓", paper: "#bfdbfe", ink: "#1e3a8a", pin: "#2563eb",
    steps: ["تحديد الاحتياج", "تجهيز المادة", "تنفيذ التدريب", "تقييم الأثر"],
  },
  {
    id: "ops", label: "تشغيل وتحسين", emoji: "⚙️", paper: "#fed7aa", ink: "#7c2d12", pin: "#ea580c",
    steps: ["تحديد المشكلة", "اقتراح الحل", "التطبيق", "المتابعة والتأكد"],
  },
  {
    id: "other", label: "أخرى", emoji: "📌", paper: "#e9d5ff", ink: "#581c87", pin: "#9333ea",
    steps: [],
  },
];
export const BOARD_CATEGORY_IDS = BOARD_CATEGORIES.map((c) => c.id);
export const boardCategory = (id: string) => BOARD_CATEGORIES.find((c) => c.id === id) ?? BOARD_CATEGORIES[BOARD_CATEGORIES.length - 1];

export const BOARD_STATUSES: { id: BoardStatus; label: string; color: string }[] = [
  { id: "todo", label: "جديدة", color: "#7A6570" },
  { id: "doing", label: "قيد التنفيذ", color: "#2563EB" },
  { id: "review", label: "بانتظار المراجعة", color: "#D9A21B" },
  { id: "done", label: "منجزة", color: "#059669" },
];
export const BOARD_STATUS_IDS = BOARD_STATUSES.map((s) => s.id);
export const boardStatus = (id: string) => BOARD_STATUSES.find((s) => s.id === id) ?? BOARD_STATUSES[0];

export const stepsFor = (category: BoardCategory): BoardStep[] =>
  boardCategory(category).steps.map((label, i) => ({ key: `s${i + 1}`, label, done_at: null, done_by: null }));

/** نسبة التقدّم: من الخطوات، ولو ما فيه خطوات فمن الحالة. */
export function boardProgress(t: Pick<BoardTask, "steps" | "status">) {
  if (t.status === "done") return 1;
  if (!t.steps.length) return t.status === "review" ? 0.8 : t.status === "doing" ? 0.4 : 0;
  return t.steps.filter((s) => s.done_at).length / t.steps.length;
}
