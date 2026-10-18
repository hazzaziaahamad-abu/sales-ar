"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { createClient } from "@/lib/supabase/client";
import { DEFAULT_SHOWCASE_PACKAGES, SHOWCASE_SLIDES, type ShowcasePackage } from "@/lib/showcase";
import { PackagesEditor } from "./PackagesEditor";
import s from "./showcase.module.css";

const TOTAL = SHOWCASE_SLIDES.length + 1; // + شريحة الباقات
const pad = (n: number) => String(n).padStart(2, "0");
const noSubscribe = () => () => {};

const Chevron = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

const Check = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);

export default function ShowcaseView() {
  const { user, loading, activeOrgId, isImpersonating } = useAuth();
  const router = useRouter();
  const trackRef = useRef<HTMLElement>(null);
  const editBtnRef = useRef<HTMLButtonElement>(null);
  const [cur, setCur] = useState(0);
  const fsEnabled = useSyncExternalStore(noSubscribe, () => !!document.fullscreenEnabled, () => false);
  const [fsFailed, setFsFailed] = useState(false);
  const [packages, setPackages] = useState<ShowcasePackage[]>(DEFAULT_SHOWCASE_PACKAGES);
  const [canEdit, setCanEdit] = useState(false);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const ready = !loading && !!user;

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // الباقات من السيرفر + هل المستخدم مدير
  useEffect(() => {
    if (!user || !activeOrgId) return;
    let cancelled = false;
    fetch(`/api/showcase-packages?org=${encodeURIComponent(activeOrgId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        if (Array.isArray(d.packages)) setPackages(d.packages);
        setCanEdit(d.canEdit === true);
        setOrgId(d.orgId);
      })
      .catch(console.error);
    return () => { cancelled = true; };
  }, [user, activeOrgId]);

  // تحديث مباشر: أي حفظ من المدير يوصل لكل من فاتح الصفحة
  useEffect(() => {
    if (!orgId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`showcase-packages-${orgId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "showcase_packages", filter: `org_id=eq.${orgId}` },
        (payload) => {
          const next = (payload.new as { packages?: unknown })?.packages;
          if (Array.isArray(next)) setPackages(next as ShowcasePackage[]);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [orgId]);

  // الشريحة الحالية
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting && e.intersectionRatio > 0.6) setCur(Number((e.target as HTMLElement).dataset.i));
      }),
      { root: track, threshold: [0.6] }
    );
    Array.from(track.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [ready]);

  const go = useCallback((i: number) => {
    const track = trackRef.current;
    const target = track?.children[Math.max(0, Math.min(TOTAL - 1, i))];
    if (!target) return;
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
  }, []);

  // أسهم الكيبورد (معكوسة بسبب RTL)
  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      if (e.key === "ArrowLeft") { e.preventDefault(); go(cur + 1); }
      if (e.key === "ArrowRight") { e.preventDefault(); go(cur - 1); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [cur, go, editing]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setFsFailed(true);
    }
  };

  const closeEditor = useCallback(() => {
    setEditing(false);
    requestAnimationFrame(() => editBtnRef.current?.focus());
  }, []);

  if (!ready) return <div className={s.app} />;

  const showEdit = canEdit && !isImpersonating && !!orgId;

  return (
    <div className={s.app} dir="rtl">
      <header className={s.header}>
        <div className={s.brand}>
          <span className={s.logo} aria-hidden="true"><i /><i /><i /><i /></span>
          قائمة الطلبات <small>MENU</small>
        </div>
        <div className={s.tools}>
          <div className={s.count} aria-live="polite"><b>{pad(cur + 1)}</b> / {pad(TOTAL)}</div>
          {fsEnabled && !fsFailed && (
            <button type="button" className={`${s.nav} ${s.sm}`} onClick={toggleFullscreen} aria-label="ملء الشاشة" title="ملء الشاشة">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
              </svg>
            </button>
          )}
        </div>
      </header>

      <main ref={trackRef} className={s.track} tabIndex={0} aria-label="شاشات النظام">
        {SHOWCASE_SLIDES.map((slide, i) => (
          <section key={slide.image} className={s.slide} data-i={i} aria-label={`شاشة ${i + 1} من ${TOTAL}`}>
            <div className={slide.frame === "tablet" ? s.tablet : slide.frame === "phone" ? s.phone : s.devices}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slide.image} alt={slide.title} loading={i < 2 ? "eager" : "lazy"} decoding="async" />
            </div>
            <div className={s.cap}>
              <h2>{slide.title}</h2>
              {slide.note && <span className={s.note}>{slide.note}</span>}
              <p>{slide.description}</p>
            </div>
          </section>
        ))}

        <section className={`${s.slide} ${s.pkSlide}`} data-i={TOTAL - 1} aria-label={`شاشة ${TOTAL} من ${TOTAL}`}>
          <div className={s.pkHead}>
            <h2>الباقات</h2>
            {showEdit && (
              <button ref={editBtnRef} type="button" className={s.pkEdit} onClick={() => setEditing(true)}>
                تعديل الباقات
              </button>
            )}
          </div>
          <div className={s.pkGrid}>
            {packages.map((p, i) => (
              <article key={`${p.name}-${i}`} className={`${s.pkCard} ${p.featured ? s.featured : ""}`}>
                {p.featured && <span className={s.pkBadge}>الأكثر طلباً</span>}
                <h3 className={s.pkName}>{p.name}</h3>
                <div className={s.pkPrice}>
                  <span className={s.num}>{p.price}</span>
                  <span className={s.per}>{p.period}</span>
                </div>
                <ul className={s.pkList}>
                  {p.features.map((f, j) => (
                    <li key={j}><span className={s.ic}><Check /></span><span>{f}</span></li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>
      </main>

      <div className={s.controls}>
        <button type="button" className={s.nav} onClick={() => go(cur - 1)} disabled={cur === 0} aria-label="السابق">
          <Chevron d="M9 6l6 6-6 6" />
        </button>
        <div className={s.dots}>
          {Array.from({ length: TOTAL }, (_, i) => (
            <button
              key={i}
              type="button"
              className={s.dot}
              aria-label={`انتقل إلى الشاشة ${i + 1}`}
              aria-current={i === cur}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <button type="button" className={s.nav} onClick={() => go(cur + 1)} disabled={cur === TOTAL - 1} aria-label="التالي">
          <Chevron d="M15 6l-6 6 6 6" />
        </button>
      </div>
      <div className={s.hint}>اسحب أو استخدم الأسهم للتنقل · زر ملء الشاشة مناسب لمشاركة الشاشة في الاتصال</div>

      {editing && orgId && (
        <PackagesEditor
          initial={packages}
          orgId={orgId}
          onClose={closeEditor}
          onSaved={(next) => { setPackages(next); closeEditor(); }}
        />
      )}
    </div>
  );
}
