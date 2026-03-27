"use client";

import { useState, useEffect } from "react";
import type { FollowUpNote } from "@/types";
import { fetchFollowUpNotes, createFollowUpNote } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Send, Clock } from "lucide-react";

interface FollowUpLogProps {
  entityType: "deal" | "renewal";
  entityId: string;
  entityName: string;
}

export function FollowUpLogButton({ entityType, entityId, entityName }: FollowUpLogProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState<FollowUpNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchFollowUpNotes(entityType, entityId)
      .then(setNotes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [open, entityType, entityId]);

  async function handleAdd() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const authorName = user?.name || user?.email || "مستخدم";
      const created = await createFollowUpNote(entityType, entityId, newNote.trim(), authorName);
      setNotes((prev) => [created, ...prev]);
      setNewNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" }) +
      " — " +
      d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="p-1.5 rounded-md hover:bg-amber/10 text-amber transition-colors"
        title="سجل المتابعة"
      >
        <MessageSquarePlus className="w-3.5 h-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-right">
              سجل متابعة — {entityName}
            </DialogTitle>
          </DialogHeader>

          {/* Add note input */}
          <div className="flex gap-2 items-start">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="أضف تعليق أو ملاحظة متابعة..."
              className="flex-1 min-h-[70px] rounded-lg border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan resize-none"
              dir="rtl"
              onKeyDown={(e) => {
                if (e.key === "Enter" && e.ctrlKey) handleAdd();
              }}
            />
            <Button
              onClick={handleAdd}
              disabled={!newNote.trim() || saving}
              size="sm"
              className="mt-1 bg-cyan hover:bg-cyan/80 text-background"
            >
              <Send className="w-4 h-4 ml-1" />
              {saving ? "..." : "إضافة"}
            </Button>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto space-y-3 mt-2">
            {loading ? (
              <div className="text-center text-muted-foreground text-sm py-8">جاري التحميل...</div>
            ) : notes.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">لا توجد ملاحظات بعد</div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="p-3 rounded-lg border border-border/50 bg-card/50">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-bold text-cyan">{n.author_name}</span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {formatDateTime(n.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{n.note}</p>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
