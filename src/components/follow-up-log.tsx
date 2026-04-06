"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Employee, FollowUpNote } from "@/types";
import { fetchFollowUpNotes, createFollowUpNote, updateFollowUpNote, deleteFollowUpNote, fetchEmployees, createMentionNotification } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageSquarePlus, Send, Clock, AtSign, Pencil, Trash2, Check, X } from "lucide-react";

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

  /* Edit state */
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  /* Delete confirm state */
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* Employees for @mention */
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionStart, setMentionStart] = useState(-1); // cursor position of @
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetchFollowUpNotes(entityType, entityId),
      fetchEmployees(),
    ]).then(([n, e]) => {
      setNotes(n);
      setEmployees(e);
    }).catch(console.error).finally(() => setLoading(false));
  }, [open, entityType, entityId]);

  const filteredEmployees = employees.filter((e) =>
    !mentionFilter || e.name.includes(mentionFilter)
  );

  const insertMention = useCallback((name: string) => {
    const textarea = textareaRef.current;
    if (!textarea || mentionStart === -1) return;
    const before = newNote.slice(0, mentionStart);
    const cursor = textarea.selectionStart;
    const after = newNote.slice(cursor);
    const inserted = before + `@${name} ` + after;
    setNewNote(inserted);
    setShowMentions(false);
    setMentionFilter("");
    setMentionStart(-1);
    setTimeout(() => {
      textarea.focus();
      const pos = before.length + name.length + 2;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  }, [newNote, mentionStart]);

  function handleNoteChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setNewNote(val);

    const cursor = e.target.selectionStart;
    const before = val.slice(0, cursor);

    const atIdx = before.lastIndexOf("@");
    if (atIdx !== -1 && (atIdx === 0 || before[atIdx - 1] === " " || before[atIdx - 1] === "\n")) {
      const query = before.slice(atIdx + 1);
      if (!query.includes("\n")) {
        setMentionStart(atIdx);
        setMentionFilter(query);
        setShowMentions(true);
        setMentionIndex(0);
        return;
      }
    }
    setShowMentions(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentions && filteredEmployees.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => Math.min(i + 1, filteredEmployees.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(filteredEmployees[mentionIndex].name);
      } else if (e.key === "Escape") {
        setShowMentions(false);
      }
      return;
    }
    if (e.key === "Enter" && e.ctrlKey) handleAdd();
  }

  function extractMentions(text: string): string[] {
    const mentioned: string[] = [];
    for (const emp of employees) {
      if (text.includes(`@${emp.name}`)) {
        mentioned.push(emp.name);
      }
    }
    return [...new Set(mentioned)];
  }

  async function handleAdd() {
    if (!newNote.trim()) return;
    setSaving(true);
    try {
      const authorName = user?.name || user?.email || "مستخدم";
      const created = await createFollowUpNote(entityType, entityId, newNote.trim(), authorName);
      setNotes((prev) => [created, ...prev]);

      const mentionedNames = extractMentions(newNote);
      for (const name of mentionedNames) {
        createMentionNotification(created.id, entityType, entityId, entityName, name, authorName, newNote.trim()).catch(console.error);
      }

      setNewNote("");
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  /* Edit handler */
  async function handleEditSave(noteId: string) {
    if (!editText.trim()) return;
    setEditSaving(true);
    try {
      const editorName = user?.name || user?.email || "مستخدم";
      const updated = await updateFollowUpNote(noteId, editText.trim(), editorName);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      setEditingId(null);
      setEditText("");
    } catch (err) {
      console.error(err);
    } finally {
      setEditSaving(false);
    }
  }

  /* Delete handler */
  async function handleDelete(noteId: string) {
    try {
      await deleteFollowUpNote(noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      setDeletingId(null);
    } catch (err) {
      console.error(err);
    }
  }

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" }) +
      " — " +
      d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
  }

  function renderNoteText(text: string) {
    if (employees.length === 0) return text;
    const names = employees.map((e) => e.name).sort((a, b) => b.length - a.length);
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    const regex = new RegExp(`(@(?:${escaped.join("|")}))`, "g");
    const parts = text.split(regex);
    return parts.map((part, i) =>
      part.startsWith("@") && names.some((n) => part === `@${n}`) ? (
        <span key={i} className="text-amber font-bold">{part}</span>
      ) : (
        <span key={i}>{part}</span>
      )
    );
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
          <div className="relative">
            <div className="flex gap-2 items-start">
              <div className="flex-1 relative">
                <textarea
                  ref={textareaRef}
                  value={newNote}
                  onChange={handleNoteChange}
                  onKeyDown={handleKeyDown}
                  placeholder="أضف تعليق... اكتب @ لمنشن موظف"
                  className="w-full min-h-[70px] rounded-lg border border-border bg-card p-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-cyan resize-none"
                  dir="rtl"
                />
                {/* Mention suggestions dropdown */}
                {showMentions && filteredEmployees.length > 0 && (
                  <div className="absolute top-full mt-1 right-0 w-full min-w-[280px] bg-card border border-border rounded-lg shadow-lg z-50 max-h-[200px] overflow-y-auto">
                    {filteredEmployees.map((emp, idx) => (
                      <button
                        key={emp.id}
                        onClick={() => insertMention(emp.name)}
                        className={`w-full flex items-center gap-2 px-3 py-2.5 text-right text-sm transition-colors ${
                          idx === mentionIndex ? "bg-cyan/10 text-cyan" : "text-foreground hover:bg-white/5"
                        }`}
                      >
                        <div className="w-7 h-7 rounded-full bg-amber/15 text-amber flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {emp.name.charAt(0)}
                        </div>
                        <span className="font-medium whitespace-nowrap">{emp.name}</span>
                        {emp.role && <span className="text-[10px] text-muted-foreground mr-auto whitespace-nowrap">{emp.role}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <Button
                  onClick={handleAdd}
                  disabled={!newNote.trim() || saving}
                  size="sm"
                  className="bg-cyan hover:bg-cyan/80 text-background"
                >
                  <Send className="w-4 h-4 ml-1" />
                  {saving ? "..." : "إضافة"}
                </Button>
                <button
                  onClick={() => {
                    const textarea = textareaRef.current;
                    if (textarea) {
                      const cursor = textarea.selectionStart;
                      const before = newNote.slice(0, cursor);
                      const after = newNote.slice(cursor);
                      const needSpace = before.length > 0 && before[before.length - 1] !== " " && before[before.length - 1] !== "\n";
                      const prefix = needSpace ? " @" : "@";
                      setNewNote(before + prefix + after);
                      setMentionStart(before.length + (needSpace ? 1 : 0));
                      setShowMentions(true);
                      setMentionFilter("");
                      setTimeout(() => {
                        textarea.focus();
                        const pos = cursor + prefix.length;
                        textarea.setSelectionRange(pos, pos);
                      }, 0);
                    }
                  }}
                  className="p-1.5 rounded-md border border-amber/30 text-amber hover:bg-amber/10 transition-colors"
                  title="منشن موظف @"
                >
                  <AtSign className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Notes list */}
          <div className="flex-1 overflow-y-auto space-y-3 mt-2">
            {loading ? (
              <div className="text-center text-muted-foreground text-sm py-8">جاري التحميل...</div>
            ) : notes.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">لا توجد ملاحظات بعد</div>
            ) : (
              notes.map((n) => (
                <div key={n.id} className="p-3 rounded-lg border border-border/50 bg-card/50 group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-cyan">{n.author_name}</span>
                      {n.edited_at && (
                        <span className="text-[10px] text-amber/70">(معدّل بواسطة {n.edited_by})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {/* Edit & Delete buttons - visible on hover */}
                      {editingId !== n.id && deletingId !== n.id && (
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => { setEditingId(n.id); setEditText(n.note); setDeletingId(null); }}
                            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-amber transition-colors"
                            title="تعديل"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => { setDeletingId(n.id); setEditingId(null); }}
                            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors"
                            title="حذف"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        {formatDateTime(n.created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Delete confirmation */}
                  {deletingId === n.id ? (
                    <div className="flex items-center justify-between p-2 rounded-lg bg-red-500/10 border border-red-500/20">
                      <span className="text-sm text-red-400">هل تريد حذف هذا التعليق؟</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(n.id)}
                          className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          حذف
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="px-2 py-1 rounded text-xs bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : editingId === n.id ? (
                    /* Edit mode */
                    <div className="space-y-2">
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full min-h-[60px] rounded-lg border border-amber/30 bg-card p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-amber resize-none"
                        dir="rtl"
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleEditSave(n.id)}
                          disabled={!editText.trim() || editSaving}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-amber/15 text-amber hover:bg-amber/25 disabled:opacity-40 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          {editSaving ? "..." : "حفظ"}
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditText(""); }}
                          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                        >
                          <X className="w-3 h-3" />
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal display */
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{renderNoteText(n.note)}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
