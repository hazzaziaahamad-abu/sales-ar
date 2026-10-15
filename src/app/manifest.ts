import type { MetadataRoute } from "next";

/** تثبيت المنصة على الجوال كتطبيق (PWA) — بدون تخزين مؤقت للبيانات حتى ما تطلع قديمة. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CommandCenter — لوحة التحكم",
    short_name: "CommandCenter",
    description: "منصة إدارة المبيعات والدعم",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0C1220",
    theme_color: "#0C1220",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
