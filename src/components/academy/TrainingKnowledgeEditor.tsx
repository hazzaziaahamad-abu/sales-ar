"use client";

import { useState, useEffect } from "react";
import { fetchTrainingKnowledge, upsertTrainingKnowledge } from "@/lib/supabase/db";
import type { TrainingKnowledge } from "@/types";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowRight,
  Save,
  BookOpen,
  BrainCircuit,
  MessageSquareText,
  Settings2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

/* ── Topic definitions (mirror of TrainingSession.tsx TOPICS) ── */
const TOPIC_OPTIONS = [
  { key: "closing", title: "إغلاق الصفقات" },
  { key: "objections", title: "التعامل مع الاعتراضات" },
  { key: "discovery", title: "اكتشاف احتياجات العميل" },
  { key: "angry_customer", title: "التعامل مع عميل غاضب" },
  { key: "presentation", title: "تقديم العروض" },
  { key: "negotiation", title: "التفاوض" },
  { key: "renewal_no_use", title: "تجديد — عدم استخدام" },
  { key: "renewal_competitor", title: "تجديد — منافس" },
  { key: "renewal_management", title: "تجديد — تغيير إداري" },
  { key: "upsell", title: "ترقية الباقة" },
  { key: "cold_call", title: "مكالمات باردة" },
  { key: "followup", title: "المتابعة" },
  { key: "discounts", title: "الخصومات" },
  { key: "cashier_pos", title: "نظام الكاشير (POS)" },
  { key: "_product_knowledge", title: "المعرفة العامة بالمنتج" },
  { key: "_system_wrapper", title: "قواعد سلوك المدرب AI" },
];

interface Props {
  onBack: () => void;
}

