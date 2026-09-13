"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, RotateCw, MessageCircle, RefreshCw, Headphones, Users, Clock, TrendingUp } from "lucide-react";
import type { MentionNotification } from "@/types";
import { fetchRecentMentions } from "@/lib/supabase/db";
import { useAuth } from "@/lib/auth-context";
import { formatDateTime } from "@/lib/utils/format";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

/* ─── مسار كل نوع كيان للانتقال إليه ─── */
const ENTITY_PATH: Record<string, string> = { deal: "/sales", ticket: "/support", renewal: "/renewals" };
const ENTITY_META: Record<string, { label: string; icon: typeof MessageCircle; hex: string }> = {
  deal: { label: "صفقة", icon: MessageCircle, hex: "#10B981" },
  ticket: { label: "تذكرة دعم", icon: Headphones, hex: "#F59E0B" },
  renewal: { label: "تجديد", icon: RefreshCw, hex: "#38BDF8" },
};

function buildMentionUrl(m: MentionNotification): string {
  const base = ENTITY_PATH[m.entity_type] || "/sales";
  const params = new URLSearchParams();
  if (m.entity_name) params.set("profile", m.entity_name);
  if (m.note_id) params.set("noteId", m.note_id);
  return `${base}?${params.toString()}`;
}

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `منذ ${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `منذ ${hrs} س`;
  return `منذ ${Math.floor(hrs / 24)} ي`;
}

type WindowKey = 24 | 48 | 72;

export default function MentionsOverviewPage() {
  const { activeOrgId } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState<WindowKey>(24);
  const [mentions, setMentions] = useState<MentionNotification[]>([]);
  const [filterAuthor, setFilterAuthor] = useState<string | null>(null);
  const [filterMentioned, setFilterMentioned] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await fetchRecentMentions(hours);
      setMentions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [hours]);

  useEffect(() => { setLoading(true); load(); }, [load, activeOrgId]);
  useEffect(() => {
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  /* ─── إحصاءات ملخّصة ─── */
  const stats = useMemo(() => {
    const byType = new Map<string, number>();
    const byAuthor = new Map<string, number>();
    const byMentioned = new Map<string, number>();
    let unread = 0;
    for (const m of mentions) {
      byType.set(m.entity_type, (byType.get(m.entity_type) || 0) + 1);
      byAuthor.set(m.author_name, (byAuthor.get(m.author_name) || 0) + 1);
      byMentioned.set(m.mentioned_name, (byMentioned.get(m.mentioned_name) || 0) + 1);
      if (!m.is_read) unread += 1;
    }
    const top = (map: Map<string, number>) =>
      [...map.entries()].sort((a, b) => b[1] - a[1]);
    return {
      total: mentions.length,
      unread,
      byType,
      topAuthors: top(byAuthor),
      topMentioned: top(byMentioned),
    };
  }, [mentions]);

  const filtered = useMemo(
    () => mentions.filter((m) =>
      (!filterAuthor || m.author_name === filterAuthor) &&
      (!filterMentioned || m.mentioned_name === filterMentioned) &&
      (!filterType || m.entity_type === filterType)),
    [mentions, filterAuthor, filterMentioned, filterType],
  );

  const anyFilter = filterAuthor || filterMentioned || filterType;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "linear-gradient(135deg,rgba(245,158,11,.20),rgba(139,92,246,.14))", border: "1px solid rgba(245,158,11,.28)" }}>
            <AtSign className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">منشنات الفريق</h1>
            <p className="text-xs text-muted-foreground">نظرة عامة على كل إشارات @ في سجلّات المتابعة خلال آخر {hours} ساعة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg overflow-hidden border border-white/[0.08]">
            {([24, 48, 72] as WindowKey[]).map((h) => (
              <button key={h} onClick={() => setHours(h)}
                className={`text-[12px] px-3 py-1.5 transition-colors ${hours === h ? "bg-amber-500/15 text-amber-400" : "bg-white/[0.03] text-muted-foreground hover:text-foreground"}`}>
                {h} س
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => load()}>
            <RotateCw className="w-3.5 h-3.5" /> تحديث
          </Button>
        </div>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile label="إجمالي المنشنات" value={stats.total} tone="#F59E0B" icon={<AtSign className="w-4 h-4" />} />
        <StatTile label="غير مقروءة" value={stats.unread} tone="#EF4444" icon={<Clock className="w-4 h-4" />} />
        <StatTile label="موظفون أشاروا" value={stats.topAuthors.length} tone="#8B5CF6" icon={<TrendingUp className="w-4 h-4" />} />
        <StatTile label="موظفون مُشار إليهم" value={stats.topMentioned.length} tone="#00D4FF" icon={<Users className="w-4 h-4" />} />
      </div>

      {/* Breakdown by entity type + top people */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="حسب القسم">
          {(["deal", "renewal", "ticket"] as const).map((t) => {
            const meta = ENTITY_META[t];
            const Icon = meta.icon;
            const n = stats.byType.get(t) || 0;
            const active = filterType === t;
            return (
              <button key={t} onClick={() => setFilterType(active ? null : t)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${active ? "bg-white/[0.06] border-white/[0.14]" : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.05]"}`}>
                <span className="w-7 h-7 rounded-lg grid place-items-center shrink-0" style={{ background: `${meta.hex}22`, color: meta.hex }}><Icon className="w-4 h-4" /></span>
                <span className="text-[13px] text-foreground flex-1 text-right">{meta.label}</span>
                <span className="text-[13px] font-mono font-bold" style={{ color: meta.hex }}>{n}</span>
              </button>
            );
          })}
        </Panel>

        <Panel title="الأكثر إرسالاً للمنشنات">
          <PeopleList rows={stats.topAuthors} activeName={filterAuthor} onPick={(n) => setFilterAuthor(filterAuthor === n ? null : n)} tone="#8B5CF6" empty="لا يوجد" />
        </Panel>

        <Panel title="الأكثر إشارةً إليهم">
          <PeopleList rows={stats.topMentioned} activeName={filterMentioned} onPick={(n) => setFilterMentioned(filterMentioned === n ? null : n)} tone="#00D4FF" empty="لا يوجد" />
        </Panel>
      </div>

      {/* Active filters bar */}
      {anyFilter && (
        <div className="flex items-center gap-2 flex-wrap text-[12px] text-muted-foreground">
          <span>عوامل التصفية:</span>
          {filterType && <Chip label={ENTITY_META[filterType]?.label || filterType} onClear={() => setFilterType(null)} />}
          {filterAuthor && <Chip label={`من: ${filterAuthor}`} onClear={() => setFilterAuthor(null)} />}
          {filterMentioned && <Chip label={`إلى: ${filterMentioned}`} onClear={() => setFilterMentioned(null)} />}
          <button onClick={() => { setFilterType(null); setFilterAuthor(null); setFilterMentioned(null); }} className="text-amber-400 hover:underline">مسح الكل</button>
        </div>
      )}

      {/* Mentions list */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}</div>
      ) : !filtered.length ? (
        <div className="cc-card rounded-2xl p-10 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 flex items-center justify-center mb-3"><AtSign className="w-7 h-7 text-amber-400/50" /></div>
          <p className="text-sm text-muted-foreground">
            {anyFilter ? "لا توجد منشنات مطابقة لعوامل التصفية." : `لا توجد منشنات خلال آخر ${hours} ساعة. أي إشارة @ في سجل المتابعة تظهر هنا.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-[12px] text-muted-foreground">{filtered.length} منشن</p>
          {filtered.map((m) => {
            const meta = ENTITY_META[m.entity_type] || ENTITY_META.deal;
            const Icon = meta.icon;
            return (
              <button key={m.id} onClick={() => router.push(buildMentionUrl(m))}
                className="w-full cc-card rounded-[13px] p-3.5 flex gap-3 items-start text-right hover:bg-white/[0.03] transition-colors">
                <div className="w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold shrink-0 bg-amber-500/10 border-amber-500/20 text-amber-400">
                  {m.author_name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] text-foreground">
                    <span className="font-bold text-amber-400">{m.author_name}</span>
                    {" أشار إلى "}
                    <span className="font-bold text-cyan-400">{m.mentioned_name}</span>
                    {" في "}
                    <span className="font-semibold">{m.entity_name}</span>
                  </p>
                  {m.note_text && <p className="text-[12px] text-muted-foreground mt-1 line-clamp-2">{m.note_text}</p>}
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-[10.5px] px-1.5 py-0.5 rounded-md flex items-center gap-1" style={{ background: `${meta.hex}1f`, color: meta.hex }}>
                      <Icon className="w-3 h-3" /> {meta.label}
                    </span>
                    <span className="text-[11px] text-muted-foreground/70 font-mono">{formatDateTime(m.created_at)}</span>
                    {!m.is_read && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold">غير مقروء</span>}
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground/60 shrink-0 whitespace-nowrap">{timeAgo(m.created_at)}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── مكوّنات مساعدة ─── */
function StatTile({ label, value, tone, icon }: { label: string; value: number; tone: string; icon: React.ReactNode }) {
  return (
    <div className="cc-card rounded-[14px] p-4">
      <div className="flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <span className="w-6 h-6 rounded-lg grid place-items-center" style={{ background: `${tone}22`, color: tone }}>{icon}</span>
        {label}
      </div>
      <div className="text-2xl font-bold font-mono mt-2" style={{ color: tone }}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="cc-card rounded-[14px] p-3.5">
      <div className="text-[12.5px] font-semibold text-foreground mb-2.5">{title}</div>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function PeopleList({ rows, activeName, onPick, tone, empty }: {
  rows: [string, number][]; activeName: string | null; onPick: (n: string) => void; tone: string; empty: string;
}) {
  if (!rows.length) return <p className="text-[12px] text-muted-foreground/60 py-2 text-center">{empty}</p>;
  const max = rows[0][1] || 1;
  return (
    <>
      {rows.slice(0, 6).map(([name, n]) => {
        const active = activeName === name;
        return (
          <button key={name} onClick={() => onPick(name)}
            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border transition-colors ${active ? "bg-white/[0.06] border-white/[0.14]" : "border-transparent hover:bg-white/[0.04]"}`}>
            <span className="text-[12.5px] text-foreground flex-1 text-right truncate">{name}</span>
            <span className="relative h-1.5 w-16 rounded-full bg-white/[0.06] overflow-hidden">
              <span className="absolute inset-y-0 right-0 rounded-full" style={{ width: `${(n / max) * 100}%`, background: tone }} />
            </span>
            <span className="text-[12px] font-mono font-bold w-6 text-left" style={{ color: tone }}>{n}</span>
          </button>
        );
      })}
    </>
  );
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.05] border border-white/[0.08] text-foreground">
      {label}
      <button onClick={(e) => { e.stopPropagation(); onClear(); }} className="text-muted-foreground hover:text-foreground">✕</button>
    </span>
  );
}
