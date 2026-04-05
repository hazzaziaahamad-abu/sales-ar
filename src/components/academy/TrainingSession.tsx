"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState } from "react";
import {
  GraduationCap,
  Send,
  RotateCcw,
  ArrowRight,
  Bot,
  Target,
  ShieldAlert,
  Search,
  Flame,
  Presentation,
  HandCoins,
  Loader2,
  Ban,
  TrendingUp,
  Phone,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TOPICS = [
  {
    key: "closing",
    title: "إغلاق الصفقات",
    desc: "تعلّم تقنيات إغلاق الصفقات بفعالية",
    icon: Target,
    color: "text-cyan",
    bg: "bg-cyan/10 border-cyan/20 hover:bg-cyan/15",
    gradient: "from-cyan/20 to-cyan/5",
  },
  {
    key: "objections",
    title: "التعامل مع الاعتراضات",
    desc: "تدرّب على الرد على اعتراضات العملاء",
    icon: ShieldAlert,
    color: "text-amber",
    bg: "bg-amber/10 border-amber/20 hover:bg-amber/15",
    gradient: "from-amber/20 to-amber/5",
  },
  {
    key: "discovery",
    title: "اكتشاف احتياجات العميل",
    desc: "أتقن فن طرح الأسئلة الذكية",
    icon: Search,
    color: "text-cc-green",
    bg: "bg-cc-green/10 border-cc-green/20 hover:bg-cc-green/15",
    gradient: "from-cc-green/20 to-cc-green/5",
  },
  {
    key: "angry_customer",
    title: "التعامل مع عميل غاضب",
    desc: "تعلّم كيف تهدّئ العميل وتكسبه",
    icon: Flame,
    color: "text-cc-red",
    bg: "bg-cc-red/10 border-cc-red/20 hover:bg-cc-red/15",
    gradient: "from-cc-red/20 to-cc-red/5",
  },
  {
    key: "presentation",
    title: "عرض المنتج باحترافية",
    desc: "قدّم عرضاً يقنع العميل من أول دقيقة",
    icon: Presentation,
    color: "text-cc-purple",
    bg: "bg-cc-purple/10 border-cc-purple/20 hover:bg-cc-purple/15",
    gradient: "from-cc-purple/20 to-cc-purple/5",
  },
  {
    key: "negotiation",
    title: "التفاوض على السعر",
    desc: "دافع عن القيمة بدون خسارة العميل",
    icon: HandCoins,
    color: "text-cc-blue",
    bg: "bg-cc-blue/10 border-cc-blue/20 hover:bg-cc-blue/15",
    gradient: "from-cc-blue/20 to-cc-blue/5",
  },
  {
    key: "renewal_no_use",
    title: "تجديد: عميل لم يستخدم المنتج",
    desc: "أقنع عميل يرفض التجديد لأنه ما استفاد",
    icon: RotateCcw,
    color: "text-orange-400",
    bg: "bg-orange-400/10 border-orange-400/20 hover:bg-orange-400/15",
    gradient: "from-orange-400/20 to-orange-400/5",
  },
  {
    key: "renewal_competitor",
    title: "تجديد: عميل تحوّل لمنافس",
    desc: "استرجع عميل قرر الانتقال لمنافس",
    icon: ShieldAlert,
    color: "text-rose-400",
    bg: "bg-rose-400/10 border-rose-400/20 hover:bg-rose-400/15",
    gradient: "from-rose-400/20 to-rose-400/5",
  },
  {
    key: "renewal_management",
    title: "تجديد: الإدارة رفضت",
    desc: "تعامل مع عميل يقول إدارته رفضت التجديد",
    icon: Ban,
    color: "text-slate-400",
    bg: "bg-slate-400/10 border-slate-400/20 hover:bg-slate-400/15",
    gradient: "from-slate-400/20 to-slate-400/5",
  },
  {
    key: "upsell",
    title: "ترقية العميل لباقة أعلى",
    desc: "اقنع العميل بالترقية بدون ضغط",
    icon: TrendingUp,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10 border-emerald-400/20 hover:bg-emerald-400/15",
    gradient: "from-emerald-400/20 to-emerald-400/5",
  },
  {
    key: "cold_call",
    title: "أول اتصال بارد",
    desc: "اكسر الجليد مع عميل محتمل غير مهتم",
    icon: Phone,
    color: "text-sky-400",
    bg: "bg-sky-400/10 border-sky-400/20 hover:bg-sky-400/15",
    gradient: "from-sky-400/20 to-sky-400/5",
  },
  {
    key: "followup",
    title: "متابعة عميل صامت",
    desc: "أعد إحياء محادثة مع عميل توقف عن الرد",
    icon: MessageCircle,
    color: "text-violet-400",
    bg: "bg-violet-400/10 border-violet-400/20 hover:bg-violet-400/15",
    gradient: "from-violet-400/20 to-violet-400/5",
  },
];

function formatMessage(text: string) {
  // Simple markdown rendering for training messages
  return text
    .replace(/\[✅ ([^\]]+)\]/g, '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px] font-medium my-1">✅ $1</span>')
    .replace(/\[📝 ([^\]]+)\]/g, '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan/10 border border-cyan/20 text-cyan text-[11px] font-medium my-1">📝 $1</span>')
    .replace(/\[💡 ([^\]]+)\]/g, '<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber/10 border border-amber/20 text-amber text-[11px] font-medium my-1">💡 $1</span>')
    .replace(/## 📋 تقييم الجلسة التدريبية/g, '<div class="mt-3 mb-2 px-3 py-2 rounded-lg bg-gradient-to-l from-cyan/10 to-cc-purple/10 border border-cyan/20"><span class="text-sm font-bold text-cyan">📋 تقييم الجلسة التدريبية</span></div>')
    .replace(/## (.+)/g, '<h3 class="text-sm font-bold text-foreground mt-3 mb-1">$1</h3>')
    .replace(/### (.+)/g, '<h4 class="text-xs font-bold text-foreground/80 mt-2 mb-1">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>')
    .replace(/\n- /g, '\n<span class="text-cyan/70 mr-1">•</span> ')
    .replace(/\n(\d+)\. /g, '\n<span class="text-cyan/70 font-bold mr-1">$1.</span> ')
    .replace(/\n/g, "<br/>");
}

interface TrainingSessionProps {
  onBack: () => void;
}

export function TrainingSession({ onBack }: TrainingSessionProps) {
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { messages, sendMessage, status, setMessages } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/ai/training-session",
      body: { topic: selectedTopic },
    }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (selectedTopic) inputRef.current?.focus();
  }, [selectedTopic]);

  const getMessageText = (msg: typeof messages[number]): string => {
    if ("content" in msg && typeof msg.content === "string") return msg.content;
    return (
      msg.parts
        ?.filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("") || ""
    );
  };

  const submitMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    setInput("");
    await sendMessage({ text: text.trim() });
  };

  const startSession = (topicKey: string) => {
    setSelectedTopic(topicKey);
    setMessages([]);
    const topic = TOPICS.find((t) => t.key === topicKey);
    setTimeout(() => {
      sendMessage({
        text: `مرحباً، أنا مندوب مبيعات في RESTAVO. أبي أتدرب على "${topic?.title}". ابدأ الجلسة.`,
      });
    }, 100);
  };

  const resetSession = () => {
    setSelectedTopic(null);
    setMessages([]);
    setInput("");
  };

  const topicInfo = TOPICS.find((t) => t.key === selectedTopic);

  // ── Topic Selection Screen ──
  if (!selectedTopic) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan/20 to-cc-purple/20 flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-cyan" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">جلسة تدريبية</h2>
              <p className="text-xs text-muted-foreground">اختر موضوع التدريب وابدأ محادثة تفاعلية مع المدرب الذكي</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack} className="text-xs text-muted-foreground gap-1">
            <ArrowRight className="w-3.5 h-3.5" />
            رجوع للأكاديمية
          </Button>
        </div>

        {/* How it works */}
        <div className="cc-card rounded-[14px] p-5 border border-cyan/10 bg-gradient-to-l from-cyan/[0.03] to-transparent">
          <h3 className="text-sm font-bold text-foreground mb-3">كيف تعمل الجلسة؟</h3>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            {[
              { step: "1", text: "اختر موضوع التدريب", icon: "🎯" },
              { step: "2", text: "المدرب يلعب دور العميل", icon: "🎭" },
              { step: "3", text: "تتفاعل كأنه موقف حقيقي", icon: "💬" },
              { step: "4", text: "تحصل على تقييم وملاحظات", icon: "📋" },
            ].map((s) => (
              <div key={s.step} className="flex items-center gap-2.5 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <span className="text-lg">{s.icon}</span>
                <div>
                  <span className="text-[10px] text-cyan font-bold">خطوة {s.step}</span>
                  <p className="text-xs text-foreground">{s.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Topics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <button
                key={topic.key}
                onClick={() => startSession(topic.key)}
                className={cn(
                  "flex items-start gap-3.5 p-4 rounded-[14px] border text-right transition-all hover:scale-[1.02]",
                  topic.bg
                )}
              >
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br shrink-0", topic.gradient)}>
                  <Icon className={cn("w-5 h-5", topic.color)} />
                </div>
                <div>
                  <p className={cn("text-sm font-bold", topic.color)}>{topic.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{topic.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Chat Session Screen ──
  return (
    <div className="flex flex-col cc-card rounded-xl overflow-hidden" style={{ height: "calc(100vh - 7rem)" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br", topicInfo?.gradient)}>
            {topicInfo && <topicInfo.icon className={cn("w-5 h-5", topicInfo.color)} />}
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">جلسة تدريبية: {topicInfo?.title}</h3>
            <p className="text-[10px] text-muted-foreground">مدرب ذكي — تفاعل كأنك مع عميل حقيقي</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={resetSession} className="text-xs text-muted-foreground gap-1.5">
            <RotateCcw className="w-3 h-3" />
            موضوع آخر
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-5" ref={scrollRef}>
        <div className="space-y-4 py-5">
          {messages.map((msg) => {
            const text = getMessageText(msg);
            if (!text) return null;
            return (
              <div key={msg.id} className="flex gap-3">
                <div
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5",
                    msg.role === "user"
                      ? "bg-cyan/15"
                      : `bg-gradient-to-br ${topicInfo?.gradient || "from-cyan/20 to-cc-purple/20"}`
                  )}
                >
                  {msg.role === "user" ? (
                    <span className="text-xs font-bold text-cyan">أنت</span>
                  ) : (
                    <Bot className={cn("w-4 h-4", topicInfo?.color || "text-cyan")} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-foreground">
                      {msg.role === "user" ? "أنت (المندوب)" : "المدرب (العميل)"}
                    </span>
                  </div>
                  {msg.role === "user" ? (
                    <p className="text-sm text-foreground/90 leading-relaxed">{text}</p>
                  ) : (
                    <div
                      className="text-sm text-foreground/90 leading-relaxed prose-sm"
                      dangerouslySetInnerHTML={{ __html: formatMessage(text) }}
                    />
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading indicator */}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br", topicInfo?.gradient)}>
                <Bot className={cn("w-4 h-4", topicInfo?.color)} />
              </div>
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/[0.03]">
                <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
                <span className="text-xs text-muted-foreground">المدرب يكتب...</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitMessage(input);
              }
            }}
            placeholder="اكتب ردك كمندوب مبيعات..."
            rows={1}
            className="flex-1 resize-none rounded-xl bg-white/[0.04] border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan/30 focus:border-cyan/30"
            style={{ minHeight: 44, maxHeight: 120 }}
          />
          <Button
            onClick={() => submitMessage(input)}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="h-[44px] w-[44px] rounded-xl bg-cyan hover:bg-cyan/80 shrink-0"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
