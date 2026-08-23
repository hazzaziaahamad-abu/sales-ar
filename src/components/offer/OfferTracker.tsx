"use client";

import { useEffect, useRef } from "react";

export default function OfferTracker({ page }: { page: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    let ref: string | null = null;
    try {
      ref = new URLSearchParams(window.location.search).get("ref");
    } catch { /* ignore */ }
    fetch("/api/offer/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "visit", page, ref, referrer: document.referrer }),
      keepalive: true,
    }).catch(() => { /* never break the page */ });
  }, [page]);
  return null;
}
