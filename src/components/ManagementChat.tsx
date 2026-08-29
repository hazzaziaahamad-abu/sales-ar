"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Send, Loader2, MessagesSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchManagementMessages, sendManagementMessage, type ManagementMessage } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";

function fmtTime(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("ar-SA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function ManagementChat({
  entityType,
  entityId,
  entityName,
  compact = false,
}: {
  entityType: "deal" | "renewal" | "client";
  entityId: string;
  entityName?: string;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ManagementMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, []);

  const load = useCallback(async () => {
    try {
      const rows = await fetchManagementMessages(entityType, entityId);
      setMessages(rows);
    } catch { /* ignore */ }
    setLoading(false);
    scrollToBottom();
  }, [entityType, entityId, scrollToBottom]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  // Realtime — ردود لحظية
  useEffect(() => {
    if (!entityId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`mgmt-chat-${entityType}-${entityId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "management_messages", filter: `entity_id=eq.${entityId}` },
        (payload) => {
          const m = payload.new as ManagementMessage;
          if (m.entity_type !== entityType) return;
          setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
          scrollToBottom();
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [entityType, entityId, scrollToBottom]);

  async function handleSend() {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText("");
    const senderName = user?.name || "الإدارة";
    // تفاؤلي: نضيف الرسالة فوراً ثم نحفظها
    const optimistic: ManagementMessage = {
      id: `tmp-${Date.now()}`,
      org_id: "",
      entity_type: entityType,
      entity_id: entityId,
      entity_name: entityName,
      sender_id: user?.id,
      sender_name: senderName,
      body,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    scrollToBottom();
    try {
      const saved = await sendManagementMessage({ entityType, entityId, entityName, body, senderId: user?.id, senderName });
      if (saved) setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)));
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setText(body);
    }
    setSending(false);
  }

  const myName = user?.name || "الإدارة";

  return (
    <div className="flex flex-col rounded-xl border border-border/50 bg-background/40 overflow-hidden">
      {!compact && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40 bg-white/[0.02]">
          <MessagesSquare className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-foreground">محادثات الإدارة</span>
          {entityName && <span className="text-[11px] text-muted-foreground">· {entityName}</span>}
        </div>
      )}

      <div ref={scrollRef} className={`overflow-y-auto p-3 space-y-2 ${compact ? "max-h-[240px]" : "max-h-[340px] min-h-[140px]"}`}>
        {loading ? (
          <p className="text-center text-[12px] text-muted-foreground py-6">جارٍ التحميل…</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-[12px] text-muted-foreground py-6">لا توجد رسائل بعد — ابدأ المحادثة مع الموظف.</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_name === myName;
            return (
              <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[82%] rounded-2xl px-3 py-2 ${mine ? "bg-cyan-500/15 border border-cyan-500/20" : "bg-white/[0.05] border border-white/[0.08]"}`}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[11px] font-bold ${mine ? "text-cyan-300" : "text-amber-300"}`}>{m.sender_name}</span>
                    <span className="text-[10px] text-muted-foreground/70">{fmtTime(m.created_at)}</span>
                  </div>
                  <p className="text-[13px] text-foreground whitespace-pre-wrap leading-relaxed">{m.body}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 p-2 border-t border-border/40">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="اكتب رسالة للموظف…"
          className="flex-1 rounded-lg bg-background/60 border border-border/50 text-[13px] text-foreground px-3 py-2 outline-none focus:border-cyan-500/40"
        />
        <button
          onClick={handleSend}
          disabled={sending || !text.trim()}
          className="flex items-center justify-center h-9 w-9 rounded-lg bg-cyan-600 text-white hover:bg-cyan-500 disabled:opacity-40 transition-colors shrink-0"
          title="إرسال"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
