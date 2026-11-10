"use client";

import { useEffect, useRef, useState } from "react";
import { Clock, ExternalLink, Send, CheckCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth-context";
import {
  fetchFollowUpNotes,
  createFollowUpNote,
  createMentionNotification,
  fetchEmployees,
  fetchUserProfiles,
} from "@/lib/supabase/db";
import type { Employee, FollowUpNote, MentionNotification } from "@/types";

/**
 * نافذة سريعة للمدير من «منشناتي»: يقرأ سجل المتابعة ويرد ويأكّد — بدون فتح ملخص العميل كامل.
 * «إرسال وتأكيد» يضيف الرد للسجل (ومنشن للكاتب) ثم يقفل النافذة ويرجع للقائمة مباشرة.
 */
export function MentionReplyDialog({
  mention,
  onClose,
  onDone,
  onOpenFull,
}: {
  mention: MentionNotification;
  onClose: () => void;
  /** يُستدعى بعد التأكيد (مع أو بدون رد) — لتعليم المنشن كمقروء */
  onDone: (m: MentionNotification) => void;
  /** فتح ملخص العميل كامل (اختياري) */
  onOpenFull: (m: MentionNotification) => void;
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<FollowUpNote[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState(mention.author_name ? `@${mention.author_name} ` : "");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetchFollowUpNotes(mention.entity_type, mention.entity_id),
      fetchEmployees().catch(() => [] as Employee[]),
      fetchUserProfiles().catch(() => [] as { name: string }[]),
    ])
      .then(([n, emps, profiles]) => {
        if (!alive) return;
        setNotes(n);
        const empNames = (emps as Employee[]).map((e) => e.name);
        const profileNames = (profiles as { name: string }[]).map((p) => p.name).filter(Boolean);
        setNames([...new Set([...profileNames, ...empNames])]);
      })
      .catch(console.error)
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mention]);

  // نزّل للمنشن نفسه بعد التحميل
  useEffect(() => {
    if (!loading && highlightRef.current) highlightRef.current.scrollIntoView({ block: "center" });
  }, [loading]);

  const authorName = user?.name || user?.email || "مستخدم";

  async function submit(withReply: boolean) {
    const text = reply.trim();
    // رد فاضي (بس المنشن) يُعامل كتأكيد بدون رد
    const hasContent = withReply && text && text !== `@${mention.author_name}`;
    if (hasContent) {
      setSaving(true);
      try {
        const created = await createFollowUpNote(mention.entity_type, mention.entity_id, text, authorName);
        const allNames = names.includes(mention.author_name) ? names : [...names, mention.author_name];
        const mentioned = [...new Set(allNames.filter((n) => n && text.includes(`@${n}`)))];
        for (const name of mentioned) {
          if (name === authorName) continue;
          createMentionNotification(created.id, mention.entity_type, mention.entity_id, mention.entity_name, name, authorName, text)
            .catch((err) => console.error("[mention] failed for:", name, err));
        }
      } catch (err) {
        console.error(err);
        setSaving(false);
        return;
      }
      setSaving(false);
    }
    onDone(mention);
    onClose();
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-SA-u-ca-gregory", { day: "numeric", month: "short" }) +
      " — " + d.toLocaleTimeString("ar-SA-u-ca-gregory", { hour: "2-digit", minute: "2-digit" });
  }

  function renderText(text: string) {
    if (names.length === 0) return text;
    const sorted = [...names].sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const parts = text.split(new RegExp(`(@(?:${sorted.join("|")}))`, "g"));
    return parts.map((p, i) =>
      p.startsWith("@") && names.some((n) => p === `@${n}`)
        ? <span key={i} className="text-amber-400 font-bold">{p}</span>
        : <span key={i}>{p}</span>,
    );
  }

  const canSend = !!reply.trim() && reply.trim() !== `@${mention.author_name}`;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[88vh] flex flex-col gap-3 p-4">
        <DialogHeader>
          <DialogTitle className="text-right text-base">
            سجل متابعة — <span className="text-amber-400">{mention.entity_name}</span>
          </DialogTitle>
          <p className="text-right text-[12px] text-muted-foreground">
            {mention.author_name} أشار إليك
          </p>
        </DialogHeader>

        {/* السجل */}
        <div className="flex-1 min-h-[120px] overflow-y-auto overscroll-contain space-y-2 -mx-1 px-1">
          {loading ? (
            <div className="text-center text-muted-foreground text-sm py-8">جاري التحميل...</div>
          ) : notes.length === 0 ? (
            <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-sm whitespace-pre-wrap">
              {renderText(mention.note_text)}
            </div>
          ) : (
            notes.map((n) => {
              const isMention = n.id === mention.note_id;
              return (
                <div
                  key={n.id}
                  ref={isMention ? highlightRef : undefined}
                  className={`p-3 rounded-lg border ${isMention ? "border-amber-500/50 bg-amber-500/10" : "border-border/50 bg-card/50"}`}
                >
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-xs font-bold truncate ${isMention ? "text-amber-400" : "text-cyan"}`}>{n.author_name}</span>
                      {isMention && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold shrink-0">المنشن</span>
                      )}
                    </div>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground shrink-0">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{renderText(n.note)}</p>
                </div>
              );
            })
          )}
        </div>

        {/* الرد */}
        <div className="space-y-2 border-t border-border/40 pt-3">
          <textarea
            ref={textareaRef}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && canSend) submit(true); }}
            placeholder="اكتب ردك..."
            className="w-full min-h-[70px] rounded-lg border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-amber-500/60 resize-none"
            dir="rtl"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => submit(true)}
              disabled={!canSend || saving}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-40 transition-colors"
            >
              <Send className="w-4 h-4" />
              {saving ? "جاري الإرسال..." : "إرسال وتأكيد"}
            </button>
            <button
              onClick={() => submit(false)}
              disabled={saving}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-40 transition-colors"
              title="تأكيد القراءة بدون رد"
            >
              <CheckCheck className="w-4 h-4" />
              تم الاطلاع
            </button>
          </div>
          <button
            onClick={() => { onDone(mention); onOpenFull(mention); }}
            className="w-full flex items-center justify-center gap-1 text-[12px] text-muted-foreground hover:text-foreground py-1"
          >
            <ExternalLink className="w-3 h-3" />
            فتح ملخص العميل كامل
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
