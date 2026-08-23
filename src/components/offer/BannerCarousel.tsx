"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, HelpCircle } from "lucide-react";

export type OfferFaq = { q: string; a: string };
export type OfferBanner = { src: string; alt?: string; href?: string; faq?: OfferFaq[] };

export default function BannerCarousel({ banners, accent = "#6D28D9" }: { banners: OfferBanner[]; accent?: string }) {
  const count = banners.length;
  const [idx, setIdx] = useState(0);
  const go = useCallback((n: number) => setIdx((n + count) % count), [count]);

  useEffect(() => {
    if (count <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % count), 5000);
    return () => clearInterval(t);
  }, [count]);

  if (count === 0) return null;

  const b = banners[idx];
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={b.src}
      alt={b.alt || "إعلان"}
      className="mx-auto max-h-[72vh] w-auto rounded-3xl object-contain sm:max-h-[600px]"
      style={{ boxShadow: "0 22px 48px -22px rgba(64,51,43,.5)" }}
    />
  );

  return (
    <section className="mx-auto max-w-3xl px-4 pt-6">
      <div className="relative">
        {b.href ? (
          <a href={b.href} target="_blank" rel="noopener noreferrer">{img}</a>
        ) : (
          img
        )}

        {count > 1 && (
          <>
            <button
              onClick={() => go(idx - 1)}
              aria-label="الإعلان السابق"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#40332b] shadow-md transition hover:scale-105"
              style={{ backgroundColor: "rgba(255,255,255,.85)", backdropFilter: "blur(4px)" }}
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={() => go(idx + 1)}
              aria-label="الإعلان التالي"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#40332b] shadow-md transition hover:scale-105"
              style={{ backgroundColor: "rgba(255,255,255,.85)", backdropFilter: "blur(4px)" }}
            >
              <ChevronLeft size={20} />
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {banners.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`الإعلان ${i + 1}`}
              className="h-2 rounded-full transition-all"
              style={{ width: i === idx ? 24 : 8, backgroundColor: i === idx ? accent : "#d9ccbf" }}
            />
          ))}
        </div>
      )}

      {/* نبذة سؤال وجواب عن الميزة وفائدتها لصاحب المحل */}
      {b.faq && b.faq.length > 0 && (
        <div className="mx-auto mt-6 max-w-2xl">
          <div className="mb-3 flex items-center justify-center gap-2">
            <HelpCircle size={18} style={{ color: accent }} />
            <h3 className="text-base font-black" style={{ color: "#2b2620" }}>نبذة سريعة — سؤال وجواب</h3>
          </div>
          <div className="space-y-2.5">
            {b.faq.map((f, i) => (
              <div key={i} className="rounded-2xl p-4 text-right" style={{ backgroundColor: "#fff", border: "1px solid #ece1d3", boxShadow: "0 8px 20px -18px rgba(64,51,43,.4)" }}>
                <p className="mb-1.5 flex items-start gap-2 text-sm font-black leading-relaxed" style={{ color: accent }}>
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white"
                    style={{ backgroundColor: accent }}
                  >
                    س
                  </span>
                  {f.q}
                </p>
                <p className="pr-7 text-sm leading-relaxed" style={{ color: "#5a4a40" }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
