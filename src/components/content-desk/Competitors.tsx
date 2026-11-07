"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Heart, Loader2, MessageSquare, Pencil, Play, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { addDays, fmtNum } from "@/lib/content-desk/types";
import type { Competitor, CompetitorPost, CompetitorSnapshot, CompetitorsPayload, SocialPlatform } from "@/lib/content-desk/bank";

const PLAT: Record<SocialPlatform, { label: string; chip: string; profile: (u: string) => string }> = {
  ig: { label: "انستقرام", chip: "bg-pink-500/15 text-pink-400", profile: (u) => `https://www.instagram.com/${u}/` },
  tt: { label: "تيك توك", chip: "bg-violet-500/15 text-violet-400", profile: (u) => `https://www.tiktok.com/@${u}` },
};
const inputCls =
  "w-full rounded-lg border border-border bg-white/[0.06] px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-cyan/50";

async function api(body: Record<string, unknown>) {
  const res = await fetch("/api/content-desk/competitors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || "حدث خطأ");
  return json;
}

const sum = (xs: (number | null)[]) => xs.reduce<number>((a, b) => a + (b ?? 0), 0);
const handleOf = (c: Competitor, p: SocialPlatform) => (p === "ig" ? c.ig_username : c.tt_username);

function Delta({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground">—</span>;
  if (v === 0) return <span className="font-mono text-muted-foreground" dir="ltr">0</span>;
  const up = v > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 font-mono", up ? "text-emerald-400" : "text-red-400")} dir="ltr">
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}{up ? "+" : "−"}{fmtNum(Math.abs(v))}
    </span>
  );
}

