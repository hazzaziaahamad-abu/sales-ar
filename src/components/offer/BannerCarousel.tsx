"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type OfferBanner = { src: string; alt?: string; href?: string };

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
    </section>
  );
}