export function TrainingKnowledgeEditor({ onBack }: Props) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [allKnowledge, setAllKnowledge] = useState<TrainingKnowledge[]>([]);

  const [selectedTopic, setSelectedTopic] = useState<string>("_product_knowledge");

  /* Form fields */
  const [topicPrompt, setTopicPrompt] = useState("");
  const [productKnowledge, setProductKnowledge] = useState("");
  const [systemWrapper, setSystemWrapper] = useState("");

  useEffect(() => {
    setLoading(true);
    fetchTrainingKnowledge()
      .then((data) => setAllKnowledge(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  /* Load form when topic changes */
  useEffect(() => {
    const existing = allKnowledge.find((k) => k.topic_key === selectedTopic);
    if (existing) {
      setTopicPrompt(existing.topic_prompt || "");
      setProductKnowledge(existing.product_knowledge || "");
      setSystemWrapper(existing.system_wrapper || "");
    } else {
      setTopicPrompt("");
      setProductKnowledge("");
      setSystemWrapper("");
    }
    setSaved(false);
    setError("");
  }, [selectedTopic, allKnowledge]);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const topicMeta = TOPIC_OPTIONS.find((t) => t.key === selectedTopic);
      const result = await upsertTrainingKnowledge(selectedTopic, {
        topic_title: topicMeta?.title || selectedTopic,
        topic_prompt: topicPrompt,
        product_knowledge: productKnowledge,
        system_wrapper: systemWrapper,
        updated_by: user?.name || user?.email || "مستخدم",
      });
      setAllKnowledge((prev) => {
        const idx = prev.findIndex((k) => k.topic_key === selectedTopic);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = result;
          return updated;
        }
        return [...prev, result];
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
      setError("حدث خطأ أثناء الحفظ");
    } finally {
      setSaving(false);
    }
  }

  const isSpecialTopic = selectedTopic.startsWith("_");
  const existingEntry = allKnowledge.find((k) => k.topic_key === selectedTopic);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber/10 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-amber" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">تحرير قاعدة المعرفة التدريبية</h1>
            <p className="text-xs text-muted-foreground">حدّث محتوى الجلسات التدريبية بدون تدخل مطوّر</p>
          </div>
        </div>
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
      </div>

      {/* Topic Selector */}
      <div className="cc-card rounded-[14px] p-4">
        <Label className="text-sm font-bold text-foreground mb-3 block">اختر الموضوع</Label>
        <div className="flex flex-wrap gap-2">
          {TOPIC_OPTIONS.map((topic) => {
            const isActive = selectedTopic === topic.key;
            const isGlobal = topic.key.startsWith("_");
            const hasContent = allKnowledge.some((k) => k.topic_key === topic.key);
            return (
              <button
                key={topic.key}
                onClick={() => setSelectedTopic(topic.key)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition-all border ${
                  isActive
                    ? isGlobal
                      ? "bg-amber/15 text-amber border-amber/30"
                      : "bg-cyan/15 text-cyan border-cyan/30"
                    : "text-muted-foreground hover:text-foreground border-border hover:border-white/20"
                } ${hasContent ? "ring-1 ring-emerald-500/20" : ""}`}
              >
                {topic.title}
                {hasContent && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5" />}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Guidance card */}
          <div className="cc-card rounded-[14px] p-4 border border-amber/10 bg-gradient-to-l from-amber/5 to-transparent">
            <div className="flex items-start gap-3">
              <Settings2 className="w-5 h-5 text-amber shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-bold text-foreground mb-1">
                  {isSpecialTopic
                    ? selectedTopic === "_product_knowledge"
                      ? "المعرفة العامة بالمنتج"
                      : "قواعد سلوك المدرب AI"
                    : `إعدادات موضوع: ${TOPIC_OPTIONS.find((t) => t.key === selectedTopic)?.title}`}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isSpecialTopic
                    ? selectedTopic === "_product_knowledge"
                      ? "هذا المحتوى يُضاف تلقائياً لكل الجلسات التدريبية — يحتوي على معلومات المنتج والباقات والأسعار."
                      : "هذه القواعد تتحكم بسلوك المدرب AI في كل الجلسات — مثل اللهجة وطريقة التقييم."
                    : "يمكنك تعديل سيناريو التدريب الخاص بهذا الموضوع. إذا تركته فارغاً سيُستخدم المحتوى الافتراضي."}
                </p>
              </div>
            </div>
          </div>

          {/* Fields */}
          {isSpecialTopic ? (
            /* Global fields: product_knowledge or system_wrapper */
            <div className="cc-card rounded-[14px] p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                {selectedTopic === "_product_knowledge" ? (
                  <BookOpen className="w-4 h-4 text-amber" />
                ) : (
                  <MessageSquareText className="w-4 h-4 text-amber" />
                )}
                <Label className="text-sm font-bold">
                  {selectedTopic === "_product_knowledge" ? "معلومات المنتج" : "قواعد المدرب"}
                </Label>
              </div>
              <Textarea
                value={selectedTopic === "_product_knowledge" ? productKnowledge : systemWrapper}
                onChange={(e) =>
                  selectedTopic === "_product_knowledge"
                    ? setProductKnowledge(e.target.value)
                    : setSystemWrapper(e.target.value)
                }
                placeholder={
                  selectedTopic === "_product_knowledge"
                    ? "أدخل معلومات المنتج هنا... (الباقات، الأسعار، المميزات، إلخ)"
                    : "أدخل قواعد سلوك المدرب AI... (اللهجة، أسلوب التقييم، إلخ)"
                }
                rows={16}
                className="font-mono text-xs leading-relaxed"
                dir="rtl"
              />
              <p className="text-[10px] text-muted-foreground">
                {selectedTopic === "_product_knowledge"
                  ? "هذا النص يُضاف لكل جلسة تدريبية. يمكنك استخدام Markdown."
                  : "هذه القواعد تُلحق بنهاية كل سيناريو تدريبي."}
              </p>
            </div>
          ) : (
            /* Topic-specific prompt */
            <div className="cc-card rounded-[14px] p-5 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquareText className="w-4 h-4 text-cyan" />
                <Label className="text-sm font-bold">سيناريو التدريب (Prompt)</Label>
              </div>
              <Textarea
                value={topicPrompt}
                onChange={(e) => setTopicPrompt(e.target.value)}
                placeholder="أدخل سيناريو التدريب لهذا الموضوع... (دور العميل، طريقة التفاعل، نقاط التقييم)"
                rows={16}
                className="font-mono text-xs leading-relaxed"
                dir="rtl"
              />
              <p className="text-[10px] text-muted-foreground">
                هذا النص يحدد شخصية وسلوك العميل الافتراضي في هذا الموضوع. إذا تركته فارغاً سيُستخدم المحتوى الافتراضي المبرمج مسبقاً.
              </p>
            </div>
          )}

          {/* Save button + status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {saved && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-400">
                  <CheckCircle2 className="w-4 h-4" />
                  تم الحفظ بنجاح
                </span>
              )}
              {error && (
                <span className="flex items-center gap-1.5 text-sm text-red-400">
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </span>
              )}
              {existingEntry?.updated_by && (
                <span className="text-[10px] text-muted-foreground">
                  آخر تعديل: {existingEntry.updated_by} — {new Date(existingEntry.updated_at).toLocaleDateString("ar-SA")}
                </span>
              )}
            </div>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5 bg-cyan hover:bg-cyan/80 text-background">
              <Save className="w-4 h-4" />
              {saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