export default function Competitors() {
  const [data, setData] = useState<CompetitorsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [mode, setMode] = useState<"daily" | "weekly">("daily");
  const [editing, setEditing] = useState<Partial<Competitor> | null>(null);
  const [manual, setManual] = useState<{ c: Competitor; p: SocialPlatform } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/content-desk/competitors", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "تعذّر التحميل");
      setData(json); setError(null);
    } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const syncNow = async (id?: string) => {
    setSyncing(true); setError(null);
    try {
      const r = await api({ action: "sync", id });
      if (r.errors?.length) setError(r.errors.join(" · "));
      await load();
    } catch (e) { setError((e as Error).message); }
    setSyncing(false);
  };

  const idx = useMemo(() => {
    const m = new Map<string, CompetitorSnapshot>();
    for (const s of data?.snapshots ?? []) m.set(`${s.competitor_id}|${s.platform}|${s.day}`, s);
    return m;
  }, [data]);

  if (error && !data) return <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">{error}</div>;
  if (!data) return <div className="flex items-center justify-center py-24 text-muted-foreground"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const { today, competitors, posts } = data;
  /** آخر لقطة في يوم ≤ day (نرجع لحد ٣ أيام لو يوم ناقص) */
  const snapAt = (id: string, p: SocialPlatform, day: string) => {
    for (let i = 0; i < 4; i++) { const s = idx.get(`${id}|${p}|${addDays(day, -i)}`); if (s) return s; }
    return null;
  };
  const exact = (id: string, p: SocialPlatform, day: string) => idx.get(`${id}|${p}|${day}`) ?? null;
  const diff = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null ? a - b : null);
  const postsIn = (id: string, p: SocialPlatform, from: string, to: string) =>
    posts.filter((x) => x.competitor_id === id && x.platform === p && x.posted_at && x.posted_at.slice(0, 10) >= from && x.posted_at.slice(0, 10) <= to);

  const rows = competitors.flatMap((c) => (["ig", "tt"] as const).filter((p) => handleOf(c, p)).map((p) => {
    const now = snapAt(c.id, p, today);
    const wk = postsIn(c.id, p, addDays(today, -6), today);
    return {
      c, p, now,
      dDay: diff(now?.followers, snapAt(c.id, p, addDays(today, -1))?.followers),
      dWeek: diff(now?.followers, snapAt(c.id, p, addDays(today, -7))?.followers),
      wkPosts: wk.length, wkViews: sum(wk.map((x) => x.views)), wkLikes: sum(wk.map((x) => x.likes)), wkComments: sum(wk.map((x) => x.comments)),
    };
  }));

  const weekAgo = addDays(today, -6);
  const topPosts = posts.filter((x) => x.posted_at && x.posted_at.slice(0, 10) >= weekAgo)
    .sort((a, b) => (b.views ?? b.likes ?? 0) - (a.views ?? a.likes ?? 0)).slice(0, 8);
  const nameOf = new Map(competitors.map((c) => [c.id, c.name]));
  const lastSync = competitors.map((c) => c.last_synced_at).filter(Boolean).sort().pop();

  return (
    <div className="space-y-5" dir="rtl" lang="ar">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">المنافسين</h1>
          <p className="text-xs text-muted-foreground">
            حساباتهم تُسحب تلقائياً كل يوم ٦ الصبح — المتابعين والمنشورات وتفاعلها، يومي وأسبوعي
            {lastSync && <> · آخر سحب {new Date(lastSync).toLocaleString("ar-SA", { dateStyle: "medium", timeStyle: "short" })}</>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.connected && competitors.length > 0 && (
            <button disabled={syncing} onClick={() => syncNow()} className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-4 py-2 text-sm disabled:opacity-60">
              <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} /> {syncing ? "جاري السحب… (دقيقة أو دقيقتين)" : "سحب الآن"}
            </button>
          )}
          <button className="flex items-center gap-1.5 rounded-xl bg-cyan px-4 py-2 text-sm font-bold text-[#07090F]" onClick={() => setEditing({ active: true })}>
            <Plus className="h-4 w-4" /> إضافة منافس
          </button>
        </div>
      </div>

      {!data.connected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">
          <b>أداة السحب التلقائي غير مربوطة بعد.</b> نستخدم Apify لسحب انستقرام وتيك توك يومياً — أضف <code dir="ltr" className="rounded bg-black/30 px-1">APIFY_TOKEN</code> في متغيرات Vercel ويشتغل السحب تلقائياً.
          لين ذاك تقدر تدخل أرقام اليوم يدوياً من زر «يدوي» جنب كل حساب.
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
          {error}<button onClick={() => setError(null)} aria-label="إغلاق"><X className="h-4 w-4" /></button>
        </div>
      )}

      {competitors.length === 0 ? (
        <button onClick={() => setEditing({ active: true })} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-border py-16 text-sm text-muted-foreground hover:border-cyan/50">
          <Plus className="h-6 w-6" /> أضف أول منافس (حساب انستقرام أو تيك توك)
        </button>
      ) : (
        <>
          {/* ─── ملخص اليوم والأسبوع ─── */}
          <section className="overflow-hidden rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold">لوحة المنافسين</h2>
              <div className="flex gap-1 rounded-xl bg-white/[0.04] p-1" role="group" aria-label="الفترة">
                {([["daily", "يومي"], ["weekly", "أسبوعي"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setMode(k)} aria-pressed={mode === k}
                    className={cn("rounded-lg px-4 py-1.5 text-sm font-bold", mode === k ? "bg-cyan/15 text-cyan" : "text-muted-foreground hover:text-foreground")}>{l}</button>
                ))}
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="text-[11px] text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-4 py-2 text-start font-bold">المنافس</th>
                    <th className="px-2 py-2 text-start font-bold">المتابعين</th>
                    <th className="px-2 py-2 text-start font-bold">{mode === "daily" ? "تغيّر اليوم" : "تغيّر الأسبوع"}</th>
                    <th className="px-2 py-2 text-start font-bold">{mode === "daily" ? "متوسط مشاهدات" : "منشورات الأسبوع"}</th>
                    <th className="px-2 py-2 text-start font-bold">{mode === "daily" ? "متوسط لايك" : "مشاهدات الأسبوع"}</th>
                    <th className="px-2 py-2 text-start font-bold">{mode === "daily" ? "متوسط تعليقات" : "لايكات الأسبوع"}</th>
                    <th className="px-2 py-2 text-start font-bold">معدل التفاعل</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ c, p, now, dDay, dWeek, wkPosts, wkViews, wkLikes }) => (
                    <tr key={`${c.id}-${p}`} className={cn("border-b border-border last:border-0", !c.active && "opacity-50")}>
                      <td className="px-4 py-2.5">
                        <button className="text-start" onClick={() => setOpenId(c.id)}>
                          <b className="block hover:text-cyan">{c.name}</b>
                          <span className="flex items-center gap-1 text-[11px]">
                            <span className={cn("rounded-md px-1.5 py-px font-bold", PLAT[p].chip)}>{PLAT[p].label}</span>
                            <span className="text-muted-foreground" dir="ltr">@{handleOf(c, p)}</span>
                          </span>
                        </button>
                      </td>
                      <td className="px-2 font-mono font-bold" dir="ltr">{fmtNum(now?.followers)}</td>
                      <td className="px-2"><Delta v={mode === "daily" ? dDay : dWeek} /></td>
                      <td className="px-2 font-mono" dir="ltr">{mode === "daily" ? fmtNum(now?.avg_views) : wkPosts}</td>
                      <td className="px-2 font-mono" dir="ltr">{mode === "daily" ? fmtNum(now?.avg_likes) : fmtNum(wkViews || null)}</td>
                      <td className="px-2 font-mono" dir="ltr">{mode === "daily" ? fmtNum(now?.avg_comments) : fmtNum(wkLikes || null)}</td>
                      <td className="px-2 font-mono" dir="ltr">{now?.engagement_rate != null ? `${now.engagement_rate.toFixed(2)}%` : "—"}</td>
                      <td className="px-4">
                        <div className="flex justify-end gap-1">
                          <button className="rounded-lg border border-border px-2 py-1 text-[11px]" onClick={() => setManual({ c, p })}>يدوي</button>
                          <button className="grid h-7 w-7 place-items-center rounded-lg border border-border" onClick={() => setEditing(c)} aria-label="تعديل"><Pencil className="h-3.5 w-3.5" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {competitors.some((c) => c.last_error) && (
              <div className="border-t border-border px-4 py-2 text-[11px] text-amber-400">
                {competitors.filter((c) => c.last_error).map((c) => <p key={c.id}>{c.name}: {c.last_error}</p>)}
              </div>
            )}
          </section>

          <History competitors={competitors} today={today} mode={mode} exact={exact} snapAt={snapAt} postsIn={postsIn} />

          {/* ─── أقوى منشوراتهم هذا الأسبوع ─── */}
          <section className="space-y-2">
            <h2 className="text-sm font-bold">أقوى منشوراتهم آخر ٧ أيام</h2>
            {topPosts.length === 0 ? <p className="text-xs text-muted-foreground">ما فيه منشورات مسحوبة هذا الأسبوع.</p> : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {topPosts.map((x) => <PostCard key={`${x.competitor_id}-${x.post_id}`} x={x} name={nameOf.get(x.competitor_id) ?? ""} />)}
              </div>
            )}
          </section>
        </>
      )}

      {editing && (
        <CompetitorModal initial={editing} onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await load(); }} />
      )}
      {manual && <ManualModal c={manual.c} p={manual.p} onClose={() => setManual(null)} onSaved={async () => { setManual(null); await load(); }} />}
      {openId && (() => {
        const c = competitors.find((x) => x.id === openId);
        return c ? <Detail c={c} today={today} exact={exact} posts={posts.filter((x) => x.competitor_id === c.id)} connected={data.connected}
          syncing={syncing} onSync={() => syncNow(c.id)} onClose={() => setOpenId(null)} /> : null;
      })()}
    </div>
  );
}

type SnapFn = (id: string, p: SocialPlatform, day: string) => CompetitorSnapshot | null;
type PostsFn = (id: string, p: SocialPlatform, from: string, to: string) => CompetitorPost[];

/** جدول المتابعين: آخر ٧ أيام (يومي) أو آخر ٤ أسابيع (أسبوعي). */
function History({ competitors, today, mode, exact, snapAt, postsIn }: {
  competitors: Competitor[]; today: string; mode: "daily" | "weekly"; exact: SnapFn; snapAt: SnapFn; postsIn: PostsFn;
}) {
  const cols = mode === "daily"
    ? Array.from({ length: 7 }, (_, i) => { const d = addDays(today, -6 + i); return { key: d, label: `${Number(d.slice(8))}/${Number(d.slice(5, 7))}`, from: d, to: d }; })
    : Array.from({ length: 4 }, (_, i) => { const to = addDays(today, -7 * (3 - i)); const from = addDays(to, -6); return { key: to, label: i === 3 ? "هذا الأسبوع" : `أسبوع ${Number(from.slice(8))}/${Number(from.slice(5, 7))}`, from, to }; });
  const rows = competitors.filter((c) => c.active).flatMap((c) => (["ig", "tt"] as const).filter((p) => handleOf(c, p)).map((p) => ({ c, p })));
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <h2 className="border-b border-border px-4 py-3 text-sm font-bold">{mode === "daily" ? "نمو المتابعين يومياً — آخر ٧ أيام" : "الأداء الأسبوعي — آخر ٤ أسابيع"}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th className="px-4 py-2 text-start font-bold">الحساب</th>
              {cols.map((c) => <th key={c.key} className="px-2 py-2 text-start font-bold">{c.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, p }) => (
              <tr key={`${c.id}-${p}`} className="border-b border-border last:border-0">
                <td className="px-4 py-2"><b>{c.name}</b> <span className={cn("rounded-md px-1 text-[10px] font-bold", PLAT[p].chip)}>{PLAT[p].label}</span></td>
                {cols.map((col) => {
                  if (mode === "daily") {
                    const s = exact(c.id, p, col.to);
                    const prev = exact(c.id, p, addDays(col.to, -1));
                    const d = s?.followers != null && prev?.followers != null ? s.followers - prev.followers : null;
                    return (
                      <td key={col.key} className="px-2 py-2">
                        <span className="block font-mono font-bold" dir="ltr">{fmtNum(s?.followers)}</span>
                        <Delta v={d} />
                      </td>
                    );
                  }
                  const end = snapAt(c.id, p, col.to), start = snapAt(c.id, p, addDays(col.from, -1));
                  const ps = postsIn(c.id, p, col.from, col.to);
                  const d = end?.followers != null && start?.followers != null ? end.followers - start.followers : null;
                  return (
                    <td key={col.key} className="px-2 py-2 align-top">
                      <span className="block"><Delta v={d} /> <span className="text-muted-foreground">متابع</span></span>
                      <span className="block text-muted-foreground"><b className="font-mono text-foreground">{ps.length}</b> منشور · <b className="font-mono text-foreground" dir="ltr">{fmtNum(sum(ps.map((x) => x.views)) || null)}</b> مشاهدة</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PostCard({ x, name }: { x: CompetitorPost; name: string }) {
  return (
    <a href={x.url ?? "#"} target="_blank" rel="noopener noreferrer" className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="relative aspect-[4/5] bg-black/30">
        {x.thumbnail_url && <img src={x.thumbnail_url} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />}
        <span className={cn("absolute top-2 start-2 rounded-md px-1.5 py-0.5 text-[10px] font-bold", PLAT[x.platform].chip, "bg-black/60")}>{PLAT[x.platform].label}</span>
        <ExternalLink className="absolute top-2 end-2 h-4 w-4 text-white opacity-0 group-hover:opacity-100" />
      </div>
      <div className="space-y-1.5 p-2.5">
        <b className="block truncate text-xs">{name}</b>
        {x.caption && <p className="line-clamp-2 text-[11px] text-muted-foreground">{x.caption}</p>}
        <div className="flex flex-wrap gap-2 text-[11px] text-muted-foreground" dir="ltr">
          {x.views != null && <span className="flex items-center gap-0.5"><Play className="h-3 w-3" />{fmtNum(x.views)}</span>}
          {x.likes != null && <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{fmtNum(x.likes)}</span>}
          {x.comments != null && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{fmtNum(x.comments)}</span>}
        </div>
        {x.posted_at && <span className="block text-[10px] text-muted-foreground">{x.posted_at.slice(0, 10)}</span>}
      </div>
    </a>
  );
}

function Detail({ c, today, exact, posts, connected, syncing, onSync, onClose }: {
  c: Competitor; today: string; exact: SnapFn; posts: CompetitorPost[]; connected: boolean; syncing: boolean; onSync: () => void; onClose: () => void;
}) {
  const plats = (["ig", "tt"] as const).filter((p) => handleOf(c, p));
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, -i));
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60" onClick={onClose}>
      <aside className="h-full w-full max-w-2xl overflow-y-auto border-s border-border bg-background p-5" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{c.name}</h2>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {plats.map((p) => (
                <a key={p} href={PLAT[p].profile(handleOf(c, p)!)} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-1 rounded-md px-2 py-0.5 font-bold", PLAT[p].chip)}>
                  {PLAT[p].label} <span dir="ltr">@{handleOf(c, p)}</span><ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
            {c.note && <p className="mt-2 text-xs text-muted-foreground">{c.note}</p>}
          </div>
          <div className="flex gap-2">
            {connected && <button disabled={syncing} onClick={onSync} className="grid h-8 w-8 place-items-center rounded-lg border border-border" aria-label="سحب الآن"><RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} /></button>}
            <button onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {plats.map((p) => (
          <section key={p} className="mb-6 space-y-3">
            <h3 className="text-sm font-bold">{PLAT[p].label} — آخر ١٤ يوم</h3>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[520px] text-xs">
                <thead className="text-muted-foreground"><tr className="border-b border-border">
                  {["اليوم", "المتابعين", "التغيّر", "المنشورات", "متوسط مشاهدات", "متوسط لايك", "التفاعل"].map((h) => <th key={h} className="px-3 py-2 text-start font-bold">{h}</th>)}
                </tr></thead>
                <tbody>
                  {days.map((d) => {
                    const s = exact(c.id, p, d), prev = exact(c.id, p, addDays(d, -1));
                    return (
                      <tr key={d} className="border-b border-border last:border-0">
                        <td className="px-3 py-1.5 font-mono" dir="ltr">{d.slice(5)}</td>
                        <td className="px-3 font-mono font-bold" dir="ltr">{fmtNum(s?.followers)}</td>
                        <td className="px-3"><Delta v={s?.followers != null && prev?.followers != null ? s.followers - prev.followers : null} /></td>
                        <td className="px-3 font-mono" dir="ltr">{fmtNum(s?.posts_count)}</td>
                        <td className="px-3 font-mono" dir="ltr">{fmtNum(s?.avg_views)}</td>
                        <td className="px-3 font-mono" dir="ltr">{fmtNum(s?.avg_likes)}</td>
                        <td className="px-3 font-mono" dir="ltr">{s?.engagement_rate != null ? `${s.engagement_rate.toFixed(2)}%` : "—"}{s?.source === "manual" && <span className="ms-1 text-[10px] text-amber-400">يدوي</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {posts.filter((x) => x.platform === p).slice(0, 12).map((x) => <PostCard key={x.post_id} x={x} name={c.name} />)}
            </div>
          </section>
        ))}
      </aside>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl border border-border bg-card p-5 sm:rounded-2xl" dir="rtl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="إغلاق"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CompetitorModal({ initial, onClose, onSaved }: { initial: Partial<Competitor>; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ name: initial.name ?? "", ig: initial.ig_username ?? "", tt: initial.tt_username ?? "", note: initial.note ?? "", active: initial.active !== false });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const run = async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try { await api(body); onSaved(); } catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  return (
    <Modal title={initial.id ? "تعديل منافس" : "إضافة منافس"} onClose={onClose}>
      <div className="space-y-3">
        <label className="block space-y-1 text-xs font-bold">الاسم<input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="اسم المنافس" /></label>
        <label className="block space-y-1 text-xs font-bold">حساب انستقرام<input className={inputCls} dir="ltr" value={f.ig} onChange={(e) => setF({ ...f, ig: e.target.value })} placeholder="@username أو الرابط" /></label>
        <label className="block space-y-1 text-xs font-bold">حساب تيك توك<input className={inputCls} dir="ltr" value={f.tt} onChange={(e) => setF({ ...f, tt: e.target.value })} placeholder="@username أو الرابط" /></label>
        <label className="block space-y-1 text-xs font-bold">ملاحظة<textarea className={inputCls} rows={2} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> متابعة يومية (السحب التلقائي)</label>
        {err && <p className="text-sm text-red-400">{err}</p>}
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => run({ action: "save", id: initial.id, name: f.name, ig_username: f.ig, tt_username: f.tt, note: f.note, active: f.active })}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan py-2.5 text-sm font-extrabold text-[#07090F] disabled:opacity-60">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}{busy && !initial.id ? "جاري الحفظ وأول سحب…" : "حفظ"}
          </button>
          {initial.id && (
            <button disabled={busy} onClick={() => confirm("حذف المنافس وكل أرقامه؟") && run({ action: "delete", id: initial.id })}
              className="flex items-center gap-1 rounded-xl border border-red-500/40 px-4 text-sm font-bold text-red-400"><Trash2 className="h-4 w-4" /> حذف</button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function ManualModal({ c, p, onClose, onSaved }: { c: Competitor; p: SocialPlatform; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ followers: "", posts_count: "", avg_views: "", avg_likes: "", avg_comments: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fields: [keyof typeof f, string][] = [["followers", "المتابعين"], ["posts_count", "عدد المنشورات"], ["avg_views", "متوسط المشاهدات"], ["avg_likes", "متوسط اللايكات"], ["avg_comments", "متوسط التعليقات"]];
  return (
    <Modal title={`أرقام اليوم — ${c.name} (${PLAT[p].label})`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([k, l]) => (
          <label key={k} className={cn("space-y-1 text-xs font-bold", k === "followers" && "col-span-2")}>{l}
            <input className={inputCls} inputMode="numeric" dir="ltr" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value.replace(/\D/g, "") })} />
          </label>
        ))}
      </div>
      {err && <p className="mt-3 text-sm text-red-400">{err}</p>}
      <button disabled={busy} className="mt-4 w-full rounded-xl bg-cyan py-2.5 text-sm font-extrabold text-[#07090F] disabled:opacity-60"
        onClick={async () => { setBusy(true); setErr(null); try { await api({ action: "manual", id: c.id, platform: p, ...f }); onSaved(); } catch (e) { setErr((e as Error).message); setBusy(false); } }}>
        حفظ أرقام اليوم
      </button>
    </Modal>
  );
}
